// All the code from app.js, but without the top-level DOMContentLoaded wrapper
// DOM Elements
const settingsButton = document.getElementById('settings-button');
const closeSettingsButton = document.getElementById('close-settings-button');
const settingsModal = document.getElementById('settings-modal');
const configTitle = document.getElementById('config-title');
const loadDataButton = document.getElementById('load-data');
const saveConfigButton = document.getElementById('save-config');
const dataUrlInput = document.getElementById('data-url');
const frontColumnCheckboxes = document.getElementById('front-column-checkboxes');
const backColumnCheckboxes = document.getElementById('back-column-checkboxes');
const fontSelector = document.getElementById('font-selector');
const ttsFrontCheckbox = document.getElementById('tts-front');
const ttsBackCheckbox = document.getElementById('tts-back');
const ttsFrontLangSelect = document.getElementById('tts-front-lang');
const ttsBackLangSelect = document.getElementById('tts-back-lang');
const ttsRateSlider = document.getElementById('tts-rate');
const alternateUppercaseCheckbox = document.getElementById('alternate-uppercase');
const disableAnimationCheckbox = document.getElementById('disable-animation');
const audioOnlyFrontCheckbox = document.getElementById('audio-only-front');
const ttsOnHotkeyOnlyCheckbox = document.getElementById('tts-on-hotkey-only');
const configNameInput = document.getElementById('config-name');
const configSelector = document.getElementById('config-selector');
const cardContainer = document.getElementById('card-container');
const cardStats = document.getElementById('card-stats');
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
let viewCount = [];
let lastViewed = [];
let voices = [];
let viewHistory = [];
let useUppercase = false;

// --- Event Listeners ---
if (settingsButton) settingsButton.addEventListener('click', () => settingsModal.classList.remove('hidden'));
if (closeSettingsButton) closeSettingsButton.addEventListener('click', () => settingsModal.classList.add('hidden'));
if (loadDataButton) loadDataButton.addEventListener('click', loadData);
if (saveConfigButton) saveConfigButton.addEventListener('click', saveConfig);
if (configSelector) configSelector.addEventListener('change', () => loadSelectedConfig(configSelector.value));
if (flipCardButton) flipCardButton.addEventListener('click', flipCard);
if (nextCardButton) nextCardButton.addEventListener('click', () => showNextCard());
if (prevCardButton) prevCardButton.addEventListener('click', showPrevCard);
if (iKnowButton) iKnowButton.addEventListener('click', () => { markCardAsKnown(true); showNextCard(); });
if (iDontKnowButton) iDontKnowButton.addEventListener('click', () => { markCardAsKnown(false); showNextCard({forceNew: true}); });
if (frontColumnCheckboxes) frontColumnCheckboxes.addEventListener('change', () => displayCard(currentCardIndex));
if (backColumnCheckboxes) backColumnCheckboxes.addEventListener('change', () => displayCard(currentCardIndex));
if (fontSelector) fontSelector.addEventListener('change', () => {
    if (cardContainer) cardContainer.style.fontFamily = fontSelector.value;
});
if (disableAnimationCheckbox) disableAnimationCheckbox.addEventListener('change', () => {
    if (disableAnimationCheckbox.checked) {
        card.classList.add('no-animation');
    } else {
        card.classList.remove('no-animation');
    }
});
    if (audioOnlyFrontCheckbox) audioOnlyFrontCheckbox.addEventListener('change', () => displayCard(currentCardIndex));
document.addEventListener('keydown', handleHotkeys);
document.addEventListener('keyup', handleHotkeys);


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
    viewCount = new Array(cardData.length).fill(0);
    lastViewed = new Array(cardData.length).fill(null);
    viewHistory = []; // Reset history for new deck
    populateColumnSelectors();
}

function populateColumnSelectors() {
    frontColumnCheckboxes.innerHTML = '';
    backColumnCheckboxes.innerHTML = '';
    headers.forEach((header, index) => {
        const idFront = `front-col-${index}`;
        const checkboxFront = `<div><input type="checkbox" id="${idFront}" value="${index}"><label for="${idFront}">${header}</label></div>`;
        frontColumnCheckboxes.insertAdjacentHTML('beforeend', checkboxFront);

        const idBack = `back-col-${index}`;
        const checkboxBack = `<div><input type="checkbox" id="${idBack}" value="${index}"><label for="${idBack}">${header}</label></div>`;
        backColumnCheckboxes.insertAdjacentHTML('beforeend', checkboxBack);
    });

    // Default to first and second columns
    if (headers.length > 0) {
        frontColumnCheckboxes.querySelector('input').checked = true;
    }
    if (headers.length > 1) {
        backColumnCheckboxes.querySelectorAll('input')[1].checked = true;
    }
}

function flipCard() {
    card.classList.toggle('flipped');
    document.body.classList.add('is-flipping');
    setTimeout(() => {
        document.body.classList.remove('is-flipping');
    }, 600); // Corresponds to the animation duration

        if (ttsOnHotkeyOnlyCheckbox.checked) return;

    if (card.classList.contains('flipped') && ttsBackCheckbox.checked) {
        speak(cardBack.textContent, ttsBackLangSelect.value);
    } else if (!card.classList.contains('flipped') && ttsFrontCheckbox.checked) {
            speak(originalFrontText, ttsFrontLangSelect.value);
    }
}

function adjustFontSize(element) {
    const container = element.parentElement;
    let min = 10, max = 150; // Min and max font sizes
    let bestSize = min;

    while (min <= max) {
        let mid = Math.floor((min + max) / 2);
        element.style.fontSize = `${mid}px`;
        if (element.scrollWidth <= container.clientWidth && element.scrollHeight <= container.clientHeight) {
            bestSize = mid; // This size fits, try for a larger one
            min = mid + 1;
        } else {
            max = mid - 1; // This size is too big, try a smaller one
        }
    }
    element.style.fontSize = `${bestSize}px`;
}

function formatTimeAgo(timestamp) {
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

function displayCard(index, isNavigatingBack = false) {
    if (cardData.length === 0 || index < 0 || index >= cardData.length) return;

    if (!isNavigatingBack && index !== currentCardIndex) {
        viewHistory.push(currentCardIndex);
    }

    currentCardIndex = index;
    replayRate = 1.0; // Reset replay rate for new card

    // Update stats
    viewCount[currentCardIndex]++;
    lastViewed[currentCardIndex] = Date.now();

    const frontColumns = Array.from(frontColumnCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
    const backColumns = Array.from(backColumnCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

    const originalFrontText = frontColumns.map(colIndex => cardData[currentCardIndex][colIndex]).join('\n');
    let displayText = originalFrontText;
    if (alternateUppercaseCheckbox.checked) {
        if (useUppercase) {
            displayText = originalFrontText.toUpperCase();
        }
        useUppercase = !useUppercase; // Alternate for the next card
    }

    if (audioOnlyFrontCheckbox.checked) {
        cardFront.innerHTML = '<span class="speech-icon">🔊</span>';
    } else {
        cardFront.textContent = displayText;
    }
    cardBack.textContent = backColumns.map(colIndex => cardData[currentCardIndex][colIndex]).join('\n');

    // Reset font size before adjusting
    cardFront.style.fontSize = '';
    cardBack.style.fontSize = '';

    // Adjust font size after a short delay to allow rendering
    setTimeout(() => {
        adjustFontSize(cardFront);
        adjustFontSize(cardBack);
    }, 50);

    card.classList.remove('flipped');
        if (ttsFrontCheckbox.checked && !ttsOnHotkeyOnlyCheckbox.checked) {
        speak(originalFrontText, ttsFrontLangSelect.value);
    }

    // Render stats
    const timeAgo = formatTimeAgo(lastViewed[currentCardIndex]);
    cardStats.innerHTML = `
        <span>Retention Score: ${cardStatus[currentCardIndex]}</span> |
        <span>View Count: ${viewCount[currentCardIndex]}</span> |
        <span>Last seen: ${timeAgo}</span>
    `;
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
    const frontColumns = Array.from(frontColumnCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
    const backColumns = Array.from(backColumnCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

    configs[configName] = {
        dataUrl: dataUrlInput.value,
        frontColumns: frontColumns,
        backColumns: backColumns,
        font: fontSelector.value,
        ttsFront: ttsFrontCheckbox.checked,
        ttsBack: ttsBackCheckbox.checked,
        ttsFrontLang: ttsFrontLangSelect.value,
        ttsBackLang: ttsBackLangSelect.value,
        ttsRate: ttsRateSlider.value,
        alternateUppercase: alternateUppercaseCheckbox.checked,
        disableAnimation: disableAnimationCheckbox.checked,
        audioOnlyFront: audioOnlyFrontCheckbox.checked,
            ttsOnHotkeyOnly: ttsOnHotkeyOnlyCheckbox.checked,
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
        frontColumnCheckboxes.querySelectorAll('input').forEach(cb => cb.checked = false);
        backColumnCheckboxes.querySelectorAll('input').forEach(cb => cb.checked = false);

        if (config.frontColumns) {
            config.frontColumns.forEach(colIndex => {
                const cb = frontColumnCheckboxes.querySelector(`input[value="${colIndex}"]`);
                if (cb) cb.checked = true;
            });
        }
        if (config.backColumns) {
            config.backColumns.forEach(colIndex => {
                const cb = backColumnCheckboxes.querySelector(`input[value="${colIndex}"]`);
                if (cb) cb.checked = true;
            });
        }

        ttsFrontLangSelect.value = config.ttsFrontLang;
        ttsBackLangSelect.value = config.ttsBackLang;
        ttsRateSlider.value = config.ttsRate || 1;
        alternateUppercaseCheckbox.checked = config.alternateUppercase || false;
        disableAnimationCheckbox.checked = config.disableAnimation || false;
        audioOnlyFrontCheckbox.checked = config.audioOnlyFront || false;
            ttsOnHotkeyOnlyCheckbox.checked = config.ttsOnHotkeyOnly || false;

        if (disableAnimationCheckbox.checked) {
            card.classList.add('no-animation');
        } else {
            card.classList.remove('no-animation');
        }
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
        if (settingsModal) settingsModal.classList.remove('hidden');
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

let replayRate = 1.0;

function speak(text, voiceName, rate) {
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
    utterance.rate = rate || ttsRateSlider.value;
    window.speechSynthesis.speak(utterance);
}

function handleHotkeys(e) {
    // Don't trigger hotkeys if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch(e.type) {
        case 'keydown':
            switch(e.key) {
                case ' ': // Space bar
                    e.preventDefault();
                    if (!card.classList.contains('flipped')) {
                        flipCard();
                    }
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
                case 'f':
                    const text = card.classList.contains('flipped') ? cardBack.textContent : cardFront.textContent;
                    const voiceName = card.classList.contains('flipped') ? ttsBackLangSelect.value : ttsFrontLangSelect.value;
                    replayRate = Math.max(0.1, replayRate - 0.2); // Decrease rate, with a floor
                    speak(text, voiceName, replayRate);
                    break;
            }
            break;
        case 'keyup':
            switch(e.key) {
                case ' ': // Space bar
                    e.preventDefault();
                    if (card.classList.contains('flipped')) {
                        flipCard();
                    }
                    break;
            }
            break;
    }
}

// Initial load
populateVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoices;
}
loadInitialConfigs();
