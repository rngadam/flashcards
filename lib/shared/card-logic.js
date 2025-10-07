/**
 * @file Contains the core logic for the flashcard application.
 * This includes displaying cards, handling user interactions (flipping, marking known/unknown),
 * implementing the spaced repetition algorithm, and managing card state.
 */

import { transformSlashText } from '../string-utils.js';
import { VERIFICATION_METHODS } from '../skill-utils.js';

// Dependencies to be injected
let state;
let updateState;
let showTopNotification;
let startVoiceRecognition;
let stopVoiceRecognition;
let speak;
let generateMultipleChoiceOptions;
let syncToServer;
let getActiveSkills;
let popFromViewHistory;
let getCardStats;
let setCardStats;


export function initCardLogic(dependencies) {
    state = dependencies.state;
    updateState = dependencies.updateState;
    showTopNotification = dependencies.showTopNotification;
    startVoiceRecognition = dependencies.startVoiceRecognition;
    stopVoiceRecognition = dependencies.stopVoiceRecognition;
    speak = dependencies.speak;
    generateMultipleChoiceOptions = dependencies.generateMultipleChoiceOptions;
    syncToServer = dependencies.syncToServer;
    getActiveSkills = dependencies.getActiveSkills;
    popFromViewHistory = dependencies.popFromViewHistory;
    getCardStats = dependencies.getCardStats;
    setCardStats = dependencies.setCardStats;
}


export function getCardKey(card) {
    const currentConfig = state.configs[state.currentConfig];
    if (!currentConfig || !currentConfig.roleToColumnMap) {
        return null;
    }
    const keyIndices = currentConfig.roleToColumnMap['TARGET_LANGUAGE'] || [];
    if (keyIndices.length !== 1) {
        return null;
    }
    const keyIndex = keyIndices[0];
    if (!card || !Array.isArray(card) || keyIndex >= card.length || !card[keyIndex] || typeof card[keyIndex] !== 'string' || card[keyIndex].trim() === '') {
        return null;
    }
    return card[keyIndex].trim();
}

export function getRetentionScore(skillStats) {
    if (!skillStats || typeof skillStats !== 'object') {
        return 0;
    }
    return (skillStats.successTimestamps?.length || 0) - (skillStats.failureTimestamps?.length || 0);
}

export function createDefaultSkillStats() {
    return {
        successTimestamps: [],
        failureTimestamps: [],
        responseDelays: [],
        lastViewed: null,
        intervalIndex: 0,
        viewCount: 0
    };
}

export async function getSanitizedStats(cardKey) {
    let cardStats = await getCardStats(cardKey);
    if (!cardStats || typeof cardStats !== 'object' || !cardStats.skills) {
        cardStats = { skills: {} };
    }
    const currentConfig = state.configs[state.currentConfig];
    const userSkills = (currentConfig && currentConfig.skills) ? currentConfig.skills : [];
    if (userSkills.length > 0) {
        userSkills.forEach(skill => {
            if (!cardStats.skills[skill.id]) {
                cardStats.skills[skill.id] = createDefaultSkillStats();
            }
        });
    }
    return cardStats;
}

export async function getAllCardStats() {
    const promises = state.cardData.map(card => getSanitizedStats(getCardKey(card)));
    return Promise.all(promises);
}

export async function markCardAsKnown(known) {
    const cardKey = getCardKey(state.cardData[state.currentCardIndex]);
    const cardStats = await getSanitizedStats(cardKey);
    const skillStats = cardStats.skills[state.currentSkillId];

    if (!skillStats) {
        console.error(`Could not find stats for skill ${state.currentSkillId} on card ${cardKey}.`);
        return;
    }

    if (state.cardShownTimestamp) {
        const delay = Date.now() - state.cardShownTimestamp;
        skillStats.responseDelays = skillStats.responseDelays || [];
        skillStats.responseDelays.push(delay);
    }

    if (known) {
        const currentScore = getRetentionScore(skillStats);
        skillStats.successTimestamps.push(Date.now());
        if (currentScore < 0) {
            const failuresToRemove = skillStats.failureTimestamps.length - skillStats.successTimestamps.length;
            if (failuresToRemove > 0) {
                skillStats.failureTimestamps.splice(0, failuresToRemove);
            }
        }
        if (state.isCurrentCardDue && skillStats.intervalIndex < state.repetitionIntervals.length - 1) {
            skillStats.intervalIndex++;
        }
    } else {
        skillStats.failureTimestamps.push(Date.now());
        skillStats.intervalIndex = 0;
    }
    await saveCardStats(cardKey, cardStats);
}

export function getTimeToDue(skillStats, now = Date.now()) {
    if (!skillStats.lastViewed) {
        return { ms: -1 };
    }
    const intervalSeconds = state.repetitionIntervals[skillStats.intervalIndex];
    if (intervalSeconds === undefined) {
        return { ms: Infinity };
    }
    const dueDate = skillStats.lastViewed + (intervalSeconds * 1000);
    const timeToDueMs = dueDate - now;
    return {
        ms: timeToDueMs,
    };
}

export function getCurrentSkillConfig() {
    const currentConfig = state.configs[state.currentConfig];
    if (!currentConfig || !currentConfig.skills || !state.currentSkillId) {
        return null;
    }
    const skillConfig = currentConfig.skills.find(s => s.id === state.currentSkillId);
    if (!skillConfig && currentConfig.skills.length > 0) {
        return currentConfig.skills[0];
    }
    return skillConfig;
}

export async function getTextForRoles(roles, side, baseLanguageIndex = -1) {
    const currentConfig = state.configs[state.currentConfig];
    if (!currentConfig || !currentConfig.roleToColumnMap) return [];
    const currentCard = state.cardData[state.currentCardIndex];
    if (!currentCard) return [];
    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) return [];

    const getRawTextForRole = (role) => {
        const indices = currentConfig.roleToColumnMap[role] || [];
        if (indices.length > 0) {
            return currentCard[indices[0]];
        }
        return null;
    };

    const textParts = [];
    for (const roleKey of roles) {
        const transform = skillConfig.transforms?.[side]?.[roleKey];

        let columnIndices = (roleKey === 'BASE_LANGUAGE' && baseLanguageIndex !== -1)
            ? [baseLanguageIndex]
            : (currentConfig.roleToColumnMap[roleKey] || []);

        for (const colIndex of columnIndices) {
            let cellText = currentCard[colIndex];
            if (!cellText) continue;

            // Apply skill-affecting transforms
            if (transform) {
                let stringToHide = null;
                if (transform.hideString && transform.hideStringColumn && transform.hideStringColumn !== 'none') {
                    stringToHide = getRawTextForRole(transform.hideStringColumn);
                }

                if (transform.suppressParentheses) {
                    cellText = cellText.replace(/\(.*?\)/g, ' ').trim();
                    if (stringToHide) {
                        stringToHide = stringToHide.replace(/\(.*?\)/g, ' ').trim();
                    }
                }

                if (stringToHide) {
                    const trimmedStringToHide = stringToHide.trim();
                    if (trimmedStringToHide) {
                        const regex = new RegExp(trimmedStringToHide.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        cellText = cellText.replace(regex, '█'.repeat(trimmedStringToHide.length));
                    }
                }
            }

            if (roleKey === 'RELATED_WORD') {
                const relatedWords = [...new Set(cellText.split(',').map(w => w.trim()).filter(Boolean))];
                if (relatedWords.length > 0) {
                    textParts.push({ text: transformSlashText(relatedWords.join(', ')), role: roleKey });
                }
            } else {
                textParts.push({ text: transformSlashText(cellText), role: roleKey });
            }
        }
    }
    return textParts;
}

export async function displayCard(index, { reason = {} } = {}) {
    if (state.cardData.length === 0 || index < 0 || index >= state.cardData.length) return null;

    updateState({ isCurrentCardDue: reason.type === 'due_review' });

    const cardKey = getCardKey(state.cardData[index]);
    const stats = await getSanitizedStats(cardKey);

    updateState({ currentCardIndex: index, replayRate: 1.0 });

    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) {
        console.error('No skill config found for displayCard. Aborting.');
        return null;
    }

    const currentSkillStats = stats.skills[state.currentSkillId] || createDefaultSkillStats();
    const previousLastViewed = currentSkillStats.lastViewed;
    currentSkillStats.viewCount++;
    currentSkillStats.lastViewed = Date.now();

    const baseLangIndices = (state.configs[state.currentConfig] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
    let newRandomBaseIndex = -1;
    if (baseLangIndices.length > 1) {
        newRandomBaseIndex = baseLangIndices[state.baseLanguageRotationIndex % baseLangIndices.length];
    } else if (baseLangIndices.length === 1) {
        newRandomBaseIndex = baseLangIndices[0];
    }
    updateState({ currentRandomBaseIndex: newRandomBaseIndex });

    const frontRoles = skillConfig.front || [];
    const backRoles = skillConfig.back || [];
    const ttsFrontRole = skillConfig.ttsFrontColumn ? [skillConfig.ttsFrontColumn] : [];
    const ttsBackRole = skillConfig.ttsBackColumn ? [skillConfig.ttsBackColumn] : [];

    const newFrontParts = await getTextForRoles(frontRoles, 'front', state.currentRandomBaseIndex);
    const newBackParts = await getTextForRoles(backRoles, 'back', state.currentRandomBaseIndex);
    const newTtsFrontParts = await getTextForRoles(ttsFrontRole, 'front', state.currentRandomBaseIndex);
    const newTtsBackParts = await getTextForRoles(ttsBackRole, 'back', state.currentRandomBaseIndex);
    updateState({ frontParts: newFrontParts, backParts: newBackParts, ttsFrontParts: newTtsFrontParts, ttsBackParts: newTtsBackParts });

    const hasAlternateCasing = Object.values(skillConfig.transforms?.front || {}).some(t => t.casing === 'alternate');
    if (hasAlternateCasing) {
        updateState({ useUppercase: !state.useUppercase });
    }

    const autoPlayTts = !skillConfig.ttsOnHotkeyOnly;
    const ttsRole = skillConfig.ttsFrontColumn;
    const textToSpeak = newTtsFrontParts.map(p => p.text).join(' ');

    const startRecognitionCallback = () => {
        if (skillConfig.verificationMethod === VERIFICATION_METHODS.VOICE) {
            startVoiceRecognition();
        }
    };

    if (autoPlayTts && textToSpeak) {
        speak(textToSpeak, { ttsRole, onEndCallback: startRecognitionCallback });
    } else {
        startRecognitionCallback();
    }

    stopVoiceRecognition();
    await saveCardStats(cardKey, stats);
    updateState({ cardShownTimestamp: Date.now() });

    return {
        stats,
        previousLastViewed,
        reason,
        skillConfig
    };
}

export async function flipCard() {
    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) return null;

    const isFlippingToFront = state.isFlipped;
    updateState({ isFlipped: !isFlippingToFront });

    if (isFlippingToFront) {
        updateState({ baseLanguageRotationIndex: state.baseLanguageRotationIndex + 1 });
        const baseLangIndices = (state.configs[state.currentConfig] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
        if (baseLangIndices.length > 1) {
            updateState({ currentRandomBaseIndex: baseLangIndices[state.baseLanguageRotationIndex % baseLangIndices.length] });
        }

        const frontRoles = skillConfig.front || [];
        const backRoles = skillConfig.back || [];
        const newFrontParts = await getTextForRoles(frontRoles, 'front', state.currentRandomBaseIndex);
        const newBackParts = await getTextForRoles(backRoles, 'back', state.currentRandomBaseIndex);
        updateState({ frontParts: newFrontParts, backParts: newBackParts });

    }

    if (skillConfig.ttsOnHotkeyOnly) return { skillConfig };

    if (state.isFlipped) {
        const ttsRole = skillConfig.ttsBackColumn;
        const textToSpeak = state.ttsBackParts.map(p => p.text).join(' ');
        speak(textToSpeak, { ttsRole });
    } else {
        const ttsRole = skillConfig.ttsFrontColumn;
        const textToSpeak = state.ttsFrontParts.map(p => p.text).join(' ');
        speak(textToSpeak, { ttsRole });
    }
    return { skillConfig };
}


function findNextCardFromList(items, { forceNew = false, now = Date.now(), allCardStats = [], userSkills = [], isFiltered = false } = {}) {
    if (items.length === 0) return null;

    const dueItems = items.filter(item => {
        if (!item.skillStats.lastViewed) return false;
        const intervalSeconds = state.repetitionIntervals[item.skillStats.intervalIndex];
        return intervalSeconds !== undefined && (now - item.skillStats.lastViewed > intervalSeconds * 1000);
    });

    if (dueItems.length > 0) {
        dueItems.sort((a, b) => getRetentionScore(a.skillStats) - getRetentionScore(b.skillStats));
        let nextItem = dueItems[0];
        if (forceNew && nextItem.cardIndex === state.currentCardIndex && nextItem.skillId === state.currentSkillId && dueItems.length > 1) {
            nextItem = dueItems[1];
        }
        const reason = { type: 'due_review', expiredInterval: state.repetitionIntervals[nextItem.skillStats.intervalIndex], nextInterval: state.repetitionIntervals[nextItem.skillStats.intervalIndex + 1] || 0, isFiltered };
        return { nextItem, reason };
    }

    const unseenItems = items.filter(item => item.skillStats.viewCount === 0);
    if (unseenItems.length > 0) {
        const skillOrderMap = new Map(userSkills.map((skill, index) => [skill.id, index]));
        const bridgingItems = [];
        const trulyNewItems = [];

        unseenItems.forEach(item => {
            const cardStats = allCardStats[item.cardIndex];
            const currentSkillOrder = skillOrderMap.get(item.skillId);
            let seenInPreviousSkill = false;
            if (currentSkillOrder > 0) {
                for (const [skillId, stats] of Object.entries(cardStats.skills)) {
                    const skillIdx = skillOrderMap.get(skillId);
                    if (skillIdx !== undefined && skillIdx < currentSkillOrder && stats.viewCount > 0) {
                        seenInPreviousSkill = true;
                        break;
                    }
                }
            }
            if (seenInPreviousSkill) bridgingItems.push(item);
            else trulyNewItems.push(item);
        });

        if (bridgingItems.length > 0) {
            bridgingItems.sort((a, b) => {
                const orderA = skillOrderMap.get(a.skillId);
                const orderB = skillOrderMap.get(b.skillId);
                if (orderA !== orderB) return orderA - orderB;
                const totalScoreA = Object.values(allCardStats[a.cardIndex].skills).reduce((sum, s) => sum + getRetentionScore(s), 0);
                const totalScoreB = Object.values(allCardStats[b.cardIndex].skills).reduce((sum, s) => sum + getRetentionScore(s), 0);
                return totalScoreA - totalScoreB;
            });
            return { nextItem: bridgingItems[0], reason: { type: 'bridging_card', isFiltered } };
        }
        if (trulyNewItems.length > 0) {
            const nextItem = trulyNewItems[Math.floor(Math.random() * trulyNewItems.length)];
            return { nextItem, reason: { type: 'new_card', isFiltered } };
        }
    }

    let reasonForDisplay;
    const allSkillsLearned = items.every(item => getRetentionScore(item.skillStats) > 0);
    if (allSkillsLearned) {
        let minTimeToDue = Infinity, maxTimeToDue = 0;
        items.forEach(item => {
            const timeToDue = getTimeToDue(item.skillStats, now).ms;
            if (timeToDue > 0 && timeToDue < minTimeToDue) minTimeToDue = timeToDue;
            if (timeToDue > maxTimeToDue) maxTimeToDue = timeToDue;
        });
        reasonForDisplay = { type: 'deck_learned', timeToNextReview: minTimeToDue, timeToLastReview: maxTimeToDue, isFiltered };
    } else {
        reasonForDisplay = { type: 'least_learned', isFiltered };
    }

    let candidateItems = [...items];
    if (forceNew && candidateItems.length > 1) {
        candidateItems = candidateItems.filter(item => item.cardIndex !== state.currentCardIndex || item.skillId !== state.currentSkillId);
    }
    if (candidateItems.length === 0) candidateItems = [...items];

    candidateItems.sort((a, b) => {
        const scoreA = getRetentionScore(a.skillStats);
        const scoreB = getRetentionScore(b.skillStats);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (a.skillStats.lastViewed || 0) - (b.skillStats.lastViewed || 0);
    });

    const nextItem = candidateItems[0];
    return { nextItem, reason: reasonForDisplay };
}

export async function showNextCard({ forceNew = false, now = Date.now() } = {}) {
    if (state.cardData.length === 0) return null;

    const currentConfig = state.configs[state.currentConfig];
    const activeSkills = getActiveSkills();
    const userSkills = currentConfig ? currentConfig.skills : [];

    if (activeSkills.length === 0) {
        showTopNotification('No active skills. Please select skills to practice in Settings.', 'error');
        return null;
    }

    const allCardStats = await getAllCardStats();
    let allReviewableItems = [];
    allCardStats.forEach((cardStats, cardIndex) => {
        activeSkills.forEach(skillId => {
            allReviewableItems.push({
                cardIndex,
                skillId,
                skillStats: cardStats.skills[skillId] || createDefaultSkillStats()
            });
        });
    });

    if (allReviewableItems.length === 0) {
        showTopNotification('No cards to display.', 'error');
        return null;
    }

    let itemsToSelectFrom = allReviewableItems;
    let isFiltered = currentConfig.filterIsEnabled && state.activeFilterWords.size > 0;
    if (isFiltered) {
        const keyIndices = (currentConfig.roleToColumnMap || {})['TARGET_LANGUAGE'] || [];
        if (keyIndices.length === 1) {
            const keyIndex = keyIndices[0];
            const filteredItems = allReviewableItems.filter(item => {
                const cardText = state.cardData[item.cardIndex][keyIndex]?.toLowerCase();
                if (!cardText) return false;
                const cardWords = cardText.match(/[\p{L}\p{N}]+/gu) || [];
                return cardWords.some(word => state.activeFilterWords.has(word));
            });
            if (filteredItems.length > 0) itemsToSelectFrom = filteredItems;
            else {
                showTopNotification('No matching cards for the current filter.', 'error');
                return null;
            }
        }
    }

    const findNextCardOptions = { forceNew, now, allCardStats, userSkills, isFiltered };
    let result = findNextCardFromList(itemsToSelectFrom, findNextCardOptions);

    const filteredDeckIsLearned = isFiltered && result && result.reason.type === 'deck_learned';
    if (isFiltered) {
        // updateFilterState(filteredDeckIsLearned ? 'learned' : 'learning');
    } else {
        // updateFilterState('off');
    }

    if (filteredDeckIsLearned && currentConfig.filterAllowOverflow) {
        result = findNextCardFromList(allReviewableItems, { ...findNextCardOptions, isFiltered: false }) || result;
    }


    if (result) {
        const { nextItem, reason } = result;
        // Save the state of the card we are navigating AWAY FROM.
        if (state.currentCardIndex >= 0 && state.currentSkillId != null) {
            updateState({ viewHistory: [...state.viewHistory, { cardIndex: state.currentCardIndex, skillId: state.currentSkillId }] });
        }
        updateState({ currentCardIndex: nextItem.cardIndex, currentSkillId: nextItem.skillId });
        return await displayCard(nextItem.cardIndex, { reason });
    } else {
        const message = isFiltered ? 'You have learned all cards in the filtered set!' : 'You have learned all cards in the deck!';
        showTopNotification(message, 'success');
        return null;
    }
}


export async function showPrevCard() {
    const { lastState, newHistory } = popFromViewHistory();
    if (lastState) {
        updateState({ viewHistory: newHistory, currentSkillId: lastState.skillId });
        return await displayCard(lastState.cardIndex);
    }
    return null;
}

export async function saveCardStats(cardKey, stats) {
    if (!cardKey || !stats) return;
    await setCardStats(cardKey, stats);
    await syncToServer({ cardStats: { [cardKey]: stats } });
}