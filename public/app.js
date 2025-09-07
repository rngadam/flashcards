document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const loadDataButton = document.getElementById('load-data');
    const saveConfigButton = document.getElementById('save-config');
    const dataUrlInput = document.getElementById('data-url');
    const frontColumnSelect = document.getElementById('front-column');
    const backColumnSelect = document.getElementById('back-column');
    const fontSelector = document.getElementById('font-selector');
    const ttsFrontCheckbox = document.getElementById('tts-front');
    const ttsBackCheckbox = document.getElementById('tts-back');
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

    // --- Event Listeners ---
    loadDataButton.addEventListener('click', loadData);
    saveConfigButton.addEventListener('click', saveConfig);
    configSelector.addEventListener('change', loadSelectedConfig);
    flipCardButton.addEventListener('click', flipCard);
    nextCardButton.addEventListener('click', showNextCard);
    prevCardButton.addEventListener('click', showPrevCard);
    iKnowButton.addEventListener('click', () => { markCardAsKnown(true); showNextCard(); });
    iDontKnowButton.addEventListener('click', () => { markCardAsKnown(false); showNextCard(); });
    frontColumnSelect.addEventListener('change', () => displayCard(currentCardIndex));
    backColumnSelect.addEventListener('change', () => displayCard(currentCardIndex));
    fontSelector.addEventListener('change', () => {
        cardContainer.style.fontFamily = fontSelector.value;
    });
    document.addEventListener('keydown', handleHotkeys);


    // --- Functions ---
    async function loadData() {
        const url = dataUrlInput.value;
        if (!url) {
            alert('Please enter a data source URL.');
            return;
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            parseData(text);
        } catch (error) {
            alert(`Failed to load data: ${error.message}`);
        }
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
        populateColumnSelectors();
        displayCard(0);
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
            speak(cardBack.textContent);
        } else if (!card.classList.contains('flipped') && ttsFrontCheckbox.checked) {
            speak(cardFront.textContent);
        }
    }

    function displayCard(index) {
        if (cardData.length === 0 || index < 0 || index >= cardData.length) return;
        currentCardIndex = index;
        const frontColumn = frontColumnSelect.value;
        const backColumn = backColumnSelect.value;
        cardFront.textContent = cardData[currentCardIndex][frontColumn];
        cardBack.textContent = cardData[currentCardIndex][backColumn];
        card.classList.remove('flipped');
        if (ttsFrontCheckbox.checked) {
            speak(cardFront.textContent);
        }
    }

    function showNextCard() {
        // Spaced repetition logic: find next card to show
        let nextIndex = -1;
        // Prioritize unseen cards
        const unseenIndices = cardStatus.map((s, i) => s === 0 ? i : -1).filter(i => i !== -1);
        if (unseenIndices.length > 0) {
            nextIndex = unseenIndices[0];
        } else {
            // Or show the least known card
            let minStatus = Math.min(...cardStatus);
            nextIndex = cardStatus.indexOf(minStatus);
        }

        if(nextIndex !== -1) {
            displayCard(nextIndex);
        } else {
            alert("You've reviewed all cards!");
        }
    }

    function showPrevCard() {
        if (currentCardIndex > 0) {
            displayCard(currentCardIndex - 1);
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
        };
        localStorage.setItem('flashcard-configs', JSON.stringify(configs));
        populateConfigSelector();
        alert(`Configuration '${configName}' saved!`);
    }

    function loadSelectedConfig() {
        const configName = configSelector.value;
        if (!configName || !configs[configName]) return;
        const config = configs[configName];

        configNameInput.value = configName;
        dataUrlInput.value = config.dataUrl;
        fontSelector.value = config.font;
        ttsFrontCheckbox.checked = config.ttsFront;
        ttsBackCheckbox.checked = config.ttsBack;
        cardContainer.style.fontFamily = config.font;


        loadData().then(() => {
             // Need to wait for data to load before setting columns
            frontColumnSelect.value = config.frontColumn;
            backColumnSelect.value = config.backColumn;
            displayCard(currentCardIndex);
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
    }

    function speak(text) {
        if (!('speechSynthesis' in window)) {
            alert('Text-to-speech not supported in this browser.');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    }

    function handleHotkeys(e) {
        switch(e.key) {
            case ' ': // Space bar
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
                showNextCard();
                break;
        }
    }

    // Initial load
    loadInitialConfigs();
});
