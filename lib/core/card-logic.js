/**
 * @file Contains the core logic for the flashcard application.
 * This includes displaying cards, handling user interactions (flipping, marking known/unknown),
 * implementing the spaced repetition algorithm, and managing card state.
 */

import { get, set } from '../idb-keyval-wrapper.js';
import { transformSlashText } from '../string-utils.js';
import { VERIFICATION_METHODS } from '../skill-utils.js';
import { formatTimeAgo, formatDuration, formatTimeDifference, adjustFontSize } from '../ui/ui-helpers.js';

// Dependencies to be injected
let dom;
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

export function initCardLogic(dependencies) {
    dom = dependencies.dom;
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
}


export function getCardKey(card) {
    const currentConfig = state.configs[dom.configSelector.value];
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
    let cardStats = await get(cardKey);
    if (!cardStats || typeof cardStats !== 'object' || !cardStats.skills) {
        cardStats = { skills: {} };
    }
    const currentConfig = state.configs[dom.configSelector.value];
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
        return { ms: -1, formatted: 'N/A' };
    }
    const intervalSeconds = state.repetitionIntervals[skillStats.intervalIndex];
    if (intervalSeconds === undefined) {
        return { ms: Infinity, formatted: 'Learned' };
    }
    const dueDate = skillStats.lastViewed + (intervalSeconds * 1000);
    const timeToDueMs = dueDate - now;
    return {
        ms: timeToDueMs,
        formatted: formatTimeDifference(timeToDueMs)
    };
}

export function getCurrentSkillConfig() {
    const currentConfig = state.configs[dom.configSelector.value];
    if (!currentConfig || !currentConfig.skills || !state.currentSkillId) {
        return null;
    }
    const skillConfig = currentConfig.skills.find(s => s.id === state.currentSkillId);
    if (!skillConfig && currentConfig.skills.length > 0) {
        return currentConfig.skills[0];
    }
    return skillConfig;
}

export function isAudioOnly(skillConfig) {
    return skillConfig && skillConfig.front.length === 0 && skillConfig.ttsFrontColumn && skillConfig.ttsFrontColumn !== 'none';
}

export async function getTextForRoles(roles, side, baseLanguageIndex = -1) {
    const currentConfig = state.configs[dom.configSelector.value];
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

export function renderSkillMastery(cardStats) {
    if (!dom.skillMasteryDashboard) return;

    const currentConfig = state.configs[dom.configSelector.value] || {};
    const userSkills = currentConfig.skills || [];
    const activeSkills = new Set(currentConfig.activeSkills || []);

    let html = '';
    userSkills.forEach((skill, index) => {
        const skillStats = cardStats.skills[skill.id] || createDefaultSkillStats();
        const score = getRetentionScore(skillStats);
        const timeToDue = getTimeToDue(skillStats);
        const letter = String.fromCharCode(65 + index);

        let classes = 'skill-mastery-item';
        if (skill.id === state.currentSkillId) classes += ' active';
        if (activeSkills.has(skill.id)) classes += ' active-session';

        html += `
            <div class="${classes}" data-skill-id="${skill.id}" title="${skill.name} - Next review: ${timeToDue.formatted}">
                <span class="skill-name">${letter}</span>
                <span class="skill-score">${score}</span>
            </div>
        `;
    });

    dom.skillMasteryDashboard.innerHTML = html;
    dom.skillMasteryDashboard.title = 'Click to configure skills';
}

/**
 * Renders the content of the front and back faces of the card.
 * @param {Array<object>} frontParts - The parts for the front of the card.
 * @param {Array<object>} backParts - The parts for the back of the card.
 * @param {object} skillConfig - The configuration for the current skill.
 */
function renderCardFaces(frontParts, backParts, skillConfig) {
    dom.cardFrontContent.innerHTML = '';
    dom.cardBackContent.innerHTML = '';

    const applyTransforms = (part, side) => {
        const transform = skillConfig.transforms?.[side]?.[part.role];
        let text = part.text;
        if (transform) {
            let casing = transform.casing;
            if (casing === 'random') {
                const options = ['uppercase', 'lowercase', 'initial'];
                casing = options[Math.floor(Math.random() * options.length)];
            }

            switch (casing) {
                case 'uppercase': text = text.toUpperCase(); break;
                case 'lowercase': text = text.toLowerCase(); break;
                case 'initial': text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(); break;
                case 'alternate':
                    if (side === 'front') {
                        text = state.useUppercase ? text.toUpperCase() : text;
                    }
                    break;
            }
        }
        return text;
    };

    if (isAudioOnly(skillConfig)) {
        dom.cardFrontContent.innerHTML = '<span class="speech-icon">🔊</span>';
    } else {
        frontParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            partDiv.textContent = applyTransforms(part, 'front');

            const transform = skillConfig.transforms?.front?.[part.role];
            if (transform?.font) {
                if (transform.font === 'Random') {
                    const availableFonts = ['Arial', 'Verdana', 'Times New Roman', 'Courier New'];
                    partDiv.style.fontFamily = availableFonts[Math.floor(Math.random() * availableFonts.length)];
                } else {
                    partDiv.style.fontFamily = transform.font;
                }
            }
            dom.cardFrontContent.appendChild(partDiv);
        });
    }

    backParts.forEach(part => {
        const partDiv = document.createElement('div');
        partDiv.className = `card-role-${part.role.toLowerCase()}`;
        partDiv.textContent = applyTransforms(part, 'back');
        const transform = skillConfig.transforms?.back?.[part.role];
        if (transform?.font) {
            if (transform.font === 'Random') {
                const availableFonts = ['Arial', 'Verdana', 'Times New Roman', 'Courier New'];
                partDiv.style.fontFamily = availableFonts[Math.floor(Math.random() * availableFonts.length)];
            } else {
                partDiv.style.fontFamily = transform.font;
            }
        }
        dom.cardBackContent.appendChild(partDiv);
    });

    dom.cardFront.style.fontSize = '';
    dom.cardBackContent.style.fontSize = '';
    setTimeout(() => {
        adjustFontSize(dom.cardFrontContent, true);
        adjustFontSize(dom.cardBackContent, false);
    }, 50);
}

export async function displayCard(index, { reason = {} } = {}) {
    if (state.cardData.length === 0 || index < 0 || index >= state.cardData.length) return;

    updateState({ isCurrentCardDue: reason.type === 'due_review' });

    const cardKey = getCardKey(state.cardData[index]);
    const stats = await getSanitizedStats(cardKey);

    // The history is now managed in showNextCard to ensure the correct state is saved.

    updateState({ currentCardIndex: index, replayRate: 1.0 });

    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) {
        console.error('No skill config found for displayCard. Aborting.');
        return;
    }

    const currentSkillStats = stats.skills[state.currentSkillId] || createDefaultSkillStats();
    const previousLastViewed = currentSkillStats.lastViewed;
    currentSkillStats.viewCount++;
    currentSkillStats.lastViewed = Date.now();

    const baseLangIndices = (state.configs[dom.configSelector.value] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
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

    renderCardFaces(newFrontParts, newBackParts, skillConfig);

    // This logic is now handled by the 'alternate' casing transform in renderCardFaces
    const hasAlternateCasing = Object.values(skillConfig.transforms?.front || {}).some(t => t.casing === 'alternate');
    if (hasAlternateCasing && !isAudioOnly(skillConfig)) {
        updateState({ useUppercase: !state.useUppercase });
    }

    dom.card.classList.remove('flipped');

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

    renderSkillMastery(stats);
    if (dom.lastSeen) dom.lastSeen.textContent = `Last seen: ${formatTimeAgo(previousLastViewed)}`;
    if (dom.cardSpecificStats) dom.cardSpecificStats.innerHTML = '';

    if (dom.explanationMessage) {
        let message = '';
        const deckIcon = reason.isFiltered ? 'Filter 🐠' : 'Deck 📚';
        dom.explanationMessage.classList.remove('deck-learned-message');

        switch (reason.type) {
            case 'due_review': message = `[${deckIcon}] This card is due for its ${reason.expiredInterval} review. Next review in ${reason.nextInterval}.`; break;
            case 'bridging_card': message = `[${deckIcon}] Introducing a card from a previous skill.`; break;
            case 'new_card': message = `[${deckIcon}] Introducing a new, unseen card.`; break;
            case 'least_learned': message = `[${deckIcon}] Reviewing card with the lowest score.`; break;
            case 'deck_learned':
                dom.explanationMessage.classList.add('deck-learned-message');
                message = reason.isFiltered ? 'Filtered deck learned! Proceeding with regular deck.' : (reason.timeToNextReview !== Infinity ? `Deck learned! Reviews are from ${formatTimeDifference(reason.timeToNextReview)} to ${formatTimeDifference(reason.timeToLastReview)}. Reviewing lowest-score cards until then.` : 'Congratulations, you have learned this whole deck!');
                break;
        }
        dom.explanationMessage.textContent = message;
        dom.explanationMessage.classList.toggle('visible', !!message);
    }

    stopVoiceRecognition();

    dom.writingPracticeContainer.classList.add('hidden');
    dom.multipleChoiceContainer.classList.add('hidden');
    dom.voiceInputContainer.classList.add('hidden');
    dom.iKnowButton.classList.remove('hidden');
    dom.iDontKnowButton.classList.remove('hidden');
    dom.nextCardButton.classList.remove('hidden');

    if (skillConfig.verificationMethod === VERIFICATION_METHODS.TEXT) {
        dom.writingPracticeContainer.classList.remove('hidden');
        dom.writingPracticeContainer.classList.toggle('audio-only-writing', isAudioOnly(skillConfig));
        dom.iKnowButton.classList.add('hidden');
        dom.iDontKnowButton.classList.add('hidden');
        dom.nextCardButton.classList.add('hidden');
        dom.writingInput.value = '';
        dom.writingInput.disabled = false;
        // const validationLang = getLanguageForRole(skillConfig.validationColumn);
        // if (validationLang && validationLang !== 'N/A') dom.writingInput.lang = validationLang;
        // else dom.writingInput.removeAttribute('lang');
        dom.writingInput.setAttribute('autocomplete', 'off');
        dom.writingInput.focus();
    } else if (skillConfig.verificationMethod === VERIFICATION_METHODS.MULTIPLE_CHOICE) {
        dom.multipleChoiceContainer.classList.remove('hidden');
        generateMultipleChoiceOptions();
    } else if (skillConfig.verificationMethod === VERIFICATION_METHODS.VOICE) {
        dom.voiceInputContainer.classList.remove('hidden');
        dom.voiceInputFeedback.textContent = '';
        dom.iKnowButton.classList.add('hidden');
        dom.iDontKnowButton.classList.remove('hidden');
        dom.nextCardButton.classList.add('hidden');
    }

    dom.comparisonContainer.classList.add('hidden');
    dom.comparisonContainer.innerHTML = '';

    await saveCardStats(cardKey, stats);
    updateState({ cardShownTimestamp: Date.now() });
}

export async function flipCard() {
    if (!dom.card) return;

    if (!dom.multipleChoiceContainer.classList.contains('hidden') && !dom.multipleChoiceContainer.classList.contains('answered')) {
        await markCardAsKnown(false);
        await showNextCard({ forceNew: true });
        return;
    }

    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) return;

    const isFlippingToFront = dom.card.classList.contains('flipped');
    dom.card.classList.toggle('flipped');

    if (isFlippingToFront) {
        updateState({ baseLanguageRotationIndex: state.baseLanguageRotationIndex + 1 });
        const baseLangIndices = (state.configs[dom.configSelector.value] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
        if (baseLangIndices.length > 1) {
            updateState({ currentRandomBaseIndex: baseLangIndices[state.baseLanguageRotationIndex % baseLangIndices.length] });
        }

        const frontRoles = skillConfig.front || [];
        const backRoles = skillConfig.back || [];
        const newFrontParts = await getTextForRoles(frontRoles, 'front', state.currentRandomBaseIndex);
        const newBackParts = await getTextForRoles(backRoles, 'back', state.currentRandomBaseIndex);
        updateState({ frontParts: newFrontParts, backParts: newBackParts });

        renderCardFaces(newFrontParts, newBackParts, skillConfig);
    }

    document.body.classList.add('is-flipping');
    setTimeout(() => document.body.classList.remove('is-flipping'), 600);

    if (skillConfig.ttsOnHotkeyOnly) return;

    if (dom.card.classList.contains('flipped')) {
        const ttsRole = skillConfig.ttsBackColumn;
        const textToSpeak = state.ttsBackParts.map(p => p.text).join(' ');
        speak(textToSpeak, { ttsRole });
    } else {
        const ttsRole = skillConfig.ttsFrontColumn;
        const textToSpeak = state.ttsFrontParts.map(p => p.text).join(' ');
        speak(textToSpeak, { ttsRole });
    }
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
        const reason = { type: 'due_review', expiredInterval: formatDuration(state.repetitionIntervals[nextItem.skillStats.intervalIndex]), nextInterval: formatDuration(state.repetitionIntervals[nextItem.skillStats.intervalIndex + 1] || 0), isFiltered };
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
    if (state.cardData.length === 0) return;

    const currentConfig = state.configs[dom.configSelector.value];
    const activeSkills = getActiveSkills();
    const userSkills = currentConfig ? currentConfig.skills : [];

    if (activeSkills.length === 0) {
        showTopNotification('No active skills. Please select skills to practice in Settings.', 'error');
        return;
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
        return;
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
                return;
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

    if (filteredDeckIsLearned && dom.filterAllowOverflowCheckbox.checked) {
        result = findNextCardFromList(allReviewableItems, { ...findNextCardOptions, isFiltered: false }) || result;
    }

    if (result) {
        const { nextItem, reason } = result;
        // Save the state of the card we are navigating AWAY FROM.
        if (state.currentCardIndex >= 0 && state.currentSkillId != null) {
            updateState({ viewHistory: [...state.viewHistory, { cardIndex: state.currentCardIndex, skillId: state.currentSkillId }] });
        }
        updateState({ currentCardIndex: nextItem.cardIndex, currentSkillId: nextItem.skillId });
        await displayCard(nextItem.cardIndex, { reason });
    } else {
        const message = isFiltered ? 'You have learned all cards in the filtered set!' : 'You have learned all cards in the deck!';
        showTopNotification(message, 'success');
    }
}

export async function showPrevCard() {
    const { lastState, newHistory } = popFromViewHistory();
    if (lastState) {
        updateState({ viewHistory: newHistory, currentSkillId: lastState.skillId });
        await displayCard(lastState.cardIndex);
    }
}

export async function saveCardStats(cardKey, stats) {
    if (!cardKey || !stats) return;
    await set(cardKey, stats);
    await syncToServer({ cardStats: { [cardKey]: stats } });
}