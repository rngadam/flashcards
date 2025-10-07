// dictation.js
import * as idb from './lib/idb-keyval-wrapper.js';
import { detectLanguage } from './lib/detect-language.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const DB_PREFIX = 'dictation-';
    const DB_CONFIG_KEY = 'dictation-config';

    // --- DOM Elements ---
    const textSelect = document.getElementById('text-select');
    const newTextBtn = document.getElementById('new-text-btn');
    const editTextBtn = document.getElementById('edit-text-btn');
    const deleteTextBtn = document.getElementById('delete-text-btn');
    const textDisplay = document.getElementById('text-display');
    const speakerIcon = document.getElementById('speaker-icon');
    const writingInput = document.getElementById('writing-input');
    const speedSlider = document.getElementById('speed-slider');
    const fontSizeSelect = document.getElementById('font-size-select');
    const fontFamilySelect = document.getElementById('font-family-select');
    const hideTextCheckbox = document.getElementById('hide-text-checkbox');
    const modal = document.getElementById('modal');
    const closeButton = document.querySelector('.close-button');
    const textTitleInput = document.getElementById('text-title-input');
    const textContentTextarea = document.getElementById('text-content-textarea');
    const saveTextBtn = document.getElementById('save-text-btn');
    const readAloudBtn = document.getElementById('read-aloud-btn');
    const repeatWordBtn = document.getElementById('repeat-word-btn');
    const configToggleBtn = document.getElementById('config-toggle-btn');
    const configPanel = document.getElementById('config-panel');
    const closeConfigBtn = document.getElementById('close-config-btn');
    const notificationArea = document.getElementById('notification-area');

    // --- App State ---
    let texts = {};
    let sourceWords = [];
    let currentWordIndex = 0;
    let originalTitle = null;
    let highlightedWordSpan = null;

    // --- Utility Functions ---
    const stripPunctuation = (str) => str.replace(/[\p{P}]/gu, '');

    const showNotification = (message, duration = 3000) => {
        notificationArea.textContent = message;
        notificationArea.classList.remove('hidden');
        setTimeout(() => {
            notificationArea.classList.add('hidden');
        }, duration);
    };

    // --- Core Data Functions ---
    const loadTexts = async () => {
        const keys = await idb.keys();
        const dictationKeys = keys.filter(key => key.startsWith(DB_PREFIX));
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

    const updateTextList = () => {
        const selectedValue = textSelect.value;
        textSelect.innerHTML = '';
        Object.keys(texts).forEach(title => {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            textSelect.appendChild(option);
        });
        textSelect.value = selectedValue;
    };

    // --- Modal & CRUD Functions ---
    const openModal = (title = '', content = '', isEditing = false) => {
        textTitleInput.value = title;
        textContentTextarea.value = content;
        originalTitle = isEditing ? title : null;
        modal.style.display = 'block';
    };

    const closeModal = () => {
        modal.style.display = 'none';
        originalTitle = null;
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
            textSelect.value = newTitle; // Select the new/edited text
            displayText();
            closeModal();
        }
    };

    const deleteText = async () => {
        const title = textSelect.value;
        if (title && confirm(`Are you sure you want to delete "${title}"?`)) {
            await idb.del(`${DB_PREFIX}${title}`);
            textDisplay.innerHTML = '';
            writingInput.value = '';
            await loadTexts();
        }
    };

    // --- Dictation & Display Logic ---
    const displayText = async () => {
        const title = textSelect.value;
        if (title && texts[title]) {
            sourceWords = texts[title].split(' ').filter(w => w.length > 0);
            currentWordIndex = 0;
            writingInput.value = '';

            textDisplay.innerHTML = sourceWords.map(word => `<span>${word}</span>`).join(' ');

            const lang = await detectLanguage(texts[title]);
            textDisplay.lang = lang;
            writingInput.lang = lang;

            handleContinuousInput(); // Initial validation state
            speakNextWord();
        }
    };

    const handleContinuousInput = () => {
        const sourceSpans = Array.from(textDisplay.querySelectorAll('span'));
        const inputWords = writingInput.value.split(' ').filter(w => w.length > 0);

        let lastCorrectIndex = -1;

        sourceSpans.forEach((span, index) => {
            span.classList.remove('correct', 'incorrect');
            if (index < inputWords.length) {
                // Punctuation is included for visual matching
                if (inputWords[index] === sourceWords[index]) {
                    span.classList.add('correct');
                    lastCorrectIndex = index;
                } else {
                    span.classList.add('incorrect');
                }
            }
        });

        const newWordIndex = lastCorrectIndex + 1;
        if (newWordIndex > currentWordIndex && newWordIndex < sourceWords.length) {
            currentWordIndex = newWordIndex;
            speakWord(stripPunctuation(sourceWords[currentWordIndex - 1])); // Re-read successful word
            speakNextWord(); // Read the next word to be typed
        }
        currentWordIndex = newWordIndex;


        // Check for full completion
        if (writingInput.value.trim() === sourceWords.join(' ')) {
            showNotification('Dictation complete!', 5000);
        }
    };

    const speakWord = (word, rate) => {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = textDisplay.lang || 'en';
        utterance.rate = rate || parseFloat(speedSlider.value);
        speechSynthesis.speak(utterance);
    };

    const speakNextWord = () => {
        if (currentWordIndex < sourceWords.length) {
            speakWord(stripPunctuation(sourceWords[currentWordIndex]));
        }
    };

    const repeatCurrentWord = () => {
        if (currentWordIndex < sourceWords.length) {
            const speed = 1.0 - (0.2 * (fKeyPressCount++));
            speakWord(stripPunctuation(sourceWords[currentWordIndex]), Math.max(0.2, speed));
        }
    };

    const speakText = () => {
        if (!sourceWords.length || !('speechSynthesis' in window)) {
            return;
        }
        speechSynthesis.cancel();
        const fullText = sourceWords.join(' ');
        const utterance = new SpeechSynthesisUtterance(fullText);
        utterance.lang = textDisplay.lang || 'en';
        utterance.rate = parseFloat(speedSlider.value);

        utterance.onend = () => {
             if (highlightedWordSpan) {
                highlightedWordSpan.classList.remove('highlight');
                highlightedWordSpan = null;
            }
        };
        speechSynthesis.speak(utterance);
    };

    const toggleHideText = () => {
        const isHidden = hideTextCheckbox.checked;
        textDisplay.classList.toggle('hidden', isHidden);
        speakerIcon.classList.toggle('hidden', !isHidden);
        if (isHidden) {
            writingInput.focus();
            speakNextWord();
        }
    };

    // --- Configuration ---
    const saveConfig = async () => {
        const config = {
            fontSize: fontSizeSelect.value,
            fontFamily: fontFamilySelect.value,
            hideText: hideTextCheckbox.checked,
            speed: speedSlider.value,
        };
        await idb.set(DB_CONFIG_KEY, config);
    };

    const applyConfig = (config) => {
        const elementsToStyle = [textDisplay, writingInput];
        elementsToStyle.forEach(el => {
            if (el) {
                el.style.fontSize = config.fontSize;
                el.style.fontFamily = config.fontFamily;
            }
        });
    };

    const loadConfig = async () => {
        const config = await idb.get(DB_CONFIG_KEY) || {};
        fontSizeSelect.value = config.fontSize || '28px';
        fontFamilySelect.value = config.fontFamily || 'Arial, sans-serif';
        speedSlider.value = config.speed || '1';
        hideTextCheckbox.checked = config.hideText || false;

        applyConfig({
            fontSize: fontSizeSelect.value,
            fontFamily: fontFamilySelect.value
        });
        toggleHideText(); // Apply initial state
    };

    // --- Event Listeners ---
    newTextBtn.addEventListener('click', () => openModal());
    editTextBtn.addEventListener('click', () => {
        const title = textSelect.value;
        if (title && texts[title]) {
            openModal(title, texts[title], true);
        }
    });
    deleteTextBtn.addEventListener('click', deleteText);
    saveTextBtn.addEventListener('click', saveText);
    closeButton.addEventListener('click', closeModal);
    textSelect.addEventListener('change', displayText);

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

    const handleConfigChange = () => {
        applyConfig({ fontSize: fontSizeSelect.value, fontFamily: fontFamilySelect.value });
        saveConfig();
    };

    fontSizeSelect.addEventListener('change', handleConfigChange);
    fontFamilySelect.addEventListener('change', handleConfigChange);
    speedSlider.addEventListener('input', saveConfig);
    hideTextCheckbox.addEventListener('change', () => {
        toggleHideText();
        saveConfig();
    });

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'f') {
            event.preventDefault();
            repeatCurrentWord();
        }
        if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault();
            speakText();
        }
    });

    // --- Initial Load ---
    const initializeApp = async () => {
        await loadConfig();
        await loadTexts();
    };

    initializeApp();
});
