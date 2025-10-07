// dictation.js
import * as idb from './lib/idb-keyval-wrapper.js';
import { detectLanguage } from './lib/detect-language.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
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

    // App state
    let texts = {};
    let currentText = null;
    let wordsToDictate = [];
    let currentWordIndex = 0;
    let fKeyPressCount = 0;
    let originalTitle = null;

    // Functions
    const loadTexts = async () => {
        const keys = await idb.keys();
        texts = {};
        for (const key of keys) {
            if (key.startsWith('dictation-')) {
                const title = key.substring('dictation-'.length);
                texts[title] = await idb.get(key);
            }
        }
        updateTextList();
    };

    const updateTextList = () => {
        textSelect.innerHTML = '';
        for (const title in texts) {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            textSelect.appendChild(option);
        }
    };

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
                // If the title has changed, delete the old entry
                await idb.del(`dictation-${originalTitle}`);
            }
            await idb.set(`dictation-${newTitle}`, content);
            await loadTexts();
            closeModal();
        }
    };

    const deleteText = async () => {
        const title = textSelect.value;
        if (title) {
            await idb.del(`dictation-${title}`);
            await loadTexts();
            textDisplay.innerHTML = '';
        }
    };

    const handleWordClick = (event) => {
        const word = event.target.textContent;
        const sourceLang = textDisplay.lang || 'auto';
        const targetLang = 'en'; // Default to English
        const url = `https://translate.google.com/?sl=${sourceLang}&tl=${targetLang}&text=${encodeURIComponent(word)}&op=translate`;
        window.open(url, '_blank');
    };

    const displayText = async () => {
        const title = textSelect.value;
        if (title && texts[title]) {
            currentText = texts[title];
            wordsToDictate = currentText.split(' ').filter(w => w.length > 0);
            currentWordIndex = 0;
            fKeyPressCount = 0;
            writingInput.value = '';
            textDisplay.innerHTML = wordsToDictate.map(word => `<span>${word}</span>`).join(' ');

            textDisplay.querySelectorAll('span').forEach(wordSpan => {
                wordSpan.addEventListener('click', handleWordClick);
            });

            const lang = await detectLanguage(currentText);
            textDisplay.lang = lang;
            writingInput.lang = lang;
            updateWordHighlight();
        }
    };

    const speakText = () => {
        if (!currentText || !('speechSynthesis' in window)) {
            return;
        }

        speechSynthesis.cancel(); // Cancel any previous speech

        const utterance = new SpeechSynthesisUtterance(currentText);
        utterance.lang = textDisplay.lang || 'en';
        utterance.rate = parseFloat(speedSlider.value);

        const words = textDisplay.querySelectorAll('span');
        let currentWordIndex = 0;

        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                // Find the current word based on charIndex
                for (let i = 0; i < words.length; i++) {
                    words[i].classList.remove('highlight');
                }
                let charCount = 0;
                for (let i = 0; i < words.length; i++) {
                    const word = words[i].textContent;
                    if (event.charIndex >= charCount && event.charIndex < charCount + word.length) {
                        words[i].classList.add('highlight');
                        break;
                    }
                    charCount += word.length + 1; // +1 for the space
                }
            }
        };

        utterance.onend = () => {
            for (let i = 0; i < words.length; i++) {
                words[i].classList.remove('highlight');
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

    const handleDictationInput = (event) => {
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


        const typedValue = writingInput.value.trim();
        const currentWord = wordsToDictate[currentWordIndex];

        if (typedValue === currentWord) {
            speakWord(currentWord);
            writingInput.value = '';
            currentWordIndex++;
            fKeyPressCount = 0; // Reset on correct word
            if (currentWordIndex < wordsToDictate.length) {
                updateWordHighlight();
                 if (hideTextCheckbox.checked) {
                    // In hide mode, we don't auto-speak the next word. User presses Enter.
                }
            } else {
                // End of dictation
                alert('Dictation complete!');
            }
        }
    };

    const toggleHideText = () => {
        textDisplay.style.visibility = hideTextCheckbox.checked ? 'hidden' : 'visible';
        if (hideTextCheckbox.checked) {
            writingInput.focus();
            currentWordIndex = 0;
            updateWordHighlight();
             // Speak the first word to start things off
            if(wordsToDictate.length > 0) {
                speakWord(wordsToDictate[0]);
            }
        }
    };


    const saveConfig = async () => {
        const config = {
            fontSize: fontSizeSelect.value,
            fontFamily: fontFamilySelect.value,
        };
        await idb.set('dictation-config', config);
    };

    const applyConfig = (config) => {
        const fontSize = config.fontSize || '20px';
        const fontFamily = config.fontFamily || 'Arial';

        fontSizeSelect.value = fontSize;
        fontFamilySelect.value = fontFamily;

        textDisplay.style.fontSize = fontSize;
        writingInput.style.fontSize = fontSize;
        textDisplay.style.fontFamily = fontFamily;
        writingInput.style.fontFamily = fontFamily;
    };

    const loadConfig = async () => {
        const config = await idb.get('dictation-config');
        if (config) {
            applyConfig(config);
        }
    };

    // Event Listeners
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
    readTextBtn.addEventListener('click', speakText);
    writingInput.addEventListener('keyup', handleDictationInput);
    hideTextCheckbox.addEventListener('change', toggleHideText);
    fontSizeSelect.addEventListener('change', () => {
        textDisplay.style.fontSize = fontSizeSelect.value;
        writingInput.style.fontSize = fontSizeSelect.value;
        saveConfig();
    });
    fontFamilySelect.addEventListener('change', () => {
        textDisplay.style.fontFamily = fontFamilySelect.value;
        writingInput.style.fontFamily = fontFamilySelect.value;
        saveConfig();
    });


    // Initial load
    loadConfig();
    loadTexts();
});
