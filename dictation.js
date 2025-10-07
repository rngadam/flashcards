// dictation.js
import * as idb from './lib/idb-keyval-wrapper.js';
import { detectLanguage } from './lib/detect-language.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const DB_PREFIX = 'dictation-';
    const DB_CONFIG_KEY = 'dictation-config';
    const SESSION_STORAGE_KEY = 'dictation-session';

    // --- DOM Elements ---
    const textSelect = document.getElementById('text-select');
    const newTextBtn = document.getElementById('new-text-btn');
    const deleteTextBtn = document.getElementById('delete-text-btn');
    const textDisplay = document.getElementById('text-display');
    const speakerIcon = document.getElementById('speaker-icon');
    const diffDisplay = document.getElementById('diff-display');
    const writingInput = document.getElementById('writing-input');
    const speedSlider = document.getElementById('speed-slider');
    const fontSizeSelect = document.getElementById('font-size-select');
    const fontFamilySelect = document.getElementById('font-family-select');
    const hideTextCheckbox = document.getElementById('hide-text-checkbox');
    const readNextCheckbox = document.getElementById('read-next-checkbox');
    const readOnCorrectCheckbox = document.getElementById('read-on-correct-checkbox');
    const ignoreAccentsCheckbox = document.getElementById('ignore-accents-checkbox');
    const ignorePunctuationCheckbox = document.getElementById('ignore-punctuation-checkbox');
    const ignoreCaseCheckbox = document.getElementById('ignore-case-checkbox');
    const textTitleInput = document.getElementById('text-title-input');
    const textContentTextarea = document.getElementById('text-content-textarea');
    const saveTextBtn = document.getElementById('save-text-btn');
    const readAloudTextBtn = document.getElementById('read-aloud-text-btn');
    const repeatWordBtn = document.getElementById('repeat-word-btn');
    const revealTextBtn = document.getElementById('reveal-text-btn');
    const configToggleBtn = document.getElementById('config-toggle-btn');
    const configPanel = document.getElementById('config-panel');
    const closeConfigBtn = document.getElementById('close-config-btn');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    const notificationArea = document.getElementById('notification-area');

    // --- App State ---
    let texts = {};
    let sourceWords = [];
    let currentWordIndex = 0;
    let originalTitle = null; // Used for editing/renaming texts
    let tabKeyPressCount = 0;
    let speechQueue = [];

    // --- Function Declarations (ordered to prevent no-use-before-define) ---

    // ** Level 1: No Dependencies **
    const stripPunctuation = (str) => str.replace(/[\p{P}]/gu, '');

    const showNotification = (message, duration = 3000) => {
        notificationArea.textContent = message;
        notificationArea.classList.remove('hidden');
        setTimeout(() => {
            notificationArea.classList.add('hidden');
        }, duration);
    };

    const saveSession = () => {
        if (textSelect.value) {
            const sessionData = {
                title: textSelect.value,
                userInput: writingInput.value
            };
            console.log('Saving session:', sessionData);
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        }
    };

    const loadSession = () => {
        const session = sessionStorage.getItem(SESSION_STORAGE_KEY);
        return session ? JSON.parse(session) : null;
    };

    const updateTextList = () => {
        const selectedValue = textSelect.value;
        textSelect.innerHTML = '';
        Object.keys(texts).forEach(title => {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            textSelect.appendChild(option);
        });
        if (selectedValue) {
            textSelect.value = selectedValue;
        }
    };

    const clearEditor = () => {
        textSelect.value = '';
        textTitleInput.value = '';
        textContentTextarea.value = '';
        originalTitle = null;
        textTitleInput.focus();
    };

    const normalizeWord = (word) => {
        let normalized = word;
        if (ignoreCaseCheckbox.checked) {
            normalized = normalized.toLowerCase();
        }
        if (ignoreAccentsCheckbox.checked) {
            normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        }
        if (ignorePunctuationCheckbox.checked) {
            normalized = normalized.replace(/[\p{P}]/gu, '');
        }
        return normalized;
    };

    const createDiffHtml = (actual, expected) => {
        const diff = Diff.diffChars(actual, expected);
        const fragment = document.createDocumentFragment();
        diff.forEach((part) => {
            const span = document.createElement('span');
            span.className = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-correct';
            span.appendChild(document.createTextNode(part.value));
            fragment.appendChild(span);
        });
        return fragment;
    };

    // ** Level 2: Dependencies on Level 1 **
    let isSpeaking = false;

    const processSpeechQueue = () => {
        if (isSpeaking || speechQueue.length === 0) {
            return;
        }

        isSpeaking = true;
        const { word, rate } = speechQueue.shift();
        console.log(`Speaking: ${word}`);

        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = textDisplay.lang || 'en';
        utterance.rate = rate;

        utterance.onend = () => {
            isSpeaking = false;
            processSpeechQueue();
        };

        speechSynthesis.speak(utterance);
    };

    const speakWord = (word, rate) => {
        if (!('speechSynthesis' in window)) return;
        speechQueue.push({ word, rate: rate || parseFloat(speedSlider.value) });
        processSpeechQueue();
    };

    const speakImmediately = (word, rate) => {
        if (!('speechSynthesis' in window)) return;
        speechQueue = []; // Clear the queue
        speechSynthesis.cancel(); // Stop any current speech
        isSpeaking = false;
        speakWord(word, rate);
    };

    const loadTexts = async () => {
        const keys = await idb.keys();
        const dictationKeys = keys.filter(key => key.startsWith(DB_PREFIX) && key !== DB_CONFIG_KEY);
        const entries = await Promise.all(
            dictationKeys.map(async (key) => {
                const title = key.substring(DB_PREFIX.length);
                const content = await idb.get(key);
                return [title, content];
            })
        );
        texts = Object.fromEntries(entries);
        updateTextList();
    };

    // ** Level 3: Dependencies on Level 2 **
    const speakNextWord = () => {
        if (currentWordIndex < sourceWords.length) {
            speakWord(stripPunctuation(sourceWords[currentWordIndex]));
        }
    };

    const repeatCurrentWord = () => {
        if (currentWordIndex < sourceWords.length) {
            const speed = 1.0 - (0.2 * tabKeyPressCount++);
            speakImmediately(stripPunctuation(sourceWords[currentWordIndex]), Math.max(0.2, speed));
        }
    };

    const speakText = () => {
        if (!sourceWords.length || !('speechSynthesis' in window)) return;
        const fullText = sourceWords.join(' ');
        speakImmediately(fullText, parseFloat(speedSlider.value));
    };

    const handleContinuousInput = () => {
        const sourceSpans = Array.from(textDisplay.querySelectorAll('span'));
        const inputValue = writingInput.value;
        const inputWords = inputValue.split(/[\s\n]+/).filter(w => w.length > 0);
        const isInputComplete = /[\s\n]$/.test(inputValue) || inputValue.length === 0;
        const isHiddenMode = hideTextCheckbox.checked;

        let lastCorrectIndex = -1;
        let diffShown = false;

        // At the start of each check, reset the diff/speaker icon state in hidden mode.
        if (isHiddenMode) {
            diffDisplay.classList.add('hidden');
            speakerIcon.classList.remove('hidden');
        }

        sourceSpans.forEach(span => span.classList.remove('correct', 'incorrect', 'current'));

        sourceSpans.forEach((span, index) => {
            if (index < inputWords.length) {
                const isLastWord = index === inputWords.length - 1;
                const normalizedSource = normalizeWord(sourceWords[index]);
                const normalizedInput = normalizeWord(inputWords[index]);

                let isIncorrect = false;
                if (isLastWord && !isInputComplete) {
                    if (!normalizedSource.startsWith(normalizedInput)) {
                        isIncorrect = true;
                    }
                } else {
                    if (normalizedInput !== normalizedSource) {
                        isIncorrect = true;
                    }
                }

                if (isIncorrect) {
                    span.classList.add('incorrect');
                    // If it's the first error and we're hidden, show the diff.
                    if (isHiddenMode && !diffShown) {
                        const diffHtml = createDiffHtml(inputWords[index], sourceWords[index]);
                        diffDisplay.innerHTML = '';
                        diffDisplay.appendChild(diffHtml);
                        diffDisplay.classList.remove('hidden');
                        speakerIcon.classList.add('hidden');
                        diffShown = true;
                    }
                } else {
                    if (!isLastWord || isInputComplete) {
                        span.classList.add('correct');
                        lastCorrectIndex = index;
                    }
                }
            }
        });

        const newWordIndex = lastCorrectIndex + 1;
        const hasAdvanced = newWordIndex > currentWordIndex;
        currentWordIndex = newWordIndex;

        if (hasAdvanced) {
            if (readOnCorrectCheckbox.checked && currentWordIndex > 0) {
                speakWord(stripPunctuation(sourceWords[currentWordIndex - 1]));
            }
            if (readNextCheckbox.checked) {
                speakNextWord();
            }
        }

        if (currentWordIndex < sourceWords.length) {
            sourceSpans[currentWordIndex].classList.add('current');
        }

        saveSession();

        if (writingInput.value.trim() === sourceWords.join(' ')) {
            showNotification('Dictation complete!', 5000);
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }
    };

    // ** Level 4: Dependencies on Level 3 **
    const displayText = async (savedInput = '') => {
        const title = textSelect.value;
        if (title && texts[title]) {
            // Clear any previous diff display when loading new text
            diffDisplay.innerHTML = '';
            diffDisplay.classList.add('hidden');

            sourceWords = texts[title].split(' ').filter(w => w.length > 0);
            currentWordIndex = 0;
            tabKeyPressCount = 0;
            writingInput.value = savedInput;

            textDisplay.innerHTML = sourceWords.map(word => `<span>${word}</span>`).join(' ');

            const lang = await detectLanguage(texts[title]);
            textDisplay.lang = lang;
            writingInput.lang = lang;

            handleContinuousInput();
            if (!savedInput) {
                speakNextWord();
            }
        }
    };

    const saveText = async () => {
        const newTitle = textTitleInput.value.trim();
        const content = textContentTextarea.value.trim();
        if (newTitle && content) {
            if (originalTitle && originalTitle !== newTitle) {
                await idb.del(`${DB_PREFIX}${originalTitle}`);
            }
            await idb.set(`${DB_PREFIX}${newTitle}`, content);
            await loadTexts();
            textSelect.value = newTitle;
            displayText();
        }
    };

    const deleteText = async () => {
        const title = textSelect.value;
        if (title && confirm(`Are you sure you want to delete "${title}"?`)) {
            await idb.del(`${DB_PREFIX}${title}`);
            textDisplay.innerHTML = '';
            writingInput.value = '';
            clearEditor();
            await loadTexts();
        }
    };

    const toggleHideText = () => {
        const isHidden = hideTextCheckbox.checked;
        textDisplay.classList.toggle('hidden', isHidden);
        revealTextBtn.classList.toggle('hidden', !isHidden);

        // When hiding text, show the speaker icon and hide the diff display.
        // When showing text, hide both.
        speakerIcon.classList.toggle('hidden', !isHidden);
        diffDisplay.classList.toggle('hidden', true); // Always hide diff on toggle

        if (isHidden) {
            writingInput.focus();
            // We re-run input handler to check if a diff should be shown immediately
            handleContinuousInput();
            speakNextWord();
        }
    };

    const applyConfig = (config) => {
        const classesToRemove = (element) => {
            const toRemove = [];
            element.classList.forEach(c => {
                if (c.startsWith('font-size-') || c.startsWith('font-family-')) {
                    toRemove.push(c);
                }
            });
            return toRemove;
        };

        classesToRemove(writingInput).forEach(c => writingInput.classList.remove(c));
        classesToRemove(textDisplay).forEach(c => textDisplay.classList.remove(c));

        // Add the new classes
        if (config.fontSize) {
            writingInput.classList.add(config.fontSize);
            textDisplay.classList.add(config.fontSize);
        }
        if (config.fontFamily) {
            writingInput.classList.add(config.fontFamily);
            textDisplay.classList.add(config.fontFamily);
        }
    };

    const saveConfig = async () => {
        const config = {
            fontSize: fontSizeSelect.value,
            fontFamily: fontFamilySelect.value,
            hideText: hideTextCheckbox.checked,
            speed: speedSlider.value,
            readNext: readNextCheckbox.checked,
            readOnCorrect: readOnCorrectCheckbox.checked,
            ignoreAccents: ignoreAccentsCheckbox.checked,
            ignorePunctuation: ignorePunctuationCheckbox.checked,
            ignoreCase: ignoreCaseCheckbox.checked,
        };
        await idb.set(DB_CONFIG_KEY, config);
    };

    const loadConfig = async () => {
        const config = await idb.get(DB_CONFIG_KEY) || {};
        fontSizeSelect.value = config.fontSize || 'font-size-28';
        fontFamilySelect.value = config.fontFamily || 'font-family-arial';
        speedSlider.value = config.speed || '1';
        hideTextCheckbox.checked = config.hideText || false;
        readNextCheckbox.checked = config.readNext !== false;
        readOnCorrectCheckbox.checked = config.readOnCorrect !== false;
        ignoreAccentsCheckbox.checked = config.ignoreAccents !== false;
        ignorePunctuationCheckbox.checked = config.ignorePunctuation !== false;
        ignoreCaseCheckbox.checked = config.ignoreCase !== false;

        applyConfig({ fontSize: fontSizeSelect.value, fontFamily: fontFamilySelect.value });
        toggleHideText();
    };

    const handleConfigChange = () => {
        applyConfig({ fontSize: fontSizeSelect.value, fontFamily: fontFamilySelect.value });
        saveConfig();
    };

    const resetSettings = () => {
        // Set UI elements to default values
        fontSizeSelect.value = 'font-size-28';
        fontFamilySelect.value = 'font-family-arial';
        speedSlider.value = '1';
        hideTextCheckbox.checked = false;
        readNextCheckbox.checked = true;
        readOnCorrectCheckbox.checked = true;
        ignoreAccentsCheckbox.checked = true;
        ignorePunctuationCheckbox.checked = true;
        ignoreCaseCheckbox.checked = true;

        // Apply visual changes
        applyConfig({
            fontSize: fontSizeSelect.value,
            fontFamily: fontFamilySelect.value,
        });
        toggleHideText();

        // Save the new default config and notify the user
        saveConfig();
        showNotification('Display settings have been reset.');
    };

    // --- Event Listeners & Initial Load ---

    resetSettingsBtn.addEventListener('click', resetSettings);
    newTextBtn.addEventListener('click', clearEditor);
    deleteTextBtn.addEventListener('click', deleteText);
    saveTextBtn.addEventListener('click', saveText);

    textSelect.addEventListener('change', () => {
        const title = textSelect.value;
        if (title && texts[title]) {
            textTitleInput.value = title;
            textContentTextarea.value = texts[title];
            originalTitle = title;
            displayText();
        }
    });

    writingInput.addEventListener('input', handleContinuousInput);
    readAloudTextBtn.addEventListener('click', speakText);
    repeatWordBtn.addEventListener('click', repeatCurrentWord);

    textDisplay.addEventListener('click', (event) => {
        if (event.target.tagName === 'SPAN') {
            const word = event.target.textContent;
            const sourceLang = textDisplay.lang || 'auto';
            const targetLang = 'en';
            const url = `https://translate.google.com/?sl=${sourceLang}&tl=${targetLang}&text=${encodeURIComponent(word)}&op=translate`;
            window.open(url, '_blank');
        }
    });

    configToggleBtn.addEventListener('click', () => configPanel.classList.toggle('config-panel-hidden'));
    closeConfigBtn.addEventListener('click', () => configPanel.classList.add('config-panel-hidden'));

    fontSizeSelect.addEventListener('change', handleConfigChange);
    fontFamilySelect.addEventListener('change', handleConfigChange);
    speedSlider.addEventListener('input', saveConfig);
    hideTextCheckbox.addEventListener('change', () => {
        toggleHideText();
        saveConfig();
    });
    readNextCheckbox.addEventListener('change', saveConfig);
    readOnCorrectCheckbox.addEventListener('change', saveConfig);
    ignoreAccentsCheckbox.addEventListener('change', saveConfig);
    ignorePunctuationCheckbox.addEventListener('change', saveConfig);
    ignoreCaseCheckbox.addEventListener('change', saveConfig);

    writingInput.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
            event.preventDefault();
            repeatCurrentWord();
        }
    });

    const revealHiddenText = () => {
        if (hideTextCheckbox.checked) {
            hideTextCheckbox.checked = false;
            toggleHideText();
            saveConfig();
        }
    };

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault();
            speakText();
        } else if (event.key === '`') {
            revealHiddenText();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            speakText();
        }
    });

    revealTextBtn.addEventListener('click', revealHiddenText);

    const initializeApp = async () => {
        await loadConfig();
        await loadTexts();

        // Restore the previous session if it exists
        const savedSession = loadSession();
        console.log('Loaded session from sessionStorage:', savedSession);
        if (savedSession && texts[savedSession.title]) {
            console.log('Session is valid, restoring for text:', savedSession.title);
            textSelect.value = savedSession.title;
            // Directly call displayText with the saved user input to restore the state
            await displayText(savedSession.userInput);
        } else {
            console.log('No valid session found to restore.');
        }
    };

    initializeApp();
});
