import { VERIFICATION_METHODS } from './skill-utils.js';

/**
 * Dynamically adjusts the font size of an element to fit its container.
 * Uses a binary search approach for efficiency.
 * @param {HTMLElement} element - The text element to resize.
 */
export function adjustFontSize(element, isFront) {
    if (!element) return;
    const container = element.closest('.card-face');
    if (!container) return;
    let min = 10, max = isFront ? 150 : 80;
    let bestSize = min;

    while (min <= max) {
        let mid = Math.floor((min + max) / 2);
        element.style.fontSize = `${mid}px`;
        if (element.scrollWidth <= container.clientWidth && element.scrollHeight <= container.clientHeight) {
            bestSize = mid;
            min = mid + 1;
        } else {
            max = mid - 1;
        }
    }
    element.style.fontSize = `${bestSize}px`;
}

/**
 * Converts a timestamp into a human-readable "time ago" string.
 * @param {number|null} timestamp - The timestamp to format.
 * @returns {string} A human-readable string like "5 minutes ago" or "just now".
 */
export function formatTimeAgo(timestamp) {
    if (!timestamp) return 'never';
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(months / 12);
    return `${years} years ago`;
}

export function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
    if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
    return `${Math.round(seconds / 31536000)} years`;
}

export function formatTimeDifference(ms) {
    if (ms <= 0) return 'Now';

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    return `${days}d`;
}

export function getTimeToDue(skillStats, repetitionIntervals, now = Date.now()) {
    if (!skillStats.lastViewed) {
        return { ms: -1, formatted: 'N/A' }; // N/A for cards never seen
    }
    const intervalSeconds = repetitionIntervals[skillStats.intervalIndex];
    if (intervalSeconds === undefined) {
        return { ms: Infinity, formatted: 'Learned' }; // Card is fully learned
    }
    const dueDate = skillStats.lastViewed + (intervalSeconds * 1000);
    const timeToDueMs = dueDate - now;

    return {
        ms: timeToDueMs,
        formatted: formatTimeDifference(timeToDueMs)
    };
}


function isAudioOnly(skillConfig) {
    return skillConfig && skillConfig.front.length === 0 && skillConfig.ttsFrontColumn && skillConfig.ttsFrontColumn !== 'none';
}

/**
 * Flips the current card and handles the flip animation.
 * Also triggers TTS for the revealed side if enabled.
 */
export async function flipCard(state, actions) {
    const { card, multipleChoiceContainer } = state.dom;
    if (!card) return;

    // If flipping is attempted during an active (unanswered) multiple-choice question,
    // treat it as "I don't know" and show the next card.
    if (!multipleChoiceContainer.classList.contains('hidden') && !multipleChoiceContainer.classList.contains('answered')) {
        await actions.markCardAsKnown(false);
        await actions.showNextCard({ forceNew: true });
        return;
    }

    const skillConfig = actions.getCurrentSkillConfig();
    if (!skillConfig) {
        console.error('Cannot flip card: no skill configured.');
        return;
    }

    const isFlippingToFront = card.classList.contains('flipped');
    card.classList.toggle('flipped');

    if (isFlippingToFront) {
        // Logic to handle rotating through multiple base languages when flipping back to the front
        state.baseLanguageRotationIndex++;
        const baseLangIndices = (state.configs[state.dom.configSelector.value] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
        if (baseLangIndices.length > 1) {
            const rotationIndex = state.baseLanguageRotationIndex % baseLangIndices.length;
            state.currentRandomBaseIndex = baseLangIndices[rotationIndex];
        }

        // Regenerate and update text for both faces since the base language might have changed
        const frontRoles = skillConfig.front || [];
        const backRoles = skillConfig.back || [];
        state.frontParts = await actions.getTextForRoles(frontRoles, state.currentRandomBaseIndex);
        state.backParts = await actions.getTextForRoles(backRoles, state.currentRandomBaseIndex);

        // This is a simplified redraw. The main redraw logic is in displayCard.
        // When flipping back to the front, we need to ensure the content is updated
        // in case the base language has rotated.
        state.dom.cardFrontContent.innerHTML = ''; // Clear existing content
        state.frontParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            partDiv.textContent = part.text;
            state.dom.cardFrontContent.appendChild(partDiv);
        });

        state.dom.cardBackContent.innerHTML = ''; // Clear existing content
        state.backParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            partDiv.textContent = part.text;
            state.dom.cardBackContent.appendChild(partDiv);
        });

        // Re-apply font size adjustments after content update
        adjustFontSize(state.dom.cardFrontContent, true);
        adjustFontSize(state.dom.cardBackContent, false);
    }

    document.body.classList.add('is-flipping');
    setTimeout(() => {
        document.body.classList.remove('is-flipping');
    }, 600);

    if (skillConfig.ttsOnHotkeyOnly) return;

    // Speak the content of the revealed face
    if (card.classList.contains('flipped')) {
        const ttsRole = skillConfig.ttsBackColumn;
        const lang = actions.getLanguageForTts(ttsRole);
        const textToSpeak = state.ttsBackParts.map(p => p.text).join(' ');
        actions.speak(textToSpeak, { ttsRole: ttsRole, lang: lang });
    } else {
        const ttsRole = skillConfig.ttsFrontColumn;
        const lang = actions.getLanguageForTts(ttsRole);
        const textToSpeak = state.ttsFrontParts.map(p => p.text).join(' ');
        actions.speak(textToSpeak, { ttsRole: ttsRole, lang: lang });
    }
}

/**
 * Displays a card at a given index, updating the front and back content,
 * and handling features like "Alternate Uppercase" and "Audio-Only Front".
 * It also updates and displays the card's statistics.
 * @param {number} index - The index of the card to display in the `cardData` array.
 * @param {object} [options={}] - Additional options.
 * @param {boolean} [options.isNavigatingBack=false] - True if this call is from the "previous" button.
 * @param {string} [options.reason=''] - The reason the card was chosen.
 */
export async function displayCard(index, { isNavigatingBack = false, reason = {} } = {}, state, actions) {
    const { dom, cardData, currentCardIndex, currentSkillId, configs, repetitionIntervals } = state;
    const { getCardKey, getSanitizedStats, getCurrentSkillConfig, getTextForRoles, speak, getLanguageForTts, renderSkillMastery, saveCardStats, startVoiceRecognition, stopVoiceRecognition, generateMultipleChoiceOptions } = actions;

    if (cardData.length === 0 || index < 0 || index >= cardData.length) return;

    state.isCurrentCardDue = reason.type === 'due_review';

    const cardKey = getCardKey(cardData[index]);
    const stats = await getSanitizedStats(cardKey);

    if (!isNavigatingBack && (index !== currentCardIndex || reason.skill !== currentSkillId)) {
        state.viewHistory.push({ cardIndex: currentCardIndex, skillId: currentSkillId });
    }

    state.currentCardIndex = index;
    // The currentSkillId is now set by showNextCard
    state.replayRate = 1.0;

    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig) {
        console.error('No skill config found for displayCard. Aborting.');
        // Potentially show a user-facing error here
        return;
    }

    const currentSkillStats = stats.skills[state.currentSkillId] || actions.createDefaultSkillStats();
    const previousLastViewed = currentSkillStats.lastViewed;
    currentSkillStats.viewCount++;
    currentSkillStats.lastViewed = Date.now();

    // --- Text Generation ---
    const baseLangIndices = (configs[dom.configSelector.value] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
    if (baseLangIndices.length > 1) {
        const rotationIndex = state.baseLanguageRotationIndex % baseLangIndices.length;
        state.currentRandomBaseIndex = baseLangIndices[rotationIndex];
    } else if (baseLangIndices.length === 1) {
        state.currentRandomBaseIndex = baseLangIndices[0];
    } else {
        state.currentRandomBaseIndex = -1;
    }

    const frontRoles = skillConfig.front || [];
    const backRoles = skillConfig.back || [];
    const ttsFrontRole = skillConfig.ttsFrontColumn ? [skillConfig.ttsFrontColumn] : [];
    const ttsBackRole = skillConfig.ttsBackColumn ? [skillConfig.ttsBackColumn] : [];

    state.frontParts = await getTextForRoles(frontRoles, state.currentRandomBaseIndex);
    state.backParts = await getTextForRoles(backRoles, state.currentRandomBaseIndex);
    state.ttsFrontParts = await getTextForRoles(ttsFrontRole, state.currentRandomBaseIndex);
    state.ttsBackParts = await getTextForRoles(ttsBackRole, state.currentRandomBaseIndex);

    // --- UI Update ---
    if (!dom.cardFrontContent || !dom.cardBackContent) {
        console.error('Critical error: card content elements not found in the DOM.');
        actions.showTopNotification('Critical error: UI components are missing.', 'error');
        return;
    }
    dom.cardFrontContent.innerHTML = '';
    dom.cardBackContent.innerHTML = '';

    if (isAudioOnly(skillConfig)) {
        dom.cardFrontContent.innerHTML = '<span class="speech-icon">🔊</span>';
    } else {
        state.frontParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            let text = part.text;
            if (skillConfig.alternateUppercase && part.role === 'TARGET_LANGUAGE') {
                if (state.useUppercase) {
                    text = text.toUpperCase();
                }
            }
            partDiv.textContent = text;
            dom.cardFrontContent.appendChild(partDiv);
        });
        if (skillConfig.alternateUppercase) {
            state.useUppercase = !state.useUppercase;
        }
    }

    state.backParts.forEach(part => {
        const partDiv = document.createElement('div');
        partDiv.className = `card-role-${part.role.toLowerCase()}`;
        partDiv.textContent = part.text;
        dom.cardBackContent.appendChild(partDiv);
    });

    dom.cardFront.style.fontSize = '';
    dom.cardBackContent.style.fontSize = '';

    setTimeout(() => {
        adjustFontSize(dom.cardFrontContent, true);
        adjustFontSize(dom.cardBackContent, false);
    }, 50);

    dom.card.classList.remove('flipped');

    // Determine if TTS should play automatically and handle voice recognition start.
    const autoPlayTts = !skillConfig.ttsOnHotkeyOnly;
    const ttsRole = skillConfig.ttsFrontColumn;
    const lang = getLanguageForTts(ttsRole);
    const textToSpeak = state.ttsFrontParts.map(p => p.text).join(' ');

    const startRecognitionCallback = () => {
        if (skillConfig.verificationMethod === VERIFICATION_METHODS.VOICE) {
            startVoiceRecognition();
        }
    };

    if (autoPlayTts && textToSpeak) {
        // If TTS is supposed to play, start voice recognition after it finishes.
        speak(textToSpeak, { ttsRole: ttsRole, lang: lang, onEndCallback: startRecognitionCallback });
    } else {
        // Otherwise, start voice recognition immediately (if applicable).
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
        case 'due_review':
            message = `[${deckIcon}] This card is due for its ${formatDuration(repetitionIntervals[reason.expiredInterval])} review. Next review in ${formatDuration(repetitionIntervals[reason.nextInterval] || 0)}.`;
            break;
        case 'bridging_card':
            message = `[${deckIcon}] Introducing a card from a previous skill.`;
            break;
        case 'new_card':
            message = `[${deckIcon}] Introducing a new, unseen card.`;
            break;
        case 'least_learned':
            message = `[${deckIcon}] Reviewing card with the lowest score.`;
            break;
        case 'deck_learned':
            dom.explanationMessage.classList.add('deck-learned-message');
            if (reason.isFiltered) {
                message = 'Filtered deck learned! Proceeding with regular deck.';
            } else {
                message = reason.timeToNextReview !== Infinity
                    ? `Deck learned! Reviews are from ${formatTimeDifference(reason.timeToNextReview)} to ${formatTimeDifference(reason.timeToLastReview)}. Reviewing lowest-score cards until then.`
                    : 'Congratulations, you have learned this whole deck!';
            }
            break;
        }
        dom.explanationMessage.textContent = message;
        dom.explanationMessage.classList.toggle('visible', !!message);
    }

    // Handle UI for different verification methods
    stopVoiceRecognition(); // Stop any active recognition from the previous card.

    // Reset all verification UI to a default state
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
        const validationLang = actions.getLanguageForRole(skillConfig.validationColumn);
        if (validationLang && validationLang !== 'N/A') {
            dom.writingInput.lang = validationLang;
        } else {
            dom.writingInput.removeAttribute('lang');
        }
        dom.writingInput.setAttribute('autocomplete', 'off');
        dom.writingInput.focus();
    } else if (skillConfig.verificationMethod === VERIFICATION_METHODS.MULTIPLE_CHOICE) {
        dom.multipleChoiceContainer.classList.remove('hidden');
        generateMultipleChoiceOptions();
    } else if (skillConfig.verificationMethod === VERIFICATION_METHODS.VOICE) {
        dom.voiceInputContainer.classList.remove('hidden');
        dom.voiceInputFeedback.textContent = ''; // Explicitly clear previous recognition text
        dom.iKnowButton.classList.add('hidden');
        dom.iDontKnowButton.classList.remove('hidden'); // Re-enable "I don't know"
        dom.nextCardButton.classList.add('hidden');
    }
    // The 'none' case is now handled by the default state set above.
    dom.comparisonContainer.classList.add('hidden');
    dom.comparisonContainer.innerHTML = '';

    await saveCardStats(cardKey, stats);
    state.cardShownTimestamp = Date.now();
}