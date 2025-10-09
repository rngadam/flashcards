/**
 * @file Handles all card verification methods.
 * This module contains the logic for text input, multiple-choice questions,
 * and voice recognition, including checking answers and updating the UI accordingly.
 */

import { VERIFICATION_METHODS } from '../shared/skill-utils.js';
import { getLenientString, stripParentheses } from '../string-utils.js';
import { renderDiff } from '../ui/ui-helpers.js';
import logger from '../core/logger.js';

// Dependencies to be injected
let dom;
let state;
let updateState;
let showTopNotification;
let markCardAsKnown;
let flipCard;
let showNextCard;
let getCurrentSkillConfig;
let getLanguageForRole;

export function initVerification(dependencies) {
    dom = dependencies.dom;
    state = dependencies.state;
    updateState = dependencies.updateState;
    showTopNotification = dependencies.showTopNotification;
    markCardAsKnown = dependencies.markCardAsKnown;
    flipCard = dependencies.flipCard;
    showNextCard = dependencies.showNextCard;
    getCurrentSkillConfig = dependencies.getCurrentSkillConfig;
    getLanguageForRole = dependencies.getLanguageForRole;
}

export async function checkWritingAnswer() {
    const userAnswer = dom.writingInput.value.trim();
    if (userAnswer === '') {
        await markCardAsKnown(false);
        flipCard();
        return;
    }

    const skillConfig = getCurrentSkillConfig();
    if (!skillConfig || skillConfig.verificationMethod !== VERIFICATION_METHODS.TEXT) return;

    const validationRole = skillConfig.validationColumn;
    if (!validationRole || validationRole === 'none') {
        showTopNotification('Cannot validate: No validation column is configured.', 'error');
        return;
    }

    const roleToColumnMap = (state.configs[dom.configSelector.value] || {}).roleToColumnMap || {};
    const validationColumnIndices = roleToColumnMap[validationRole] || [];
    if (validationColumnIndices.length === 0) {
        showTopNotification(`Cannot validate: No column is assigned the role.`, 'error');
        return;
    }

    const correctAnswers = validationColumnIndices.map(index => state.cardData[state.currentCardIndex][index]);
    const isCorrect = correctAnswers.some(correctAnswer => getLenientString(userAnswer) === getLenientString(correctAnswer));
    const firstCorrectAnswer = correctAnswers[0];

    await markCardAsKnown(isCorrect);

    dom.comparisonContainer.innerHTML = '';
    dom.comparisonContainer.appendChild(renderDiff(userAnswer, firstCorrectAnswer, isCorrect));
    dom.comparisonContainer.classList.remove('hidden');
    dom.writingInput.disabled = true;

    if (!dom.card.classList.contains('flipped')) {
        flipCard();
    }
    dom.nextCardButton.classList.remove('hidden');
}

export function generateMultipleChoiceOptions() {
    const skillConfig = getCurrentSkillConfig();
    console.debug('[mc] skillConfig:', skillConfig);
    const validationRole = skillConfig.validationColumn;
    console.debug('[mc] validationRole:', validationRole);
    if (!validationRole || validationRole === 'none') return;

    const roleToColumnMap = (state.configs[dom.configSelector.value] || {}).roleToColumnMap || {};
    console.debug('[mc] roleToColumnMap:', roleToColumnMap, 'configKey:', dom.configSelector?.value);
    const validationColumnIndices = roleToColumnMap[validationRole] || [];
    console.debug('[mc] validationColumnIndices:', validationColumnIndices);
    if (validationColumnIndices.length === 0) {
        showTopNotification(`Cannot validate: No column is assigned the role.`, 'error');
        return;
    }

    const correctAnswer = state.cardData[state.currentCardIndex][validationColumnIndices[0]];
    const numChoices = parseInt((state.configs[dom.configSelector.value] || {}).multipleChoiceCount || 4, 10);

    const distractorPool = [...new Set(
        state.cardData
            .filter((_, index) => index !== state.currentCardIndex)
            .map(card => card[validationColumnIndices[0]])
            .filter(Boolean)
    )];

    // Simple shuffle
    for (let i = distractorPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [distractorPool[i], distractorPool[j]] = [distractorPool[j], distractorPool[i]];
    }

    const options = [correctAnswer, ...distractorPool.slice(0, numChoices - 1)];
    // Shuffle again
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    dom.multipleChoiceContainer.innerHTML = '';
    dom.multipleChoiceContainer.classList.remove('answered');
    // Ensure visible
    dom.multipleChoiceContainer.classList.remove('hidden');
    try { logger.log('ui', 'mc.generate', { options, correctAnswer }); } catch (e) {}
    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.dataset.option = option;
        const numberSpan = document.createElement('span');
        numberSpan.className = 'mc-option-number';
        numberSpan.textContent = index + 1;
        button.appendChild(numberSpan);
        button.appendChild(document.createTextNode(` ${stripParentheses(option)}`));
        button.addEventListener('click', () => {
            try { logger.log('ui', 'mc.click', { selected: option }); } catch (e) {}
            checkMultipleChoiceAnswer(option, correctAnswer);
        });
        dom.multipleChoiceContainer.appendChild(button);
    });
}

export function checkMultipleChoiceAnswer(selectedAnswer, correctAnswer) {
    // Ensure quick UI feedback: mark answered immediately to avoid blocking on
    // async persistence or sync work (which previously caused the click handler
    // to block and delay visual feedback).
    if (dom.multipleChoiceContainer.classList.contains('answered')) return;
    try { logger.log('ui', 'mc.answer', { selectedAnswer, correctAnswer }); } catch (e) {}

    const isCorrect = selectedAnswer === correctAnswer;

    // Immediate visual update
    dom.multipleChoiceContainer.classList.add('answered');
    Array.from(dom.multipleChoiceContainer.children).forEach(button => {
        if (button.dataset.option === correctAnswer) button.classList.add('correct');
        else if (button.dataset.option === selectedAnswer) button.classList.add('incorrect');
    });

    // Do the heavier work asynchronously so the click handler returns fast
    (async () => {
        try {
            await markCardAsKnown(isCorrect);
        } catch (e) {
            // swallow to avoid breaking UI flow; errors are surfaced via logger
            try { logger.log('error', 'mc.markCardError', { error: e && e.message }); } catch (_) {}
        }

        // Flip card to reveal answer if needed (may be async)
        try {
            if (!dom.card.classList.contains('flipped')) {
                await flipCard();
            }
            try { logger.log('ui', 'mc.postFlip', { cardFlipped: dom.card.classList.contains('flipped') }); } catch (e) {}
        } catch (e) {
            try { logger.log('error', 'mc.flipError', { error: e && e.message }); } catch (_) {}
        }

        // Advance to next card after a short delay so user sees feedback.
        try {
            const currentConfig = (state.configs && state.configs[dom.configSelector.value]) || {};
            const delay = parseInt(currentConfig.voiceCorrectDelay, 10) || 1000;
            setTimeout(() => {
                try { showNextCard(); } catch (e) { try { logger.log('error', 'mc.nextCardError', { error: e && e.message }); } catch (_) {} }
            }, delay);
        } catch (e) {
            try { logger.log('error', 'mc.nextCardScheduleError', { error: e && e.message }); } catch (_) {}
        }
    })();
}


const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function toggleVoiceRecognition() {
    if (state.recognitionActive) {
        stopVoiceRecognition();
    } else {
        startVoiceRecognition();
    }
}

export function startVoiceRecognition() {
    if (!SpeechRecognition || state.recognitionActive) return;

    const skillConfig = getCurrentSkillConfig();
    const validationRole = skillConfig.validationColumn;
    const lang = getLanguageForRole(validationRole);

    if (!validationRole || validationRole === 'none' || !lang) {
        showTopNotification('Voice input requires a Validation Column with a detectable language.', 'error');
        return;
    }

    updateState({ recognitionActive: true });
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = lang;
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;
    updateState({ recognitionInstance });

    recognitionInstance.onstart = () => {
        dom.voiceInputButton.classList.add('listening');
        dom.voiceInputFeedback.textContent = 'Listening...';
        dom.voiceInputFeedback.classList.remove('correct', 'incorrect');
    };

    recognitionInstance.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                dom.voiceInputFeedback.textContent = `"${event.results[i][0].transcript}"`;
            }
        }
        if (finalTranscript) checkVoiceAnswer(finalTranscript.trim());
    };

    recognitionInstance.onerror = (event) => {
        if (event.error === 'aborted') return;
        let errorMessage = 'An error occurred.';
        if (event.error === 'no-speech') errorMessage = 'No speech was detected.';
        else if (event.error === 'not-allowed') errorMessage = 'Microphone access was denied.';
        dom.voiceInputFeedback.textContent = errorMessage;
        dom.voiceInputFeedback.classList.add('incorrect');
        stopVoiceRecognition();
    };

    recognitionInstance.onend = () => {
        if (state.recognitionActive) {
            recognitionInstance.start();
        } else {
            dom.voiceInputButton.classList.remove('listening');
            updateState({ recognitionInstance: null });
        }
    };

    recognitionInstance.start();
}

export function stopVoiceRecognition() {
    updateState({ recognitionActive: false });
    if (state.recognitionInstance) {
        state.recognitionInstance.onend = null;
        state.recognitionInstance.stop();
        updateState({ recognitionInstance: null });
    }
    dom.voiceInputButton.classList.remove('listening');
}

async function checkVoiceAnswer(transcript) {
    const skillConfig = getCurrentSkillConfig();
    const validationRole = skillConfig.validationColumn;
    const roleToColumnMap = (state.configs[dom.configSelector.value] || {}).roleToColumnMap || {};
    const validationColumnIndices = roleToColumnMap[validationRole] || [];
    if (validationColumnIndices.length === 0) {
        showTopNotification('Cannot validate: No column is assigned the role.', 'error');
        stopVoiceRecognition();
        return;
    }

    const correctAnswers = validationColumnIndices.map(index => state.cardData[state.currentCardIndex][index]);
    const isCorrect = correctAnswers.some(correctAnswer => getLenientString(transcript) === getLenientString(correctAnswer));

    if (isCorrect) await markCardAsKnown(true);

    dom.voiceInputFeedback.textContent = `"${transcript}"`;
    dom.voiceInputFeedback.classList.toggle('correct', isCorrect);
    dom.voiceInputFeedback.classList.toggle('incorrect', !isCorrect);

    if (isCorrect) {
        stopVoiceRecognition();
        if (!dom.card.classList.contains('flipped')) flipCard();
        const currentConfig = state.configs[dom.configSelector.value] || {};
        const delay = parseInt(currentConfig.voiceCorrectDelay, 10) || 1000;
        setTimeout(() => showNextCard(), delay);
    }
}