/* global Sortable */

import { get, set, del, keys } from './lib/idb-keyval-wrapper.js';
import { getLenientString, transformSlashText, stripParentheses } from './lib/string-utils.js';
import { Skill, createSkillId, createSkill, VERIFICATION_METHODS } from './lib/skill-utils.js';
import { getDeckWords, getHighlightHTML } from './lib/filter-utils.js';
import { detectColumnLanguages } from './lib/detect-column-languages.js';

/**
 * @file Main application logic for the Flashcards web app.
 * Handles DOM interactions, data loading, card display, state management,
 * and all user-facing features like TTS, spaced repetition, and settings.
 */
document.addEventListener('DOMContentLoaded', () => {
    const updateLayout = () => {
        // Use a media query to check for desktop-like screen widths (a common breakpoint).
        if (window.matchMedia('(min-width: 769px)').matches) {
            document.body.classList.add('desktop');
        } else {
            document.body.classList.remove('desktop');
        }
    };

    // Set the layout on initial load
    updateLayout();

    // And update it whenever the window is resized
    window.addEventListener('resize', updateLayout);

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
    const fontSelector = document.getElementById('font-selector');
    const ttsRateSlider = document.getElementById('tts-rate');
    const ttsRateBaseSlider = document.getElementById('tts-rate-base');
    const disableAnimationCheckbox = document.getElementById('disable-animation');
    const audioOnlyFrontCheckbox = document.getElementById('audio-only-front');
    const multipleChoiceCount = document.getElementById('multiple-choice-count');
    const configNameInput = document.getElementById('config-name');
    const skillSelectorCheckboxes = document.getElementById('skill-selector-checkboxes');
    const mobileSkillSelectorCheckboxes = document.getElementById('mobile-skill-selector-checkboxes');
    const repetitionIntervalsTextarea = document.getElementById('repetition-intervals');
    const configSelector = document.getElementById('config-selector');
    const cardContainer = document.getElementById('card-container');
    const skillMasteryDashboard = document.getElementById('skill-mastery-dashboard');
    const cardSpecificStats = document.getElementById('card-specific-stats');
    const cardFront = document.querySelector('.card-front');
    const cardFrontContent = document.getElementById('card-front-content');
    const cardBackContent = document.getElementById('card-back-content');
    const flipCardButton = document.getElementById('flip-card');
    const card = document.getElementById('card');
    const nextCardButton = document.getElementById('next-card');
    const prevCardButton = document.getElementById('prev-card');
    const iKnowButton = document.getElementById('i-know');
    const iDontKnowButton = document.getElementById('i-dont-know');
    const explanationMessage = document.getElementById('explanation-message');
    const cacheStatus = document.getElementById('cache-status');
    const applyFilterButton = document.getElementById('apply-filter-button');
    const clearFilterButton = document.getElementById('clear-filter-button');
    const filterTextarea = document.getElementById('filter-text');
    const filterAllowOverflowCheckbox = document.getElementById('filter-allow-overflow');
    const filterToggleButton = document.getElementById('filter-toggle-button');
    const mobileFilterToggleButton = document.getElementById('mobile-filter-toggle-button');
    const enableFilterSettingsCheckbox = document.getElementById('enable-filter-settings-checkbox');
    const filterIntersectionInfo = document.getElementById('filter-intersection-info');
    const filterHighlightLayer = document.getElementById('filter-highlight-layer');
    const filterStatusIndicator = document.getElementById('filter-status-indicator');
    const mobileFilterStatusIndicator = document.getElementById('mobile-filter-status-indicator');
    const writingPracticeContainer = document.getElementById('writing-practice-container');
    const writingInput = document.getElementById('writing-input');
    const writingSubmit = document.getElementById('writing-submit');
    const multipleChoiceContainer = document.getElementById('multiple-choice-container');
    const voiceInputContainer = document.getElementById('voice-input-container');
    const voiceInputButton = document.getElementById('voice-input-button');
    const voiceInputFeedback = document.getElementById('voice-input-feedback');
    const comparisonContainer = document.getElementById('comparison-container');
    const slowReplayButton = document.getElementById('slow-replay-button');
    const slowReplayHotkey = document.getElementById('slow-replay-hotkey');
    const deckTitle = document.getElementById('deck-title');
    const lastSeen = document.getElementById('last-seen');
    const topNotification = document.getElementById('top-notification');
    const ttsLangDisplayFront = document.getElementById('tts-lang-display-front');
    const ttsLangDisplayBack = document.getElementById('tts-lang-display-back');
    const dashboardButton = document.getElementById('dashboard-button');
    const mobileDashboardButton = document.getElementById('mobile-dashboard-button');
    const dashboardModal = document.getElementById('dashboard-modal');
    const closeDashboardButton = document.getElementById('close-dashboard-button');
    const masteredWordsList = document.getElementById('mastered-words-list');
    const difficultWordsList = document.getElementById('difficult-words-list');


    // --- Top Notification Function ---
    let notificationTimeout;
    function showTopNotification(message, type = 'error', duration = 3000) {
        if (!topNotification) return;

        // Clear any existing timeout to prevent the notification from disappearing early
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
        }

        topNotification.textContent = message;
        // The 'hidden' class is removed and 'visible' is added to trigger the transition
        topNotification.className = `visible ${type}`;

        // Set a timeout to hide the notification after the specified duration
        notificationTimeout = setTimeout(() => {
            topNotification.className = `hidden ${type}`;
        }, duration);
    }


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
    let cardData = []; // Holds the parsed card data from the TSV/CSV file.
    let headers = []; // Holds the column headers from the data file.
    let currentCardIndex = 0; // The index of the currently displayed card in cardData.
    let currentSkillId = null; // The ID of the skill being practiced.
    let configs = {}; // Stores all saved deck configurations.
    let voices = []; // Holds the list of available TTS voices from the browser.
    let viewHistory = []; // A stack to keep track of the sequence of viewed cards for the "previous" button.
    let currentRandomBaseIndex = -1; // The randomly selected index for the base language for the current card view.
    let baseLanguageRotationIndex = 0; // For sequential rotation of base languages.
    // These will now hold the structured data [{text, role}, ...]
    let frontParts = [];
    let backParts = [];
    let ttsFrontParts = [];
    let ttsBackParts = [];
    let useUppercase = false; // A flag for the "Alternate Uppercase" feature.
    let replayRate = 1.0; // Tracks the current playback rate for the 'f' key replay feature.
    let cardShownTimestamp = null; // Tracks when the card was shown to calculate response delay.
    let isCurrentCardDue = false; // Tracks if the current card was shown because it was due for review.
    let columnLanguages = []; // Holds the detected language for each column.
    let activeFilterWords = new Set(); // Holds the words for the current filter.
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognitionInstance = null;
    let recognitionActive = false; // Use a flag to control the recognition loop

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

    if (dashboardButton) dashboardButton.addEventListener('click', renderDashboard);
    if (mobileDashboardButton) mobileDashboardButton.addEventListener('click', () => {
        mobileMenuOverlay.classList.add('hidden');
        renderDashboard();
    });
    if (closeDashboardButton) closeDashboardButton.addEventListener('click', () => dashboardModal.classList.add('hidden'));

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
    if (iDontKnowButton) iDontKnowButton.addEventListener('click', handleIDontKnow);
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

    if (skillMasteryDashboard) {
        skillMasteryDashboard.addEventListener('click', () => {
            // Open the settings modal and navigate to the skills tab
            settingsModal.classList.remove('hidden');
            const skillsTabButton = document.getElementById('skills-tab');
            if (skillsTabButton) {
                skillsTabButton.click();
            }
        });
    }

    function syncCheckboxes(source, destination) {
        const sourceCheckboxes = source.querySelectorAll('input[type="checkbox"]');
        const destCheckboxes = destination.querySelectorAll('input[type="checkbox"]');

        // Create a map of destination checkboxes by their value for O(1) lookup.
        const destMap = new Map();
        destCheckboxes.forEach(cb => destMap.set(cb.value, cb));

        sourceCheckboxes.forEach(sourceCb => {
            const destCb = destMap.get(sourceCb.value);
            if (destCb && destCb.checked !== sourceCb.checked) {
                destCb.checked = sourceCb.checked;
            }
        });
    }

    async function handleSkillSelectionChange(e) {
        if (e.target.matches('input[type="checkbox"]')) {
            // Sync the other set of checkboxes
            if (e.currentTarget === mobileSkillSelectorCheckboxes) {
                syncCheckboxes(mobileSkillSelectorCheckboxes, skillSelectorCheckboxes);
            } else {
                syncCheckboxes(skillSelectorCheckboxes, mobileSkillSelectorCheckboxes);
            }

            // Save the new skill selection immediately
            await saveCurrentConfig();

            // Render the mastery dashboard for the current card with the new settings
            if (cardData.length > 0 && currentCardIndex < cardData.length) {
                const cardKey = getCardKey(cardData[currentCardIndex]);
                const stats = await getSanitizedStats(cardKey);
                renderSkillMastery(stats);
            }

            // Immediately find and display the next appropriate card
            showNextCard();
        }
    }

    if (skillSelectorCheckboxes) {
        skillSelectorCheckboxes.addEventListener('change', handleSkillSelectionChange);
    }
    if (mobileSkillSelectorCheckboxes) {
        mobileSkillSelectorCheckboxes.addEventListener('change', handleSkillSelectionChange);
    }

    if (writingSubmit) writingSubmit.addEventListener('click', checkWritingAnswer);
    if (writingInput) writingInput.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') {
            checkWritingAnswer();
        }
    });

    if (voiceInputButton) voiceInputButton.addEventListener('click', toggleVoiceRecognition);
    if (applyFilterButton) applyFilterButton.addEventListener('click', applyFilter);
    if (clearFilterButton) clearFilterButton.addEventListener('click', clearFilter);
    if (filterTextarea) {
        filterTextarea.addEventListener('input', updateFilterHighlights);
        filterTextarea.addEventListener('scroll', () => {
            if (filterHighlightLayer) {
                filterHighlightLayer.scrollTop = filterTextarea.scrollTop;
                filterHighlightLayer.scrollLeft = filterTextarea.scrollLeft;
            }
        });
    }
    function toggleFilter() {
        const currentConfig = configs[configSelector.value];
        if (!currentConfig) return;

        const isEnabled = !currentConfig.filterIsEnabled; // Toggle the state
        setFilterEnabled(isEnabled);
        saveCurrentConfig();
        showNextCard();
    }

    if (filterToggleButton) filterToggleButton.addEventListener('click', toggleFilter);
    if (mobileFilterToggleButton) mobileFilterToggleButton.addEventListener('click', toggleFilter);

    async function handleSettingsFilterToggle(event) {
        const isChecked = event.target.checked;
        setFilterEnabled(isChecked);
        await saveCurrentConfig(); // Persist the change
        showNextCard();
    }
    if (enableFilterSettingsCheckbox) enableFilterSettingsCheckbox.addEventListener('change', handleSettingsFilterToggle);

    const handleSlowReplay = () => {
        const skillConfig = getCurrentSkillConfig();
        const ttsFrontRole = skillConfig.ttsFrontColumn;
        if (ttsFrontRole) {
            const ttsText = getTextForRoles([ttsFrontRole]);
            const lang = getLanguageForTts(ttsFrontRole);
            // Speak at a fixed slow rate, but still pass the role and language
            speak(ttsText, { rate: 0.7, ttsRole: ttsFrontRole, lang: lang });
        }
    };

    if (slowReplayButton) slowReplayButton.addEventListener('click', handleSlowReplay);
    if (slowReplayHotkey) slowReplayHotkey.addEventListener('click', handleSlowReplay);

    if (settingsModal) {
        settingsModal.addEventListener('input', handleSettingsChange);
        settingsModal.addEventListener('change', handleSettingsChange);
    }

    // --- Skill Management Event Listeners ---
    const addSkillButton = document.getElementById('add-skill-button');
    if (addSkillButton) addSkillButton.addEventListener('click', () => openSkillDialog());

    const presetSkillsButton = document.getElementById('preset-skills-button');
    if (presetSkillsButton) presetSkillsButton.addEventListener('click', createPresetSkills);

    const exportSkillsButton = document.getElementById('export-skills-button');
    if (exportSkillsButton) exportSkillsButton.addEventListener('click', exportSkills);

    const exportAllDataButton = document.getElementById('export-all-data-button');
    if (exportAllDataButton) exportAllDataButton.addEventListener('click', exportAllData);

    const importAllDataButton = document.getElementById('import-all-data-button');
    const importFileInput = document.getElementById('import-file-input');

    if (importAllDataButton) {
        importAllDataButton.addEventListener('click', () => {
            importFileInput.click();
        });
    }
    if (importFileInput) {
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                importAllData(file);
            }
        });
    }

    const deleteAllSkillsButton = document.getElementById('delete-all-skills-button');
    if (deleteAllSkillsButton) deleteAllSkillsButton.addEventListener('click', deleteAllSkills);

    const skillsList = document.getElementById('skills-list');
    if (skillsList) {
        skillsList.addEventListener('click', (e) => {
            const skillId = e.target.closest('.skill-item')?.dataset.skillId;
            if (!skillId) return;

            if (e.target.matches('.edit-skill-button')) {
                openSkillDialog(skillId);
            }
            if (e.target.matches('.delete-skill-button')) {
                deleteSkill(skillId);
            }
        });

        Sortable.create(skillsList, {
            animation: 150,
            onEnd: function (evt) {
                const currentConfigName = configSelector.value;
                const currentConfig = configs[currentConfigName];
                if (!currentConfig || !currentConfig.skills) return;

                // The evt.oldIndex and evt.newIndex are what we need.
                // Get the skill that was moved
                const movedSkill = currentConfig.skills.splice(evt.oldIndex, 1)[0];
                if (!movedSkill) return; // Guard against undefined skill
                // Re-insert it at the new index
                currentConfig.skills.splice(evt.newIndex, 0, movedSkill);


                // Mark the configuration as changed and refresh UI that depends on skill order
                handleSettingsChange();
                populateAllSkillSelectors();
            }
        });
    }

    const closeSkillConfigButton = document.getElementById('close-skill-config-button');
    if (closeSkillConfigButton) {
        closeSkillConfigButton.addEventListener('click', () => {
            document.getElementById('skill-config-modal').classList.add('hidden');
        });
    }

    const skillVerificationMethod = document.getElementById('skill-verification-method');
    if (skillVerificationMethod) {
        skillVerificationMethod.addEventListener('change', (e) => {
            const validationSelect = document.getElementById('skill-validation-column');
            validationSelect.disabled = e.target.value === VERIFICATION_METHODS.NONE;
        });
    }

    const saveSkillButton = document.getElementById('save-skill-button');
    if (saveSkillButton) saveSkillButton.addEventListener('click', saveSkill);

    function handleSettingsChange() {
        // This function can be called with or without an event object.
        // If called without an event, it's a programmatic way to mark the config as dirty.
        if (saveConfigButton) saveConfigButton.disabled = false;
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
        if (userAnswer === '') {
            await markCardAsKnown(false);
            // The user wants to see the answer on an empty submission.
            // Unlike the "I don't know" button, we flip the card and wait for manual progression.
            flipCard();
            return;
        }

        const skillConfig = getCurrentSkillConfig();
        if (!skillConfig || skillConfig.verificationMethod !== VERIFICATION_METHODS.TEXT) {
            console.error('checkWritingAnswer called for a non-text verification skill.');
            return;
        }

        const validationRole = skillConfig.validationColumn;
        if (!validationRole || validationRole === 'none') {
            console.error('checkWritingAnswer called but no validation column is configured.');
            return;
        }

        const roleToColumnMap = (configs[configSelector.value] || {}).roleToColumnMap || {};
        const validationColumnIndices = roleToColumnMap[validationRole] || [];

        if (validationColumnIndices.length === 0) {
            const message = `Cannot validate: No column is assigned the "${COLUMN_ROLES[validationRole]}" role.`;
            showTopNotification(message);
            return;
        }

        const correctAnswers = validationColumnIndices.map(index => cardData[currentCardIndex][index]);
        const isCorrect = correctAnswers.some(correctAnswer => getLenientString(userAnswer) === getLenientString(correctAnswer));
        const firstCorrectAnswer = correctAnswers[0];

        await markCardAsKnown(isCorrect);

        comparisonContainer.innerHTML = '';
        comparisonContainer.appendChild(renderDiff(userAnswer, firstCorrectAnswer, isCorrect));
        comparisonContainer.classList.remove('hidden');
        writingInput.disabled = true;

        if (!card.classList.contains('flipped')) {
            flipCard();
        }

        nextCardButton.classList.remove('hidden');
    }

    function generateMultipleChoiceOptions() {
        const skillConfig = getCurrentSkillConfig();
        const validationRole = skillConfig.validationColumn;
        if (!validationRole || validationRole === 'none') {
            console.error('generateMultipleChoiceOptions called but no validation column is configured.');
            return;
        }

        const roleToColumnMap = (configs[configSelector.value] || {}).roleToColumnMap || {};
        const validationColumnIndices = roleToColumnMap[validationRole] || [];

        if (validationColumnIndices.length === 0) {
            const message = `Cannot validate: No column is assigned the "${COLUMN_ROLES[validationRole]}" role.`;
            showTopNotification(message);
            return;
        }

        const correctAnswer = cardData[currentCardIndex][validationColumnIndices[0]];

        const numChoices = parseInt((configs[configSelector.value] || {}).multipleChoiceCount || 4, 10);

        // Create a pool of unique distractors from all other cards.
        const distractorPool = [...new Set(
            cardData
                .filter((_, index) => index !== currentCardIndex)
                .map(card => card[validationColumnIndices[0]])
                .filter(Boolean) // Filter out empty/null/undefined values
        )];

        shuffleArray(distractorPool);

        // Combine the correct answer with a slice of the shuffled distractors.
        const options = [
            correctAnswer,
            ...distractorPool.slice(0, numChoices - 1)
        ];

        shuffleArray(options);

        multipleChoiceContainer.innerHTML = '';
        multipleChoiceContainer.classList.remove('answered'); // Reset answered state
        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.dataset.option = option; // Store the raw option text for reliable checking

            const numberSpan = document.createElement('span');
            numberSpan.className = 'mc-option-number';
            numberSpan.textContent = index + 1;

            button.appendChild(numberSpan);
            button.appendChild(document.createTextNode(` ${stripParentheses(option)}`)); // Use the new function here

            button.addEventListener('click', () => checkMultipleChoiceAnswer(option, correctAnswer));
            multipleChoiceContainer.appendChild(button);
        });
    }

    async function checkMultipleChoiceAnswer(selectedAnswer, correctAnswer) {
        // If an answer has already been submitted, do nothing.
        if (multipleChoiceContainer.classList.contains('answered')) return;

        const isCorrect = selectedAnswer === correctAnswer;
        await markCardAsKnown(isCorrect);

        // Mark the container as answered to prevent further clicks and to change styling.
        multipleChoiceContainer.classList.add('answered');

        Array.from(multipleChoiceContainer.children).forEach(button => {
            // Use the data attribute for a reliable check
            if (button.dataset.option === correctAnswer) {
                button.classList.add('correct');
            } else if (button.dataset.option === selectedAnswer) {
                button.classList.add('incorrect');
            }
        });

        if (!card.classList.contains('flipped')) {
            flipCard();
        }
        // The main control buttons are now always visible during MC, so no need to show/hide them.
    }

    function toggleVoiceRecognition() {
        if (recognitionActive) {
            stopVoiceRecognition();
        } else {
            startVoiceRecognition();
        }
    }

    function startVoiceRecognition() {
        if (!SpeechRecognition) {
            showTopNotification('Speech recognition is not supported in this browser.', 'error');
            return;
        }

        const skillConfig = getCurrentSkillConfig();
        const validationRole = skillConfig.validationColumn;
        const lang = getLanguageForRole(validationRole);

        if (!validationRole || validationRole === 'none' || !lang) {
            showTopNotification('Voice input requires a Validation Column with a detectable language.', 'error');
            return;
        }

        recognitionActive = true;
        voiceInputButton.classList.add('listening');
        voiceInputFeedback.textContent = 'Listening...';
        voiceInputFeedback.classList.remove('correct', 'incorrect');

        recognitionInstance = new SpeechRecognition();
        recognitionInstance.lang = lang;
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true; // Enable interim results for live feedback

        recognitionInstance.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            // Iterate through all results from the current recognition event
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Update the UI with the interim transcript for immediate feedback
            if (interimTranscript) {
                voiceInputFeedback.textContent = `"${interimTranscript}"`;
                voiceInputFeedback.classList.remove('correct', 'incorrect');
            }

            // If we have a final transcript, process the answer
            if (finalTranscript) {
                checkVoiceAnswer(finalTranscript.trim());
            }
        };

        recognitionInstance.onerror = (event) => {
            // Ignore the 'aborted' error, which is expected when we programmatically stop recognition.
            if (event.error === 'aborted') {
                return;
            }
            console.error('Speech recognition error:', event.error);
            let errorMessage = 'An error occurred.';
            if (event.error === 'no-speech') {
                errorMessage = 'No speech was detected.';
            } else if (event.error === 'not-allowed') {
                errorMessage = 'Microphone access was denied.';
            }
            voiceInputFeedback.textContent = errorMessage;
            voiceInputFeedback.classList.add('incorrect');
            stopVoiceRecognition(); // Stop on actual errors.
        };

        recognitionInstance.onend = () => {
            if (recognitionActive) {
                recognitionInstance.start(); // Keep listening
            }
        };

        recognitionInstance.start();
    }

    function stopVoiceRecognition() {
        recognitionActive = false;
        if (recognitionInstance) {
            recognitionInstance.stop();
            recognitionInstance = null;
        }
        voiceInputButton.classList.remove('listening');
    }

    async function checkVoiceAnswer(transcript) {
        const skillConfig = getCurrentSkillConfig();
        const validationRole = skillConfig.validationColumn;
        const roleToColumnMap = (configs[configSelector.value] || {}).roleToColumnMap || {};
        const validationColumnIndices = roleToColumnMap[validationRole] || [];

        // Validate that a column is assigned to the role
        if (validationColumnIndices.length === 0) {
            const message = `Cannot validate: No column is assigned the "${COLUMN_ROLES[validationRole]}" role.`;
            showTopNotification(message, 'error');
            stopVoiceRecognition(); // Stop listening if the config is bad
            return;
        }

        const correctAnswers = validationColumnIndices.map(index => cardData[currentCardIndex][index]);

        const isCorrect = correctAnswers.some(correctAnswer => getLenientString(transcript) === getLenientString(correctAnswer));

        await markCardAsKnown(isCorrect);

        voiceInputFeedback.textContent = `"${transcript}"`;
        voiceInputFeedback.classList.remove('correct', 'incorrect');

        if (isCorrect) {
            voiceInputFeedback.classList.add('correct');
            stopVoiceRecognition();
            if (!card.classList.contains('flipped')) {
                flipCard();
            }
            setTimeout(() => showNextCard(), 1000); // Move to next card after a short delay
        } else {
            voiceInputFeedback.classList.add('incorrect');
            // The 'onend' event will automatically restart recognition for another try
        }
    }

    async function handleIDontKnow() {
        const skillConfig = getCurrentSkillConfig();

        // For voice input, the user wants to see the answer and practice.
        if (skillConfig && skillConfig.verificationMethod === VERIFICATION_METHODS.VOICE) {
            await markCardAsKnown(false);
            stopVoiceRecognition(); // Stop listening
            if (!card.classList.contains('flipped')) {
                flipCard();
            }
            // Show the main controls again so they can navigate away when ready.
            iKnowButton.classList.remove('hidden');
            iDontKnowButton.classList.remove('hidden');
            nextCardButton.classList.remove('hidden');
        } else {
            // Default behavior for other skills
            await markCardAsKnown(false);
            await showNextCard({ forceNew: true });
        }
    }


    function setFilterEnabled(isEnabled) {
        const currentConfig = configs[configSelector.value];
        if (currentConfig) {
            currentConfig.filterIsEnabled = isEnabled;
        }

        if (filterToggleButton) filterToggleButton.classList.toggle('active', isEnabled);
        if (mobileFilterToggleButton) mobileFilterToggleButton.classList.toggle('active', isEnabled);
        if (enableFilterSettingsCheckbox) enableFilterSettingsCheckbox.checked = isEnabled;
    }

    function updateFilterState(state) { // 'off', 'learning', 'learned'
        const indicators = [filterStatusIndicator, mobileFilterStatusIndicator];
        indicators.forEach(indicator => {
            if (!indicator) return;
            indicator.classList.remove('learning', 'learned');
            if (state === 'learning' || state === 'learned') {
                indicator.classList.add(state);
            }
        });
    }

    function updateFilterHighlights() {
        if (!filterTextarea || !filterHighlightLayer || !filterIntersectionInfo) return;

        const text = filterTextarea.value;
        if (!text.trim()) {
            filterHighlightLayer.innerHTML = '';
            filterIntersectionInfo.textContent = 'Enter text to see matching words.';
            return;
        }

        const currentConfig = configs[configSelector.value] || {};
        const roleToColumnMap = currentConfig.roleToColumnMap;
        const deckWords = getDeckWords(cardData, roleToColumnMap);
        if (deckWords.size === 0) {
            filterHighlightLayer.innerHTML = '';
            filterIntersectionInfo.textContent = 'Load a deck to see matching words.';
            return;
        }

        const filterWords = new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
        const intersection = new Set([...deckWords].filter(word => filterWords.has(word)));

        const highlightedHtml = getHighlightHTML(text, intersection);

        filterHighlightLayer.innerHTML = highlightedHtml;
        filterIntersectionInfo.textContent = `Found ${intersection.size} matching words in the deck. Words: ${[...intersection].join(', ')}`;
    }


    async function applyFilter() {
        const text = filterTextarea.value;
        if (!text) {
            await clearFilter(); // If text is empty, just clear the filter.
            return;
        }
        if (cardData.length === 0) {
            showTopNotification('No deck is loaded. Please load a deck first.', 'error');
            return;
        }

        const wordsArray = text.match(/[\p{L}\p{N}]+/gu) || [];
        const words = new Set(wordsArray.map(w => w.toLowerCase()));
        activeFilterWords = words;
        setFilterEnabled(true); // Applying a filter should enable it.
        updateFilterState('learning');

        await saveCurrentConfig(); // Persist the filter text and state
        showTopNotification(`Filter applied and saved. Found ${words.size} unique words.`, 'success');
        updateFilterHighlights();
        showNextCard();
    }

    async function clearFilter() {
        activeFilterWords.clear();
        setFilterEnabled(false);
        if (filterTextarea) filterTextarea.value = '';
        updateFilterState('off');

        await saveCurrentConfig(); // Persist the cleared filter
        showTopNotification('Filter cleared and saved.', 'success');
        updateFilterHighlights();
        showNextCard();
    }

    // --- Functions ---
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
                    const message = `Failed to load data: ${error.message}. No cached data available.`;
                    console.error(message);
                    showTopNotification(message);
                }
            } catch (cacheError) {
                const message = `Failed to load data from both network and cache: ${cacheError.message}`;
                console.error(message);
                showTopNotification(message);
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

    async function updateColumnLanguages() {
        columnLanguages = await detectColumnLanguages(cardData, headers);
        console.log('Detected column languages:', columnLanguages);
        populateColumnRolesUI();
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
        await updateColumnLanguages(); // Cette fonction met à jour columnLanguages et l'UI
        if (repetitionIntervalsTextarea) repetitionIntervalsTextarea.value = repetitionIntervals.join(', ');
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

            const lang = columnLanguages[index];
            if (lang && lang !== 'N/A') {
                const langSpan = document.createElement('span');
                langSpan.textContent = `(${lang})`;
                langSpan.className = 'lang-hint';
                label.appendChild(langSpan);
            }

            const select = document.createElement('select');
            select.id = `column-role-${index}`;
            select.dataset.columnIndex = index;

            for (const roleKey in COLUMN_ROLES) {
                const option = new Option(COLUMN_ROLES[roleKey], roleKey);
                select.add(option);
            }
            // Auto-detect roles
            const headerLower = header.toLowerCase();
            for (const roleKey in COLUMN_ROLES) {
                if (roleKey === 'NONE') continue;

                // Convert role key to a more matchable string, e.g., "EXAMPLE_SENTENCE" -> "example sentence"
                const roleName = COLUMN_ROLES[roleKey].toLowerCase();
                const roleNameAsKeyword = roleKey.replace(/_/g, ' ').toLowerCase();

                if (headerLower.includes(roleName) || headerLower.includes(roleNameAsKeyword)) {
                    select.value = roleKey;
                    // Break after the first match to avoid assigning a less specific role
                    // (e.g., "Related Word" matching before "Related Word Type")
                    break;
                }
            }

            // Fallback for common alternative names if no role was matched by the generic logic
            if (select.value === 'NONE') {
                if (headerLower.includes('greek')) select.value = 'TARGET_LANGUAGE';
                if (headerLower.includes('english')) select.value = 'BASE_LANGUAGE';
            }

            rolesGrid.appendChild(label);
            rolesGrid.appendChild(select);
        });

        columnRolesContainer.appendChild(rolesGrid);
    }

    /* eslint-disable-next-line no-unused-vars */
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
            READING: { front: ['TARGET_LANGUAGE'], back: ['BASE_LANGUAGE', 'PRONUNCIATION'] },
            LISTENING: { front: ['TARGET_LANGUAGE'], back: ['BASE_LANGUAGE', 'PRONUNCIATION', 'TARGET_LANGUAGE'] },
            WRITING: { front: ['BASE_LANGUAGE'], back: ['TARGET_LANGUAGE'] },
            SPOKEN: { front: ['BASE_LANGUAGE'], back: ['TARGET_LANGUAGE'] },
            PRONUNCIATION: { front: ['TARGET_LANGUAGE', 'PRONUNCIATION'], back: ['BASE_LANGUAGE'] }
        };

        // 4. Apply the rules
        for (const skillId in presets) {
            const preset = presets[skillId];
            const frontContainer = document.getElementById(`front-role-checkboxes-${skillId}`);
            const backContainer = document.getElementById(`back-role-checkboxes-${skillId}`);

            if (frontContainer) {
                frontContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = preset.front.includes(cb.value);
                });
            }
            if (backContainer) {
                backContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = preset.back.includes(cb.value);
                });
            }
        }

        // 5. Auto-set TTS Source and Validation columns per skill
        for (const skillId in presets) {
            const validationSelector = document.getElementById(`validation-column-selector-${skillId}`);
            const ttsFrontSelector = document.getElementById(`tts-front-column-selector-${skillId}`);
            const ttsBackSelector = document.getElementById(`tts-back-column-selector-${skillId}`);
            if (!validationSelector || !ttsFrontSelector || !ttsBackSelector) continue;

            // Default TTS is always the target language
            ttsFrontSelector.value = 'TARGET_LANGUAGE';
            if (roleToIndexMap.BASE_LANGUAGE && roleToIndexMap.BASE_LANGUAGE.length > 0) {
                ttsBackSelector.value = 'BASE_LANGUAGE';
            } else {
                ttsBackSelector.value = 'TARGET_LANGUAGE'; // Fallback if no base language is set
            }

            // Default validation settings
            switch (skillId) {
            case 'LISTENING':
            case 'WRITING':
                validationSelector.value = 'TARGET_LANGUAGE';
                break;
            default:
                validationSelector.value = 'none';
                break;
            }
        }


        showTopNotification('Skill settings have been auto-configured based on column roles.', 'success');
        handleSettingsChange(); // Mark config as dirty
    }


    // --- User-Defined Skill Management ---

    function renderSkillsList() {
        const skillsList = document.getElementById('skills-list');
        if (!skillsList) return;

        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        if (!currentConfig || !currentConfig.skills) {
            skillsList.innerHTML = '<p>No skills configured. Add a new skill or load presets.</p>';
            return;
        }

        if (currentConfig.skills.length === 0) {
            skillsList.innerHTML = '<p>No skills configured. Add a new skill or load presets.</p>';
            return;
        }

        skillsList.innerHTML = '';
        currentConfig.skills.forEach(skill => {
            const skillItem = document.createElement('div');
            skillItem.className = 'skill-item';
            skillItem.dataset.skillId = skill.id;

            // Left side content
            const leftDiv = document.createElement('div');

            const nameDiv = document.createElement('div');
            nameDiv.className = 'skill-item-name';
            // Show the skill name followed by the first 8 chars of the stable id for verification
            const shortId = skill.id ? ` (${skill.id.substring(0, 8)})` : '';
            nameDiv.textContent = `${skill.name}${shortId}`; // SAFE

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'skill-item-details';
            const frontDetails = Array.isArray(skill.front) ? skill.front.join(', ') : 'None';
            const backDetails = Array.isArray(skill.back) ? skill.back.join(', ') : 'None';
            detailsDiv.textContent = `Front: ${frontDetails || 'None'} | Back: ${backDetails || 'None'} | Validation: ${skill.verificationMethod}`; // SAFE

            leftDiv.appendChild(nameDiv);
            leftDiv.appendChild(detailsDiv);

            // Right side actions
            const rightDiv = document.createElement('div');
            rightDiv.className = 'skill-item-actions';

            const editButton = document.createElement('button');
            editButton.className = 'edit-skill-button';
            editButton.textContent = 'Edit'; // SAFE

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-skill-button danger';
            deleteButton.textContent = 'Delete'; // SAFE

            rightDiv.appendChild(editButton);
            rightDiv.appendChild(deleteButton);

            // Append to main item
            skillItem.appendChild(leftDiv);
            skillItem.appendChild(rightDiv);

            skillsList.appendChild(skillItem);
        });
    }

    function openSkillDialog(skillId = null) {
        const modal = document.getElementById('skill-config-modal');
        const title = document.getElementById('skill-config-title');
        const nameInput = document.getElementById('skill-name-input');
        const verificationSelect = document.getElementById('skill-verification-method');
        const validationSelect = document.getElementById('skill-validation-column');
        const ttsFrontSelect = document.getElementById('skill-tts-front-column');
        const ttsBackSelect = document.getElementById('skill-tts-back-column');
        const frontColumnsContainer = document.getElementById('skill-front-columns');
        const backColumnsContainer = document.getElementById('skill-back-columns');
        const editingSkillIdInput = document.getElementById('editing-skill-id');

        if (!modal) return;

        // --- Populate Selectors ---
        const populateVerificationMethodSelector = (select) => {
            select.innerHTML = '';
            // Manually define the display text for each method
            const displayTexts = {
                [VERIFICATION_METHODS.NONE]: 'None (Self-Assessed)',
                [VERIFICATION_METHODS.TEXT]: 'Text Input',
                [VERIFICATION_METHODS.MULTIPLE_CHOICE]: 'Multiple Choice',
                [VERIFICATION_METHODS.VOICE]: 'Voice Input'
            };
            for (const method of Object.values(VERIFICATION_METHODS)) {
                select.add(new Option(displayTexts[method], method));
            }
        };

        const populateRoleSelector = (select, includeNone = true) => {
            select.innerHTML = '';
            if (includeNone) {
                select.add(new Option('None', 'none'));
            }
            for (const roleKey in COLUMN_ROLES) {
                if (roleKey !== 'NONE') {
                    select.add(new Option(COLUMN_ROLES[roleKey], roleKey));
                }
            }
        };

        const populateColumnCheckboxes = (container) => {
            container.innerHTML = '';
            for (const roleKey in COLUMN_ROLES) {
                if (roleKey !== 'NONE') {
                    const roleName = COLUMN_ROLES[roleKey];
                    const id = `skill-config-${container.id}-${roleKey}`;
                    const checkboxHtml = `<div><input type="checkbox" id="${id}" value="${roleKey}"><label for="${id}">${roleName}</label></div>`;
                    container.insertAdjacentHTML('beforeend', checkboxHtml);
                }
            }
        };

        populateVerificationMethodSelector(verificationSelect);
        populateRoleSelector(validationSelect);
        populateRoleSelector(ttsFrontSelect);
        populateRoleSelector(ttsBackSelect);
        populateColumnCheckboxes(frontColumnsContainer);
        populateColumnCheckboxes(backColumnsContainer);


        // --- Configure for Edit or Add ---
        const currentConfig = configs[configSelector.value];
        if (skillId && currentConfig && currentConfig.skills) {
            const skill = currentConfig.skills.find(s => s.id === skillId);
            if (skill) {
                // Editing existing skill
                title.textContent = 'Edit Skill';
                editingSkillIdInput.value = skill.id;
                nameInput.value = skill.name;
                verificationSelect.value = skill.verificationMethod;
                validationSelect.value = skill.validationColumn;
                ttsFrontSelect.value = skill.ttsFrontColumn;
                ttsBackSelect.value = skill.ttsBackColumn;
                document.getElementById('skill-alternate-uppercase').checked = skill.alternateUppercase || false;
                document.getElementById('skill-tts-on-hotkey-only').checked = skill.ttsOnHotkeyOnly || false;

                frontColumnsContainer.querySelectorAll('input').forEach(cb => cb.checked = skill.front.includes(cb.value));
                backColumnsContainer.querySelectorAll('input').forEach(cb => cb.checked = skill.back.includes(cb.value));
            }
        } else {
            // Adding new skill
            title.textContent = 'Add New Skill';
            editingSkillIdInput.value = '';
            nameInput.value = '';
            verificationSelect.value = VERIFICATION_METHODS.NONE;
            validationSelect.value = 'none';
            ttsFrontSelect.value = 'TARGET_LANGUAGE';
            ttsBackSelect.value = 'BASE_LANGUAGE';
            document.getElementById('skill-alternate-uppercase').checked = false;
            document.getElementById('skill-tts-on-hotkey-only').checked = false;
            frontColumnsContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
            backColumnsContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
        }

        // --- Show Modal ---
        validationSelect.disabled = verificationSelect.value === 'none';
        modal.classList.remove('hidden');
    }

    async function saveSkill() {
        const modal = document.getElementById('skill-config-modal');
        const nameInput = document.getElementById('skill-name-input');
        const editingSkillId = document.getElementById('editing-skill-id').value;
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];

        if (!currentConfig) {
            showTopNotification('No configuration selected.');
            return;
        }

        const skillName = nameInput.value.trim();
        if (!skillName) {
            showTopNotification('Skill name cannot be empty.');
            return;
        }

        // Create a temporary object with all the new properties to generate the ID
        const skillData = {
            name: skillName,
            verificationMethod: document.getElementById('skill-verification-method').value,
            validationColumn: document.getElementById('skill-validation-column').value,
            ttsFrontColumn: document.getElementById('skill-tts-front-column').value,
            ttsBackColumn: document.getElementById('skill-tts-back-column').value,
            alternateUppercase: document.getElementById('skill-alternate-uppercase').checked,
            ttsOnHotkeyOnly: document.getElementById('skill-tts-on-hotkey-only').checked,
            front: getSelectedRoles(document.getElementById('skill-front-columns')),
            back: getSelectedRoles(document.getElementById('skill-back-columns'))
        };

        const newSkillId = await createSkillId(skillData);

        // Check for duplicates
        const duplicateSkill = currentConfig.skills.find(s => s.id === newSkillId && s.id !== editingSkillId);
        if (duplicateSkill) {
            showTopNotification(`This skill already exists as '${duplicateSkill.name}'.`, 'error');
            return;
        }

        let skill;
        if (editingSkillId) {
            // Find the existing skill to update
            skill = currentConfig.skills.find(s => s.id === editingSkillId);
            if (!skill) {
                showTopNotification('Error: Skill not found for editing.');
                return;
            }

            // Update all properties from the form data and set the new stable ID
            Object.assign(skill, skillData);
            skill.id = newSkillId;
        } else {
            // Create a new skill instance via factory (computes stable id and returns Skill)
            const created = await createSkill(skillData);
            currentConfig.skills.push(created);
            skill = created;
        }

        // Refresh UI and mark config as dirty
        renderSkillsList();
        populateAllSkillSelectors();
        handleSettingsChange();
        modal.classList.add('hidden');
        showTopNotification(`Skill '${skill.name}' saved.`, 'success');
    }

    function deleteSkill(skillId) {
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        if (!currentConfig || !currentConfig.skills) return;

        const skillToDelete = currentConfig.skills.find(s => s.id === skillId);
        if (!skillToDelete) return;

        if (confirm(`Are you sure you want to delete the skill "${skillToDelete.name}"?`)) {
            currentConfig.skills = currentConfig.skills.filter(s => s.id !== skillId);
            // Also remove it from active skills if it's there
            if (currentConfig.activeSkills) {
                currentConfig.activeSkills = currentConfig.activeSkills.filter(id => id !== skillId);
            }

            renderSkillsList();
            populateAllSkillSelectors();
            handleSettingsChange();
            showTopNotification(`Skill "${skillToDelete.name}" deleted.`, 'success');
        }
    }

    function deleteAllSkills() {
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        if (!currentConfig || !currentConfig.skills) return;

        if (confirm(`Are you sure you want to delete all ${currentConfig.skills.length} skills? This action cannot be undone.`)) {
            currentConfig.skills = [];
            currentConfig.activeSkills = [];

            renderSkillsList();
            populateAllSkillSelectors();
            handleSettingsChange();
            showTopNotification('All skills have been deleted.', 'success');
        }
    }

    async function addDefaultSkill(currentConfig) {
        if (!currentConfig || !currentConfig.skills) {
            return;
        }
        // Build the default skill data and create it via factory to get stable id
        const defaultSkillData = {
            name: 'Reading & Listening',
            front: ['TARGET_LANGUAGE'],
            back: ['BASE_LANGUAGE', 'PRONUNCIATION', 'GRAMMATICAL_TYPE'],
            verificationMethod: 'none',
            ttsFrontColumn: 'TARGET_LANGUAGE',
            ttsBackColumn: 'BASE_LANGUAGE',
            alternateUppercase: true,
            ttsOnHotkeyOnly: true
        };
        // Precompute id so we don't double-hash inside createSkill
        const id = await createSkillId(defaultSkillData);
        defaultSkillData.id = id;
        const created = await createSkill(defaultSkillData);
        currentConfig.skills.push(created);
        if (!currentConfig.activeSkills) currentConfig.activeSkills = [];
        currentConfig.activeSkills.push(created.id);
    }

    async function createPresetSkills() {
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        if (!currentConfig) {
            showTopNotification('Please select or save a configuration first.');
            return;
        }
        if (!confirm('This will add preset skills to your configuration. Any existing skills will be kept. Continue?')) {
            return;
        }

        try {
            const response = await fetch('lib/default-skills.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const presets = await response.json();

            if (!currentConfig.skills) {
                currentConfig.skills = [];
            }

            for (const p of presets) {
                const skillData = {
                    name: p.name,
                    front: p.front || [],
                    back: p.back || [],
                    verificationMethod: p.verificationMethod || 'none',
                    validationColumn: p.validationColumn || 'none',
                    ttsFrontColumn: p.ttsFrontColumn || 'none',
                    ttsBackColumn: p.ttsBackColumn || 'none',
                    alternateUppercase: p.alternateUppercase || false,
                    ttsOnHotkeyOnly: p.ttsOnHotkeyOnly || false
                };
                const id = await createSkillId(skillData);
                // Skip if a skill with same stable id already exists
                if (currentConfig.skills.find(s => s.id === id)) continue;
                // Pass the precomputed id to createSkill to avoid re-hashing
                skillData.id = id;
                const created = await createSkill(skillData);
                currentConfig.skills.push(created);
            }

            renderSkillsList();
            populateAllSkillSelectors();
            handleSettingsChange();
            showTopNotification('Preset skills added.', 'success');

        } catch (error) {
            console.error('Failed to load preset skills:', error);
            showTopNotification('Error: Could not load preset skills.', 'error');
        }
    }

    async function exportSkills() {
        const success = await saveCurrentConfig();
        if (!success) {
            showTopNotification('Could not save configuration. Skills not exported.', 'error');
            return;
        }

        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];

        if (!currentConfig || !currentConfig.skills || currentConfig.skills.length === 0) {
            showTopNotification('No skills to export in the current configuration.', 'error');
            return;
        }

        const skillsJson = JSON.stringify(currentConfig.skills, null, 2);
        const blob = new Blob([skillsJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentConfigName || 'flashcards'}-skills.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showTopNotification('Skills exported successfully.', 'success');
    }

    async function exportAllData() {
        try {
            showTopNotification('Exporting all data... this may take a moment.', 'success');

            const allKeys = await keys();
            const dataToExport = {
                version: 1,
                exportDate: new Date().toISOString(),
                configs: null,
                cardStats: {}
            };

            const dataPromises = allKeys.map(async (key) => {
                const value = await get(key);
                return { key, value };
            });

            const allData = await Promise.all(dataPromises);

            allData.forEach(({ key, value }) => {
                if (key === 'flashcard-configs') {
                    dataToExport.configs = value;
                } else if (key !== 'flashcard-last-config') {
                    dataToExport.cardStats[key] = value;
                }
            });

            const jsonString = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');

            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            a.download = `flashcards-backup-${year}-${month}-${day}-${hours}${minutes}.json`;

            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showTopNotification('All data exported successfully!', 'success');
        } catch (error) {
            console.error('Failed to export all data:', error);
            showTopNotification(`Error exporting data: ${error.message}`, 'error');
        }
    }

    async function importAllData(file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = event.target.result;
                const data = JSON.parse(json);

                if (!data.version || !data.configs || !data.cardStats) {
                    throw new Error('Invalid backup file format.');
                }

                const confirmation = confirm(
                    'Are you sure you want to import this backup? ' +
                    'This will overwrite all existing configurations and merge card statistics. ' +
                    'This action cannot be undone.'
                );

                if (!confirmation) {
                    showTopNotification('Import cancelled.', 'success');
                    return;
                }

                showTopNotification('Importing data... please wait.', 'success');

                // Overwrite configs
                await set('flashcard-configs', data.configs);

                // Optimized card stat merging
                const cardKeys = Object.keys(data.cardStats);
                const existingStatsPromises = cardKeys.map(key => get(key));
                const existingStatsList = await Promise.all(existingStatsPromises);

                const writePromises = [];
                for (let i = 0; i < cardKeys.length; i++) {
                    const cardKey = cardKeys[i];
                    const importedStats = data.cardStats[cardKey];
                    const existingStats = existingStatsList[i];

                    if (existingStats) {
                        const mergedStats = mergeCardStats(existingStats, importedStats);
                        writePromises.push(set(cardKey, mergedStats));
                    } else {
                        writePromises.push(set(cardKey, importedStats));
                    }
                }
                await Promise.all(writePromises);

                showTopNotification('Import successful! The application will now reload.', 'success');

                // Reload the application to apply changes
                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (error) {
                console.error('Failed to import data:', error);
                showTopNotification(`Error importing data: ${error.message}`, 'error');
            } finally {
                // Reset file input so the same file can be selected again
                importFileInput.value = '';
            }
        };
        reader.readAsText(file);
    }

    function mergeCardStats(existing, imported) {
        // Ensure both stats objects have the 'skills' property
        if (!existing.skills) existing.skills = {};
        if (!imported.skills) return existing; // Nothing to merge from

        for (const skillId in imported.skills) {
            const importedSkill = imported.skills[skillId];
            const existingSkill = existing.skills[skillId];

            if (existingSkill) {
                // Merge arrays, avoiding duplicates
                existingSkill.successTimestamps = [...new Set([...existingSkill.successTimestamps, ...importedSkill.successTimestamps])].sort((a, b) => a - b);
                existingSkill.failureTimestamps = [...new Set([...existingSkill.failureTimestamps, ...importedSkill.failureTimestamps])].sort((a, b) => a - b);
                existingSkill.responseDelays = [...(existingSkill.responseDelays || []), ...(importedSkill.responseDelays || [])];

                // Sum view counts
                existingSkill.viewCount = (existingSkill.viewCount || 0) + (importedSkill.viewCount || 0);

                // Take the more recent lastViewed timestamp
                existingSkill.lastViewed = Math.max(existingSkill.lastViewed || 0, importedSkill.lastViewed || 0);

                // Take the higher intervalIndex
                existingSkill.intervalIndex = Math.max(existingSkill.intervalIndex || 0, importedSkill.intervalIndex || 0);
            } else {
                // If the skill doesn't exist on the existing card, add it
                existing.skills[skillId] = importedSkill;
            }
        }
        return existing;
    }


    /**
     * Flips the current card and handles the flip animation.
     * Also triggers TTS for the revealed side if enabled.
     */
    function getCurrentSkillConfig() {
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        if (!currentConfig || !currentConfig.skills || !currentSkillId) {
            return null;
        }
        const skillConfig = currentConfig.skills.find(s => s.id === currentSkillId);

        // Fallback to the first skill if the current one isn't found
        if (!skillConfig && currentConfig.skills.length > 0) {
            return currentConfig.skills[0];
        }
        return skillConfig;
    }

    function isAudioOnly(skillConfig) {
        return skillConfig && skillConfig.front.length === 0 && skillConfig.ttsFrontColumn && skillConfig.ttsFrontColumn !== 'none';
    }

    /**
     * Flips the current card and handles the flip animation.
     * Also triggers TTS for the revealed side if enabled.
     */
    function flipCard() {
        if (!card) return;

        // If flipping is attempted during an active (unanswered) multiple-choice question,
        // treat it as "I don't know" and show the next card.
        if (!multipleChoiceContainer.classList.contains('hidden') && !multipleChoiceContainer.classList.contains('answered')) {
            markCardAsKnown(false);
            showNextCard({ forceNew: true });
            return;
        }

        const skillConfig = getCurrentSkillConfig();
        if (!skillConfig) {
            console.error('Cannot flip card: no skill configured.');
            return;
        }

        const isFlippingToFront = card.classList.contains('flipped');
        card.classList.toggle('flipped');

        if (isFlippingToFront) {
            // Logic to handle rotating through multiple base languages when flipping back to the front
            baseLanguageRotationIndex++;
            const baseLangIndices = (configs[configSelector.value] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
            if (baseLangIndices.length > 1) {
                const rotationIndex = baseLanguageRotationIndex % baseLangIndices.length;
                currentRandomBaseIndex = baseLangIndices[rotationIndex];
            }

            // Regenerate and update text for both faces since the base language might have changed
            const frontRoles = skillConfig.front || [];
            const backRoles = skillConfig.back || [];
            frontParts = getTextForRoles(frontRoles, currentRandomBaseIndex);
            backParts = getTextForRoles(backRoles, currentRandomBaseIndex);

            // This is a simplified redraw. The main redraw logic is in displayCard.
            // When flipping back to the front, we need to ensure the content is updated
            // in case the base language has rotated.
            cardFrontContent.innerHTML = ''; // Clear existing content
            frontParts.forEach(part => {
                const partDiv = document.createElement('div');
                partDiv.className = `card-role-${part.role.toLowerCase()}`;
                partDiv.textContent = part.text;
                cardFrontContent.appendChild(partDiv);
            });

            cardBackContent.innerHTML = ''; // Clear existing content
            backParts.forEach(part => {
                const partDiv = document.createElement('div');
                partDiv.className = `card-role-${part.role.toLowerCase()}`;
                partDiv.textContent = part.text;
                cardBackContent.appendChild(partDiv);
            });

            // Re-apply font size adjustments after content update
            adjustFontSize(cardFrontContent, true);
            adjustFontSize(cardBackContent, false);
        }

        document.body.classList.add('is-flipping');
        setTimeout(() => {
            document.body.classList.remove('is-flipping');
        }, 600);

        if (skillConfig.ttsOnHotkeyOnly) return;

        // Speak the content of the revealed face
        if (card.classList.contains('flipped')) {
            const ttsRole = skillConfig.ttsBackColumn;
            const lang = getLanguageForTts(ttsRole);
            const textToSpeak = ttsBackParts.map(p => p.text).join(' ');
            speak(textToSpeak, { ttsRole: ttsRole, lang: lang });
        } else {
            const ttsRole = skillConfig.ttsFrontColumn;
            const lang = getLanguageForTts(ttsRole);
            const textToSpeak = ttsFrontParts.map(p => p.text).join(' ');
            speak(textToSpeak, { ttsRole: ttsRole, lang: lang });
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
    function getSelectedRoles(checkboxContainer) {
        if (!checkboxContainer) return [];
        return Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => cb.value);
    }

    /**
     * Gets the combined text content for the current card from a given set of column indices.
     * @param {number[]} indices - An array of column indices.
     * @returns {string} The combined text, with each column's content on a new line.
     */
    function getTextForRoles(roles, baseLanguageIndex = -1) {
        const currentConfigName = configSelector.value;
        if (!currentConfigName || !configs[currentConfigName] || !configs[currentConfigName].roleToColumnMap) return [];
        const roleToColumnMap = configs[currentConfigName].roleToColumnMap;
        const currentCard = cardData[currentCardIndex];

        if (!currentCard) return [];

        const textParts = [];

        roles.forEach(roleKey => {
            let columnIndices = [];
            if (roleKey === 'BASE_LANGUAGE' && baseLanguageIndex !== -1) {
                // If a specific base language has been chosen for this card view, use its index.
                columnIndices = [baseLanguageIndex];
            } else {
                // Otherwise, get all columns associated with the role.
                columnIndices = roleToColumnMap[roleKey] || [];
            }

            columnIndices.forEach(colIndex => {
                const cellText = currentCard[colIndex];
                if (cellText) {
                    textParts.push({
                        text: transformSlashText(cellText),
                        role: roleKey
                    });
                }
            });
        });
        return textParts;
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

        // Ensure the basic structure is valid
        if (!cardStats || typeof cardStats !== 'object' || !cardStats.skills) {
            cardStats = { skills: {} };
        }

        // Get the current list of user-defined skills
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        const userSkills = (currentConfig && currentConfig.skills) ? currentConfig.skills : [];

        // Ensure all user-defined skills have a stats object
        if (userSkills.length > 0) {
            userSkills.forEach(skill => {
                if (!cardStats.skills[skill.id]) {
                    cardStats.skills[skill.id] = createDefaultSkillStats();
                }
            });
        }

        // Note: Old migration logic for the very first version is removed for clarity,
        // as the new system is fundamentally different. A more robust migration
        // would be needed for production, but this is sufficient for the refactor.

        return cardStats;
    }

    function renderSkillMastery(cardStats) {
        if (!skillMasteryDashboard) return;

        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName] || {};
        const userSkills = currentConfig.skills || [];
        const activeSkills = new Set(currentConfig.activeSkills || []);

        let html = '';
        userSkills.forEach((skill, index) => {
            const skillStats = cardStats.skills[skill.id] || createDefaultSkillStats();
            const score = getRetentionScore(skillStats);
            const timeToDue = getTimeToDue(skillStats);
            const letter = String.fromCharCode(65 + index); // A, B, C...

            const isCurrent = skill.id === currentSkillId;
            const isActiveSession = activeSkills.has(skill.id);

            let classes = 'skill-mastery-item';
            if (isCurrent) classes += ' active';
            if (isActiveSession) classes += ' active-session';

            html += `
                <div class="${classes}" data-skill-id="${skill.id}" title="${skill.name} - Next review: ${timeToDue.formatted}">
                    <span class="skill-name">${letter}</span>
                    <span class="skill-score">${score}</span>
                </div>
            `;
        });

        skillMasteryDashboard.innerHTML = html;
        skillMasteryDashboard.title = 'Click to configure skills'; // Add hover tooltip
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

        if (!isNavigatingBack && (index !== currentCardIndex || reason.skill !== currentSkillId)) {
            viewHistory.push({ cardIndex: currentCardIndex, skillId: currentSkillId });
        }

        currentCardIndex = index;
        // The currentSkillId is now set by showNextCard
        replayRate = 1.0;

        const skillConfig = getCurrentSkillConfig();
        if (!skillConfig) {
            console.error('No skill config found for displayCard. Aborting.');
            // Potentially show a user-facing error here
            return;
        }

        const currentSkillStats = stats.skills[currentSkillId] || createDefaultSkillStats();
        const previousLastViewed = currentSkillStats.lastViewed;
        currentSkillStats.viewCount++;
        currentSkillStats.lastViewed = Date.now();

        // --- Text Generation ---
        const baseLangIndices = (configs[configSelector.value] || {}).roleToColumnMap['BASE_LANGUAGE'] || [];
        if (baseLangIndices.length > 1) {
            const rotationIndex = baseLanguageRotationIndex % baseLangIndices.length;
            currentRandomBaseIndex = baseLangIndices[rotationIndex];
        } else if (baseLangIndices.length === 1) {
            currentRandomBaseIndex = baseLangIndices[0];
        } else {
            currentRandomBaseIndex = -1;
        }

        const frontRoles = skillConfig.front || [];
        const backRoles = skillConfig.back || [];
        const ttsFrontRole = skillConfig.ttsFrontColumn ? [skillConfig.ttsFrontColumn] : [];
        const ttsBackRole = skillConfig.ttsBackColumn ? [skillConfig.ttsBackColumn] : [];

        frontParts = getTextForRoles(frontRoles, currentRandomBaseIndex);
        backParts = getTextForRoles(backRoles, currentRandomBaseIndex);
        ttsFrontParts = getTextForRoles(ttsFrontRole, currentRandomBaseIndex);
        ttsBackParts = getTextForRoles(ttsBackRole, currentRandomBaseIndex);

        // --- UI Update ---
        cardFrontContent.innerHTML = '';
        cardBackContent.innerHTML = '';

        if (isAudioOnly(skillConfig)) {
            cardFrontContent.innerHTML = '<span class="speech-icon">🔊</span>';
        } else {
            frontParts.forEach(part => {
                const partDiv = document.createElement('div');
                partDiv.className = `card-role-${part.role.toLowerCase()}`;
                let text = part.text;
                if (skillConfig.alternateUppercase && part.role === 'TARGET_LANGUAGE') {
                    if (useUppercase) {
                        text = text.toUpperCase();
                    }
                }
                partDiv.textContent = text;
                cardFrontContent.appendChild(partDiv);
            });
            if (skillConfig.alternateUppercase) {
                useUppercase = !useUppercase;
            }
        }

        backParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            partDiv.textContent = part.text;
            cardBackContent.appendChild(partDiv);
        });

        cardFront.style.fontSize = '';
        cardBackContent.style.fontSize = '';

        setTimeout(() => {
            adjustFontSize(cardFrontContent, true);
            adjustFontSize(cardBackContent, false);
        }, 50);

        card.classList.remove('flipped');
        if (!skillConfig.ttsOnHotkeyOnly) {
            const ttsRole = skillConfig.ttsFrontColumn;
            const lang = getLanguageForTts(ttsRole);
            const textToSpeak = ttsFrontParts.map(p => p.text).join(' ');
            speak(textToSpeak, { ttsRole: ttsRole, lang: lang });
        }

        renderSkillMastery(stats);
        if (lastSeen) lastSeen.textContent = `Last seen: ${formatTimeAgo(previousLastViewed)}`;
        if (cardSpecificStats) cardSpecificStats.innerHTML = '';

        if (explanationMessage) {
            let message = '';
            const deckIcon = reason.isFiltered ? 'Filter 🐠' : 'Deck 📚';
            explanationMessage.classList.remove('deck-learned-message');

            switch (reason.type) {
            case 'due_review':
                message = `[${deckIcon}] This card is due for its ${reason.expiredInterval} review. Next review in ${reason.nextInterval}.`;
                break;
            case 'bridging_card':
                message = `[${deckIcon}] Introducing a card from a previous skill.`;
                break;
            case 'new_card':
                message = `[${deckIcon}] Introducing a new, unseen card.`;
                break;
            case 'least_learned':
                message = `[${deckIcon}] Reviewing card with the lowest score.`;
                break;
            case 'deck_learned':
                explanationMessage.classList.add('deck-learned-message');
                if (reason.isFiltered) {
                    message = 'Filtered deck learned! Proceeding with regular deck.';
                } else {
                    message = reason.timeToNextReview !== Infinity
                        ? `Deck learned! Reviews are from ${formatTimeDifference(reason.timeToNextReview)} to ${formatTimeDifference(reason.timeToLastReview)}. Reviewing lowest-score cards until then.`
                        : 'Congratulations, you have learned this whole deck!';
                }
                break;
            }
            explanationMessage.textContent = message;
            explanationMessage.classList.toggle('visible', !!message);
        }

        // Handle UI for different verification methods
        stopVoiceRecognition(); // Stop any active recognition from the previous card.

        // Reset all verification UI to a default state
        writingPracticeContainer.classList.add('hidden');
        multipleChoiceContainer.classList.add('hidden');
        voiceInputContainer.classList.add('hidden');
        iKnowButton.classList.remove('hidden');
        iDontKnowButton.classList.remove('hidden');
        nextCardButton.classList.remove('hidden');


        if (skillConfig.verificationMethod === VERIFICATION_METHODS.TEXT) {
            writingPracticeContainer.classList.remove('hidden');
            writingPracticeContainer.classList.toggle('audio-only-writing', isAudioOnly);
            iKnowButton.classList.add('hidden');
            iDontKnowButton.classList.add('hidden');
            nextCardButton.classList.add('hidden');
            writingInput.value = '';
            writingInput.disabled = false;
            writingInput.focus();
        } else if (skillConfig.verificationMethod === VERIFICATION_METHODS.MULTIPLE_CHOICE) {
            multipleChoiceContainer.classList.remove('hidden');
            generateMultipleChoiceOptions();
        } else if (skillConfig.verificationMethod === VERIFICATION_METHODS.VOICE) {
            voiceInputContainer.classList.remove('hidden');
            iKnowButton.classList.add('hidden');
            iDontKnowButton.classList.remove('hidden'); // Re-enable "I don't know"
            nextCardButton.classList.add('hidden');
            // Automatically start listening
            startVoiceRecognition();
        }
        // The 'none' case is now handled by the default state set above.
        comparisonContainer.classList.add('hidden');
        comparisonContainer.innerHTML = '';

        await saveCardStats(cardKey, stats);
        cardShownTimestamp = Date.now();
    }

    async function getAllCardStats() {
        const promises = cardData.map(card => getSanitizedStats(getCardKey(card)));
        return Promise.all(promises);
    }

    function findNextCardFromList(items, { forceNew = false, now = Date.now(), allCardStats = [], userSkills = [], isFiltered = false } = {}) {
        if (items.length === 0) return null;

        // --- Due Items (Priority 1) ---
        const dueItems = items.filter(item => {
            if (!item.skillStats.lastViewed) return false;
            const intervalSeconds = repetitionIntervals[item.skillStats.intervalIndex];
            return intervalSeconds !== undefined && (now - item.skillStats.lastViewed > intervalSeconds * 1000);
        });

        if (dueItems.length > 0) {
            shuffleArray(dueItems);
            dueItems.sort((a, b) => getRetentionScore(a.skillStats) - getRetentionScore(b.skillStats));
            let nextItem = dueItems[0];
            if (forceNew && nextItem.cardIndex === currentCardIndex && nextItem.skillId === currentSkillId && dueItems.length > 1) {
                nextItem = dueItems[1];
            }
            const reason = { type: 'due_review', expiredInterval: formatDuration(repetitionIntervals[nextItem.skillStats.intervalIndex]), nextInterval: formatDuration(repetitionIntervals[nextItem.skillStats.intervalIndex + 1] || 0), isFiltered };
            return { nextItem, reason };
        }

        // --- New Items (Prioritized) ---
        const unseenItems = items.filter(item => item.skillStats.viewCount === 0);
        if (unseenItems.length > 0) {
            const skillOrderMap = new Map(userSkills.map((skill, index) => [skill.id, index]));
            const bridgingItems = [];
            const trulyNewItems = [];

            unseenItems.forEach(item => {
                const cardStats = allCardStats[item.cardIndex];
                const currentSkillOrder = skillOrderMap.get(item.skillId);
                let seenInPreviousSkill = false;
                if (currentSkillOrder > 0) {
                    for (const [skillId, stats] of Object.entries(cardStats.skills)) {
                        const skillIdx = skillOrderMap.get(skillId);
                        if (skillIdx !== undefined && skillIdx < currentSkillOrder && stats.viewCount > 0) {
                            seenInPreviousSkill = true;
                            break;
                        }
                    }
                }
                if (seenInPreviousSkill) {
                    bridgingItems.push(item);
                } else {
                    trulyNewItems.push(item);
                }
            });

            if (bridgingItems.length > 0) {
                const nextItem = bridgingItems[Math.floor(Math.random() * bridgingItems.length)];
                return { nextItem, reason: { type: 'bridging_card', isFiltered } };
            }
            if (trulyNewItems.length > 0) {
                const nextItem = trulyNewItems[Math.floor(Math.random() * trulyNewItems.length)];
                return { nextItem, reason: { type: 'new_card', isFiltered } };
            }
        }

        // --- Least Learned (Priority 4) ---
        let reasonForDisplay;
        const allSkillsLearned = items.every(item => getRetentionScore(item.skillStats) > 0);
        if (allSkillsLearned) {
            let minTimeToDue = Infinity, maxTimeToDue = 0;
            items.forEach(item => {
                const timeToDue = getTimeToDue(item.skillStats, now).ms;
                if (timeToDue > 0 && timeToDue < minTimeToDue) minTimeToDue = timeToDue;
                if (timeToDue > maxTimeToDue) maxTimeToDue = timeToDue;
            });
            reasonForDisplay = { type: 'deck_learned', timeToNextReview: minTimeToDue, timeToLastReview: maxTimeToDue, isFiltered };
        } else {
            reasonForDisplay = { type: 'least_learned', isFiltered };
        }

        let candidateItems = [...items];
        if (forceNew && candidateItems.length > 1) {
            candidateItems = candidateItems.filter(item => item.cardIndex !== currentCardIndex || item.skillId !== currentSkillId);
        }
        if (candidateItems.length === 0) candidateItems = [...items];

        shuffleArray(candidateItems);
        candidateItems.sort((a, b) => {
            const scoreA = getRetentionScore(a.skillStats);
            const scoreB = getRetentionScore(b.skillStats);
            if (scoreA !== scoreB) return scoreA - scoreB;
            return (a.skillStats.lastViewed || 0) - (b.skillStats.lastViewed || 0);
        });

        const nextItem = candidateItems[0];
        return { nextItem, reason: reasonForDisplay };
    }

    async function showNextCard({ forceNew = false, now = Date.now() } = {}) {
        if (cardData.length === 0) return;

        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        const activeSkills = getActiveSkills();
        const userSkills = currentConfig ? currentConfig.skills : [];

        if (activeSkills.length === 0) {
            showTopNotification('No active skills. Please select skills to practice in Settings.', 'error');
            return;
        }

        const allCardStats = await getAllCardStats();

        // 1. Get all possible reviewable items
        let allReviewableItems = [];
        allCardStats.forEach((cardStats, cardIndex) => {
            activeSkills.forEach(skillId => {
                allReviewableItems.push({
                    cardIndex,
                    skillId,
                    skillStats: cardStats.skills[skillId] || createDefaultSkillStats()
                });
            });
        });

        if (allReviewableItems.length === 0) {
            showTopNotification('No cards to display.', 'error');
            return;
        }

        // 2. Determine the list of items to select from (filtered or all)
        let itemsToSelectFrom = allReviewableItems;
        let isFiltered = currentConfig.filterIsEnabled && activeFilterWords.size > 0;
        let filteredItems = [];

        if (isFiltered) {
            const roleToColumnMap = (configs[configSelector.value] || {}).roleToColumnMap || {};
            const keyIndices = roleToColumnMap['TARGET_LANGUAGE'] || [];
            if (keyIndices.length === 1) {
                const keyIndex = keyIndices[0];
                // The deck words are now split, so we need to check if any word in the card's target field is in the filter
                filteredItems = allReviewableItems.filter(item => {
                    const cardText = cardData[item.cardIndex][keyIndex]?.toLowerCase();
                    if (!cardText) return false;
                    const cardWords = cardText.match(/[\p{L}\p{N}]+/gu) || [];
                    return cardWords.some(word => activeFilterWords.has(word));
                });

                if (filteredItems.length > 0) {
                    itemsToSelectFrom = filteredItems;
                } else {
                    showTopNotification('No matching cards for the current filter.', 'error');
                    // If no cards match, we should probably stop instead of showing the whole deck.
                    return;
                }
            }
        }

        // 3. Find the next card from the determined list
        const findNextCardOptions = { forceNew, now, allCardStats, userSkills, isFiltered };
        let result = findNextCardFromList(itemsToSelectFrom, findNextCardOptions);

        // 4. Handle overflow if the filtered set is learned
        const filteredDeckIsLearned = isFiltered && result && result.reason.type === 'deck_learned';

        if (isFiltered) {
            updateFilterState(filteredDeckIsLearned ? 'learned' : 'learning');
        } else {
            updateFilterState('off');
        }

        if (filteredDeckIsLearned && filterAllowOverflowCheckbox.checked) {
            const overflowResult = findNextCardFromList(allReviewableItems, { ...findNextCardOptions, isFiltered: false });
            if (overflowResult) {
                // By not overwriting the reason, the explanation message for the new card will be correct.
                result = overflowResult;
            }
        } else if (!result && isFiltered && filterAllowOverflowCheckbox.checked) {
            // This case handles when the filtered list is exhausted (e.g., all cards are new but seen).
            const overflowResult = findNextCardFromList(allReviewableItems, { ...findNextCardOptions, isFiltered: false });
            if (overflowResult) {
                result = overflowResult;
            }
        }

        // 5. Display the card or a message
        if (result) {
            const { nextItem, reason } = result;
            currentCardIndex = nextItem.cardIndex;
            currentSkillId = nextItem.skillId;
            await displayCard(currentCardIndex, { reason });
        } else {
            const message = isFiltered ? 'You have learned all cards in the filtered set!' : 'You have learned all cards in the deck!';
            showTopNotification(message, 'success');
        }
    }

    /**
     * Shows the previously viewed card by popping from the view history stack.
     */
    async function showPrevCard() {
        if (viewHistory.length > 0) {
            const prevState = viewHistory.pop();
            currentSkillId = prevState.skillId; // Restore the skill for that card
            await displayCard(prevState.cardIndex, { isNavigatingBack: true });
        }
    }

    function buildHistoryTbodyHtml(data) {
        let tbodyHtml = '<tbody>';
        const now = Date.now();
        const currentConfig = configs[configSelector.value] || {};
        const userSkills = currentConfig.skills || [];

        data.forEach(item => {
            tbodyHtml += '<tr>';
            item.card.forEach(cell => {
                tbodyHtml += `<td>${cell}</td>`;
            });

            // Mastery column
            const masteryHtml = userSkills.map((skill, index) => {
                const letter = String.fromCharCode(65 + index);
                const skillStats = item.stats.skills[skill.id] || createDefaultSkillStats();
                const score = getRetentionScore(skillStats);
                return `<span title="${skill.name}: ${score}">${letter}:${score}</span>`;
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
    async function renderDashboard() {
        const MASTERED_THRESHOLD = 5;
        const DIFFICULT_THRESHOLD = 0;

        if (cardData.length === 0) {
            showTopNotification('No deck loaded. Please load a deck to analyze.', 'error');
            return;
        }

        const allCardStats = await getAllCardStats();
        const masteredWords = [];
        const difficultWords = [];
        const keyIndex = (configs[configSelector.value]?.roleToColumnMap?.TARGET_LANGUAGE || [])[0];

        if (keyIndex === undefined) {
            showTopNotification('Cannot generate report: Target Language column not set.', 'error');
            return;
        }

        allCardStats.forEach((cardStats, index) => {
            const cardKey = cardData[index][keyIndex];
            if (!cardKey) return;

            let totalScore = 0;
            let skillCount = 0;
            for (const skillId in cardStats.skills) {
                totalScore += getRetentionScore(cardStats.skills[skillId]);
                skillCount++;
            }

            const avgScore = skillCount > 0 ? totalScore / skillCount : 0;

            if (avgScore > MASTERED_THRESHOLD) {
                masteredWords.push({ word: cardKey, score: avgScore.toFixed(1) });
            } else if (avgScore < DIFFICULT_THRESHOLD) {
                difficultWords.push({ word: cardKey, score: avgScore.toFixed(1) });
            }
        });

        const populateList = (listElement, words, sortFn) => {
            listElement.innerHTML = '';
            if (words.length === 0) {
                listElement.innerHTML = '<li>None yet. Keep practicing!</li>';
                return;
            }
            words.sort(sortFn); // Sort by score using the provided function
            words.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.word} (Score: ${item.score})`;
                listElement.appendChild(li);
            });
        };

        populateList(masteredWordsList, masteredWords, (a, b) => parseFloat(b.score) - parseFloat(a.score));
        populateList(difficultWordsList, difficultWords, (a, b) => parseFloat(a.score) - parseFloat(b.score));

        dashboardModal.classList.remove('hidden');
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
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName] || {};
        const roleToColumnMap = currentConfig.roleToColumnMap || {};
        const keyIndices = roleToColumnMap['TARGET_LANGUAGE'] || [];

        if (keyIndices.length === 0) {
            // This should be prevented by validation in saveConfig, but as a fallback:
            console.error('No Target Language column set for getCardKey!');
            return `invalid-card-${Math.random()}`;
        }
        const keyIndex = keyIndices[0]; // Use the first one

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
        const skillStats = cardStats.skills[currentSkillId];

        if (!skillStats) {
            console.error(`Could not find stats for skill ${currentSkillId} on card ${cardKey}.`);
            return;
        }

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
                    skillStats.failureTimestamps.splice(0, failuresToRemove);
                }
            }

            if (isCurrentCardDue && skillStats.intervalIndex < repetitionIntervals.length - 1) {
                skillStats.intervalIndex++;
            }
        } else {
            skillStats.failureTimestamps.push(Date.now());
            skillStats.intervalIndex = 0;
        }
        await saveCardStats(cardKey, cardStats);
    }

    /**
     * Saves the current UI settings (URL, columns, font, etc.) as a named configuration
     * to IndexedDB.
     */
    function getSelectedSkills() {
        if (!skillSelectorCheckboxes) return [];
        return Array.from(skillSelectorCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
    }

    function getActiveSkills() {
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        // The source of truth is the activeSkills array. If it's missing or empty, no skills are active.
        return (currentConfig && currentConfig.activeSkills) ? currentConfig.activeSkills : [];
    }

    /**
     * The core, unified function for saving the current configuration to IndexedDB.
     * It gathers all settings from the UI and state, validates them, and persists.
     * It does not show notifications, making it suitable for background saves.
     * @returns {Promise<boolean>} A promise that resolves to true on success, false on validation failure.
     */
    async function saveCurrentConfig() {
        const configName = configSelector.value;
        if (!configName) {
            // This can happen if no config is selected. Silently fail.
            return false;
        }

        const currentConfig = configs[configName] || {};

        const columnRoleAssignments = {};
        document.querySelectorAll('[id^="column-role-"]').forEach(select => {
            columnRoleAssignments[select.dataset.columnIndex] = select.value;
        });

        const roleToColumnMap = {};
        for (const roleKey in COLUMN_ROLES) {
            roleToColumnMap[roleKey] = [];
        }
        for (const colIndex in columnRoleAssignments) {
            const role = columnRoleAssignments[colIndex];
            if (role !== 'NONE') {
                roleToColumnMap[role].push(parseInt(colIndex));
            }
        }

        if (roleToColumnMap['TARGET_LANGUAGE'].length !== 1) {
            showTopNotification('Config not saved: Assign exactly one "Target Language" column.', 'error');
            return false;
        }

        if (!currentConfig.skills) {
            currentConfig.skills = [];
        }

        // Update the single config object with all current settings
        configs[configName] = {
            ...currentConfig,
            dataUrl: currentConfig.subsetData ? null : dataUrlInput.value,
            repetitionIntervals: repetitionIntervalsTextarea.value,
            activeSkills: getSelectedSkills(),
            columnRoleAssignments: columnRoleAssignments,
            roleToColumnMap: roleToColumnMap,
            font: fontSelector.value,
            ttsRate: ttsRateSlider.value,
            ttsRateBase: ttsRateBaseSlider.value,
            disableAnimation: disableAnimationCheckbox.checked,
            multipleChoiceCount: multipleChoiceCount.value,
            // Add filter settings
            filterIsEnabled: enableFilterSettingsCheckbox.checked,
            filterText: filterTextarea.value,
            filterAllowOverflow: filterAllowOverflowCheckbox.checked
        };

        // Persist all configs and the last used one
        await set('flashcard-configs', configs);
        await set('flashcard-last-config', configName);

        // Update UI elements that reflect the config name
        if (configTitle) configTitle.textContent = configName;
        if (deckTitle) deckTitle.textContent = configName;
        if (saveConfigButton) saveConfigButton.disabled = true;

        return true;
    }

    /**
     * A wrapper for saveCurrentConfig, designed to be called by the user-facing "Save" button.
     * It handles UI feedback like notifications.
     */
    async function saveConfig() {
        if (!configNameInput) return;
        const configName = configNameInput.value.trim();
        if (!configName) {
            showTopNotification('Please enter a configuration name.', 'error');
            return;
        }

        // Ensure the dropdown reflects the name being saved
        if (configSelector.value !== configName) {
            configs[configName] = configs[configSelector.value] || {};
            delete configs[configSelector.value];
            populateConfigSelector();
            configSelector.value = configName;
        }

        const success = await saveCurrentConfig();
        if (success) {
            showTopNotification(`Configuration '${configName}' saved!`, 'success');
        }
    }

    async function resetDeckStats() {
        if (cardData.length === 0) {
            showTopNotification('No deck is loaded. Please load a deck first.');
            return;
        }

        const confirmation = confirm('Are you sure you want to reset all statistics for every card in the current deck? This action cannot be undone.');
        if (!confirmation) {
            return;
        }

        try {
            const promises = cardData.map(card => del(getCardKey(card)));
            await Promise.all(promises);
            showTopNotification('Statistics for the current deck have been reset.', 'success');
            // Optionally, reload the current card to show its stats are reset
            if (currentCardIndex >= 0) {
                await displayCard(currentCardIndex);
            }
        } catch (error) {
            console.error('Failed to reset deck statistics:', error);
            showTopNotification('An error occurred while trying to reset the deck statistics.');
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
        cardContainer.style.fontFamily = config.font;
        if (configTitle) configTitle.textContent = configName;
        if (deckTitle) deckTitle.textContent = configName;

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

        // Ensure skills array exists and hydrate them
        if (config.skills && Array.isArray(config.skills)) {
            config.skills = config.skills.map(plainSkill => {
                const skill = new Skill(plainSkill.name, plainSkill.id);
                // Object.assign to merge loaded properties, preserving defaults from constructor
                return Object.assign(skill, plainSkill);
            });
        } else {
            config.skills = [];
        }

        if (config.skills.length === 0) {
            await addDefaultSkill(config);
            handleSettingsChange();
        }

        // Ensure activeSkills array exists
        if (!config.activeSkills) {
            config.activeSkills = config.skills.length > 0 ? [config.skills[0].id] : [];
        }

        renderSkillsList();
        populateAllSkillSelectors();

        // Load Column Roles
        if (config.columnRoleAssignments) {
            for (const colIndex in config.columnRoleAssignments) {
                const select = document.getElementById(`column-role-${colIndex}`);
                if (select) {
                    select.value = config.columnRoleAssignments[colIndex];
                }
            }
        }

        if (ttsRateSlider) ttsRateSlider.value = config.ttsRate || 1;
        if (ttsRateBaseSlider) ttsRateBaseSlider.value = config.ttsRateBase || 1.5;
        if (disableAnimationCheckbox) disableAnimationCheckbox.checked = config.disableAnimation || false;
        if (multipleChoiceCount) multipleChoiceCount.value = config.multipleChoiceCount || 4;

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

        // Load filter settings
        if (filterTextarea) filterTextarea.value = config.filterText || '';
        if (filterAllowOverflowCheckbox) filterAllowOverflowCheckbox.checked = config.filterAllowOverflow !== false; // default to true
        setFilterEnabled(config.filterIsEnabled || false);
        updateFilterState(config.filterIsEnabled ? 'learning' : 'off');
        updateFilterHighlights(); // Update highlights based on loaded text
        const wordsArray = (config.filterText || '').match(/[\p{L}\p{N}]+/gu) || [];
        activeFilterWords = new Set(wordsArray.map(w => w.toLowerCase()));


        await set('flashcard-last-config', configName);

        if (cardData.length > 0) {
            showNextCard();
        }
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
            console.error('Error loading initial configs from IndexedDB:', error);
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
    function loadVoices() {
        if (!('speechSynthesis' in window)) {
            return;
        }
        const setVoices = () => {
            voices = speechSynthesis.getVoices();
        };
        // Voices may load asynchronously. Call once to get what's available now.
        setVoices();
        // And set the event handler to repopulate the list when it changes.
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = setVoices;
        }
    }

    /**
     * Uses the browser's SpeechSynthesis API to speak the given text.
     * @param {string} text - The text to be spoken.
     * @param {string} voiceName - The name of the voice to use (from `speechSynthesis.getVoices()`).
     * @param {number} [rate] - The playback rate (e.g., 1.0 for normal, 0.5 for half-speed). Defaults to the slider value.
     */
    function getLanguageForRole(ttsRole) {
        if (!ttsRole) return 'en'; // Default language
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        const roleToColumnMap = currentConfig ? currentConfig.roleToColumnMap : null;

        if (!roleToColumnMap) return 'en';

        const indices = roleToColumnMap[ttsRole];
        if (!indices || indices.length === 0) {
            return 'en';
        }
        // If multiple columns have the same role, use the language of the first one for TTS.
        const columnIndex = indices[0];
        return columnLanguages[columnIndex] || 'en';
    }

    function getLanguageForTts(ttsRole) {
        if (ttsRole === 'BASE_LANGUAGE' && currentRandomBaseIndex !== -1) {
            return columnLanguages[currentRandomBaseIndex] || 'en';
        }
        return getLanguageForRole(ttsRole);
    }

    /**
     * Uses the browser's SpeechSynthesis API to speak the given text.
     * @param {string} text - The text to be spoken.
     * @param {object} options - Options for speech synthesis.
     * @param {number} [options.rate] - The playback rate.
     * @param {string} [options.lang] - The BCP 47 language code.
     * @param {string} [options.ttsRole] - The role of the content being spoken (e.g., 'BASE_LANGUAGE').
     */
    function speak(text, { rate, lang, ttsRole } = {}) {
        if (!('speechSynthesis' in window) || speechSynthesis.speaking || !text) {
            return;
        }

        // Sanitize text for TTS: remove content in parentheses
        const sanitizedText = stripParentheses(text);
        if (!sanitizedText) return;

        const utterance = new SpeechSynthesisUtterance(sanitizedText);

        // The language is now passed in directly.
        const finalLang = lang || 'en'; // Default to English if not provided
        console.log(`Using language: ${finalLang} for text: "${sanitizedText.substring(0, 30)}..."`);


        // Display detected language on the card
        const isFlipped = card.classList.contains('flipped');
        const displayer = isFlipped ? ttsLangDisplayBack : ttsLangDisplayFront;
        if (displayer) {
            // When speaking for the back, don't clear the front.
            // When speaking for the front, clear the back.
            if (isFlipped) {
                if (ttsLangDisplayBack) ttsLangDisplayBack.textContent = '';
            } else {
                if (ttsLangDisplayFront) ttsLangDisplayFront.textContent = '';
                if (ttsLangDisplayBack) ttsLangDisplayBack.textContent = '';
            }

            const updateLanguageDisplay = () => {
                if (displayer === ttsLangDisplayFront) {
                    displayer.textContent = `🔊 ${finalLang}`;
                } else {
                    displayer.textContent = finalLang;
                }
            };

            // If we are showing the back, delay the update to sync with the animation
            if (isFlipped && document.body.classList.contains('is-flipping')) {
                setTimeout(updateLanguageDisplay, 300); // 300ms is half the animation time
            } else {
                updateLanguageDisplay();
            }
        }

        // Find a suitable voice.
        let voice = voices.find(v => v.lang === finalLang);
        if (!voice) {
            voice = voices.find(v => v.lang.startsWith(finalLang));
        }
        if (!voice) {
            voice = voices.find(v => v.default);
        }

        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        }

        // Determine the rate
        let finalRate;
        if (rate) {
            finalRate = rate;
        } else if (ttsRole === 'BASE_LANGUAGE' && ttsRateBaseSlider) {
            finalRate = ttsRateBaseSlider.value;
        } else if (ttsRateSlider) {
            finalRate = ttsRateSlider.value;
        } else {
            finalRate = 1;
        }

        utterance.rate = finalRate;

        // Prevent speech queue conflicts and browser crashes
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    /**
     * Handles all keyboard shortcuts for the application.
     * This includes flipping cards, navigation, marking cards, and replaying audio.
     * It distinguishes between keydown and keyup for the "hold space to peek" feature.
     * @param {KeyboardEvent} e - The keyboard event object.
     */
    function handleHotkeys(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            // Allow all keys to function normally in textareas
            if (e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Enter' && writingPracticeContainer.classList.contains('hidden')) {
                // Allow enter to submit forms in settings, etc.
                return;
            }
            if (e.code !== 'Enter') {
                return; // Only allow Enter key in inputs/selects
            }
        }

        const isMultipleChoiceActive = !multipleChoiceContainer.classList.contains('hidden') && !multipleChoiceContainer.classList.contains('answered');

        // Handle numeric hotkeys for multiple choice
        if (e.code.startsWith('Digit')) {
            if (isMultipleChoiceActive) {
                e.preventDefault();
                const choiceIndex = parseInt(e.code.replace('Digit', ''), 10) - 1;
                const buttons = multipleChoiceContainer.querySelectorAll('button');
                if (choiceIndex >= 0 && choiceIndex < buttons.length) {
                    buttons[choiceIndex].click();
                }
            }
            return; // Consume the event so it doesn't do anything else
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
                    flipCard(); // flipCard now contains the logic for MC "I don't know"
                }
                break;
            case 'ArrowRight':
                showNextCard();
                break;
            case 'ArrowLeft':
                showPrevCard();
                break;
            case 'KeyK':
                // Allow 'k' to work anytime, even to override a multiple choice answer.
                markCardAsKnown(true);
                showNextCard();
                break;
            case 'KeyJ':
                // Allow 'j' to work anytime.
                handleIDontKnow();
                break;
            case 'KeyF': {
                const skillConfig = getCurrentSkillConfig();
                if (!skillConfig) break;
                const parts = card.classList.contains('flipped') ? ttsBackParts : ttsFrontParts;
                const text = parts.map(p => p.text).join(' ');
                const role = card.classList.contains('flipped') ? skillConfig.ttsBackColumn : skillConfig.ttsFrontColumn;
                const lang = getLanguageForTts(role);
                replayRate = Math.max(0.1, replayRate - 0.2);
                speak(text, { rate: replayRate, ttsRole: role, lang: lang });
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

    function dragEnd() {
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


    function populateSkillSelector(container, isMobile = false) {
        if (!container) return;
        container.innerHTML = '';
        const currentConfigName = configSelector.value;
        const currentConfig = configs[currentConfigName];
        if (!currentConfig || !currentConfig.skills) return;

        currentConfig.skills.forEach(skill => {
            const div = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'checkbox';
            const idSuffix = isMobile ? `-mobile-${skill.id}` : `-${skill.id}`;
            input.id = `skill-checkbox${idSuffix}`;
            input.value = skill.id;

            const label = document.createElement('label');
            label.htmlFor = input.id;
            label.title = skill.name;
            label.textContent = skill.name;

            div.appendChild(input);
            div.appendChild(label);
            container.appendChild(div);
        });

        if (currentConfig.activeSkills) {
            currentConfig.activeSkills.forEach(skillId => {
                const cb = container.querySelector(`input[value="${skillId}"]`);
                if (cb) cb.checked = true;
            });
        }
    }

    function populateAllSkillSelectors() {
        populateSkillSelector(skillSelectorCheckboxes, false);
        populateSkillSelector(mobileSkillSelectorCheckboxes, true);
    }

    // Initial load
    loadVoices();
    populateAllSkillSelectors();
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
