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
    const readTextBtn = document.getElementById('read-text-btn');
    const configToggleBtn = document.getElementById('config-toggle-btn');
    const configPanel = document.getElementById('config-panel');
    const closeConfigBtn = document.getElementById('close-config-btn');
    const notificationArea = document.getElementById('notification-area');

    // --- App State ---
    let texts = {};
    let currentText = null;
    let wordsToDictate = [];
    let currentWordIndex = 0;
    let fKeyPressCount = 0;
    let originalTitle = null;
    let highlightedWord = null;

    // --- Functions ---

    /**
     * Shows a non-blocking notification to the user.
     * @param {string} message The message to display.
     * @param {number} duration Time in ms to show the message.
     */
    const showNotification = (message, duration = 3000) => {
        notificationArea.textContent = message;
        notificationArea.classList.remove('hidden');
        setTimeout(() => {
            notificationArea.classList.add('hidden');
        }, duration);
    };

    /**
     * Loads all text fragments from IndexedDB in parallel for better performance.
     */
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

    /**
     * Updates the text selection list in the UI.
     */
    const updateTextList = () => {
        textSelect.innerHTML = '';
        for (const title in texts) {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            textSelect.appendChild(option);
        }
    };

    /**
     * Opens the modal for creating or editing a text.
     * @param {string} title The title of the text.
     * @param {string} content The content of the text.
     * @param {boolean} isEditing Flag to indicate if we are editing an existing text.
     */
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

    /**
     * Saves a new text or updates an existing one in IndexedDB.
     */
    const saveText = async () => {
        const newTitle = textTitleInput.value.trim();
        const content = textContentTextarea.value.trim();
        if (newTitle && content) {
            if (originalTitle && originalTitle !== newTitle) {
                await idb.del(`${DB_PREFIX}${originalTitle}`);
            }
            await idb.set(`${DB_PREFIX}${newTitle}`, content);
            await loadTexts();
            closeModal();
        }
    };

    /**
     * Deletes the currently selected text from IndexedDB.
     */
    const deleteText = async () => {
        const title = textSelect.value;
        if (title) {
            await idb.del(`${DB_PREFIX}${title}`);
            await loadTexts();
            textDisplay.innerHTML = '';
        }
    };

    /**
     * Displays the selected text and prepares for dictation.
     */
    const displayText = async () => {
        const title = textSelect.value;
        if (title && texts[title]) {
            currentText = texts[title];
            wordsToDictate = currentText.split(' ').filter(w => w.length > 0);
            currentWordIndex = 0;
            fKeyPressCount = 0;
            writingInput.value = '';
            textDisplay.innerHTML = wordsToDictate.map(word => `<span>${word}</span>`).join(' ');

            const lang = await detectLanguage(currentText);
            textDisplay.lang = lang;
            writingInput.lang = lang;
            updateWordHighlight();
        }
    };

    /**
     * Reads the entire current text aloud with word highlighting.
     */
    const speakText = () => {
        if (!currentText || !('speechSynthesis' in window)) {
            return;
        }
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(currentText);
        utterance.lang = textDisplay.lang || 'en';
        utterance.rate = parseFloat(speedSlider.value);

        const words = Array.from(textDisplay.querySelectorAll('span'));

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                if (highlightedWord) {
                    highlightedWord.classList.remove('highlight');
                }
                let charCount = 0;
                for (const word of words) {
                    const wordText = word.textContent;
                    if (event.charIndex >= charCount && event.charIndex < charCount + wordText.length) {
                        word.classList.add('highlight');
                        highlightedWord = word;
                        break;
                    }
                    charCount += wordText.length + 1;
                }
            }
        };

        utterance.onend = () => {
            if (highlightedWord) {
                highlightedWord.classList.remove('highlight');
                highlightedWord = null;
            }
        };

        speechSynthesis.speak(utterance);
    };

    const updateWordHighlight = () => {
        const words = textDisplay.querySelectorAll('span');
        words.forEach((word, index) => {
            word.classList.remove('highlight');
            if (index === currentWordIndex) {
                word.classList.add('highlight');
            }
        });
    };

    const speakWord = (word, rate = 1.0) => {
        if (!('speechSynthesis' in window)) return;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = textDisplay.lang || 'en';
        utterance.rate = rate;
        speechSynthesis.speak(utterance);
    };

    /**
     * Handles user input during dictation practice.
     */
    const handleDictationInput = (event) => {
        // Helper to strip punctuation for comparison
        const stripPunctuation = (str) => str.replace(/[\p{P}]/gu, '');

        if (event.key === 'Enter') {
            event.preventDefault();
            if (hideTextCheckbox.checked && currentWordIndex < wordsToDictate.length) {
                speakWord(wordsToDictate[currentWordIndex]);
            }
            return;
        }

        if (event.key.toLowerCase() === 'f') {
            event.preventDefault();
            if (hideTextCheckbox.checked && currentWordIndex < wordsToDictate.length) {
                 const speed = 1.0 - (0.2 * fKeyPressCount);
                 speakWord(wordsToDictate[currentWordIndex], Math.max(0.2, speed));
                 fKeyPressCount++;
            }
            return;
        }

        const typedValue = stripPunctuation(writingInput.value.trim());
        const currentWord = stripPunctuation(wordsToDictate[currentWordIndex]);

        if (typedValue === currentWord) {
            speakWord(wordsToDictate[currentWordIndex]);
            writingInput.value = '';
            currentWordIndex++;
            fKeyPressCount = 0;
            if (currentWordIndex < wordsToDictate.length) {
                updateWordHighlight();
            } else {
                showNotification('Dictation complete!');
            }
        }
    };

    const toggleHideText = () => {
        textDisplay.style.visibility = hideTextCheckbox.checked ? 'hidden' : 'visible';
        if (hideTextCheckbox.checked) {
            writingInput.focus();
            currentWordIndex = 0;
            updateWordHighlight();
            if (wordsToDictate.length > 0) {
                speakWord(wordsToDictate[0]);
            }
        }
    };

    // --- Configuration ---
    const saveConfig = async () => {
        const config = {
            fontSize: fontSizeSelect.value,
            fontFamily: fontFamilySelect.value,
        };
        await idb.set(DB_CONFIG_KEY, config);
    };

    const applyConfig = (config) => {
        const fontSize = config.fontSize || '28px'; // Increased default size
        const fontFamily = config.fontFamily || 'Arial, sans-serif';

        fontSizeSelect.value = fontSize;
        fontFamilySelect.value = fontFamily;

        const elementsToStyle = [textDisplay, writingInput];
        elementsToStyle.forEach(el => {
            if (el) {
                el.style.fontSize = fontSize;
                el.style.fontFamily = fontFamily;
            }
        });
    };

    const loadConfig = async () => {
        const config = await idb.get(DB_CONFIG_KEY);
        // Apply default or loaded config
        applyConfig(config || {});
    };

    // --- Event Listeners ---

    // Text management
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

    // Dictation controls
    readTextBtn.addEventListener('click', speakText);
    writingInput.addEventListener('keyup', handleDictationInput);

    // Event Delegation for word clicks
    textDisplay.addEventListener('click', (event) => {
        if (event.target.tagName === 'SPAN') {
            const word = event.target.textContent;
            const sourceLang = textDisplay.lang || 'auto';
            const targetLang = 'en';
            const url = `https://translate.google.com/?sl=${sourceLang}&tl=${targetLang}&text=${encodeURIComponent(word)}&op=translate`;
            window.open(url, '_blank');
        }
    });

    // Configuration Panel
    configToggleBtn.addEventListener('click', () => configPanel.classList.toggle('config-panel-hidden'));
    closeConfigBtn.addEventListener('click', () => configPanel.classList.add('config-panel-hidden'));
    hideTextCheckbox.addEventListener('change', toggleHideText);

    const handleConfigChange = () => {
        applyConfig({
            fontSize: fontSizeSelect.value,
            fontFamily: fontFamilySelect.value
        });
        saveConfig();
    };
    fontSizeSelect.addEventListener('change', handleConfigChange);
    fontFamilySelect.addEventListener('change', handleConfigChange);


    // --- Initial Load ---
    const initializeApp = async () => {
        await loadConfig();
        await loadTexts();
    };

    initializeApp();
});
