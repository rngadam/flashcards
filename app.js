/**
 * @file Main application logic for the Flashcards web app.
 * Handles DOM interactions, data loading, card display, state management,
 * and all user-facing features like TTS, spaced repetition, and settings.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (!('ontouchstart' in window)) {
        document.body.classList.add('desktop');
    }

    // DOM Elements
    const settingsButton = document.getElementById('settings-button');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const historyButton = document.getElementById('history-button');
    const closeHistoryButton = document.getElementById('close-history-button');
    const historyModal = document.getElementById('history-modal');
    const historyTableContainer = document.getElementById('history-table-container');
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
    let cardData = []; // Holds the parsed card data from the TSV/CSV file.
    let headers = []; // Holds the column headers from the data file.
    let currentCardIndex = 0; // The index of the currently displayed card in cardData.
    let configs = {}; // Stores all saved deck configurations.
    let cardStatus = []; // Tracks the retention score for each card.
    let viewCount = []; // Tracks how many times each card has been viewed.
    let lastViewed = []; // Tracks the timestamp of the last time each card was viewed.
    let voices = []; // Holds the list of available TTS voices from the browser.
    let viewHistory = []; // A stack to keep track of the sequence of viewed cards for the "previous" button.
    let useUppercase = false; // A flag for the "Alternate Uppercase" feature.
    let replayRate = 1.0; // Tracks the current playback rate for the 'f' key replay feature.

    // Drag state for swipe gestures
    let isDragging = false; // True if a card is currently being dragged.
    let startX = 0; // The starting X coordinate of a drag.
    let currentX = 0; // The current X coordinate during a drag.
    let dragThreshold = 100; // The pixel distance a card must be dragged to trigger a swipe action.

    // --- Event Listeners ---
    if (settingsButton) settingsButton.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    if (closeSettingsButton) closeSettingsButton.addEventListener('click', () => settingsModal.classList.add('hidden'));
    if (historyButton) historyButton.addEventListener('click', renderHistoryTable);
    if (closeHistoryButton) closeHistoryButton.addEventListener('click', () => historyModal.classList.add('hidden'));
    if (loadDataButton) {
        loadDataButton.addEventListener('click', () => {
            loadData().then(() => {
                if (cardData.length > 0) {
                    showNextCard();
                }
            });
        });
    }
    if (saveConfigButton) saveConfigButton.addEventListener('click', saveConfig);
    if (configSelector) configSelector.addEventListener('change', () => loadSelectedConfig(configSelector.value));
    if (flipCardButton) flipCardButton.addEventListener('click', flipCard);
    if (nextCardButton) nextCardButton.addEventListener('click', () => showNextCard());
    if (prevCardButton) prevCardButton.addEventListener('click', showPrevCard);
    if (iKnowButton) iKnowButton.addEventListener('click', () => { markCardAsKnown(true); showNextCard(); });
    if (iDontKnowButton) iDontKnowButton.addEventListener('click', () => { markCardAsKnown(false); showNextCard({ forceNew: true }); });
    if (frontColumnCheckboxes) frontColumnCheckboxes.addEventListener('change', () => displayCard(currentCardIndex));
    if (backColumnCheckboxes) backColumnCheckboxes.addEventListener('change', () => displayCard(currentCardIndex));
    if (fontSelector) fontSelector.addEventListener('change', () => {
        if (cardContainer) cardContainer.style.fontFamily = fontSelector.value;
    });
    if (disableAnimationCheckbox) disableAnimationCheckbox.addEventListener('change', () => {
        if (card) {
            if (disableAnimationCheckbox.checked) {
                card.classList.add('no-animation');
            } else {
                card.classList.remove('no-animation');
            }
        }
    });
    if (audioOnlyFrontCheckbox) audioOnlyFrontCheckbox.addEventListener('change', () => displayCard(currentCardIndex));
    document.addEventListener('keydown', handleHotkeys);
    document.addEventListener('keyup', handleHotkeys);
    if (card) {
        card.addEventListener('mousedown', dragStart);
        card.addEventListener('touchstart', dragStart);
        card.addEventListener('mousemove', dragMove);
        card.addEventListener('touchmove', dragMove);
        card.addEventListener('mouseup', dragEnd);
        card.addEventListener('touchend', dragEnd);
        card.addEventListener('mouseleave', dragEnd);
        card.addEventListener('click', cardClick);
    }

    // --- Functions ---
    /**
     * Fetches data from the provided URL, parses it, and initializes the deck.
     * @returns {Promise<void>} A promise that resolves when the data is loaded and the first card is displayed, or rejects on failure.
     */
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
                // The calling function is now responsible for displaying the first card
                if (settingsModal) settingsModal.classList.add('hidden');
                document.body.classList.add('debug-data-loaded');
            })
            .catch(error => {
                alert(`Failed to load data: ${error.message}`);
            });
    }

    /**
     * Parses raw TSV or CSV text into the application's data structures.
     * It auto-detects the delimiter (tab or comma).
     * It also initializes the statistics for each card.
     * @param {string} text - The raw string data from the fetched file.
     */
    function parseData(text) {
        const rows = text.trim().split('\n');
        if (rows[0].includes('\t')) {
            headers = rows[0].split('\t');
            cardData = rows.slice(1).map(row => row.split('\t'));
        } else {
            headers = rows[0].split(',');
            cardData = rows.slice(1).map(row => row.split(','));
        }

        const statsData = JSON.parse(localStorage.getItem('card-stats-data')) || {};
        cardStatus = new Array(cardData.length);
        viewCount = new Array(cardData.length);
        lastViewed = new Array(cardData.length);

        cardData.forEach((card, index) => {
            const cardKey = card[0];
            const stats = statsData[cardKey] || { status: 0, viewCount: 0, lastViewed: null };
            cardStatus[index] = stats.status;
            viewCount[index] = stats.viewCount;
            lastViewed[index] = stats.lastViewed;
        });

        viewHistory = [];
        populateColumnSelectors();
    }

    /**
     * Populates the front and back column selection checkboxes in the settings modal
     * based on the headers from the data file.
     */
    function populateColumnSelectors() {
        if (!frontColumnCheckboxes || !backColumnCheckboxes) return;
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

        if (headers.length > 0) {
            const firstCheckbox = frontColumnCheckboxes.querySelector('input');
            if (firstCheckbox) firstCheckbox.checked = true;
        }
        if (headers.length > 1) {
            const secondCheckbox = backColumnCheckboxes.querySelectorAll('input')[1];
            if (secondCheckbox) secondCheckbox.checked = true;
        }
    }

    /**
     * Flips the current card and handles the flip animation.
     * Also triggers TTS for the revealed side if enabled.
     */
    function flipCard() {
        if (!card) return;
        card.classList.toggle('flipped');
        document.body.classList.add('is-flipping');
        setTimeout(() => {
            document.body.classList.remove('is-flipping');
        }, 600);

        if (ttsOnHotkeyOnlyCheckbox && ttsOnHotkeyOnlyCheckbox.checked) return;

        const originalFrontText = getSelectedColumnsText(frontColumnCheckboxes);
        if (card.classList.contains('flipped') && ttsBackCheckbox && ttsBackCheckbox.checked) {
            speak(cardBack.textContent, ttsBackLangSelect.value);
        } else if (!card.classList.contains('flipped') && ttsFrontCheckbox && ttsFrontCheckbox.checked) {
            speak(originalFrontText, ttsFrontLangSelect.value);
        }
    }

    /**
     * Dynamically adjusts the font size of an element to fit its container.
     * Uses a binary search approach for efficiency.
     * @param {HTMLElement} element - The text element to resize.
     */
    function adjustFontSize(element) {
        if (!element) return;
        const container = element.parentElement;
        if (!container) return;
        let min = 10, max = 150;
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

    /**
     * Gets the combined text content from the selected columns for the current card.
     * @param {HTMLElement} checkboxContainer - The container with the column checkboxes (front or back).
     * @returns {string} The combined text, with each column's content on a new line.
     */
    function getSelectedColumnsText(checkboxContainer) {
        if (!checkboxContainer) return '';
        const selectedColumns = Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
        return selectedColumns.map(colIndex => cardData[currentCardIndex][colIndex]).join('\n');
    }

    /**
     * Displays a card at a given index, updating the front and back content,
     * and handling features like "Alternate Uppercase" and "Audio-Only Front".
     * It also updates and displays the card's statistics.
     * @param {number} index - The index of the card to display in the `cardData` array.
     * @param {boolean} [isNavigatingBack=false] - True if this call is from the "previous" button, to prevent pushing to view history.
     */
    function displayCard(index, isNavigatingBack = false) {
        if (cardData.length === 0 || index < 0 || index >= cardData.length) return;

        if (!isNavigatingBack && index !== currentCardIndex) {
            viewHistory.push(currentCardIndex);
        }

        currentCardIndex = index;
        replayRate = 1.0;

        viewCount[currentCardIndex]++;
        lastViewed[currentCardIndex] = Date.now();

        const originalFrontText = getSelectedColumnsText(frontColumnCheckboxes);
        let displayText = originalFrontText;
        if (alternateUppercaseCheckbox && alternateUppercaseCheckbox.checked) {
            if (useUppercase) {
                displayText = originalFrontText.toUpperCase();
            }
            useUppercase = !useUppercase;
        }

        if (audioOnlyFrontCheckbox && audioOnlyFrontCheckbox.checked) {
            cardFront.innerHTML = '<span class="speech-icon">🔊</span>';
        } else {
            cardFront.textContent = displayText;
        }
        cardBack.textContent = getSelectedColumnsText(backColumnCheckboxes);

        cardFront.style.fontSize = '';
        cardBack.style.fontSize = '';

        setTimeout(() => {
            adjustFontSize(cardFront);
            adjustFontSize(cardBack);
        }, 50);

        card.classList.remove('flipped');
        if (ttsFrontCheckbox && ttsFrontCheckbox.checked && ttsOnHotkeyOnlyCheckbox && !ttsOnHotkeyOnlyCheckbox.checked) {
            speak(originalFrontText, ttsFrontLangSelect.value);
        }

        const timeAgo = formatTimeAgo(lastViewed[currentCardIndex]);
        cardStats.innerHTML = `
            <span>Retention Score: ${cardStatus[currentCardIndex]}</span> |
            <span>View Count: ${viewCount[currentCardIndex]}</span> |
            <span>Last seen: ${timeAgo}</span>
        `;

        saveCardStats();
    }

    /**
     * Determines the next card to show based on the spaced repetition algorithm.
     * It prioritizes cards with the lowest retention score.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.forceNew=false] - If true, ensures the next card is different from the current one, even if it also has a low score. Used for "I don't know".
     */
    function showNextCard({forceNew = false} = {}) {
        if (cardData.length === 0) return;

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

    /**
     * Shows the previously viewed card by popping from the view history stack.
     */
    function showPrevCard() {
        if (viewHistory.length > 0) {
            const prevIndex = viewHistory.pop();
            displayCard(prevIndex, true);
        }
    }

    /**
     * Renders the complete history of all cards and their statistics into a table
     * and displays it in the history modal.
     */
    function renderHistoryTable() {
        if (!historyTableContainer) return;
        const statsData = JSON.parse(localStorage.getItem('card-stats-data')) || {};
        let tableHTML = '<table><thead><tr>';
        headers.forEach(header => {
            tableHTML += `<th>${header}</th>`;
        });
        tableHTML += '<th>Retention Score</th><th>View Count</th><th>Last Seen</th></tr></thead><tbody>';

        cardData.forEach((card, index) => {
            const cardKey = card[0];
            const stats = statsData[cardKey] || { status: 0, viewCount: 0, lastViewed: null };
            tableHTML += '<tr>';
            card.forEach(cell => {
                tableHTML += `<td>${cell}</td>`;
            });
            tableHTML += `<td>${stats.status}</td>`;
            tableHTML += `<td>${stats.viewCount}</td>`;
            tableHTML += `<td>${formatTimeAgo(stats.lastViewed)}</td>`;
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';
        historyTableContainer.innerHTML = tableHTML;
        historyModal.classList.remove('hidden');
    }

    /**
     * Saves the current statistics (status, view count, last viewed) for all cards
     * to the browser's local storage.
     */
    function saveCardStats() {
        const statsData = {};
        cardData.forEach((card, index) => {
            const cardKey = card[0];
            statsData[cardKey] = {
                status: cardStatus[index],
                viewCount: viewCount[index],
                lastViewed: lastViewed[index],
            };
        });
        localStorage.setItem('card-stats-data', JSON.stringify(statsData));
    }

    /**
     * Updates the retention score for the current card.
     * @param {boolean} known - If true, the score is incremented. If false, it's reset to 0.
     */
    function markCardAsKnown(known) {
        if (known) {
            cardStatus[currentCardIndex]++;
        } else {
            cardStatus[currentCardIndex] = 0;
        }
        saveCardStats();
    }

    /**
     * Saves the current UI settings (URL, columns, font, etc.) as a named configuration
     * to local storage.
     */
    function saveConfig() {
        if (!configNameInput) return;
        const configName = configNameInput.value;
        if (!configName) {
            alert('Please enter a configuration name.');
            return;
        }

        configs[configName] = {
            dataUrl: dataUrlInput.value,
            frontColumns: getSelectedColumnsText(frontColumnCheckboxes),
            backColumns: getSelectedColumnsText(backColumnCheckboxes),
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

    /**
     * Loads a saved configuration by name, updating the UI and loading its data.
     * @param {string} configName - The name of the configuration to load.
     */
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
            if (frontColumnCheckboxes) frontColumnCheckboxes.querySelectorAll('input').forEach(cb => cb.checked = false);
            if (backColumnCheckboxes) backColumnCheckboxes.querySelectorAll('input').forEach(cb => cb.checked = false);

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

            if (ttsFrontLangSelect) ttsFrontLangSelect.value = config.ttsFrontLang;
            if (ttsBackLangSelect) ttsBackLangSelect.value = config.ttsBackLang;
            if (ttsRateSlider) ttsRateSlider.value = config.ttsRate || 1;
            if (alternateUppercaseCheckbox) alternateUppercaseCheckbox.checked = config.alternateUppercase || false;
            if (disableAnimationCheckbox) disableAnimationCheckbox.checked = config.disableAnimation || false;
            if (audioOnlyFrontCheckbox) audioOnlyFrontCheckbox.checked = config.audioOnlyFront || false;
            if (ttsOnHotkeyOnlyCheckbox) ttsOnHotkeyOnlyCheckbox.checked = config.ttsOnHotkeyOnly || false;

            if (card) {
                if (disableAnimationCheckbox.checked) {
                    card.classList.add('no-animation');
                } else {
                    card.classList.remove('no-animation');
                }
            }
            localStorage.setItem('flashcard-last-config', configName);

            if (cardData.length > 0) {
                showNextCard();
            }
        });
    }

    /**
     * Populates the configuration dropdown in the settings modal with the names
     * of all saved configurations.
     */
    function populateConfigSelector() {
        if (!configSelector) return;
        configSelector.innerHTML = '<option value="">-- Load a Configuration --</option>';
        Object.keys(configs).forEach(name => {
            const option = new Option(name, name);
            configSelector.add(option);
        });
    }

    /**
     * Loads configurations from local storage on startup.
     * If a "last used" configuration is found, it is loaded automatically.
     * Otherwise, the settings modal is shown.
     */
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

    /**
     * Populates the TTS voice selection dropdowns with the list of voices
     * available in the user's browser.
     */
    function populateVoices() {
        if (!('speechSynthesis' in window)) return;
        voices = speechSynthesis.getVoices();
        if (!ttsFrontLangSelect || !ttsBackLangSelect) return;
        ttsFrontLangSelect.innerHTML = '';
        ttsBackLangSelect.innerHTML = '';
        voices.forEach(voice => {
            const option1 = new Option(`${voice.name} (${voice.lang})`, voice.name);
            const option2 = new Option(`${voice.name} (${voice.lang})`, voice.name);
            ttsFrontLangSelect.add(option1);
            ttsBackLangSelect.add(option2);
        });
    }

    /**
     * Uses the browser's SpeechSynthesis API to speak the given text.
     * @param {string} text - The text to be spoken.
     * @param {string} voiceName - The name of the voice to use (from `speechSynthesis.getVoices()`).
     * @param {number} [rate] - The playback rate (e.g., 1.0 for normal, 0.5 for half-speed). Defaults to the slider value.
     */
    function speak(text, voiceName, rate) {
        if (!('speechSynthesis' in window) || speechSynthesis.speaking) {
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        if (voiceName) {
            const voice = voices.find(v => v.name === voiceName);
            if (voice) {
                utterance.voice = voice;
            }
        }
        utterance.rate = rate || (ttsRateSlider ? ttsRateSlider.value : 1);
        window.speechSynthesis.speak(utterance);
    }

    /**
     * Handles all keyboard shortcuts for the application.
     * This includes flipping cards, navigation, marking cards, and replaying audio.
     * It distinguishes between keydown and keyup for the "hold space to peek" feature.
     * @param {KeyboardEvent} e - The keyboard event object.
     */
    function handleHotkeys(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        switch(e.type) {
            case 'keydown':
                switch(e.key) {
                    case ' ':
                        e.preventDefault();
                        if (card && !card.classList.contains('flipped')) {
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
                        replayRate = Math.max(0.1, replayRate - 0.2);
                        speak(text, voiceName, replayRate);
                        break;
                }
                break;
            case 'keyup':
                switch(e.key) {
                    case ' ':
                        e.preventDefault();
                        if (card && card.classList.contains('flipped')) {
                            flipCard();
                        }
                        break;
                }
                break;
        }
    }

    function cardClick(e) {
        // This is a failsafe for the dragend logic. If a click is registered,
        // and it wasn't a drag, we flip the card.
        if (!isDragging) {
            flipCard();
        }
    }

    function dragStart(e) {
        if (e.target.closest('button')) return; // Don't drag if clicking a button on the card
        isDragging = true;
        startX = e.pageX || e.touches[0].pageX;
        currentX = startX; // Initialize currentX
        card.style.transition = 'none'; // Disable transition for smooth dragging
    }

    function dragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.pageX || e.touches[0].pageX;
        const diffX = currentX - startX;
        card.style.transform = `translateX(${diffX}px) rotate(${diffX / 20}deg)`;
    }

    function dragEnd(e) {
        if (!isDragging) return;
        const wasDragging = isDragging;
        isDragging = false;

        const diffX = currentX - startX;

        // A very small movement should be treated as a click, not a drag
        if (Math.abs(diffX) < 10) {
            card.style.transform = '';
            // The 'click' event will handle the flip
            return;
        }

        card.style.transition = 'transform 0.3s ease';

        if (Math.abs(diffX) > dragThreshold) {
            card.classList.add(diffX > 0 ? 'swipe-right' : 'swipe-left');
            setTimeout(() => {
                if (diffX > 0) {
                    markCardAsKnown(true);
                    showNextCard();
                } else {
                    markCardAsKnown(false);
                    showNextCard({ forceNew: true });
                }
                card.style.transform = '';
                card.classList.remove('swipe-right', 'swipe-left');
            }, 300);
        } else {
            card.style.transform = '';
        }

        startX = 0;
        currentX = 0;
    }


    // Initial load
    populateVoices();
    if ('speechSynthesis' in window && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoices;
    }
    loadInitialConfigs();
});
