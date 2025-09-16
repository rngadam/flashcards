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
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    const closeMobileMenuButton = document.getElementById('close-mobile-menu-button');
    const mobileHistoryButton = document.getElementById('mobile-history-button');
    const mobileSettingsButton = document.getElementById('mobile-settings-button');
    const mobileHelpButton = document.getElementById('mobile-help-button');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const mobileFullscreenButton = document.getElementById('mobile-fullscreen-button');
    const settingsButton = document.getElementById('settings-button');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const settingsModal = document.getElementById('settings-modal');
    const historyButton = document.getElementById('history-button');
    const closeHistoryButton = document.getElementById('close-history-button');
    const historyModal = document.getElementById('history-modal');
    const helpButton = document.getElementById('help-button');
    const closeHelpButton = document.getElementById('close-help-button');
    const helpModal = document.getElementById('help-modal');
    const historyTableContainer = document.getElementById('history-table-container');
    const configTitle = document.getElementById('config-title');
    const loadDataButton = document.getElementById('load-data');
    const saveConfigButton = document.getElementById('save-config');
    const resetStatsButton = document.getElementById('reset-stats');
    const dataUrlInput = document.getElementById('data-url');
    const columnRolesContainer = document.getElementById('column-roles-container');
    const skillColumnConfigContainer = document.getElementById('skill-column-config-container');
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
    const skillSelectorCheckboxes = document.getElementById('skill-selector-checkboxes');
    const repetitionIntervalsTextarea = document.getElementById('repetition-intervals');
    const detectedLangSpan = document.getElementById('detected-lang');
    const configSelector = document.getElementById('config-selector');
    const cardContainer = document.getElementById('card-container');
    const cardStatsDisplay = document.getElementById('card-stats');
    const skillMasteryDashboard = document.getElementById('skill-mastery-dashboard');
    const cardSpecificStats = document.getElementById('card-specific-stats');
    const cardFront = document.querySelector('.card-front');
    const cardBack = document.querySelector('.card-back');
    const cardBackContent = document.getElementById('card-back-content');
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
    const writingPracticeContainer = document.getElementById('writing-practice-container');
    const writingInput = document.getElementById('writing-input');
    const writingSubmit = document.getElementById('writing-submit');
    const comparisonContainer = document.getElementById('comparison-container');
    const slowReplayButton = document.getElementById('slow-replay-button');
    const slowReplayHotkey = document.getElementById('slow-replay-hotkey');
    const deckTitle = document.getElementById('deck-title');
    const lastSeen = document.getElementById('last-seen');


    // App state
    const COLUMN_ROLES = {
        NONE: 'None',
        TARGET_LANGUAGE: 'Target Language',
        BASE_LANGUAGE: 'Base Language',
        PRONUNCIATION: 'Pronunciation Guide',
        EXAMPLE_SENTENCE: 'Example Sentence',
        COMMON_COLLOCATION: 'Common Collocation',
        RELATED_WORD: 'Related Word',
        RELATION_TYPE: 'Relation Type',
        GRAMMATICAL_TYPE: 'Grammatical Type',
    };
    const SKILLS = {
        READING: {
            id: 'READING',
            label: 'Reading Comprehension',
            description: 'See Target Language → Recall Base Language'
        },
        LISTENING: {
            id: 'LISTENING',
            label: 'Listening Comprehension',
            description: 'Hear Target Language → Recall Base Language'
        },
        WRITING: {
            id: 'WRITING',
            label: 'Validated Writing Practice',
            description: 'See Base Language → Write Target Language'
        },
        SPOKEN: {
            id: 'SPOKEN',
            label: 'Spoken Production',
            description: 'See Base Language → Say Target Language'
        },
        PRONUNCIATION: {
            id: 'PRONUNCIATION',
            label: 'Pronunciation Practice',
            description: 'See Target Language → Say Target Language'
        }
    };
    let cardData = []; // Holds the parsed card data from the TSV/CSV file.
    let headers = []; // Holds the column headers from the data file.
    let currentCardIndex = 0; // The index of the currently displayed card in cardData.
    let currentSkill = SKILLS.READING.id; // The skill being practiced for the current card.
    let configs = {}; // Stores all saved deck configurations.
    let voices = []; // Holds the list of available TTS voices from the browser.
    let viewHistory = []; // A stack to keep track of the sequence of viewed cards for the "previous" button.
    let useUppercase = false; // A flag for the "Alternate Uppercase" feature.
    let replayRate = 1.0; // Tracks the current playback rate for the 'f' key replay feature.
    let cardShownTimestamp = null; // Tracks when the card was shown to calculate response delay.
    let isCurrentCardDue = false; // Tracks if the current card was shown because it was due for review.
    let isConfigDirty = false; // Tracks if the current config has unsaved changes.

    // History table sort state
    let historySortColumn = -1;
    let historySortDirection = 'asc';

    // Spaced Repetition State
    const defaultIntervals = [5, 25, 120, 600, 3600, 18000, 86400, 432000, 2160000, 10368000, 63072000]; // in seconds
    let repetitionIntervals = [...defaultIntervals];

    // Drag state for swipe gestures
    let isDragging = false; // True if a card is currently being dragged.
    let startX = 0, startY = 0; // The starting X and Y coordinates of a drag.
    let currentX = 0, currentY = 0; // The current X and Y coordinates during a drag.
    let dragThreshold = 100; // The pixel distance a card must be dragged to trigger a swipe action.
    let verticalDragThreshold = 50; // The pixel distance for a vertical flip.

    // --- Event Listeners ---
    if (hamburgerMenu) hamburgerMenu.addEventListener('click', () => mobileMenuOverlay.classList.remove('hidden'));
    if (closeMobileMenuButton) closeMobileMenuButton.addEventListener('click', () => mobileMenuOverlay.classList.add('hidden'));

    if (settingsButton) settingsButton.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    if (mobileSettingsButton) mobileSettingsButton.addEventListener('click', () => {
        mobileMenuOverlay.classList.add('hidden');
        settingsModal.classList.remove('hidden');
    });
    if (closeSettingsButton) closeSettingsButton.addEventListener('click', () => settingsModal.classList.add('hidden'));

    if (historyButton) historyButton.addEventListener('click', renderHistoryTable);
    if (mobileHistoryButton) mobileHistoryButton.addEventListener('click', () => {
        mobileMenuOverlay.classList.add('hidden');
        renderHistoryTable();
    });
    if (closeHistoryButton) closeHistoryButton.addEventListener('click', () => historyModal.classList.add('hidden'));

    if (helpButton) helpButton.addEventListener('click', () => helpModal.classList.remove('hidden'));
    if (mobileHelpButton) mobileHelpButton.addEventListener('click', () => {
        mobileMenuOverlay.classList.add('hidden');
        helpModal.classList.remove('hidden');
    });
    if (closeHelpButton) closeHelpButton.addEventListener('click', () => helpModal.classList.add('hidden'));

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    if (fullscreenButton) fullscreenButton.addEventListener('click', toggleFullscreen);
    if (mobileFullscreenButton) mobileFullscreenButton.addEventListener('click', () => {
        mobileMenuOverlay.classList.add('hidden');
        toggleFullscreen();
    });

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

    if (skillMasteryDashboard) {
        skillMasteryDashboard.addEventListener('click', async (e) => {
            const skillItem = e.target.closest('.skill-mastery-item');
            if (!skillItem) return;

            const skillId = skillItem.dataset.skillId;
            if (!skillId) return;

            const currentConfigName = configSelector.value;
            if (!currentConfigName || !configs[currentConfigName]) return;

            const activeSkills = new Set(configs[currentConfigName].skills || []);
            if (activeSkills.has(skillId)) {
                if (activeSkills.size > 1) { // Prevent removing the last skill
                    activeSkills.delete(skillId);
                }
            } else {
                activeSkills.add(skillId);
            }
            configs[currentConfigName].skills = [...activeSkills];
            isConfigDirty = true;
            if (saveConfigButton) saveConfigButton.disabled = false;

            // Re-render the dashboard and show a new card
            const cardKey = getCardKey(cardData[currentCardIndex]);
            const stats = await getSanitizedStats(cardKey);
            renderSkillMastery(stats); // Re-render to update styles
            await showNextCard();
        });
    }

    if (skillSelectorCheckboxes) {
        skillSelectorCheckboxes.addEventListener('change', async (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                const currentConfigName = configSelector.value;
                if (currentConfigName && configs[currentConfigName]) {
                    configs[currentConfigName].skills = getSelectedSkills();
                    isConfigDirty = true;
                    if (saveConfigButton) saveConfigButton.disabled = false;
                    await showNextCard();
                }
            }
        });
    }

    if (writingSubmit) writingSubmit.addEventListener('click', checkWritingAnswer);
    if (writingInput) writingInput.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') {
            checkWritingAnswer();
        }
    });

    const handleSlowReplay = () => {
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName] || {};
        const skillConfig = (currentConfig.skillColumns || {})[currentSkill] || {};
        const frontIndices = skillConfig.front || [0];
        const ttsSourceColumn = skillConfig.ttsFrontColumn || frontIndices[0];
        const ttsText = getTextForColumns([ttsSourceColumn]);
        speak(ttsText, ttsFrontLangSelect.value, 0.7); // Speak at a fixed slow rate
    };

    if (slowReplayButton) slowReplayButton.addEventListener('click', handleSlowReplay);
    if (slowReplayHotkey) slowReplayHotkey.addEventListener('click', handleSlowReplay);

    if (settingsModal) {
        settingsModal.addEventListener('input', handleSettingsChange);
        settingsModal.addEventListener('change', handleSettingsChange);
    }

    function handleSettingsChange(e) {
        const target = e.target;
        // Check if the change happened on a relevant form element
        if (target.matches('input, select, textarea')) {
            isConfigDirty = true;
            if (saveConfigButton) saveConfigButton.disabled = false;
        }
    }

    function getLenientString(str) {
        if (typeof str !== 'string') return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '')
            .trim();
    }

    function renderDiff(userAnswer, correctAnswer, isCorrect) {
        const userAnswerLower = userAnswer.toLowerCase();
        const correctAnswerLower = correctAnswer.toLowerCase();
        // The user wants to see how to get from THEIR answer to the correct one.
        const diff = Diff.diffChars(userAnswerLower, correctAnswerLower);
        const fragment = document.createDocumentFragment();

        const resultDiv = document.createElement('div');
        resultDiv.innerHTML = `<strong>${isCorrect ? 'Correct!' : 'Incorrect.'}</strong>`;
        resultDiv.style.color = isCorrect ? 'green' : 'red';
        fragment.appendChild(resultDiv);

        // --- Your Answer ---
        const userDiv = document.createElement('div');
        userDiv.innerHTML = '<strong>Your Answer:</strong> ';
        const userContent = document.createElement('div');
        let userPointer = 0;
        diff.forEach(part => {
            // We only care about parts that were in the original user answer
            if (part.added) return;

            const span = document.createElement('span');
            // 'removed' means it's in the user's answer but not the correct one (an error).
            span.className = part.removed ? 'diff-removed' : 'diff-common';
            const originalText = userAnswer.substring(userPointer, userPointer + part.value.length);
            span.appendChild(document.createTextNode(originalText));
            userContent.appendChild(span);
            userPointer += part.value.length;
        });
        userDiv.appendChild(userContent);

        // --- Correct Answer ---
        const correctDiv = document.createElement('div');
        correctDiv.innerHTML = '<strong>Correct Answer:</strong> ';
        const correctContent = document.createElement('div');
        let correctPointer = 0;
        diff.forEach(part => {
             // We only care about parts that ended up in the correct answer
            if (part.removed) return;

            const span = document.createElement('span');
            // 'added' means it's in the correct answer but not the user's (a good addition).
            span.className = part.added ? 'diff-added' : 'diff-common';
            const originalText = correctAnswer.substring(correctPointer, correctPointer + part.value.length);
            span.appendChild(document.createTextNode(originalText));
            correctContent.appendChild(span);
            correctPointer += part.value.length;
        });
        correctDiv.appendChild(correctContent);


        fragment.appendChild(userDiv);
        fragment.appendChild(correctDiv);

        return fragment;
    }


    async function checkWritingAnswer() {
        const userAnswer = writingInput.value.trim();
        if (userAnswer === '') return;

        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName] || {};
        let skillConfig = (currentConfig.skillColumns || {})[currentSkill];
        if (!skillConfig) {
            skillConfig = (currentConfig.skillColumns || {})[SKILLS.READING.id] || { front: [0], back: [1], validationColumn: 'none' };
        }
        const validationColumnIndex = skillConfig.validationColumn;
        if (!validationColumnIndex || validationColumnIndex === 'none') {
            console.error("checkWritingAnswer called but no validation column is configured for this skill.");
            return;
        }
        const correctAnswer = cardData[currentCardIndex][validationColumnIndex];

        const isCorrect = getLenientString(userAnswer) === getLenientString(correctAnswer);

        await markCardAsKnown(isCorrect);

        comparisonContainer.innerHTML = ''; // Clear previous diff
        comparisonContainer.appendChild(renderDiff(userAnswer, correctAnswer, isCorrect));
        comparisonContainer.classList.remove('hidden');
        writingInput.disabled = true;

        if (!card.classList.contains('flipped')) {
            flipCard();
        }

        // Show the next card button to allow the user to proceed
        nextCardButton.classList.remove('hidden');
    }

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
        populateColumnRolesUI();
        populateColumnSelectors();
        populateKeyColumnSelector();
        if (repetitionIntervalsTextarea) repetitionIntervalsTextarea.value = repetitionIntervals.join(', ');
        detectAndFilterLanguage();
    }

    function populateColumnRolesUI() {
        if (!columnRolesContainer) return;
        columnRolesContainer.innerHTML = ''; // Clear previous

        const title = document.createElement('label');
        title.textContent = 'Column Roles (for Auto-Configuration):';
        title.style.display = 'block';
        title.style.marginBottom = '10px';
        columnRolesContainer.appendChild(title);

        const rolesGrid = document.createElement('div');
        rolesGrid.style.display = 'grid';
        rolesGrid.style.gridTemplateColumns = 'auto 1fr';
        rolesGrid.style.gap = '5px 10px';
        rolesGrid.style.alignItems = 'center';


        headers.forEach((header, index) => {
            const label = document.createElement('label');
            label.textContent = header;
            label.htmlFor = `column-role-${index}`;

            const select = document.createElement('select');
            select.id = `column-role-${index}`;
            select.dataset.columnIndex = index;

            for (const roleKey in COLUMN_ROLES) {
                const option = new Option(COLUMN_ROLES[roleKey], roleKey);
                select.add(option);
            }
            // Auto-detect basic roles
            if (header.toLowerCase().includes('target') || header.toLowerCase().includes('greek')) select.value = 'TARGET_LANGUAGE';
            if (header.toLowerCase().includes('base') || header.toLowerCase().includes('english')) select.value = 'BASE_LANGUAGE';
            if (header.toLowerCase().includes('pronunciation')) select.value = 'PRONUNCIATION';


            rolesGrid.appendChild(label);
            rolesGrid.appendChild(select);
        });

        // Add TTS source selector
        const ttsLabel = document.createElement('label');
        ttsLabel.textContent = 'TTS Source Column:';
        ttsLabel.htmlFor = 'tts-source-column-selector';
        const ttsSelect = document.createElement('select');
        ttsSelect.id = 'tts-source-column-selector';
        headers.forEach((header, index) => {
            const option = new Option(header, index);
            ttsSelect.add(option);
        });

        // Add Auto-configure button
        const autoConfigButton = document.createElement('button');
        autoConfigButton.id = 'auto-configure-button';
        autoConfigButton.textContent = 'Auto-Configure Skill Settings';
        autoConfigButton.style.gridColumn = '1 / -1'; // Span across both columns
        autoConfigButton.style.marginTop = '10px';


        columnRolesContainer.appendChild(rolesGrid);
        rolesGrid.appendChild(ttsLabel);
        rolesGrid.appendChild(ttsSelect);
        rolesGrid.appendChild(autoConfigButton);

        autoConfigButton.addEventListener('click', autoConfigureSkills);
    }

    function autoConfigureSkills() {
        // 1. Read the current role assignments from the UI
        const columnRoles = {};
        document.querySelectorAll('[id^="column-role-"]').forEach(select => {
            columnRoles[select.dataset.columnIndex] = select.value;
        });

        // 2. Map roles to arrays of column indices
        const roleToIndexMap = {};
        for (const roleKey in COLUMN_ROLES) {
            roleToIndexMap[roleKey] = [];
        }
        for (const colIndex in columnRoles) {
            const role = columnRoles[colIndex];
            if (role !== 'NONE') {
                roleToIndexMap[role].push(parseInt(colIndex));
            }
        }

        // 3. Define preset rules
        const presets = {
            READING: { front: roleToIndexMap.TARGET_LANGUAGE, back: roleToIndexMap.BASE_LANGUAGE.concat(roleToIndexMap.PRONUNCIATION) },
            LISTENING: { front: roleToIndexMap.TARGET_LANGUAGE, back: roleToIndexMap.BASE_LANGUAGE.concat(roleToIndexMap.PRONUNCIATION, roleToIndexMap.TARGET_LANGUAGE) },
            WRITING: { front: roleToIndexMap.BASE_LANGUAGE, back: roleToIndexMap.TARGET_LANGUAGE },
            SPOKEN: { front: roleToIndexMap.BASE_LANGUAGE, back: roleToIndexMap.TARGET_LANGUAGE },
            PRONUNCIATION: { front: roleToIndexMap.TARGET_LANGUAGE.concat(roleToIndexMap.PRONUNCIATION), back: roleToIndexMap.BASE_LANGUAGE }
        };

        // 4. Apply the rules
        const allColumnIndices = headers.map((_, i) => i);
        for (const skillId in presets) {
            const preset = presets[skillId];
            const frontContainer = document.getElementById(`front-column-checkboxes-${skillId}`);
            const backContainer = document.getElementById(`back-column-checkboxes-${skillId}`);

            if (frontContainer) {
                frontContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = preset.front.includes(parseInt(cb.value));
                });
            }
            if (backContainer) {
                backContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = allColumnIndices.includes(parseInt(cb.value));
                });
            }
        }

        // 5. Auto-set TTS Source and Validation columns per skill
        for (const skillId in presets) {
            const validationSelector = document.getElementById(`validation-column-selector-${skillId}`);
            const ttsFrontSelector = document.getElementById(`tts-front-column-selector-${skillId}`);
            if (!validationSelector || !ttsFrontSelector) continue;

            // Default TTS is always the target language if available
            if (roleToIndexMap.TARGET_LANGUAGE.length > 0) {
                ttsFrontSelector.value = roleToIndexMap.TARGET_LANGUAGE[0];
            }

            // Default validation settings
            switch (skillId) {
                case 'LISTENING':
                case 'WRITING':
                    if (roleToIndexMap.TARGET_LANGUAGE.length > 0) {
                        validationSelector.value = roleToIndexMap.TARGET_LANGUAGE[0];
                    }
                    break;
                default:
                    validationSelector.value = 'none';
                    break;
            }
        }


        // Auto-set the main TTS source as a fallback
        const ttsSelect = document.getElementById('tts-source-column-selector');
        if (ttsSelect && roleToIndexMap.TARGET_LANGUAGE.length > 0) {
            ttsSelect.value = roleToIndexMap.TARGET_LANGUAGE[0];
        }


        alert('Skill settings have been auto-configured based on column roles.');
        handleSettingsChange(); // Mark config as dirty
    }

    function populateColumnSelectors() {
        if (!skillColumnConfigContainer) return;
        skillColumnConfigContainer.innerHTML = ''; // Clear previous content

        const tabList = document.createElement('div');
        tabList.className = 'tabs';
        tabList.setAttribute('role', 'tablist');

        const panelContainer = document.createElement('div');

        headers.forEach((header, index) => {
            // This part of the logic is now inside the skill loop
        });

        Object.keys(SKILLS).forEach((skillId, i) => {
            const skill = SKILLS[skillId];
            const isActive = i === 0;

            // Create Tab Button
            const button = document.createElement('button');
            button.className = `tab-button ${isActive ? 'active' : ''}`;
            button.setAttribute('role', 'tab');
            button.dataset.tab = `skill-panel-${skillId}`;
            button.textContent = skill.label;
            tabList.appendChild(button);

            // Create Tab Panel
            const panel = document.createElement('div');
            panel.id = `skill-panel-${skillId}`;
            panel.className = `tab-panel ${isActive ? 'active' : ''}`;
            panel.setAttribute('role', 'tabpanel');

            // Create Front and Back Checkbox groups for this skill
            const frontContainer = document.createElement('div');
            frontContainer.className = 'column-checkbox-group';
            frontContainer.id = `front-column-checkboxes-${skillId}`;

            const backContainer = document.createElement('div');
            backContainer.className = 'column-checkbox-group';
            backContainer.id = `back-column-checkboxes-${skillId}`;

            headers.forEach((header, index) => {
                const idFront = `front-col-${skillId}-${index}`;
                const checkboxFront = `<div><input type="checkbox" id="${idFront}" value="${index}"><label for="${idFront}">${header}</label></div>`;
                frontContainer.insertAdjacentHTML('beforeend', checkboxFront);

                const idBack = `back-col-${skillId}-${index}`;
                const checkboxBack = `<div><input type="checkbox" id="${idBack}" value="${index}"><label for="${idBack}">${header}</label></div>`;
                backContainer.insertAdjacentHTML('beforeend', checkboxBack);
            });

            // Set default selections for the first skill (Reading)
            if (skillId === SKILLS.READING.id) {
                 if (headers.length > 0) {
                    const firstCheckbox = frontContainer.querySelector('input');
                    if (firstCheckbox) firstCheckbox.checked = true;
                }
                backContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            } else { // Default for other skills (e.g., Writing) might be swapped
                 if (headers.length > 0) {
                    const firstCheckbox = backContainer.querySelector('input');
                    if (firstCheckbox) firstCheckbox.checked = true;
                }
                frontContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            }


            panel.innerHTML = `
                <div class="setting-grid">
                    <div><label>Front Column(s):</label></div>
                    <div><label>Back Column(s):</label></div>
                    <div>${frontContainer.outerHTML}</div>
                    <div>${backContainer.outerHTML}</div>
                    <div>
                        <label for="validation-column-selector-${skillId}">Validation Column:</label>
                        <select id="validation-column-selector-${skillId}"></select>
                    </div>
                    <div>
                        <label for="tts-front-column-selector-${skillId}">TTS (Front) Column:</label>
                        <select id="tts-front-column-selector-${skillId}"></select>
                    </div>
                </div>
            `;

            // Populate the new dropdowns
            const validationSelector = panel.querySelector(`#validation-column-selector-${skillId}`);
            const ttsFrontSelector = panel.querySelector(`#tts-front-column-selector-${skillId}`);

            const noneOption = new Option('None', 'none');
            validationSelector.add(noneOption);

            headers.forEach((header, index) => {
                const optionValidation = new Option(header, index);
                const optionTts = new Option(header, index);
                validationSelector.add(optionValidation);
                ttsFrontSelector.add(optionTts);
            });

            panelContainer.appendChild(panel);
        });

        skillColumnConfigContainer.appendChild(tabList);
        skillColumnConfigContainer.appendChild(panelContainer);

        // Add event listener for the new tabs
        tabList.addEventListener('click', e => {
            if (e.target.matches('.tab-button')) {
                const button = e.target;
                tabList.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                panelContainer.querySelectorAll('.tab-panel').forEach(panel => {
                    panel.classList.toggle('active', panel.id === button.dataset.tab);
                });
            }
        });
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

        // Get the correct column configuration for the current skill to find the text to speak.
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName] || {};
        let skillConfig = (currentConfig.skillColumns || {})[currentSkill];
        if (!skillConfig) {
            skillConfig = (currentConfig.skillColumns || {})[SKILLS.READING.id] || { front: [0], back: [1] };
        }
        const frontIndices = skillConfig.front;

        if (card.classList.contains('flipped') && ttsBackCheckbox && ttsBackCheckbox.checked) {
            speak(cardBack.textContent, ttsBackLangSelect.value);
        } else if (!card.classList.contains('flipped') && ttsFrontCheckbox && ttsFrontCheckbox.checked) {
            const ttsSourceColumn = currentConfig.ttsSourceColumn || frontIndices[0];
            const ttsText = getTextForColumns([ttsSourceColumn]);
            speak(ttsText, ttsFrontLangSelect.value);
        }
    }

    /**
     * Dynamically adjusts the font size of an element to fit its container.
     * Uses a binary search approach for efficiency.
     * @param {HTMLElement} element - The text element to resize.
     */
    function adjustFontSize(element, isFront) {
        if (!element) return;
        const container = element.closest('.card-face');
        if (!container) return;
        let min = 10, max = isFront ? 150 : 80;
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

    function getTimeToDue(skillStats, now = Date.now()) {
        if (!skillStats.lastViewed) {
            return { ms: -1, formatted: 'N/A' }; // N/A for cards never seen
        }
        const intervalSeconds = repetitionIntervals[skillStats.intervalIndex];
        if (intervalSeconds === undefined) {
             return { ms: Infinity, formatted: 'Learned' }; // Card is fully learned
        }
        const dueDate = skillStats.lastViewed + (intervalSeconds * 1000);
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

    function getRetentionScore(skillStats) {
        if (!skillStats || typeof skillStats !== 'object') {
            return 0;
        }
        return (skillStats.successTimestamps?.length || 0) - (skillStats.failureTimestamps?.length || 0);
    }

    function createDefaultSkillStats() {
        return {
            successTimestamps: [],
            failureTimestamps: [],
            responseDelays: [],
            lastViewed: null,
            intervalIndex: 0,
            viewCount: 0
        };
    }

    async function getSanitizedStats(cardKey) {
        let cardStats = await get(cardKey);

        // Migration from old format
        if (cardStats && !cardStats.skills) {
            console.log(`Migrating old stats for card: ${cardKey}`);
            const oldStats = { ...cardStats };
            cardStats = {
                skills: {
                    [SKILLS.READING.id]: {
                        successTimestamps: oldStats.successTimestamps || [],
                        failureTimestamps: oldStats.failureTimestamps || [],
                        responseDelays: oldStats.responseDelays || [],
                        lastViewed: oldStats.lastViewed || null,
                        intervalIndex: oldStats.intervalIndex || 0,
                        viewCount: oldStats.viewCount || 0,
                    }
                }
            };
        }

        // Ensure the structure is valid
        if (!cardStats || typeof cardStats !== 'object' || !cardStats.skills) {
            cardStats = { skills: {} };
        }

        // Ensure all defined skills have a stats object
        for (const skillId in SKILLS) {
            if (!cardStats.skills[skillId]) {
                cardStats.skills[skillId] = createDefaultSkillStats();
            }
        }

        return cardStats;
    }

    function renderSkillMastery(cardStats) {
        if (!skillMasteryDashboard) return;

        const currentConfigName = configSelector.value;
        const activeSkills = new Set((configs[currentConfigName] || {}).skills || []);

        let html = '';
        for (const skillId in SKILLS) {
            const skill = SKILLS[skillId];
            const skillStats = cardStats.skills[skillId];
            const score = getRetentionScore(skillStats);
            const timeToDue = getTimeToDue(skillStats);

            const isCurrent = skillId === currentSkill;
            const isActiveSession = activeSkills.has(skillId);

            let classes = 'skill-mastery-item';
            if (isCurrent) classes += ' active'; // Light green for current
            if (isActiveSession) classes += ' active-session'; // Light blue for active in session

            html += `
                <div class="${classes}" data-skill-id="${skillId}" title="${skill.label} - Next review: ${timeToDue.formatted}">
                    <span class="skill-name">${skill.label.match(/\b(\w)/g).join('')}</span>
                    <span class="skill-score">${score}</span>
                </div>
            `;
        }
        skillMasteryDashboard.innerHTML = html;
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

        if (!isNavigatingBack && (index !== currentCardIndex || reason.skill !== currentSkill)) {
             viewHistory.push({ cardIndex: currentCardIndex, skill: currentSkill });
        }

        currentCardIndex = index;
        // The currentSkill is now set by showNextCard
        replayRate = 1.0;

        const currentSkillStats = stats.skills[currentSkill];
        const previousLastViewed = currentSkillStats.lastViewed; // Store previous value
        currentSkillStats.viewCount++;
        currentSkillStats.lastViewed = Date.now();

        // Get the correct column configuration for the current skill
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName] || {};
        let skillConfig = (currentConfig.skillColumns || {})[currentSkill];

        // Fallback logic if skill config is missing
        if (!skillConfig) {
            skillConfig = (currentConfig.skillColumns || {})[SKILLS.READING.id] || { front: [0], back: [1] };
        }

        const frontIndices = skillConfig.front;
        const backIndices = skillConfig.back;

        // This replaces the old hard-coded logic
        const originalFrontText = getTextForColumns(frontIndices);
        let displayText = originalFrontText;
        if (alternateUppercaseCheckbox && alternateUppercaseCheckbox.checked) {
            if (useUppercase) {
                displayText = originalFrontText.toUpperCase();
            }
            useUppercase = !useUppercase;
        }

        const isAudioOnly = (audioOnlyFrontCheckbox && audioOnlyFrontCheckbox.checked) || currentSkill === SKILLS.LISTENING.id;

        cardFront.innerHTML = ''; // Clear previous content
        cardBackContent.innerHTML = ''; // Clear previous content

        if (isAudioOnly) {
            cardFront.innerHTML = '<span class="speech-icon">🔊</span>';
        } else {
            cardFront.innerHTML = `<span>${displayText.replace(/\n/g, '<br>')}</span>`;
        }

        cardBackContent.innerHTML = `<span>${getTextForColumns(backIndices).replace(/\n/g, '<br>')}</span>`;

        cardFront.style.fontSize = '';
        cardBackContent.style.fontSize = '';

        setTimeout(() => {
            if (!isAudioOnly) {
                adjustFontSize(cardFront.querySelector('span'), true);
            }
            adjustFontSize(cardBackContent.querySelector('span'), false);
        }, 50);

        card.classList.remove('flipped');
        if (ttsFrontCheckbox && ttsFrontCheckbox.checked && ttsOnHotkeyOnlyCheckbox && !ttsOnHotkeyOnlyCheckbox.checked) {
            const ttsSourceColumn = skillConfig.ttsFrontColumn || frontIndices[0];
            const ttsText = getTextForColumns([ttsSourceColumn]);
            speak(ttsText, ttsFrontLangSelect.value);
        }

        renderSkillMastery(stats);

        const timeAgo = formatTimeAgo(previousLastViewed);
        if (lastSeen) {
            lastSeen.textContent = `Last seen: ${timeAgo}`;
        }
        if (cardSpecificStats) {
            cardSpecificStats.innerHTML = ``;
        }

        if (explanationMessage) {
            let message = '';
            explanationMessage.classList.remove('deck-learned-message'); // Reset class first
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
                    explanationMessage.classList.add('deck-learned-message');
                    if (reason.timeToNextReview !== Infinity) {
                        const formattedMinTime = formatTimeDifference(reason.timeToNextReview);
                        const formattedMaxTime = formatTimeDifference(reason.timeToLastReview);
                        message = `Deck learned! Reviews are from ${formattedMinTime} to ${formattedMaxTime}. Reviewing lowest-score cards until then.`;
                    } else {
                        message = 'Congratulations, you have learned this whole deck!';
                    }
                    break;
            }
            explanationMessage.textContent = message;
            explanationMessage.classList.toggle('visible', !!message);
        }

        // Handle UI changes for Writing skill
        const validationColumn = skillConfig.validationColumn;
        if (validationColumn && validationColumn !== 'none') {
            writingPracticeContainer.classList.remove('hidden');
            writingPracticeContainer.classList.toggle('audio-only-writing', isAudioOnly);
            iKnowButton.classList.add('hidden');
            iDontKnowButton.classList.add('hidden');
            nextCardButton.classList.add('hidden');
            writingInput.value = '';
            writingInput.disabled = false;
            writingInput.focus();
        } else {
            writingPracticeContainer.classList.add('hidden');
            iKnowButton.classList.remove('hidden');
            iDontKnowButton.classList.remove('hidden');
            nextCardButton.classList.remove('hidden');
        }
        comparisonContainer.classList.add('hidden');
        comparisonContainer.innerHTML = ''; // Clear previous diff content

        await saveCardStats(cardKey, stats);
        cardShownTimestamp = Date.now();
    }

    async function getAllCardStats() {
        const promises = cardData.map(card => getSanitizedStats(getCardKey(card)));
        return Promise.all(promises);
    }

    async function showNextCard({ forceNew = false, now = Date.now() } = {}) {
        if (cardData.length === 0) return;

        // 1. Get user's selected skills for the current session
        const activeSkills = getActiveSkills();
        const allCardStats = await getAllCardStats();

        // 2. Create a flat list of all possible (card, skill) combinations to review
        const reviewableItems = [];
        allCardStats.forEach((cardStats, cardIndex) => {
            activeSkills.forEach(skillId => {
                reviewableItems.push({
                    cardIndex,
                    skillId,
                    skillStats: cardStats.skills[skillId]
                });
            });
        });

        if (reviewableItems.length === 0) return;

        // --- Heuristic 1: Find "Due" Items ---
        const dueItems = reviewableItems.filter(item => {
            if (!item.skillStats.lastViewed) return false;
            const intervalSeconds = repetitionIntervals[item.skillStats.intervalIndex];
            if (intervalSeconds === undefined) return false; // Already fully learned
            return now - item.skillStats.lastViewed > intervalSeconds * 1000;
        });

        if (dueItems.length > 0) {
            shuffleArray(dueItems);
            dueItems.sort((a, b) => getRetentionScore(a.skillStats) - getRetentionScore(b.skillStats));
            let nextItem = dueItems[0];

            if (forceNew && nextItem.cardIndex === currentCardIndex && nextItem.skillId === currentSkill && dueItems.length > 1) {
                nextItem = dueItems[1];
            }
            currentCardIndex = nextItem.cardIndex;
            currentSkill = nextItem.skillId;
            const reason = { type: 'due_review', expiredInterval: formatDuration(repetitionIntervals[nextItem.skillStats.intervalIndex]), nextInterval: formatDuration(repetitionIntervals[nextItem.skillStats.intervalIndex + 1] || 0) };
            await displayCard(currentCardIndex, { reason });
            return;
        }

        // --- Heuristic 2: Find "New" Items ---
        const newItems = reviewableItems.filter(item => item.skillStats.viewCount === 0);
        if (newItems.length > 0) {
            const nextItem = newItems[Math.floor(Math.random() * newItems.length)];
            currentCardIndex = nextItem.cardIndex;
            currentSkill = nextItem.skillId;
            await displayCard(currentCardIndex, { reason: { type: 'new_card' } });
            return;
        }

        // --- Heuristic 3: Find "Least Learned" Item ---
        let reasonForDisplay;
        const allSkillsLearned = reviewableItems.every(item => getRetentionScore(item.skillStats) > 0);
        if (allSkillsLearned) {
                let minTimeToDue = Infinity;
                let maxTimeToDue = 0;
                reviewableItems.forEach(item => {
                    const timeToDue = getTimeToDue(item.skillStats, now).ms;
                    if (timeToDue > 0 && timeToDue < minTimeToDue) minTimeToDue = timeToDue;
                    if (timeToDue > maxTimeToDue) maxTimeToDue = timeToDue;
                });
                reasonForDisplay = { type: 'deck_learned', timeToNextReview: minTimeToDue, timeToLastReview: maxTimeToDue };
        } else {
            reasonForDisplay = { type: 'least_learned' };
        }

        let candidateItems = [...reviewableItems];
        if (forceNew && candidateItems.length > 1) {
            candidateItems = candidateItems.filter(item => item.cardIndex !== currentCardIndex || item.skillId !== currentSkill);
        }
        if (candidateItems.length === 0) {
            candidateItems = [...reviewableItems];
        }

        shuffleArray(candidateItems);
        candidateItems.sort((a, b) => {
            const scoreA = getRetentionScore(a.skillStats);
            const scoreB = getRetentionScore(b.skillStats);
            if (scoreA !== scoreB) return scoreA - scoreB;
            const lastViewedA = a.skillStats.lastViewed || 0;
            const lastViewedB = b.skillStats.lastViewed || 0;
            return lastViewedA - lastViewedB;
        });

        const nextItem = candidateItems[0];
        currentCardIndex = nextItem.cardIndex;
        currentSkill = nextItem.skillId;
        await displayCard(currentCardIndex, { reason: reasonForDisplay });
    }

    /**
     * Shows the previously viewed card by popping from the view history stack.
     */
    async function showPrevCard() {
        if (viewHistory.length > 0) {
            const prevState = viewHistory.pop();
            currentSkill = prevState.skill; // Restore the skill for that card
            await displayCard(prevState.cardIndex, { isNavigatingBack: true });
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

            // Mastery column
            const masteryHtml = Object.keys(SKILLS).map(skillId => {
                const skill = SKILLS[skillId];
                const initial = skill.label.match(/\b(\w)/g).join('');
                const score = getRetentionScore(item.stats.skills[skillId]);
                return `<span title="${skill.label}: ${score}">${initial}:${score}</span>`;
            }).join(' ');
            tbodyHtml += `<td>${masteryHtml}</td>`;

            // Overall View Count & Last Seen
            let totalViews = 0;
            let lastSeen = 0;
            Object.values(item.stats.skills).forEach(s => {
                totalViews += s.viewCount;
                if (s.lastViewed > lastSeen) {
                    lastSeen = s.lastViewed;
                }
            });
            tbodyHtml += `<td>${totalViews}</td>`;
            tbodyHtml += `<td>${formatTimeAgo(lastSeen)}</td>`;

            // Time to Next Due
            const dueTimesMs = Object.values(item.stats.skills).map(s => getTimeToDue(s, now).ms);
            const validDueTimes = dueTimesMs.filter(ms => ms !== -1); // Filter out N/A

            let nextDueFormatted;
            if (validDueTimes.length === 0) {
                nextDueFormatted = 'N/A';
            } else if (validDueTimes.some(ms => ms <= 0)) {
                nextDueFormatted = 'Now';
            } else {
                const nextDueTime = Math.min(...validDueTimes);
                nextDueFormatted = nextDueTime === Infinity ? 'Learned' : formatTimeDifference(nextDueTime);
            }
            tbodyHtml += `<td>${nextDueFormatted}</td>`;

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
        tableHTML += `<th class="sortable" data-column-index="${headers.length}">Mastery</th>`;
        tableHTML += `<th class="sortable" data-column-index="${headers.length + 1}">View Count</th>`;
        tableHTML += `<th class="sortable" data-column-index="${headers.length + 2}">Last Seen</th>`;
        tableHTML += `<th class="sortable" data-column-index="${headers.length + 3}">Next Due</th>`;
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

        const combinedData = cardData.map((card, index) => ({
            card: card,
            stats: allCardStats[index]
        }));

        combinedData.sort((a, b) => {
            let valA, valB;

            if (columnIndex < headers.length) {
                valA = a.card[columnIndex];
                valB = b.card[columnIndex];
            } else {
                const statsKeyIndex = columnIndex - headers.length;
                const skillsA = Object.values(a.stats.skills);
                const skillsB = Object.values(b.stats.skills);

                if (statsKeyIndex === 0) { // Mastery (sort by average score)
                    const avgA = skillsA.reduce((sum, s) => sum + getRetentionScore(s), 0) / skillsA.length;
                    const avgB = skillsB.reduce((sum, s) => sum + getRetentionScore(s), 0) / skillsB.length;
                    valA = avgA;
                    valB = avgB;
                } else if (statsKeyIndex === 1) { // View Count (sort by total)
                    valA = skillsA.reduce((sum, s) => sum + s.viewCount, 0);
                    valB = skillsB.reduce((sum, s) => sum + s.viewCount, 0);
                } else if (statsKeyIndex === 2) { // Last Seen (sort by most recent)
                    valA = Math.max(...skillsA.map(s => s.lastViewed || 0));
                    valB = Math.max(...skillsB.map(s => s.lastViewed || 0));
                } else { // Time to Due (sort by soonest)
                    const getSortableDueTime = (skills) => {
                        const dueTimesMs = skills.map(s => getTimeToDue(s, now).ms);
                        const validDueTimes = dueTimesMs.filter(ms => ms !== -1);
                        if (validDueTimes.length === 0) return Infinity; // N/A sorts last
                        if (validDueTimes.some(ms => ms <= 0)) return -1; // "Now" sorts first
                        return Math.min(...validDueTimes);
                    };
                    valA = getSortableDueTime(skillsA);
                    valB = getSortableDueTime(skillsB);
                }
            }

            if (valA === null || valA === undefined) valA = historySortDirection === 'asc' ? Infinity : -Infinity;
            if (valB === null || valB === undefined) valB = historySortDirection === 'asc' ? Infinity : -Infinity;

            if (typeof valA === 'number' && typeof valB === 'number') {
                // Numeric comparison
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }

            if (valA < valB) return historySortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return historySortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const newTbodyHtml = buildHistoryTbodyHtml(combinedData);
        const table = historyTableContainer.querySelector('table');
        if (table) {
            const oldTbody = table.querySelector('tbody');
            if (oldTbody) {
                table.removeChild(oldTbody);
                table.insertAdjacentHTML('beforeend', newTbodyHtml);
            } else {
                table.insertAdjacentHTML('beforeend', newTbodyHtml);
            }
        }

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
        const cardStats = await getSanitizedStats(cardKey);
        const skillStats = cardStats.skills[currentSkill];

        if (cardShownTimestamp) {
            const delay = Date.now() - cardShownTimestamp;
            skillStats.responseDelays = skillStats.responseDelays || [];
            skillStats.responseDelays.push(delay);
        }

        if (known) {
            const currentScore = getRetentionScore(skillStats);
            skillStats.successTimestamps.push(Date.now());

            if (currentScore < 0) {
                const successes = skillStats.successTimestamps.length;
                const failures = skillStats.failureTimestamps.length;
                const failuresToRemove = failures - successes;
                if (failuresToRemove > 0) {
                    // Remove the oldest failures to bring the score to 0
                    skillStats.failureTimestamps.splice(0, failuresToRemove);
                }
            }

            // Only advance the interval if the card was due for review.
            if (isCurrentCardDue && skillStats.intervalIndex < repetitionIntervals.length - 1) {
                skillStats.intervalIndex++;
            }
        } else {
            skillStats.failureTimestamps.push(Date.now());
            skillStats.intervalIndex = 0; // Reset interval on failure
        }
        await saveCardStats(cardKey, cardStats);
    }

    /**
     * Saves the current UI settings (URL, columns, font, etc.) as a named configuration
     * to IndexedDB.
     */
    function getSelectedSkills() {
        if (!skillSelectorCheckboxes) return [SKILLS.READING.id]; // Default to reading
        const selected = Array.from(skillSelectorCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
        // If no skills are selected in the UI, default to reading to avoid a broken state.
        return selected.length > 0 ? selected : [SKILLS.READING.id];
    }

    function getActiveSkills() {
        const currentConfigName = configSelector.value;
        if (currentConfigName && configs[currentConfigName] && configs[currentConfigName].skills) {
            return configs[currentConfigName].skills;
        }
        return [SKILLS.READING.id]; // Default
    }

    function getSkillColumnSettings() {
        const skillColumns = {};
        for (const skillId in SKILLS) {
            const frontContainer = document.getElementById(`front-column-checkboxes-${skillId}`);
            const backContainer = document.getElementById(`back-column-checkboxes-${skillId}`);
            const validationSelector = document.getElementById(`validation-column-selector-${skillId}`);
            const ttsFrontSelector = document.getElementById(`tts-front-column-selector-${skillId}`);

            if (frontContainer && backContainer && validationSelector && ttsFrontSelector) {
                skillColumns[skillId] = {
                    front: getSelectedColumnIndices(frontContainer),
                    back: getSelectedColumnIndices(backContainer),
                    validationColumn: validationSelector.value,
                    ttsFrontColumn: ttsFrontSelector.value
                };
            }
        }
        return skillColumns;
    }

    async function saveConfig() {
        if (!configNameInput) return;
        const configName = configNameInput.value.trim();
        if (!configName) {
            alert('Please enter a configuration name.');
            return;
        }

        const currentConfig = configs[configName] || {};

        const columnRoles = {};
        document.querySelectorAll('[id^="column-role-"]').forEach(select => {
            columnRoles[select.dataset.columnIndex] = select.value;
        });

        const ttsSourceSelector = document.getElementById('tts-source-column-selector');

        configs[configName] = {
            ...currentConfig, // Preserve subsetData if it exists
            dataUrl: currentConfig.subsetData ? null : dataUrlInput.value,
            keyColumn: keyColumnSelector.value,
            repetitionIntervals: repetitionIntervalsTextarea.value,
            skillColumns: getSkillColumnSettings(), // New per-skill column settings
            skills: getSelectedSkills(),
            columnRoles: columnRoles,
            ttsSourceColumn: ttsSourceSelector ? ttsSourceSelector.value : 0,
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

        // Remove deprecated properties
        delete configs[configName].frontColumns;
        delete configs[configName].backColumns;

        await set('flashcard-configs', configs);
        await set('flashcard-last-config', configName);
        populateConfigSelector();
        configSelector.value = configName;
        if (configTitle) configTitle.textContent = configName;
        if (deckTitle) deckTitle.textContent = configName;
        alert(`Configuration '${configName}' saved!`);
        isConfigDirty = false;
        if (saveConfigButton) saveConfigButton.disabled = true;
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
        if (configTitle) configTitle.textContent = configName;
        if (deckTitle) deckTitle.textContent = configName;
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

        // --- Load Column Selections ---
        if (config.skillColumns) {
            // New format
            for (const skillId in config.skillColumns) {
                const frontContainer = document.getElementById(`front-column-checkboxes-${skillId}`);
                const backContainer = document.getElementById(`back-column-checkboxes-${skillId}`);
                const { front, back } = config.skillColumns[skillId];

                if (frontContainer) {
                    frontContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
                    front.forEach(colIndex => {
                        const cb = frontContainer.querySelector(`input[value="${colIndex}"]`);
                        if (cb) cb.checked = true;
                    });
                }
                if (backContainer) {
                    backContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
                    back.forEach(colIndex => {
                        const cb = backContainer.querySelector(`input[value="${colIndex}"]`);
                        if (cb) cb.checked = true;
                    });
                }

                const validationSelector = document.getElementById(`validation-column-selector-${skillId}`);
                if (validationSelector) {
                    validationSelector.value = config.skillColumns[skillId].validationColumn || 'none';
                }

                const ttsFrontSelector = document.getElementById(`tts-front-column-selector-${skillId}`);
                if (ttsFrontSelector) {
                    ttsFrontSelector.value = config.skillColumns[skillId].ttsFrontColumn || 0;
                }
            }
        } else if (config.frontColumns) {
            // Migration from old format
            const readingFront = document.getElementById(`front-column-checkboxes-READING`);
            if (readingFront) {
                config.frontColumns.forEach(colIndex => {
                    const cb = readingFront.querySelector(`input[value="${colIndex}"]`);
                    if (cb) cb.checked = true;
                });
            }
            const readingBack = document.getElementById(`back-column-checkboxes-READING`);
            if (readingBack) {
                config.backColumns.forEach(colIndex => {
                    const cb = readingBack.querySelector(`input[value="${colIndex}"]`);
                    if (cb) cb.checked = true;
                });
            }
        }
        // End of Column Selections

        // Load selected skills, default to READING if not set
        const skillsToLoad = config.skills || [SKILLS.READING.id];
        if (skillSelectorCheckboxes) {
            skillSelectorCheckboxes.querySelectorAll('input').forEach(cb => {
                cb.checked = skillsToLoad.includes(cb.value);
            });
        }

        // Load Column Roles and TTS Source
        if (config.columnRoles) {
            for (const colIndex in config.columnRoles) {
                const select = document.getElementById(`column-role-${colIndex}`);
                if (select) {
                    select.value = config.columnRoles[colIndex];
                }
            }
        }
        if (config.ttsSourceColumn) {
            const ttsSelect = document.getElementById('tts-source-column-selector');
            if (ttsSelect) {
                ttsSelect.value = config.ttsSourceColumn;
            }
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
            if (configIntervalsString && configIntervalsString.trim() !== '') {
                repetitionIntervals = configIntervalsString.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            }
            if (repetitionIntervals.length === 0) {
                repetitionIntervals = [...defaultIntervals];
            }
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
        isConfigDirty = false;
        if (saveConfigButton) saveConfigButton.disabled = true;
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
    async function loadInitialConfigs() {
        try {
            const savedConfigs = await get('flashcard-configs');
            if (savedConfigs) {
                configs = savedConfigs;
                populateConfigSelector();
            }

            const lastConfig = await get('flashcard-last-config');
            if (lastConfig && configs[lastConfig]) {
                configSelector.value = lastConfig;
                await loadSelectedConfig(lastConfig);
            } else {
                // This is the path for a new user
                if (settingsModal) {
                    settingsModal.classList.remove('hidden');
                }
            }
        } catch (error) {
            // If anything goes wrong with IndexedDB, show the settings modal as a fallback.
            console.error("Error loading initial configs from IndexedDB:", error);
            document.body.style.backgroundColor = 'red'; // Visual indicator of an error
            if (settingsModal) {
                 settingsModal.classList.remove('hidden');
            }
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
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            if (e.code === 'Enter' && writingPracticeContainer.classList.contains('hidden')) {
                 // Allow enter to submit forms in settings, etc.
                 return;
            }
            if (e.code !== 'Enter') {
                return; // Only allow Enter key in inputs
            }
        }


        switch(e.type) {
            case 'keydown':
                switch(e.code) {
                    case 'Enter':
                        if (!nextCardButton.classList.contains('hidden')) {
                            showNextCard();
                        }
                        break;
                    case 'Space':
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
                    case 'KeyK': {
                        const currentConfigName = configSelector.value;
                        const currentConfig = configs[currentConfigName] || {};
                        const skillConfig = (currentConfig.skillColumns || {})[currentSkill] || {};
                        if (!skillConfig.validationColumn || skillConfig.validationColumn === 'none') {
                            markCardAsKnown(true);
                            showNextCard();
                        }
                        break;
                    }
                    case 'KeyJ': {
                        const currentConfigName = configSelector.value;
                        const currentConfig = configs[currentConfigName] || {};
                        const skillConfig = (currentConfig.skillColumns || {})[currentSkill] || {};
                        if (!skillConfig.validationColumn || skillConfig.validationColumn === 'none') {
                            markCardAsKnown(false);
                            showNextCard({forceNew: true});
                        }
                        break;
                    }
                    case 'KeyF': {
                        let text, voiceName;
                        if (card.classList.contains('flipped')) {
                            text = cardBack.textContent;
                            voiceName = ttsBackLangSelect.value;
                        } else {
                            // For the front, always get text from the configured TTS source column
                            const currentConfigName = configSelector.value;
                            const currentConfig = configs[currentConfigName] || {};
                            const ttsSourceColumn = currentConfig.ttsSourceColumn || 0; // Default to 0
                            text = getTextForColumns([ttsSourceColumn]);
                            voiceName = ttsFrontLangSelect.value;
                        }
                        replayRate = Math.max(0.1, replayRate - 0.2);
                        speak(text, voiceName, replayRate);
                        break;
                    }
                }
                break;
            case 'keyup':
                switch(e.code) {
                    case 'Space':
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
        startY = e.pageY || e.touches[0].pageY;
        currentX = startX;
        currentY = startY;
        card.style.transition = 'none'; // Disable transition for smooth dragging
    }

    function dragMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.pageX || e.touches[0].pageX;
        currentY = e.pageY || e.touches[0].pageY;
        const diffX = currentX - startX;
        const diffY = currentY - startY;
        // Allow both horizontal and vertical movement for a more natural feel
        card.style.transform = `translate(${diffX}px, ${diffY}px) rotate(${diffX / 20}deg)`;
    }

    function dragEnd(e) {
        if (!isDragging) return;
        isDragging = false;

        const diffX = currentX - startX;
        const diffY = currentY - startY;

        // Reset drag state
        startX = 0;
        startY = 0;
        currentX = 0;
        currentY = 0;

        card.style.transition = 'transform 0.3s ease';

        // Prioritize dominant axis
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal swipe is dominant
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
                card.style.transform = ''; // Not enough horizontal, snap back
            }
        } else {
            // Vertical swipe is dominant
            if (Math.abs(diffY) > verticalDragThreshold) {
                flipCard();
            }
            card.style.transform = ''; // Always snap back after vertical attempt
        }
    }


    function populateSkillSelector() {
        if (!skillSelectorCheckboxes) return;
        skillSelectorCheckboxes.innerHTML = '';
        for (const skillId in SKILLS) {
            const skill = SKILLS[skillId];
            const id = `skill-checkbox-${skill.id}`;
            const checkboxHtml = `
                <div>
                    <input type="checkbox" id="${id}" value="${skill.id}" checked>
                    <label for="${id}" title="${skill.description}">${skill.label}</label>
                </div>`;
            skillSelectorCheckboxes.insertAdjacentHTML('beforeend', checkboxHtml);
        }
    }

    // Initial load
    populateVoices();
    populateSkillSelector();
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
