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
    const writingInput = document.getElementById('writing-input');
    const speedSlider = document.getElementById('speed-slider');
    const fontSizeSelect = document.getElementById('font-size-select');
    const fontFamilySelect = document.getElementById('font-family-select');
    const hideTextCheckbox = document.getElementById('hide-text-checkbox');
    const readNextCheckbox = document.getElementById('read-next-checkbox');
    const readOnCorrectCheckbox = document.getElementById('read-on-correct-checkbox');
    const textTitleInput = document.getElementById('text-title-input');
    const textContentTextarea = document.getElementById('text-content-textarea');
    const saveTextBtn = document.getElementById('save-text-btn');
    const readAloudBtn = document.getElementById('read-aloud-btn');
    const repeatWordBtn = document.getElementById('repeat-word-btn');
    const revealTextBtn = document.getElementById('reveal-text-btn');
    const configToggleBtn = document.getElementById('config-toggle-btn');
    const configPanel = document.getElementById('config-panel');
    const closeConfigBtn = document.getElementById('close-config-btn');
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
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
                title: textSelect.value,
                userInput: writingInput.value
            }));
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
        // A word is considered "complete" if there's trailing whitespace.
        // An empty input is also considered "complete" to reset the state.
        const isInputComplete = /[\s\n]$/.test(inputValue) || inputValue.length === 0;

        let lastCorrectIndex = -1;

        sourceSpans.forEach(span => span.classList.remove('correct', 'incorrect', 'current'));

        sourceSpans.forEach((span, index) => {
            if (index < inputWords.length) {
                const isLastWord = index === inputWords.length - 1;

                if (isLastWord && !isInputComplete) {
                    // Word is being typed, check for prefix match
                    if (!sourceWords[index].startsWith(inputWords[index])) {
                        span.classList.add('incorrect');
                    }
                } else {
                    // Word is complete, check for exact match
                    if (inputWords[index] === sourceWords[index]) {
                        span.classList.add('correct');
                        lastCorrectIndex = index;
                    } else {
                        span.classList.add('incorrect');
                    }
                }
            }
        });

        const newWordIndex = lastCorrectIndex + 1;

        if (newWordIndex > currentWordIndex) {
            currentWordIndex = newWordIndex;
            if (readOnCorrectCheckbox.checked && currentWordIndex > 0) {
                speakWord(stripPunctuation(sourceWords[currentWordIndex - 1]));
            }
            if (readNextCheckbox.checked) {
                speakNextWord();
            }
        } else {
            currentWordIndex = newWordIndex;
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
        speakerIcon.classList.toggle('hidden', !isHidden);
        revealTextBtn.classList.toggle('hidden', !isHidden);
        if (isHidden) {
            writingInput.focus();
            speakNextWord();
        }
    };

    const applyConfig = (config) => {
        // Remove any existing font size or family classes
        writingInput.classList.forEach(c => {
            if (c.startsWith('font-size-') || c.startsWith('font-family-')) {
                writingInput.classList.remove(c);
            }
        });
        textDisplay.classList.forEach(c => {
            if (c.startsWith('font-size-') || c.startsWith('font-family-')) {
                textDisplay.classList.remove(c);
            }
        });

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
        };
        await idb.set(DB_CONFIG_KEY, config);
    };

    const loadConfig = async () => {
        const config = await idb.get(DB_CONFIG_KEY) || {};
        fontSizeSelect.value = config.fontSize || 'font-size-28';
        fontFamilySelect.value = config.fontFamily || 'font-family-arial';
        speedSlider.value = config.speed || '1';
        hideTextCheckbox.checked = config.hideText || false;
        readNextCheckbox.checked = config.readNext !== false; // Default to true
        readOnCorrectCheckbox.checked = config.readOnCorrect !== false; // Default to true

        applyConfig({ fontSize: fontSizeSelect.value, fontFamily: fontFamilySelect.value });
        toggleHideText();
    };

    const handleConfigChange = () => {
        applyConfig({ fontSize: fontSizeSelect.value, fontFamily: fontFamilySelect.value });
        saveConfig();
    };

    // --- Event Listeners & Initial Load ---

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
    readAloudBtn.addEventListener('click', speakText);
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

    writingInput.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
            event.preventDefault();
            repeatCurrentWord();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault();
            speakText();
        } else if (event.key === '`') {
            if (hideTextCheckbox.checked) {
                hideTextCheckbox.checked = false;
                toggleHideText();
                saveConfig();
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            speakText();
        }
    });

    revealTextBtn.addEventListener('click', () => {
        if (hideTextCheckbox.checked) {
            hideTextCheckbox.checked = false;
            toggleHideText();
            saveConfig();
        }
    });

    const initializeApp = async () => {
        await loadConfig();
        await loadTexts();

        const savedSession = loadSession();
        if (savedSession && texts[savedSession.title]) {
            textSelect.value = savedSession.title;
            await displayText(savedSession.userInput);
        }
    };

    initializeApp();
});
