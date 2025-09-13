import { franc, francAll } from 'https://cdn.jsdelivr.net/npm/franc@6.2.0/+esm';
import { eld } from 'https://cdn.jsdelivr.net/npm/efficient-language-detector-no-dynamic-import@1.0.3/+esm';
import { get, set, del } from 'https://cdn.jsdelivr.net/npm/idb-keyval/+esm';

/**
 * @file Main application logic for the Flashcards web app.
 * Handles DOM interactions, data loading, card display, state management,
 * and all user-facing features like TTS, spaced repetition, and settings.
 */
document.addEventListener('DOMContentLoaded', () => {
    if (!('ontouchstart' in window)) {
        document.body.classList.add('desktop');
    }

    // Tab switching logic
    const tabsContainer = document.querySelector('.tabs');
    const tabPanels = document.querySelectorAll('.tab-panel');

    if (tabsContainer) {
        tabsContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tab-button')) {
                const button = e.target;

                // Update button states
                tabsContainer.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');

                // Update panel visibility
                const tabName = button.dataset.tab;
                tabPanels.forEach(panel => {
                    panel.classList.toggle('active', panel.id === tabName);
                });
            }
        });
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
    const resetStatsButton = document.getElementById('reset-stats');
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
    const keyColumnSelector = document.getElementById('key-column-selector');
    const repetitionIntervalsTextarea = document.getElementById('repetition-intervals');
    const detectedLangSpan = document.getElementById('detected-lang');
    const configSelector = document.getElementById('config-selector');
    const cardContainer = document.getElementById('card-container');
    const cardStatsDisplay = document.getElementById('card-stats');
    const cardFront = document.querySelector('.card-front');
    const cardBack = document.querySelector('.card-back');
    const flipCardButton = document.getElementById('flip-card');
    const card = document.getElementById('card');
    const nextCardButton = document.getElementById('next-card');
    const prevCardButton = document.getElementById('prev-card');
    const iKnowButton = document.getElementById('i-know');
    const iDontKnowButton = document.getElementById('i-dont-know');
    const explanationMessage = document.getElementById('explanation-message');
    const cacheStatus = document.getElementById('cache-status');
    const createSubsetButton = document.getElementById('create-subset-config');
    const subsetConfigNameInput = document.getElementById('subset-config-name');
    const subsetTextarea = document.getElementById('subset-text');


    // App state
    let cardData = []; // Holds the parsed card data from the TSV/CSV file.
    let headers = []; // Holds the column headers from the data file.
    let currentCardIndex = 0; // The index of the currently displayed card in cardData.
    let configs = {}; // Stores all saved deck configurations.
    let voices = []; // Holds the list of available TTS voices from the browser.
    let viewHistory = []; // A stack to keep track of the sequence of viewed cards for the "previous" button.
    let useUppercase = false; // A flag for the "Alternate Uppercase" feature.
    let replayRate = 1.0; // Tracks the current playback rate for the 'f' key replay feature.
    let cardShownTimestamp = null; // Tracks when the card was shown to calculate response delay.
    let isCurrentCardDue = false; // Tracks if the current card was shown because it was due for review.

    // History table sort state
    let historySortColumn = -1;
    let historySortDirection = 'asc';

    // Spaced Repetition State
    const defaultIntervals = [5, 25, 120, 600, 3600, 18000, 86400, 432000, 2160000, 10368000, 63072000]; // in seconds
    let repetitionIntervals = [...defaultIntervals];

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
        loadDataButton.addEventListener('click', async () => { // make listener async
            await loadData(); // await the async function
            if (cardData.length > 0) {
                showNextCard();
            }
        });
    }
    if (saveConfigButton) saveConfigButton.addEventListener('click', saveConfig);
    if (resetStatsButton) resetStatsButton.addEventListener('click', resetDeckStats);
    if (configSelector) configSelector.addEventListener('change', () => loadSelectedConfig(configSelector.value));
    if (flipCardButton) flipCardButton.addEventListener('click', flipCard);
    if (nextCardButton) nextCardButton.addEventListener('click', () => showNextCard());
    if (prevCardButton) prevCardButton.addEventListener('click', showPrevCard);
    if (iKnowButton) iKnowButton.addEventListener('click', async () => { await markCardAsKnown(true); await showNextCard(); });
    if (iDontKnowButton) iDontKnowButton.addEventListener('click', async () => { await markCardAsKnown(false); await showNextCard({ forceNew: true }); });
    if (frontColumnCheckboxes) frontColumnCheckboxes.addEventListener('change', async () => await displayCard(currentCardIndex));
    if (backColumnCheckboxes) backColumnCheckboxes.addEventListener('change', async () => await displayCard(currentCardIndex));
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
        card.addEventListener('touchstart', dragStart, { passive: false });
        card.addEventListener('mousemove', dragMove);
        card.addEventListener('touchmove', dragMove, { passive: false });
        card.addEventListener('mouseup', dragEnd);
        card.addEventListener('touchend', dragEnd);
        card.addEventListener('mouseleave', dragEnd);
    }
    if (createSubsetButton) createSubsetButton.addEventListener('click', createSubset);

    // --- Functions ---
    async function createSubset() {
        const newConfigName = subsetConfigNameInput.value.trim();
        const text = subsetTextarea.value;
        if (!newConfigName) {
            alert('Please enter a name for the subset.');
            return;
        }
        if (!text) {
            alert('Please paste the source text for the subset.');
            return;
        }
        if (cardData.length === 0) {
            alert('No deck is loaded. Please load a deck first.');
            return;
        }

        // 1. Get current config name and settings
        const currentConfigName = configSelector.value;
        if (!currentConfigName || !configs[currentConfigName]) {
            alert('Please save the current configuration before creating a subset.');
            return;
        }
        const currentConfig = { ...configs[currentConfigName] };

        // 2. Parse text to get unique words
        const words = new Set(text.match(/[\p{L}\p{N}]+/gu).map(w => w.toLowerCase()));


        // 3. Filter cardData
        const keyIndex = parseInt(currentConfig.keyColumn || '0');
        const subsetData = cardData.filter(card => {
            const key = card[keyIndex]?.toLowerCase();
            return key && words.has(key);
        });

        if (subsetData.length === 0) {
            alert('No matching cards found in the current deck for the provided text.');
            return;
        }

        // 4. Create and save new config
        const newConfig = {
            ...currentConfig,
            dataUrl: null, // Subsets don't have a URL
            subsetData: subsetData,
            headers: headers, // Also save the headers
            sourceConfig: currentConfigName, // Keep track of the origin
        };
        configs[newConfigName] = newConfig;
        await set('flashcard-configs', configs);
        await set('flashcard-last-config', newConfigName);

        // 5. Reload UI
        populateConfigSelector();
        configSelector.value = newConfigName;
        await loadSelectedConfig(newConfigName);

        alert(`Subset "${newConfigName}" created with ${subsetData.length} cards.`);
        subsetConfigNameInput.value = '';
        subsetTextarea.value = '';
    }

    function updateCacheStatus(response) {
        if (!cacheStatus) return;
        const date = response.headers.get('date');
        const timestamp = date ? new Date(date).toLocaleString() : 'N/A';
        const isFromCache = response.headers.get('X-From-Cache') === 'true';

        if (isFromCache) {
            cacheStatus.textContent = `Offline. Data from: ${timestamp}`;
            cacheStatus.classList.add('cached');
        } else {
            cacheStatus.textContent = `Live data. Updated: ${timestamp}`;
            cacheStatus.classList.remove('cached');
        }
    }
    /**
     * Fetches data from the provided URL, parses it, and initializes the deck.
     * It uses a cache-then-network strategy managed by the service worker.
     * @returns {Promise<void>} A promise that resolves when the data is loaded, or rejects on failure.
     */
    async function loadData() {
        const url = dataUrlInput.value;
        if (!url) {
            // This is expected for subset configs, so we don't show an alert.
            return;
        }

        try {
            // The service worker will handle caching.
            // We just fetch as normal.
            const response = await fetch(url);

            if (!response.ok) {
                // If the network response is not OK, try to get from cache via SW
                const cache = await caches.open('flashcards-cache-v1');
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    const text = await cachedResponse.text();
                    await parseData(text);
                    updateCacheStatus(cachedResponse);
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                 // Network request was successful
                const text = await response.text();
                await parseData(text);
                updateCacheStatus(response);
            }

            if (settingsModal) settingsModal.classList.add('hidden');
            document.body.classList.add('debug-data-loaded');

        } catch (error) {
            // This block will be hit if the network fails and there's no cache
            console.error('Failed to load data, trying cache...', error);
            try {
                const cache = await caches.open('flashcards-cache-v1');
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    const text = await cachedResponse.text();
                    await parseData(text);
                    // Create a modified response to indicate it's from the cache
                    const headers = new Headers(cachedResponse.headers);
                    headers.set('X-From-Cache', 'true');
                    const syntheticResponse = new Response(cachedResponse.body, {
                      status: cachedResponse.status,
                      statusText: cachedResponse.statusText,
                      headers: headers
                    });
                    updateCacheStatus(syntheticResponse);

                    if (settingsModal) settingsModal.classList.add('hidden');
                    document.body.classList.add('debug-data-loaded');
                } else {
                     alert(`Failed to load data: ${error.message}. No cached data available.`);
                }
            } catch (cacheError) {
                 alert(`Failed to load data from both network and cache: ${cacheError.message}`);
            }
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Parses raw TSV or CSV text into the application's data structures.
     * It auto-detects the delimiter (tab or comma).
     * It also initializes the statistics for each card.
     * @param {string} text - The raw string data from the fetched file.
     */
    async function parseData(text) { // Made async
        const cleanCell = (cell) => cell.replace(/[\r\n\s]+/g, ' ').trim();

        const rows = text.trim().split('\n').filter(row => row.trim() !== ''); // Filter empty lines
        if (rows.length < 1) {
            cardData = [];
            headers = [];
            return;
        }

        const delimiter = rows[0].includes('\t') ? '\t' : ',';
        headers = rows[0].split(delimiter).map(cleanCell);

        cardData = rows
            .slice(1)
            .map(row => row.split(delimiter).map(cleanCell))
            .filter(row => row.length === headers.length); // Ensure row has correct number of columns

        // Stats are no longer loaded in bulk here.

        viewHistory = [];
        populateColumnSelectors();
        populateKeyColumnSelector();
        if (repetitionIntervalsTextarea) repetitionIntervalsTextarea.value = repetitionIntervals.join(', ');
        detectAndFilterLanguage();
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

        // Default front to first column
        if (headers.length > 0) {
            const firstCheckbox = frontColumnCheckboxes.querySelector('input');
            if (firstCheckbox) firstCheckbox.checked = true;
        }
        // Default back to all columns
        if (backColumnCheckboxes) {
            backColumnCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = true;
            });
        }
    }

    function populateKeyColumnSelector() {
        if (!keyColumnSelector) return;
        keyColumnSelector.innerHTML = '';
        headers.forEach((header, index) => {
            const option = new Option(header, index);
            keyColumnSelector.add(option);
        });
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

        const frontIndices = getSelectedColumnIndices(frontColumnCheckboxes);
        const originalFrontText = getTextForColumns(frontIndices);

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

    function formatDuration(seconds) {
        if (seconds < 60) return `${seconds} seconds`;
        if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
        if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
        if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
        return `${Math.round(seconds / 31536000)} years`;
    }

    function formatTimeDifference(ms) {
        if (ms <= 0) return 'Now';

        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;

        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;

        const days = Math.floor(hours / 24);
        return `${days}d`;
    }

    function getTimeToDue(stats, now = Date.now()) {
        if (!stats.lastViewed) {
            return { ms: -1, formatted: 'N/A' }; // N/A for cards never seen
        }
        const intervalSeconds = repetitionIntervals[stats.intervalIndex];
        if (intervalSeconds === undefined) {
             return { ms: Infinity, formatted: 'Learned' }; // Card is fully learned
        }
        const dueDate = stats.lastViewed + (intervalSeconds * 1000);
        const timeToDueMs = dueDate - now;

        return {
            ms: timeToDueMs,
            formatted: formatTimeDifference(timeToDueMs)
        };
    }


    /**
     * Gets the selected column indices from a checkbox container.
     * @param {HTMLElement} checkboxContainer - The container with the column checkboxes.
     * @returns {number[]} An array of selected column indices, e.g., [0, 2].
     */
    function getSelectedColumnIndices(checkboxContainer) {
        if (!checkboxContainer) return [];
        return Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
    }

    /**
     * Gets the combined text content for the current card from a given set of column indices.
     * @param {number[]} indices - An array of column indices.
     * @returns {string} The combined text, with each column's content on a new line.
     */
    function getTextForColumns(indices) {
        if (!indices || !cardData[currentCardIndex]) return '';
        return indices.map(colIndex => cardData[currentCardIndex][colIndex]).join('\n');
    }

    function getRetentionScore(stats) {
        if (!stats || typeof stats !== 'object') {
            return 0;
        }
        return (stats.successTimestamps?.length || 0) - (stats.failureTimestamps?.length || 0);
    }

    async function getSanitizedStats(cardKey) {
        const defaultStats = {
            successTimestamps: [],
            failureTimestamps: [],
            responseDelays: [],
            lastViewed: null,
            intervalIndex: 0,
            viewCount: 0
        };

        let stats = await get(cardKey);

        if (!stats || typeof stats !== 'object') {
            stats = defaultStats;
        } else {
            stats = { ...defaultStats, ...stats };
        }
        return stats;
    }

    /**
     * Displays a card at a given index, updating the front and back content,
     * and handling features like "Alternate Uppercase" and "Audio-Only Front".
     * It also updates and displays the card's statistics.
     * @param {number} index - The index of the card to display in the `cardData` array.
     * @param {object} [options={}] - Additional options.
     * @param {boolean} [options.isNavigatingBack=false] - True if this call is from the "previous" button.
     * @param {string} [options.reason=''] - The reason the card was chosen.
     */
    async function displayCard(index, { isNavigatingBack = false, reason = {} } = {}) {
        if (cardData.length === 0 || index < 0 || index >= cardData.length) return;

        isCurrentCardDue = reason.type === 'due_review';

        const cardKey = getCardKey(cardData[index]);
        const stats = await getSanitizedStats(cardKey);

        if (!isNavigatingBack && index !== currentCardIndex) {
            viewHistory.push(currentCardIndex);
        }

        currentCardIndex = index;
        replayRate = 1.0;

        const previousLastViewed = stats.lastViewed;

        stats.viewCount++;
        stats.lastViewed = Date.now();

        const frontIndices = getSelectedColumnIndices(frontColumnCheckboxes);
        const backIndices = getSelectedColumnIndices(backColumnCheckboxes);

        const originalFrontText = getTextForColumns(frontIndices);
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
        cardBack.textContent = getTextForColumns(backIndices);

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

        const timeAgo = formatTimeAgo(previousLastViewed);
        const retentionScore = getRetentionScore(stats);
        cardStatsDisplay.innerHTML = `
            <span>Retention Score: ${retentionScore}</span> |
            <span>View Count: ${stats.viewCount}</span> |
            <span>Last seen: ${timeAgo}</span>
        `;

        if (explanationMessage) {
            let message = '';
            switch (reason.type) {
                case 'due_review':
                    message = `This card is due for its ${reason.expiredInterval} review. Next review in ${reason.nextInterval}.`;
                    break;
                case 'new_card':
                    message = 'Introducing a new, unseen card.';
                    break;
                case 'least_learned':
                    message = 'Reviewing card with the lowest score.';
                    break;
                case 'deck_learned':
                    if (reason.timeToNextReview !== Infinity) {
                        const formattedTime = formatTimeDifference(reason.timeToNextReview);
                        message = `Deck learned! Next review in ${formattedTime}. Reviewing lowest-score cards until then.`;
                    } else {
                        message = 'Congratulations, you have learned this whole deck!';
                    }
                    break;
            }
            explanationMessage.textContent = message;
            explanationMessage.classList.toggle('visible', !!message);
        }

        await saveCardStats(cardKey, stats);
        cardShownTimestamp = Date.now();
    }

    async function getAllCardStats() {
        const promises = cardData.map(card => getSanitizedStats(getCardKey(card)));
        return Promise.all(promises);
    }

    /**
     * Determines the next card to show based on the spaced repetition algorithm.
     * It prioritizes cards with the lowest retention score.
     * @param {object} [options] - Optional parameters.
     * @param {boolean} [options.forceNew=false] - If true, ensures the next card is different from the current one, even if it also has a low score. Used for "I don't know".
     */
    async function showNextCard({ forceNew = false, now = Date.now() } = {}) {
        if (cardData.length === 0) {
            return;
        }
        if (cardData.length === 1) {
            await displayCard(0);
            return;
        }

        const allCardStats = await getAllCardStats();

        // --- Heuristic Step 1: Find and show a "due" card ---
        const dueCardIndices = [];
        allCardStats.forEach((stats, index) => {
            // A card is due if it has been seen before and its review interval has passed.
            if (stats.lastViewed) {
                const intervalSeconds = repetitionIntervals[stats.intervalIndex] || defaultIntervals[defaultIntervals.length - 1];
                if (now - stats.lastViewed > intervalSeconds * 1000) {
                    dueCardIndices.push(index);
                }
            }
        });

        if (dueCardIndices.length > 0) {
            // Find the due card with the lowest retention score to prioritize it.
            // If scores are equal, shuffle to introduce randomness.
            shuffleArray(dueCardIndices); // Randomize before sorting to break ties
            dueCardIndices.sort((a, b) => getRetentionScore(allCardStats[a]) - getRetentionScore(allCardStats[b]));

            let nextIndex = dueCardIndices[0];
            // Avoid showing the same card twice in a row if there are other due cards.
            if (nextIndex === currentCardIndex && dueCardIndices.length > 1) {
                nextIndex = dueCardIndices[1];
            }

            const stats = allCardStats[nextIndex];
            const expiredInterval = formatDuration(repetitionIntervals[stats.intervalIndex]);
            const nextInterval = formatDuration(repetitionIntervals[stats.intervalIndex + 1] || repetitionIntervals[stats.intervalIndex]);
            await displayCard(nextIndex, { reason: { type: 'due_review', expiredInterval, nextInterval } });
            return;
        }

        // --- Heuristic Step 2: Find and show a "new" card ---
        const newCardIndices = [];
        allCardStats.forEach((stats, index) => {
            if (stats.viewCount === 0) {
                newCardIndices.push(index);
            }
        });

        if (newCardIndices.length > 0) {
            // Pick a random new card to show.
            const nextIndex = newCardIndices[Math.floor(Math.random() * newCardIndices.length)];
            await displayCard(nextIndex, { reason: { type: 'new_card' } });
            return;
        }

        // --- Heuristic Step 3: Find and show the "least learned" card ---
        // If no cards are due and none are new, find the card with the lowest retention score.

        const allCardsLearned = allCardStats.every(stats => getRetentionScore(stats) > 0);
        let reasonForDisplay;

        if (allCardsLearned) {
            let minTimeToDue = Infinity;
            allCardStats.forEach(stats => {
                const timeToDue = getTimeToDue(stats, now).ms;
                if (timeToDue > 0 && timeToDue < minTimeToDue) {
                    minTimeToDue = timeToDue;
                }
            });
            reasonForDisplay = {
                type: 'deck_learned',
                timeToNextReview: minTimeToDue
            };
        } else {
            reasonForDisplay = { type: 'least_learned' };
        }

        // Create a list of all card indices except the current one if forceNew is true
        let candidateIndices = allCardStats.map((_, index) => index);
        if (forceNew && candidateIndices.length > 1) {
            candidateIndices = candidateIndices.filter(index => index !== currentCardIndex);
        }

        if (candidateIndices.length === 0) {
            // This can happen if forceNew is true and there's only one card left.
            // In this case, just show that one card.
            candidateIndices.push(currentCardIndex);
        }

        // Sort by retention score (ascending), then by last viewed time (ascending - oldest first)
        // Shuffle first to break ties in both score and lastViewed
        shuffleArray(candidateIndices);
        candidateIndices.sort((a, b) => {
            const scoreA = getRetentionScore(allCardStats[a]);
            const scoreB = getRetentionScore(allCardStats[b]);
            if (scoreA !== scoreB) {
                return scoreA - scoreB;
            }
            // If scores are equal, show the one that was seen longer ago.
            const lastViewedA = allCardStats[a].lastViewed || 0;
            const lastViewedB = allCardStats[b].lastViewed || 0;
            return lastViewedA - lastViewedB;
        });

        const nextIndex = candidateIndices[0];
        await displayCard(nextIndex, { reason: reasonForDisplay });
    }

    /**
     * Shows the previously viewed card by popping from the view history stack.
     */
    async function showPrevCard() {
        if (viewHistory.length > 0) {
            const prevIndex = viewHistory.pop();
            await displayCard(prevIndex, { isNavigatingBack: true });
        }
    }

    function buildHistoryTbodyHtml(data) {
        let tbodyHtml = '<tbody>';
        const now = Date.now();
        data.forEach(item => {
            tbodyHtml += '<tr>';
            item.card.forEach(cell => {
                tbodyHtml += `<td>${cell}</td>`;
            });
            const retentionScore = getRetentionScore(item.stats);
            tbodyHtml += `<td>${retentionScore}</td>`;
            tbodyHtml += `<td>${item.stats.viewCount}</td>`;
            tbodyHtml += `<td>${formatTimeAgo(item.stats.lastViewed)}</td>`;
            const timeToDue = getTimeToDue(item.stats, now);
            tbodyHtml += `<td>${timeToDue.formatted}</td>`;
            tbodyHtml += '</tr>';
        });
        tbodyHtml += '</tbody>';
        return tbodyHtml;
    }

    /**
     * Renders the complete history of all cards and their statistics into a table
     * and displays it in the history modal.
     */
    async function renderHistoryTable() {
        if (!historyTableContainer) return;

        // Build header
        let tableHTML = '<table><thead><tr>';
        headers.forEach((header, index) => {
            tableHTML += `<th class="sortable" data-column-index="${index}">${header}</th>`;
        });
        tableHTML += `<th class="sortable" data-column-index="${headers.length}">Retention Score</th>`;
        tableHTML += `<th class="sortable" data-column-index="${headers.length + 1}">View Count</th>`;
        tableHTML += `<th class="sortable" data-column-index="${headers.length + 2}">Last Seen</th>`;
        tableHTML += `<th class="sortable" data-column-index="${headers.length + 3}">Time to Due</th>`;
        tableHTML += '</tr></thead>';

        const allCardStats = await getAllCardStats();

        // Build body from freshly fetched state
        const combinedData = cardData.map((card, index) => ({
            card: card,
            stats: allCardStats[index]
        }));
        tableHTML += buildHistoryTbodyHtml(combinedData);

        tableHTML += '</table>';
        historyTableContainer.innerHTML = tableHTML;

        // Re-attach event listeners
        historyTableContainer.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', sortHistoryTable);
        });

        historyModal.classList.remove('hidden');
    }

    async function sortHistoryTable(e) {
        const th = e.currentTarget;
        const columnIndex = parseInt(th.dataset.columnIndex);
        const now = Date.now(); // Capture timestamp for consistent sorting

        if (historySortColumn === columnIndex) {
            historySortDirection = historySortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            historySortColumn = columnIndex;
            historySortDirection = 'asc';
        }

        const allCardStats = await getAllCardStats();

        // Create a combined array for sorting directly from in-memory state
        const combinedData = cardData.map((card, index) => ({
            card: card,
            stats: allCardStats[index] // The whole stats object
        }));

        combinedData.sort((a, b) => {
            let valA, valB;

            if (columnIndex < headers.length) {
                // It's a data column
                valA = a.card[columnIndex];
                valB = b.card[columnIndex];
            } else {
                // It's a stats column
                const statsKeyIndex = columnIndex - headers.length;
                if (statsKeyIndex === 0) { // Retention Score
                    valA = getRetentionScore(a.stats);
                    valB = getRetentionScore(b.stats);
                } else if (statsKeyIndex === 1) { // View Count
                    valA = a.stats.viewCount;
                    valB = b.stats.viewCount;
                } else if (statsKeyIndex === 2) { // Last Seen
                    valA = a.stats.lastViewed;
                    valB = b.stats.lastViewed;
                } else { // Time to Due
                    valA = getTimeToDue(a.stats, now).ms;
                    valB = getTimeToDue(b.stats, now).ms;
                }
            }

            // Handle nulls to sort them at the end
            if (valA === null || valA === undefined) valA = historySortDirection === 'asc' ? Infinity : -Infinity;
            if (valB === null || valB === undefined) valB = historySortDirection === 'asc' ? Infinity : -Infinity;

            // Type-aware comparison
            if (typeof valA === 'number' && typeof valB === 'number') {
                // Direct numeric comparison (for status, view count, and timestamp)
            } else {
                // Fallback to string comparison
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) {
                return historySortDirection === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return historySortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });

        // Generate a new table body from the sorted data
        const newTbodyHtml = buildHistoryTbodyHtml(combinedData);

        // Replace only the table body, leaving the main app state untouched
        const table = historyTableContainer.querySelector('table');
        if (table) {
            const oldTbody = table.querySelector('tbody');
            if (oldTbody) {
                // oldTbody.innerHTML = newTbodyHtml; // This is not right, it would insert '<tbody>...</tbody>' inside another tbody
                table.removeChild(oldTbody);
                table.insertAdjacentHTML('beforeend', newTbodyHtml);
            } else {
                table.insertAdjacentHTML('beforeend', newTbodyHtml);
            }
        }

        // Also update the header classes to show sort direction
        historyTableContainer.querySelectorAll('th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
            if (parseInt(th.dataset.columnIndex) === historySortColumn) {
                th.classList.add(historySortDirection);
            }
        });
    }

    /**
     * Gets the unique key for a given card based on the selected key column.
     * @param {string[]} card - The card data array.
     * @returns {string} The unique key for the card.
     */
    function getCardKey(card) {
        const keyIndex = keyColumnSelector ? parseInt(keyColumnSelector.value) : 0;
        // The robust parsing in parseData should prevent these errors, but this is a final safeguard.
        if (!card || keyIndex >= card.length || typeof card[keyIndex] !== 'string') {
            return `invalid-card-${Math.random()}`;
        }
        return card[keyIndex].trim();
    }

    /**
     * Saves the current statistics (status, view count, last viewed) for all cards
     * to IndexedDB.
     */
    async function saveCardStats(cardKey, stats) {
        if (!cardKey || !stats) return;
        await set(cardKey, stats);
    }

    /**
     * Updates the retention score for the current card.
     * @param {boolean} known - If true, the score is incremented. If false, it's reset to 0.
     */
    async function markCardAsKnown(known) {
        const cardKey = getCardKey(cardData[currentCardIndex]);
        const stats = await getSanitizedStats(cardKey);

        if (cardShownTimestamp) {
            const delay = Date.now() - cardShownTimestamp;
            stats.responseDelays = stats.responseDelays || [];
            stats.responseDelays.push(delay);
        }

        if (known) {
            stats.successTimestamps.push(Date.now());
            // Only advance the interval if the card was due for review.
            if (isCurrentCardDue && stats.intervalIndex < repetitionIntervals.length - 1) {
                stats.intervalIndex++;
            }
        } else {
            stats.failureTimestamps.push(Date.now());
            stats.intervalIndex = 0; // Reset interval on failure
        }
        await saveCardStats(cardKey, stats);
    }

    /**
     * Saves the current UI settings (URL, columns, font, etc.) as a named configuration
     * to IndexedDB.
     */
    async function saveConfig() {
        if (!configNameInput) return;
        const configName = configNameInput.value.trim();
        if (!configName) {
            alert('Please enter a configuration name.');
            return;
        }

        const currentConfig = configs[configName] || {};

        configs[configName] = {
            ...currentConfig, // Preserve subsetData if it exists
            dataUrl: currentConfig.subsetData ? null : dataUrlInput.value,
            keyColumn: keyColumnSelector.value,
            repetitionIntervals: repetitionIntervalsTextarea.value,
            frontColumns: getSelectedColumnIndices(frontColumnCheckboxes),
            backColumns: getSelectedColumnIndices(backColumnCheckboxes),
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

        await set('flashcard-configs', configs);
        await set('flashcard-last-config', configName);
        populateConfigSelector();
        configSelector.value = configName;
        configTitle.textContent = configName;
        alert(`Configuration '${configName}' saved!`);
    }

    async function resetDeckStats() {
        if (cardData.length === 0) {
            alert("No deck is loaded. Please load a deck first.");
            return;
        }

        const confirmation = confirm("Are you sure you want to reset all statistics for every card in the current deck? This action cannot be undone.");
        if (!confirmation) {
            return;
        }

        try {
            const promises = cardData.map(card => del(getCardKey(card)));
            await Promise.all(promises);
            alert("Statistics for the current deck have been reset.");
            // Optionally, reload the current card to show its stats are reset
            if (currentCardIndex >= 0) {
                await displayCard(currentCardIndex);
            }
        } catch (error) {
            console.error("Failed to reset deck statistics:", error);
            alert("An error occurred while trying to reset the deck statistics. Please check the console for details.");
        }
    }

    /**
     * Loads a saved configuration by name, updating the UI and loading its data.
     * @param {string} configName - The name of the configuration to load.
     */
    async function loadSelectedConfig(configName) {
        if (!configName || !configs[configName]) return;
        const config = configs[configName];

        configNameInput.value = configName;
        dataUrlInput.value = config.dataUrl || '';
        fontSelector.value = config.font;
        ttsFrontCheckbox.checked = config.ttsFront;
        ttsBackCheckbox.checked = config.ttsBack;
        cardContainer.style.fontFamily = config.font;
        configTitle.textContent = configName;
        if (keyColumnSelector) keyColumnSelector.value = config.keyColumn || 0;

        if (config.subsetData && Array.isArray(config.subsetData)) {
            const tsvString = [
                config.headers.join('\t'),
                ...config.subsetData.map(row => row.join('\t'))
            ].join('\n');
            await parseData(tsvString);
            if (cacheStatus) {
                cacheStatus.textContent = `Loaded from subset "${configName}"`;
                cacheStatus.classList.add('cached');
            }
            if (settingsModal) settingsModal.classList.add('hidden');
        } else {
            await loadData();
        }

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

        if (repetitionIntervalsTextarea) {
            const configIntervalsString = config.repetitionIntervals;
            // Check if the string is null, undefined, or just empty space
            if (configIntervalsString && configIntervalsString.trim() !== '') {
                repetitionIntervals = configIntervalsString.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            }

            // If parsing resulted in an empty array, or if there was no string to begin with, use defaults
            if (repetitionIntervals.length === 0) {
                repetitionIntervals = [...defaultIntervals];
            }

            // Always update the UI to reflect the actual intervals being used
            repetitionIntervalsTextarea.value = repetitionIntervals.join(', ');
        }

        if (card) {
            if (disableAnimationCheckbox.checked) {
                card.classList.add('no-animation');
            } else {
                card.classList.remove('no-animation');
            }
        }
        await set('flashcard-last-config', configName);

        if (cardData.length > 0) {
            showNextCard();
        }
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
    async function loadInitialConfigs() { // Made async
        const savedConfigs = await get('flashcard-configs');
        if (savedConfigs) {
            configs = savedConfigs; // No JSON.parse needed
            populateConfigSelector();
        }

        const lastConfig = await get('flashcard-last-config');
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
    async function detectAndFilterLanguage() {
        if (cardData.length === 0) return;

        const langCodeSet = new Set();
        const fullText = cardData.map(row => row.join(' ')).join(' ');

        // 1. Native Chrome API
        if ('LanguageDetector' in window) {
            try {
                const detector = await LanguageDetector.create();
                const detectionResult = await detector.detect(fullText);
                detectionResult
                    .filter(lang => lang.detectedLanguage !== 'und')
                    .forEach(lang => langCodeSet.add(lang.detectedLanguage));
            } catch (error) {
                console.error('Language Detector API failed:', error);
            }
        }

        // 2. ELD Library
        try {
            const result = eld.detect(fullText);
            if (result.language) {
                langCodeSet.add(result.language);
            }
        } catch (error) {
            console.error('ELD detection failed:', error);
        }

        // 3. Franc as a fallback if others fail
        if (langCodeSet.size === 0 && typeof francAll !== 'undefined') {
            const langGuesses = francAll(fullText);
            langGuesses
                .filter(guess => guess[0] !== 'und')
                .map(guess => guess[0].substring(0, 2)) // franc gives 3-letter, convert to 2
                .forEach(code => langCodeSet.add(code));
        }

        const finalLangCodes = Array.from(langCodeSet);

        if (finalLangCodes.length > 0) {
            if (detectedLangSpan) {
                detectedLangSpan.textContent = `Detected: ${finalLangCodes.join(', ')}`;
                detectedLangSpan.style.display = 'inline';
            }
            populateVoices(finalLangCodes);
        } else {
            if (detectedLangSpan) detectedLangSpan.style.display = 'none';
            populateVoices([]);
        }
    }

    function populateVoices(detectedLangCodes = []) {
        if (!('speechSynthesis' in window)) return;
        voices = speechSynthesis.getVoices();
        if (!ttsFrontLangSelect || !ttsBackLangSelect) return;

        const currentFront = ttsFrontLangSelect.value;
        const currentBack = ttsBackLangSelect.value;

        // Create a set of language prefixes to show
        // Start with the 2-letter codes from the detected languages
        const langPrefixesToShow = new Set(detectedLangCodes.map(code => code.substring(0, 2)));

        // Add the currently configured languages to the set so they are not removed
        const frontVoice = voices.find(v => v.name === currentFront);
        const backVoice = voices.find(v => v.name === currentBack);
        if (frontVoice) {
            langPrefixesToShow.add(frontVoice.lang.substring(0, 2));
        }
        if (backVoice) {
            langPrefixesToShow.add(backVoice.lang.substring(0, 2));
        }

        ttsFrontLangSelect.innerHTML = '';
        ttsBackLangSelect.innerHTML = '';

        let voicesToDisplay = voices;
        if (langPrefixesToShow.size > 0) {
            voicesToDisplay = voices.filter(voice => {
                const voiceLangPrefix = voice.lang.substring(0, 2);
                return langPrefixesToShow.has(voiceLangPrefix);
            });
        }

        // If filtering results in no voices, fall back to showing all
        if (voicesToDisplay.length === 0) {
            voicesToDisplay = voices;
        }

        voicesToDisplay.forEach(voice => {
            const option1 = new Option(`${voice.name} (${voice.lang})`, voice.name);
            const option2 = new Option(`${voice.name} (${voice.lang})`, voice.name);
            ttsFrontLangSelect.add(option1);
            ttsBackLangSelect.add(option2);
        });

        // Try to restore previous selection
        ttsFrontLangSelect.value = currentFront;
        ttsBackLangSelect.value = currentBack;
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
        isDragging = false;

        const diffX = currentX - startX;

        // Reset drag state for the next interaction
        startX = 0;
        currentX = 0;

        // Treat very small movements as a tap
        if (Math.abs(diffX) < 10) {
            card.style.transform = '';
            // Don't flip if the mouse just left the card while dragging
            if (e.type !== 'mouseleave') {
                flipCard();
            }
            return;
        }

        card.style.transition = 'transform 0.3s ease';

        if (Math.abs(diffX) > dragThreshold) {
            // A real swipe
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
            // A short drag, but not a tap, so snap back
            card.style.transform = '';
        }
    }


    // Initial load
    populateVoices();
    if ('speechSynthesis'in window && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => populateVoices();
    }
    loadInitialConfigs();

    // --- Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }
});
