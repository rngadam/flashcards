document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const settingsButton = document.getElementById('settings-button');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const configTitle = document.getElementById('config-title');
    const loadDataButton = document.getElementById('load-data');
    const saveConfigButton = document.getElementById('save-config');
    const dataUrlInput = document.getElementById('data-url');
    const frontColumnSelect = document.getElementById('front-column');
    const backColumnSelect = document.getElementById('back-column');
    const fontSelector = document.getElementById('font-selector');
    const ttsFrontCheckbox = document.getElementById('tts-front');
    const ttsBackCheckbox = document.getElementById('tts-back');
    const ttsFrontLangSelect = document.getElementById('tts-front-lang');
    const ttsBackLangSelect = document.getElementById('tts-back-lang');
    const configNameInput = document.getElementById('config-name');
    const configSelector = document.getElementById('config-selector');
    const cardContainer = document.getElementById('card-container');
    const cardFront = document.querySelector('.card-front');
    const cardBack = document.querySelector('.card-back');
    const flipCardButton = document.getElementById('flip-card');
    const card = document.getElementById('card');
    const nextCardButton = document.getElementById('next-card');
    const prevCardButton = document.getElementById('prev-card');
    const iKnowButton = document.getElementById('i-know');
    const iDontKnowButton = document.getElementById('i-dont-know');

    // App state
    let cardData = [];
    let headers = [];
    let currentCardIndex = 0;
    let configs = {};
    let cardStatus = []; // for spaced repetition
    let voices = [];
    let viewHistory = [];

    // --- Event Listeners ---
    settingsButton.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsButton.addEventListener('click', () => settingsModal.classList.add('hidden'));
    loadDataButton.addEventListener('click', loadData);
    saveConfigButton.addEventListener('click', saveConfig);
    configSelector.addEventListener('change', () => loadSelectedConfig(configSelector.value));
    flipCardButton.addEventListener('click', flipCard);
    nextCardButton.addEventListener('click', () => showNextCard());
    prevCardButton.addEventListener('click', showPrevCard);
    iKnowButton.addEventListener('click', () => { markCardAsKnown(true); showNextCard(); });
    iDontKnowButton.addEventListener('click', () => { markCardAsKnown(false); showNextCard({forceNew: true}); });
    frontColumnSelect.addEventListener('change', () => displayCard(currentCardIndex));
    backColumnSelect.addEventListener('change', () => displayCard(currentCardIndex));
    fontSelector.addEventListener('change', () => {
        cardContainer.style.fontFamily = fontSelector.value;
    });
    document.addEventListener('keydown', handleHotkeys);


    // --- Functions ---
    function loadData() {
        const url = dataUrlInput.value;
        if (!url) {
            alert('Please enter a data source URL.');
            return Promise.reject('No URL provided');
        }

        return fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.text();
            })
            .then(text => {
                parseData(text);
                if (cardData.length > 0) {
                    displayCard(0);
                }
                settingsModal.classList.add('hidden');
            })
            .catch(error => {
                alert(`Failed to load data: ${error.message}`);
            });
    }

    function parseData(text) {
        const rows = text.trim().split('\n');
        // Simple parser for TSV/CSV
        if (rows[0].includes('\t')) {
            headers = rows[0].split('\t');
            cardData = rows.slice(1).map(row => row.split('\t'));
        } else {
            headers = rows[0].split(',');
            cardData = rows.slice(1).map(row => row.split(','));
        }
        cardStatus = new Array(cardData.length).fill(0); // 0 = unseen, >0 = known level
        viewHistory = []; // Reset history for new deck
        populateColumnSelectors();
    }

    function populateColumnSelectors() {
        frontColumnSelect.innerHTML = '';
        backColumnSelect.innerHTML = '';
        headers.forEach((header, index) => {
            const option1 = new Option(header, index);
            const option2 = new Option(header, index);
            frontColumnSelect.add(option1);
            backColumnSelect.add(option2);
        });
        if (headers.length > 1) {
            frontColumnSelect.value = 0;
            backColumnSelect.value = 1;
        }
    }

    function flipCard() {
        card.classList.toggle('flipped');
        if (card.classList.contains('flipped') && ttsBackCheckbox.checked) {
            speak(cardBack.textContent, ttsBackLangSelect.value);
        } else if (!card.classList.contains('flipped') && ttsFrontCheckbox.checked) {
            speak(cardFront.textContent, ttsFrontLangSelect.value);
        }
    }

    function displayCard(index, isNavigatingBack = false) {
        if (cardData.length === 0 || index < 0 || index >= cardData.length) return;

        if (!isNavigatingBack && index !== currentCardIndex) {
            viewHistory.push(currentCardIndex);
        }

        currentCardIndex = index;
        const frontColumn = frontColumnSelect.value;
        const backColumn = backColumnSelect.value;
        cardFront.textContent = cardData[currentCardIndex][frontColumn];
        cardBack.textContent = cardData[currentCardIndex][backColumn];
        card.classList.remove('flipped');
        if (ttsFrontCheckbox.checked) {
            speak(cardFront.textContent, ttsFrontLangSelect.value);
        }
    }

    function showNextCard({forceNew = false} = {}) {
        if (cardData.length === 0) {
            // No alert needed if there are no cards to begin with.
            return;
        }

        let minStatus = Math.min(...cardStatus);
        let potentialIndices = cardStatus.map((s, i) => s === minStatus ? i : -1).filter(i => i !== -1);

        if (forceNew && potentialIndices.length > 1) {
            potentialIndices = potentialIndices.filter(i => i !== currentCardIndex);
        }

        if (potentialIndices.length > 0) {
            const nextIndex = potentialIndices[Math.floor(Math.random() * potentialIndices.length)];
            displayCard(nextIndex);
        } else {
             alert("You've reviewed all cards!");
        }
    }

    function showPrevCard() {
        if (viewHistory.length > 0) {
            const prevIndex = viewHistory.pop();
            displayCard(prevIndex, true);
        }
    }

    function markCardAsKnown(known) {
        if (known) {
            cardStatus[currentCardIndex]++;
        } else {
            cardStatus[currentCardIndex] = 0; // Reset progress
        }
    }

    function saveConfig() {
        const configName = configNameInput.value;
        if (!configName) {
            alert('Please enter a configuration name.');
            return;
        }
        configs[configName] = {
            dataUrl: dataUrlInput.value,
            frontColumn: frontColumnSelect.value,
            backColumn: backColumnSelect.value,
            font: fontSelector.value,
            ttsFront: ttsFrontCheckbox.checked,
            ttsBack: ttsBackCheckbox.checked,
            ttsFrontLang: ttsFrontLangSelect.value,
            ttsBackLang: ttsBackLangSelect.value,
        };
        localStorage.setItem('flashcard-configs', JSON.stringify(configs));
        localStorage.setItem('flashcard-last-config', configName);
        populateConfigSelector();
        configSelector.value = configName;
        configTitle.textContent = configName;
        alert(`Configuration '${configName}' saved!`);
    }

    function loadSelectedConfig(configName) {
        if (!configName || !configs[configName]) return;
        const config = configs[configName];

        configNameInput.value = configName;
        dataUrlInput.value = config.dataUrl;
        fontSelector.value = config.font;
        ttsFrontCheckbox.checked = config.ttsFront;
        ttsBackCheckbox.checked = config.ttsBack;
        cardContainer.style.fontFamily = config.font;
        configTitle.textContent = configName;

        loadData().then(() => {
            frontColumnSelect.value = config.frontColumn;
            backColumnSelect.value = config.backColumn;
            ttsFrontLangSelect.value = config.ttsFrontLang;
            ttsBackLangSelect.value = config.ttsBackLang;
            // Per instructions, ensure we start from the first card.
            // Note: displayCard(0) is also called in loadData, making this redundant but harmless.
            displayCard(0);
            localStorage.setItem('flashcard-last-config', configName);
        });
    }

    function populateConfigSelector() {
        configSelector.innerHTML = '<option value="">-- Load a Configuration --</option>';
        Object.keys(configs).forEach(name => {
            const option = new Option(name, name);
            configSelector.add(option);
        });
    }

    function loadInitialConfigs() {
        const savedConfigs = localStorage.getItem('flashcard-configs');
        if (savedConfigs) {
            configs = JSON.parse(savedConfigs);
            populateConfigSelector();
        }

        const lastConfig = localStorage.getItem('flashcard-last-config');
        if (lastConfig && configs[lastConfig]) {
            configSelector.value = lastConfig;
            loadSelectedConfig(lastConfig);
        } else {
            settingsModal.classList.remove('hidden');
        }
    }

    function populateVoices() {
        voices = speechSynthesis.getVoices();
        ttsFrontLangSelect.innerHTML = '';
        ttsBackLangSelect.innerHTML = '';
        voices.forEach(voice => {
            const option1 = new Option(`${voice.name} (${voice.lang})`, voice.name);
            const option2 = new Option(`${voice.name} (${voice.lang})`, voice.name);
            ttsFrontLangSelect.add(option1);
            ttsBackLangSelect.add(option2);
        });
    }

    function speak(text, voiceName) {
        if (!('speechSynthesis' in window)) {
            alert('Text-to-speech not supported in this browser.');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        if (voiceName) {
            const voice = voices.find(v => v.name === voiceName);
            if (voice) {
                utterance.voice = voice;
            }
        }
        window.speechSynthesis.speak(utterance);
    }

    function handleHotkeys(e) {
        // Don't trigger hotkeys if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        switch(e.key) {
            case ' ': // Space bar
                e.preventDefault();
                flipCard();
                break;
            case 'ArrowRight':
                showNextCard();
                break;
            case 'ArrowLeft':
                showPrevCard();
                break;
            case 'k':
                markCardAsKnown(true);
                showNextCard();
                break;
            case 'j':
                markCardAsKnown(false);
                showNextCard({forceNew: true});
                break;
        }
    }

    // Initial load
    populateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoices;
    }
    loadInitialConfigs();
});
