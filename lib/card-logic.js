import { get, set } from './idb-keyval-wrapper.js';
import { state, dom, getCurrentSkillConfig } from './state.js';
import { detectColumnLanguages } from './detect-column-languages.js';
import { showTopNotification, adjustFontSize } from './ui.js';
import { transformSlashText } from './string-utils.js';

// This function will be populated with all DOM elements in app.js
export function setDom(domElements) {
    Object.assign(dom, domElements);
}

export function getCardKey(card) {
    const currentConfigName = dom.configSelector.value;
    const currentConfig = state.configs[currentConfigName] || {};
    const roleToColumnMap = currentConfig.roleToColumnMap || {};
    const keyIndices = roleToColumnMap['TARGET_LANGUAGE'] || [];

    if (keyIndices.length === 0) {
        console.error('No Target Language column set for getCardKey!');
        return `invalid-card-${Math.random()}`;
    }
    const keyIndex = keyIndices[0];

    if (!card || keyIndex >= card.length || typeof card[keyIndex] !== 'string') {
        return `invalid-card-${Math.random()}`;
    }
    return card[keyIndex].trim();
}

export async function saveCardStats(cardKey, stats) {
    if (!cardKey || !stats) return;
    await set(cardKey, stats);
    // This needs to be imported or passed in if we want to keep the sync logic here
    // For now, assuming it will be handled by the main app orchestrator
    // await syncToServer('cardStat', cardKey, stats);
}

function getRetentionScore(skillStats) {
    if (!skillStats || typeof skillStats !== 'object') {
        return 0;
    }
    return (skillStats.successTimestamps?.length || 0) - (skillStats.failureTimestamps?.length || 0);
}

function createDefaultSkillStats() {
    return {
        successTimestamps: [],
        failureTimestamps: [],
        responseDelays: [],
        lastViewed: null,
        intervalIndex: 0,
        viewCount: 0
    };
}

async function getSanitizedStats(cardKey) {
    let cardStats = await get(cardKey);

    if (!cardStats || typeof cardStats !== 'object' || !cardStats.skills) {
        cardStats = { skills: {} };
    }

    const currentConfigName = dom.configSelector.value;
    const currentConfig = state.configs[currentConfigName];
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
            const successes = skillStats.successTimestamps.length;
            const failures = skillStats.failureTimestamps.length;
            const failuresToRemove = failures - successes;
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

async function getTextForRoles(roles, baseLanguageIndex = -1) {
    const currentConfigName = dom.configSelector.value;
    if (!currentConfigName || !state.configs[currentConfigName] || !state.configs[currentConfigName].roleToColumnMap) return [];
    const roleToColumnMap = state.configs[currentConfigName].roleToColumnMap;
    const currentCard = state.cardData[state.currentCardIndex];

    if (!currentCard) return [];

    const textParts = [];

    for (const roleKey of roles) {
        let columnIndices = [];
        if (roleKey === 'BASE_LANGUAGE' && baseLanguageIndex !== -1) {
            columnIndices = [baseLanguageIndex];
        } else {
            columnIndices = roleToColumnMap[roleKey] || [];
        }

        for (const colIndex of columnIndices) {
            const cellText = currentCard[colIndex];
            if (!cellText) continue;

            if (roleKey === 'RELATED_WORD') {
                const relatedWords = [...new Set(cellText.split(',').map(w => w.trim()).filter(Boolean))];
                const statPromises = relatedWords.map(word => getSanitizedStats(word));
                const statsArray = await Promise.all(statPromises);

                const studiedWords = relatedWords.filter((word, i) => {
                    const stats = statsArray[i];
                    const totalViews = Object.values(stats.skills).reduce((sum, s) => sum + (s.viewCount || 0), 0);
                    return totalViews > 0;
                });

                if (studiedWords.length > 0) {
                    textParts.push({
                        text: transformSlashText(studiedWords.join(', ')),
                        role: roleKey
                    });
                }
            } else {
                textParts.push({
                    text: transformSlashText(cellText),
                    role: roleKey
                });
            }
        }
    }
    return textParts;
}

export async function flipCard() {
    if (!dom.card) return;

    if (!dom.multipleChoiceContainer.classList.contains('hidden') && !dom.multipleChoiceContainer.classList.contains('answered')) {
        await markCardAsKnown(false);
        await showNextCard({ forceNew: true });
        return;
    }

    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) {
        console.error('Cannot flip card: no skill configured.');
        return;
    }

    const isFlippingToFront = dom.card.classList.contains('flipped');
    dom.card.classList.toggle('flipped');

    if (isFlippingToFront) {
        state.baseLanguageRotationIndex++;
        const baseLangIndices = (state.configs[dom.configSelector.value] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
        if (baseLangIndices.length > 1) {
            const rotationIndex = state.baseLanguageRotationIndex % baseLangIndices.length;
            state.currentRandomBaseIndex = baseLangIndices[rotationIndex];
        }

        const frontRoles = skillConfig.front || [];
        const backRoles = skillConfig.back || [];
        state.frontParts = await getTextForRoles(frontRoles, state.currentRandomBaseIndex);
        state.backParts = await getTextForRoles(backRoles, state.currentRandomBaseIndex);

        dom.cardFrontContent.innerHTML = '';
        state.frontParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            partDiv.textContent = part.text;
            dom.cardFrontContent.appendChild(partDiv);
        });

        dom.cardBackContent.innerHTML = '';
        state.backParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            partDiv.textContent = part.text;
            dom.cardBackContent.appendChild(partDiv);
        });

        adjustFontSize(dom.cardFrontContent, true);
        adjustFontSize(dom.cardBackContent, false);
    }

    // ... rest of the flip logic including TTS will be handled in a separate UI function
}

export async function displayCard(index, { isNavigatingBack = false, reason = {} } = {}) {
    if (state.cardData.length === 0 || index < 0 || index >= state.cardData.length) return;

    state.isCurrentCardDue = reason.type === 'due_review';

    const cardKey = getCardKey(state.cardData[index]);
    const stats = await getSanitizedStats(cardKey);

    if (!isNavigatingBack && (index !== state.currentCardIndex || reason.skill !== state.currentSkillId)) {
        state.viewHistory.push({ cardIndex: state.currentCardIndex, skillId: state.currentSkillId });
    }

    state.currentCardIndex = index;
    state.replayRate = 1.0;

    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) {
        console.error('No skill config found for displayCard. Aborting.');
        return;
    }

    // ... The rest of the displayCard logic will go here
}

export async function showNextCard({ forceNew = false, now = Date.now() } = {}) {
    // ... The showNextCard logic will go here
}

export async function showPrevCard() {
    if (state.viewHistory.length > 0) {
        const prevState = state.viewHistory.pop();
        state.currentSkillId = prevState.skillId;
        await displayCard(prevState.cardIndex, { isNavigatingBack: true });
    }
}

async function updateColumnLanguages() {
    state.columnLanguages = await detectColumnLanguages(state.cardData, state.headers);
    // console.log('Detected column languages:', state.columnLanguages);
    // This function will need to be moved to skill-management.js
    // populateColumnRolesUI();
}

export async function parseData(text) {
    const cleanCell = (cell) => cell.replace(/[\r\n\s]+/g, ' ').trim();

    const rows = text.trim().split('\n').filter(row => row.trim() !== '');
    if (rows.length < 1) {
        state.cardData = [];
        state.headers = [];
        return;
    }

    const delimiter = rows[0].includes('\t') ? '\t' : ',';
    state.headers = rows[0].split(delimiter).map(cleanCell);

    state.cardData = rows
        .slice(1)
        .map(row => row.split(delimiter).map(cleanCell))
        .filter(row => row.length === state.headers.length);

    state.viewHistory = [];
    await updateColumnLanguages();
    if (dom.repetitionIntervalsTextarea) dom.repetitionIntervalsTextarea.value = state.repetitionIntervals.join(', ');
}

export async function loadData() {
    const url = dom.dataUrlInput.value;
    if (!url) return;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const cache = await caches.open('flashcards-cache-v1');
            const cachedResponse = await cache.match(url);
            if (cachedResponse) {
                const text = await cachedResponse.text();
                await parseData(text);
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } else {
            const text = await response.text();
            await parseData(text);
        }

        if (dom.settingsModal) dom.settingsModal.classList.add('hidden');
        document.body.classList.add('debug-data-loaded');

    } catch (error) {
        console.error('Failed to load data', error);
        showTopNotification(`Failed to load data: ${error.message}.`);
    }
}