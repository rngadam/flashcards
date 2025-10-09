/* global Sortable */

// --- Module Imports ---
import { detectColumnLanguages } from './lib/shared/detect-column-languages.js';

// --- UI and Core Logic Imports ---
import dom from './lib/ui/dom-elements.js';
import logger from './lib/core/logger.js';
import { getState, updateState, popFromViewHistory, COLUMN_ROLES } from './lib/core/state.js';
import { showTopNotification, formatTimeAgo, formatTimeDifference } from './lib/ui/ui-helpers.js';
import { initConfigManager, saveCurrentConfig, saveConfig, resetDeckStats, loadSelectedConfig, populateConfigSelector, loadInitialConfigs, exportSQLite, exportAllData, importAllData } from './lib/core/config-manager.js';
import { initSkillManager, renderSkillsList, openSkillDialog, saveSkill, deleteSkill, deleteAllSkills, addDefaultSkill, createPresetSkills, exportSkills, populateAllSkillSelectors, getSelectedSkills, getActiveSkills, saveTransform } from './lib/core/skill-manager.js';
import { initCardLogic, getCardKey, getRetentionScore, getSanitizedStats, getAllCardStats, markCardAsKnown, getTimeToDue, getCurrentSkillConfig, getTextForRoles, renderSkillMastery, displayCard, flipCard, showNextCard, showPrevCard, saveCardStats } from './lib/core/card-logic.js';
import { createDefaultSkillStats } from './lib/shared/validation.js';
import { initVerification, checkWritingAnswer, generateMultipleChoiceOptions, checkMultipleChoiceAnswer, toggleVoiceRecognition, startVoiceRecognition, stopVoiceRecognition } from './lib/core/verification.js';
import { initAuth, syncToServer, checkAuthStatus } from './lib/core/auth.js';


/**
 * @file Main application entry point.
 * This file orchestrates the entire application. It initializes modules,
 * sets up event listeners, and handles global UI logic like drag-and-drop
 * and hotkeys.
 */
function initializeApp() {
    // --- Get State Reference ---
    // Direct reference to the state object for frequent read access.
    const state = getState();

    // --- Dependency Injection ---
    // Pass dependencies to each module that needs them.
    const dependencies = {
        dom,
        state,
        showTopNotification,
        // Config Manager deps
        syncToServer,
        loadData,
        parseData,
        showNextCard,
        displayCard,
        addDefaultSkill,
        renderSkillsList,
        populateAllSkillSelectors,
        getCardKey,
        getAllCardStats,
        getSelectedSkills,
        setFilterEnabled,
        updateFilterState,
        updateFilterHighlights,
        // Skill Manager deps
        handleSettingsChange,
        updateState,
        // Card Logic deps
        saveCardStats,
        startVoiceRecognition,
        stopVoiceRecognition,
        speak,
        handleIDontKnow,
        generateMultipleChoiceOptions,
        checkMultipleChoiceAnswer,
        getActiveSkills,
        popFromViewHistory,
        // Verification deps
        markCardAsKnown,
        flipCard,
        getLanguageForRole,
        getCurrentSkillConfig,
        // Auth deps
        populateConfigSelector,
        loadSelectedConfig,
    };

    initConfigManager(dependencies);
    initSkillManager(dependencies);
    initCardLogic(dependencies);
    initVerification(dependencies);
    initAuth(dependencies);


    // --- UI Layout & Tab Switching ---
    const updateLayout = () => {
        document.body.classList.toggle('desktop', window.matchMedia('(min-width: 769px)').matches);
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);

    // Tab switching: compute panels dynamically on click so new tabs can be injected later
    document.querySelectorAll('.tabs').forEach(tabsContainer => {
        const container = tabsContainer.parentElement;
        if (!container) return;
        tabsContainer.addEventListener('click', e => {
            if (e.target.matches('.tab-button')) {
                const button = e.target;
                tabsContainer.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');
                const tabName = button.dataset.tab;
                const tabPanels = container.querySelectorAll('.tab-panel');
                tabPanels.forEach(panel => {
                    panel.classList.toggle('active', panel.id === tabName);
                });
            }
        });
    });

    // --- Modal & Menu Handlers ---
    function setupModal(button, modal, closeButton, onOpenCallback = null, onCloseCallback = null) {
        if (button) {
            button.addEventListener('click', () => {
                if (onOpenCallback) {
                    const proceed = onOpenCallback();
                    if (proceed === false) return;
                }
                modal.classList.remove('hidden');
            });
        }
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                modal.classList.add('hidden');
                if (onCloseCallback) {
                    onCloseCallback();
                }
            });
        }
    }

    setupModal(dom.hamburgerMenu, dom.mobileMenuOverlay, dom.closeMobileMenuButton);
    setupModal(dom.settingsButton, dom.settingsModal, dom.closeSettingsButton, () => {
        // Ensure the logging panel exists and render logging + speech immediately when opening settings
        try {
            // Ensure a Debug tab exists in the settings tabs and a corresponding panel
            const tabsBar = dom.settingsModal.querySelector('.tabs');
            const debugTabId = 'debug-settings';
            if (tabsBar && !dom.settingsModal.querySelector(`#${debugTabId}`)) {
                // create tab button
                const debugBtn = document.createElement('button');
                debugBtn.className = 'tab-button';
                debugBtn.id = 'debug-tab';
                debugBtn.dataset.tab = debugTabId;
                debugBtn.setAttribute('role', 'tab');
                debugBtn.setAttribute('aria-controls', debugTabId);
                debugBtn.setAttribute('aria-selected', 'false');
                debugBtn.textContent = 'Debug';
                tabsBar.appendChild(debugBtn);

                // create panel container
                const debugPanel = document.createElement('div');
                debugPanel.id = debugTabId;
                debugPanel.className = 'tab-panel';
                debugPanel.setAttribute('role', 'tabpanel');
                debugPanel.setAttribute('aria-labelledby', 'debug-tab');
                // place after existing panels
                const panelsContainer = dom.settingsModal.querySelectorAll('.tab-panel');
                if (panelsContainer.length > 0) panelsContainer[panelsContainer.length - 1].after(debugPanel);
                else dom.settingsModal.appendChild(debugPanel);
            }

            let debugPanelEl = dom.settingsModal.querySelector('#debug-settings');
            if (!debugPanelEl) debugPanelEl = dom.settingsModal.querySelector('.logging-panel') || document.createElement('div');

            // create logging panel inside debug panel
            let loggingPanelImmediate = debugPanelEl.querySelector('.logging-panel');
            if (!loggingPanelImmediate) {
                loggingPanelImmediate = document.createElement('div');
                loggingPanelImmediate.className = 'logging-panel';
                loggingPanelImmediate.style.padding = '8px';
                debugPanelEl.appendChild(loggingPanelImmediate);
            }
            import('./lib/ui/ui-helpers.js').then(mod => {
                try {
                    mod.renderLoggingControls(loggingPanelImmediate);
                    let speechPanelImmediate = loggingPanelImmediate.querySelector('.speech-panel');
                    if (!speechPanelImmediate) {
                        speechPanelImmediate = document.createElement('div');
                        speechPanelImmediate.className = 'speech-panel';
                        speechPanelImmediate.style.paddingTop = '8px';
                        loggingPanelImmediate.appendChild(speechPanelImmediate);
                    }
                    mod.renderSpeechPanel(speechPanelImmediate);
                } catch (e) { /* ignore */ }
            }).catch(() => { /* ignore */ });
        } catch (e) { /* ignore */ }
        return true;
    }, () => {
        // If we are closing the settings and cards are loaded but none is shown, show the first card.
        if (state.cardData.length > 0 && state.currentCardIndex === -1) {
            showNextCard();
        }
    });
    // Inject logging controls into settings modal
    if (dom.settingsModal) {
        let loggingPanel = dom.settingsModal.querySelector('.logging-panel');
        if (!loggingPanel) {
            loggingPanel = document.createElement('div');
            loggingPanel.className = 'logging-panel';
            loggingPanel.style.padding = '8px';
            dom.settingsModal.appendChild(loggingPanel);
        }
        // Render controls when settings modal opens
        dom.settingsModal.addEventListener('transitionend', () => {
            if (!dom.settingsModal.classList.contains('hidden')) {
                // lazy load to avoid DOM issues in tests
                import('./lib/ui/ui-helpers.js').then(mod => {
                            mod.renderLoggingControls(loggingPanel);
                            // Also render a speech testing panel below logging controls
                            const speechPanel = document.createElement('div');
                            speechPanel.className = 'speech-panel';
                            speechPanel.style.paddingTop = '8px';
                            loggingPanel.appendChild(speechPanel);
                            mod.renderSpeechPanel(speechPanel);
                }).catch(() => {});
            }
        });
    }
    setupModal(dom.historyButton, dom.historyModal, dom.closeHistoryButton, () => {
        if (state.cardData.length === 0) {
            showTopNotification('No deck loaded. Please load a deck to view history.', 'error');
            return false;
        }
        renderHistoryTable();
        return true;
    });
    setupModal(dom.helpButton, dom.helpModal, dom.closeHelpButton);
    setupModal(dom.dashboardButton, dom.dashboardModal, dom.closeDashboardButton, () => {
        if (state.cardData.length === 0) {
            showTopNotification('No deck loaded. Please load a deck to view the dashboard.', 'error');
            return false;
        }
        renderDashboard();
        return true;
    });
    setupModal(dom.loginButton, dom.loginModal, dom.closeLoginModalButton);

    if (dom.mobileSettingsButton) dom.mobileSettingsButton.addEventListener('click', () => {
        dom.mobileMenuOverlay.classList.add('hidden');
        dom.settingsModal.classList.remove('hidden');
    });
    if (dom.mobileHistoryButton) {
        dom.mobileHistoryButton.addEventListener('click', () => {
            dom.mobileMenuOverlay.classList.add('hidden');
            renderHistoryTable();
        });
    }
    if (dom.mobileHelpButton) dom.mobileHelpButton.addEventListener('click', () => {
        dom.mobileMenuOverlay.classList.add('hidden');
        dom.helpModal.classList.remove('hidden');
    });
    if (dom.mobileDashboardButton) {
        dom.mobileDashboardButton.addEventListener('click', () => {
            dom.mobileMenuOverlay.classList.add('hidden');
            renderDashboard();
        });
    }

    if (dom.logoutButton) {
        dom.logoutButton.addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            updateState({ isAuthenticated: false });
            window.location.reload();
        });
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else if (document.exitFullscreen) document.exitFullscreen();
    }
    if (dom.fullscreenButton) dom.fullscreenButton.addEventListener('click', toggleFullscreen);
    if (dom.mobileFullscreenButton) dom.mobileFullscreenButton.addEventListener('click', () => {
        dom.mobileMenuOverlay.classList.add('hidden');
        toggleFullscreen();
    });


    // --- Core Action Event Listeners ---
    if (dom.loadDataButton) dom.loadDataButton.addEventListener('click', async () => {
        const isFirstRun = Object.keys(state.configs).length === 0;
        await loadData();
        // On a subsequent run (not the first), loading data should immediately show a card.
        // On the first run, the user must complete the setup, and the modal's
        // onCloseCallback will handle showing the first card.
        if (!isFirstRun && state.cardData.length > 0) {
            showNextCard();
        }
    });
    if (dom.saveConfigButton) dom.saveConfigButton.addEventListener('click', saveConfig);
    if (dom.resetStatsButton) dom.resetStatsButton.addEventListener('click', resetDeckStats);
    if (dom.configSelector) dom.configSelector.addEventListener('change', () => loadSelectedConfig(dom.configSelector.value));
    if (dom.flipCardButton) dom.flipCardButton.addEventListener('click', flipCard);
    if (dom.nextCardButton) dom.nextCardButton.addEventListener('click', () => showNextCard());
    if (dom.prevCardButton) dom.prevCardButton.addEventListener('click', showPrevCard);
    if (dom.iKnowButton) dom.iKnowButton.addEventListener('click', async () => { await markCardAsKnown(true); await showNextCard(); });
    if (dom.iDontKnowButton) dom.iDontKnowButton.addEventListener('click', handleIDontKnow);

    // --- Settings Event Listeners ---
    if (dom.fontSelector) dom.fontSelector.addEventListener('change', () => {
        if (dom.cardContainer) dom.cardContainer.style.fontFamily = dom.fontSelector.value;
    });
    if (dom.disableAnimationCheckbox) dom.disableAnimationCheckbox.addEventListener('change', () => {
        if (dom.card) dom.card.classList.toggle('no-animation', dom.disableAnimationCheckbox.checked);
    });

    function handleSettingsChange() {
        clearTimeout(window.saveConfigTimeout);
        window.saveConfigTimeout = setTimeout(async () => {
            const success = await saveCurrentConfig();
            if (success) {
                console.log(`Auto-saved config '${dom.configSelector.value}'`);
                const configName = dom.configSelector.value;
                const configData = { configs: { [configName]: state.configs[configName] } };
                await syncToServer(configData);
            }
        }, 500);
    }
    if (dom.settingsModal) {
        dom.settingsModal.addEventListener('input', handleSettingsChange);
        dom.settingsModal.addEventListener('change', handleSettingsChange);
    }


    // --- Skill Management Event Listeners ---
    if (dom.addSkillButton) dom.addSkillButton.addEventListener('click', () => openSkillDialog());
    if (dom.presetSkillsButton) dom.presetSkillsButton.addEventListener('click', createPresetSkills);
    if (dom.exportSkillsButton) dom.exportSkillsButton.addEventListener('click', exportSkills);
    if (dom.exportAllDataButton) dom.exportAllDataButton.addEventListener('click', exportAllData);
    if (dom.exportSqliteButton) dom.exportSqliteButton.addEventListener('click', exportSQLite);
    if (dom.importAllDataButton) dom.importAllDataButton.addEventListener('click', () => dom.importFileInput.click());
    if (dom.importFileInput) dom.importFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) importAllData(e.target.files[0]);
    });
    if (dom.deleteAllSkillsButton) dom.deleteAllSkillsButton.addEventListener('click', deleteAllSkills);

    if (dom.skillsList) {
        dom.skillsList.addEventListener('click', (e) => {
            const skillId = e.target.closest('.skill-item')?.dataset.skillId;
            if (!skillId) return;
            if (e.target.matches('.edit-skill-button')) openSkillDialog(skillId);
            if (e.target.matches('.delete-skill-button')) deleteSkill(skillId);
        });
        Sortable.create(dom.skillsList, {
            animation: 150,
            onEnd: function (evt) {
                const currentConfig = state.configs[dom.configSelector.value];
                if (!currentConfig || !currentConfig.skills) return;
                const movedSkill = currentConfig.skills.splice(evt.oldIndex, 1)[0];
                if (movedSkill) currentConfig.skills.splice(evt.newIndex, 0, movedSkill);
                handleSettingsChange();
                populateAllSkillSelectors();
            }
        });
    }

    if (dom.closeSkillConfigButton) dom.closeSkillConfigButton.addEventListener('click', () => dom.skillConfigModal.classList.add('hidden'));
    if (dom.skillVerificationMethod) dom.skillVerificationMethod.addEventListener('change', (e) => {
        dom.skillValidationColumn.disabled = e.target.value === 'none';
    });
    if (dom.saveSkillButton) dom.saveSkillButton.addEventListener('click', saveSkill);

    // --- Transform Modal Event Listeners ---
    if (dom.closeTransformButton) dom.closeTransformButton.addEventListener('click', () => dom.textTransformModal.classList.add('hidden'));
    if (dom.saveTransformButton) dom.saveTransformButton.addEventListener('click', saveTransform);
    if (dom.transformHideString) dom.transformHideString.addEventListener('change', (e) => {
        if (dom.transformHideStringColumn) dom.transformHideStringColumn.disabled = !e.target.checked;
    });


    // --- Skill Selection Syncing ---
    function syncCheckboxes(source, destination) {
        const sourceCheckboxes = source.querySelectorAll('input[type="checkbox"]');
        const destCheckboxes = destination.querySelectorAll('input[type="checkbox"]');
        const destMap = new Map(Array.from(destCheckboxes).map(cb => [cb.value, cb]));
        sourceCheckboxes.forEach(sourceCb => {
            const destCb = destMap.get(sourceCb.value);
            if (destCb && destCb.checked !== sourceCb.checked) destCb.checked = sourceCb.checked;
        });
    }

    function updateToggleAllState(container) {
        if (!container) return;
        const toggleAll = container.querySelector('input[name="toggle-all-skills"]');
        if (!toggleAll) return;

        const skillCheckboxes = container.querySelectorAll('input[type="checkbox"]:not([name="toggle-all-skills"])');
        if (skillCheckboxes.length > 0) {
            const allChecked = Array.from(skillCheckboxes).every(cb => cb.checked);
            toggleAll.checked = allChecked;
        }
    }

    async function handleSkillSelectionChange(e) {
        if (e.target.matches('input[type="checkbox"]')) {
            const isToggleAll = e.target.name === 'toggle-all-skills';
            const container = e.currentTarget;

            if (isToggleAll) {
                const isChecked = e.target.checked;
                container.querySelectorAll('input[type="checkbox"]:not([name="toggle-all-skills"])').forEach(cb => {
                    cb.checked = isChecked;
                });
            }

            if (e.currentTarget === dom.mobileSkillSelectorCheckboxes) {
                syncCheckboxes(dom.mobileSkillSelectorCheckboxes, dom.skillSelectorCheckboxes);
            } else {
                syncCheckboxes(dom.skillSelectorCheckboxes, dom.mobileSkillSelectorCheckboxes);
            }

            // Update toggle-all state in both containers after any change
            updateToggleAllState(dom.skillSelectorCheckboxes);
            updateToggleAllState(dom.mobileSkillSelectorCheckboxes);

            await saveCurrentConfig();
            if (state.cardData.length > 0 && state.currentCardIndex < state.cardData.length) {
                const cardKey = getCardKey(state.cardData[state.currentCardIndex]);
                const stats = await getSanitizedStats(cardKey);
                renderSkillMastery(stats);
            }
            showNextCard();
        }
    }
    if (dom.skillSelectorCheckboxes) dom.skillSelectorCheckboxes.addEventListener('change', handleSkillSelectionChange);
    if (dom.mobileSkillSelectorCheckboxes) dom.mobileSkillSelectorCheckboxes.addEventListener('change', handleSkillSelectionChange);


    // --- Verification Method Listeners ---
    if (dom.writingSubmit) dom.writingSubmit.addEventListener('click', checkWritingAnswer);
    if (dom.writingInput) dom.writingInput.addEventListener('keydown', (e) => { if (e.code === 'Enter') checkWritingAnswer(); });
    if (dom.voiceInputButton) dom.voiceInputButton.addEventListener('click', toggleVoiceRecognition);


    // --- Filter Listeners ---
    function openFilterSettings() {
        dom.settingsModal.classList.remove('hidden');
        document.getElementById('filter-tab')?.click();
    }
    if (dom.filterStatusIndicator) dom.filterStatusIndicator.addEventListener('click', openFilterSettings);
    if (dom.mobileFilterStatusIndicator) dom.mobileFilterStatusIndicator.addEventListener('click', openFilterSettings);

    function toggleFilter() {
        const currentConfig = state.configs[dom.configSelector.value];
        if (!currentConfig) return;
        setFilterEnabled(!currentConfig.filterIsEnabled);
        saveCurrentConfig();
        showNextCard();
    }
    if (dom.filterToggleButton) dom.filterToggleButton.addEventListener('click', toggleFilter);
    if (dom.mobileFilterToggleButton) dom.mobileFilterToggleButton.addEventListener('click', toggleFilter);

    async function handleSettingsFilterToggle(event) {
        setFilterEnabled(event.target.checked);
        await saveCurrentConfig();
        showNextCard();
    }
    if (dom.enableFilterSettingsCheckbox) dom.enableFilterSettingsCheckbox.addEventListener('change', handleSettingsFilterToggle);

    if (dom.applyFilterButton) dom.applyFilterButton.addEventListener('click', applyFilter);
    if (dom.clearFilterButton) dom.clearFilterButton.addEventListener('click', clearFilter);
    if (dom.filterTextarea) {
        dom.filterTextarea.addEventListener('input', updateFilterHighlights);
        dom.filterTextarea.addEventListener('scroll', () => {
            if (dom.filterHighlightLayer) {
                dom.filterHighlightLayer.scrollTop = dom.filterTextarea.scrollTop;
                dom.filterHighlightLayer.scrollLeft = dom.filterTextarea.scrollLeft;
            }
        });
    }

    // --- Hotkeys and Gestures ---
    document.addEventListener('keydown', handleHotkeys);
    document.addEventListener('keyup', handleHotkeys);
    if (dom.card) {
        dom.card.addEventListener('mousedown', dragStart);
        dom.card.addEventListener('touchstart', dragStart, { passive: false });
        dom.card.addEventListener('mousemove', dragMove);
        dom.card.addEventListener('touchmove', dragMove, { passive: false });
        dom.card.addEventListener('mouseup', dragEnd);
        dom.card.addEventListener('touchend', dragEnd);
        dom.card.addEventListener('mouseleave', dragEnd);
    }
    if (dom.slowReplayButton) dom.slowReplayButton.addEventListener('click', handleSlowReplay);
    if (dom.slowReplayHotkey) dom.slowReplayHotkey.addEventListener('click', handleSlowReplay);

    // --- Global Functions that need access to module internals ---
    function updateCacheStatus(response) {
        if (!dom.cacheStatus) return;
        const date = response.headers.get('date');
        const timestamp = date ? new Date(date).toLocaleString() : 'N/A';
        const isFromCache = response.headers.get('X-From-Cache') === 'true';
        dom.cacheStatus.textContent = isFromCache ? `Offline. Data from: ${timestamp}` : `Live data. Updated: ${timestamp}`;
        dom.cacheStatus.classList.toggle('cached', isFromCache);
    }

    async function loadData() {
        const url = dom.dataUrlInput.value;
        if (!url) return;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const cache = await caches.open('flashcards-cache-v1');
                const cachedResponse = await cache.match(url);
                if (cachedResponse) {
                    await parseData(await cachedResponse.text());
                    updateCacheStatus(cachedResponse);
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } else {
                await parseData(await response.text());
                updateCacheStatus(response);
            }
            // Only hide settings modal if a configuration already exists.
            // On first run, the user needs to configure the columns.
            if (Object.keys(state.configs).length > 0) {
                if (dom.settingsModal) dom.settingsModal.classList.add('hidden');
            }
            document.body.classList.add('debug-data-loaded');
        } catch (error) {
            showTopNotification(`Failed to load data: ${error.message}.`, 'error');
        }
    }

    async function parseData(text) {
        const cleanCell = (cell) => cell.replace(/[\r\n\s]+/g, ' ').trim();
        const rows = text.trim().split('\n').filter(row => row.trim() !== '');
        if (rows.length < 1) {
            updateState({ cardData: [], headers: [] });
            return;
        }
        const delimiter = rows[0].includes('\t') ? '\t' : ',';
        const newHeaders = rows[0].split(delimiter).map(cleanCell);
        const newCardData = rows.slice(1).map(row => row.split(delimiter).map(cleanCell)).filter(row => row.length === newHeaders.length);
        updateState({ cardData: newCardData, headers: newHeaders, viewHistory: [] });
        await updateColumnLanguages();
        if (dom.repetitionIntervalsTextarea) dom.repetitionIntervalsTextarea.value = state.repetitionIntervals.join(', ');
    }

    async function updateColumnLanguages() {
        const newColumnLanguages = await detectColumnLanguages(state.cardData, state.headers);
        updateState({ columnLanguages: newColumnLanguages });
        populateColumnRolesUI();
    }

    function populateColumnRolesUI() {
        if (!dom.columnRolesContainer) return;
        dom.columnRolesContainer.innerHTML = '';
        const title = document.createElement('label');
        title.textContent = 'Column Roles:';
        dom.columnRolesContainer.appendChild(title);
        const rolesGrid = document.createElement('div');
        rolesGrid.style.display = 'grid';
        rolesGrid.style.gridTemplateColumns = 'auto 1fr';
        rolesGrid.style.gap = '5px 10px';
        rolesGrid.style.alignItems = 'center';
        state.headers.forEach((header, index) => {
            const label = document.createElement('label');
            label.textContent = header;
            label.htmlFor = `column-role-${index}`;
            const lang = state.columnLanguages[index];
            if (lang && lang !== 'N/A') {
                const langSpan = document.createElement('span');
                langSpan.textContent = ` (${lang})`;
                langSpan.className = 'lang-hint';
                label.appendChild(langSpan);
            }
            const select = document.createElement('select');
            select.id = `column-role-${index}`;
            select.dataset.columnIndex = index;
            for (const roleKey in COLUMN_ROLES) {
                select.add(new Option(COLUMN_ROLES[roleKey], roleKey));
            }
            rolesGrid.appendChild(label);
            rolesGrid.appendChild(select);
        });
        dom.columnRolesContainer.appendChild(rolesGrid);
    }

    function getLanguageForRole(roleKey) {
        if (!roleKey) return 'en';
        const currentConfig = state.configs[dom.configSelector.value];
        const roleToColumnMap = currentConfig ? currentConfig.roleToColumnMap : null;
        if (!roleToColumnMap) return 'en';
        const indices = roleToColumnMap[roleKey];
        if (!indices || indices.length === 0) return 'en';
        return state.columnLanguages[indices[0]] || 'en';
    }

    function getLanguageForTts(ttsRole) {
        if (ttsRole === 'BASE_LANGUAGE' && state.currentRandomBaseIndex !== -1) {
            return state.columnLanguages[state.currentRandomBaseIndex] || 'en';
        }
        return getLanguageForRole(ttsRole);
    }

    function speak(text, { rate, ttsRole, onEndCallback } = {}) {
        if (!('speechSynthesis' in window) || !text) {
            if (onEndCallback) onEndCallback();
            return;
        }

        // Create pauses for hidden strings by replacing block characters with commas.
        const textWithPauses = text.replace(/█+/g, match => ','.repeat(match.length));
        const sanitizedText = textWithPauses.replace(/\(.*?\)/g, '').trim();

        if (!sanitizedText) {
            if (onEndCallback) onEndCallback();
            return;
        }
        const utterance = new SpeechSynthesisUtterance(sanitizedText);
        if (onEndCallback) utterance.onend = onEndCallback;

        const finalLang = getLanguageForTts(ttsRole);
        const displayer = dom.card.classList.contains('flipped') ? dom.ttsLangDisplayBack : dom.ttsLangDisplayFront;
        if (displayer) {
            if (dom.card.classList.contains('flipped')) dom.ttsLangDisplayBack.textContent = '';
            else {
                dom.ttsLangDisplayFront.textContent = '';
                dom.ttsLangDisplayBack.textContent = '';
            }
            displayer.textContent = `🔊 ${finalLang}`;
        }

        let voice = state.voices.find(v => v.lang === finalLang) || state.voices.find(v => v.lang.startsWith(finalLang)) || state.voices.find(v => v.default);
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        }
        let finalRate = rate || (ttsRole === 'BASE_LANGUAGE' ? dom.ttsRateBaseSlider.value : dom.ttsRateSlider.value) || 1;
        utterance.rate = finalRate;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    async function handleIDontKnow() {
        await markCardAsKnown(false);

        const skillConfig = getCurrentSkillConfig();
        if (skillConfig && skillConfig.verificationMethod === 'voice') {
            stopVoiceRecognition();
        }

        await showNextCard({ forceNew: true });
    }

    async function handleSlowReplay() {
        if (state.recognitionActive) stopVoiceRecognition();
        const skillConfig = getCurrentSkillConfig();
        const onEndCallback = () => {
            const currentSkillConfig = getCurrentSkillConfig();
            if (currentSkillConfig && currentSkillConfig.verificationMethod === 'voice' && !dom.card.classList.contains('flipped')) {
                startVoiceRecognition();
            }
        };
        if (skillConfig && skillConfig.ttsFrontColumn) {
            const ttsFrontRole = skillConfig.ttsFrontColumn;
            const textParts = await getTextForRoles([ttsFrontRole], 'front');
            const ttsText = textParts.map(p => p.text).join(' ');
            if (ttsText) speak(ttsText, { rate: 0.7, ttsRole: ttsFrontRole, onEndCallback });
            else onEndCallback();
        } else {
            onEndCallback();
        }
    }

    function setFilterEnabled(isEnabled) {
        const currentConfig = state.configs[dom.configSelector.value];
        if (currentConfig) currentConfig.filterIsEnabled = isEnabled;
        if (dom.filterToggleButton) dom.filterToggleButton.classList.toggle('active', isEnabled);
        if (dom.mobileFilterToggleButton) dom.mobileFilterToggleButton.classList.toggle('active', isEnabled);
        if (dom.enableFilterSettingsCheckbox) dom.enableFilterSettingsCheckbox.checked = isEnabled;
    }

    function updateFilterState(filterState) {
        [dom.filterStatusIndicator, dom.mobileFilterStatusIndicator].forEach(indicator => {
            if (!indicator) return;
            indicator.className = 'filter-status';
            if (filterState === 'learning' || filterState === 'learned') {
                indicator.classList.add(filterState);
            }
        });
    }

    function getDeckWords(cardData, roleToColumnMap) {
        const words = new Set();
        if (!roleToColumnMap || !roleToColumnMap.TARGET_LANGUAGE) return words;
        const targetLangIndex = roleToColumnMap.TARGET_LANGUAGE[0];
        if (targetLangIndex === undefined) return words;
        cardData.forEach(card => {
            const text = card[targetLangIndex];
            if (text) {
                const cardWords = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
                cardWords.forEach(word => words.add(word));
            }
        });
        return words;
    }

    function getHighlightHTML(text, intersection) {
        const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const regex = new RegExp(`\\b(${[...intersection].join('|')})\\b`, 'gi');
        return escapedText.replace(regex, '<mark>$1</mark>');
    }

    function updateFilterHighlights() {
        if (!dom.filterTextarea || !dom.filterHighlightLayer || !dom.filterIntersectionInfo) return;
        const text = dom.filterTextarea.value;
        if (!text.trim()) {
            dom.filterHighlightLayer.innerHTML = '';
            dom.filterIntersectionInfo.textContent = 'Enter text to see matching words.';
            return;
        }
        const currentConfig = state.configs[dom.configSelector.value] || {};
        const deckWords = getDeckWords(state.cardData, currentConfig.roleToColumnMap);
        if (deckWords.size === 0) {
            dom.filterHighlightLayer.innerHTML = '';
            dom.filterIntersectionInfo.textContent = 'Load a deck to see matching words.';
            return;
        }
        const filterWords = new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
        const intersection = new Set([...deckWords].filter(word => filterWords.has(word)));
        dom.filterHighlightLayer.innerHTML = getHighlightHTML(text, intersection);
        dom.filterIntersectionInfo.textContent = `Found ${intersection.size} matching words in the deck.`;
    }

    async function applyFilter() {
        const text = dom.filterTextarea.value;
        if (!text) {
            await clearFilter();
            return;
        }
        if (state.cardData.length === 0) {
            showTopNotification('No deck is loaded. Please load a deck first.', 'error');
            return;
        }
        const words = new Set((text.match(/[\p{L}\p{N}]+/gu) || []).map(w => w.toLowerCase()));
        updateState({ activeFilterWords: words });
        setFilterEnabled(true);
        updateFilterState('learning');
        await saveCurrentConfig();
        showTopNotification(`Filter applied and saved. Found ${words.size} unique words.`, 'success');
        updateFilterHighlights();
        showNextCard();
    }

    async function clearFilter() {
        updateState({ activeFilterWords: new Set() });
        setFilterEnabled(false);
        if (dom.filterTextarea) dom.filterTextarea.value = '';
        updateFilterState('off');
        await saveCurrentConfig();
        showTopNotification('Filter cleared and saved.', 'success');
        updateFilterHighlights();
        showNextCard();
    }

    function handleHotkeys(e) {
        try { logger.log('ui', 'hotkey.event', { type: e.type, code: e.code, target: e.target?.tagName }); } catch (err) { /* ignore */ }
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            if (e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Enter' && dom.writingPracticeContainer.classList.contains('hidden')) return;
            if (e.code !== 'Enter') return;
        }
        const isMultipleChoiceActive = !dom.multipleChoiceContainer.classList.contains('hidden') && !dom.multipleChoiceContainer.classList.contains('answered');
        if (e.code.startsWith('Digit')) {
            if (isMultipleChoiceActive) {
                e.preventDefault();
                const choiceIndex = parseInt(e.code.replace('Digit', ''), 10) - 1;
                const buttons = dom.multipleChoiceContainer.querySelectorAll('button');
                if (choiceIndex >= 0 && choiceIndex < buttons.length) buttons[choiceIndex].click();
            }
            return;
        }
        switch (e.type) {
            case 'keydown':
                switch (e.code) {
                    case 'Enter': { if (!dom.nextCardButton.classList.contains('hidden')) showNextCard(); break; }
                    case 'Space': { e.preventDefault(); if (dom.card && !dom.card.classList.contains('flipped')) flipCard(); break; }
                    case 'ArrowRight': { showNextCard(); break; }
                    case 'ArrowLeft': { showPrevCard(); break; }
                    case 'KeyK': { markCardAsKnown(true); showNextCard(); break; }
                    case 'KeyJ': { handleIDontKnow(); break; }
                    case 'KeyF': {
                        const skillConfig = getCurrentSkillConfig();
                        if (!skillConfig) break;
                        const parts = dom.card.classList.contains('flipped') ? state.ttsBackParts : state.ttsFrontParts;
                        const text = parts.map(p => p.text).join(' ');
                        const role = dom.card.classList.contains('flipped') ? skillConfig.ttsBackColumn : skillConfig.ttsFrontColumn;
                        updateState({ replayRate: Math.max(0.1, state.replayRate - 0.2) });
                        speak(text, { rate: state.replayRate, ttsRole: role });
                        break;
                    }
                }
                break;
            case 'keyup':
                if (e.code === 'Space') {
                    e.preventDefault();
                    if (dom.card && dom.card.classList.contains('flipped')) flipCard();
                }
                break;
        }
    }

    function dragStart(e) {
        if (e.target.closest('button')) return;
        updateState({ isDragging: true, startX: e.pageX || e.touches[0].pageX, startY: e.pageY || e.touches[0].pageY });
        updateState({ currentX: state.startX, currentY: state.startY });
        dom.card.style.transition = 'none';
    }

    function dragMove(e) {
        if (!state.isDragging) return;
        e.preventDefault();
        updateState({ currentX: e.pageX || e.touches[0].pageX, currentY: e.pageY || e.touches[0].pageY });
        const diffX = state.currentX - state.startX;
        const diffY = state.currentY - state.startY;
        dom.card.style.transform = `translate(${diffX}px, ${diffY}px) rotate(${diffX / 20}deg)`;
    }

    function dragEnd() {
        if (!state.isDragging) return;
        updateState({ isDragging: false });
        const diffX = state.currentX - state.startX;
        const diffY = state.currentY - state.startY;
        dom.card.style.transition = 'transform 0.3s ease';
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > state.dragThreshold) {
                dom.card.classList.add(diffX > 0 ? 'swipe-right' : 'swipe-left');
                setTimeout(() => {
                    if (diffX > 0) { markCardAsKnown(true); showNextCard(); }
                    else { markCardAsKnown(false); showNextCard({ forceNew: true }); }
                    dom.card.style.transform = '';
                    dom.card.classList.remove('swipe-right', 'swipe-left');
                }, 300);
            } else {
                dom.card.style.transform = '';
            }
        } else {
            if (Math.abs(diffY) > state.verticalDragThreshold) flipCard();
            dom.card.style.transform = '';
        }
    }

    async function renderDashboard() {
        if (state.cardData.length === 0) {
            showTopNotification('No deck loaded. Please load a deck to view the dashboard.', 'error');
            return;
        }
        const MASTERED_THRESHOLD = 5;
        const allCardStats = await getAllCardStats();
        if (allCardStats.length === 0) return;

        const keyIndex = (state.configs[dom.configSelector.value]?.roleToColumnMap?.TARGET_LANGUAGE || [])[0];
        if (keyIndex === undefined) {
            showTopNotification('Cannot generate report: Target Language column not set.', 'error'); return;
        }

        const computedStats = allCardStats.map((cardStats, index) => {
            const cardKey = getCardKey(state.cardData[index]);
            let totalCardScore = 0, totalCardViews = 0;
            const skillIds = Object.keys(cardStats.skills);
            if (skillIds.length > 0) {
                skillIds.forEach(skillId => {
                    const skill = cardStats.skills[skillId];
                    totalCardScore += getRetentionScore(skill);
                    totalCardViews += skill.viewCount || 0;
                });
            }
            return { cardKey, cardStats, avgCardScore: skillIds.length > 0 ? totalCardScore / skillIds.length : 0, totalCardViews };
        });

        const masteredWords = computedStats.filter(s => s.avgCardScore > MASTERED_THRESHOLD).map(s => ({ word: s.cardKey, score: s.avgCardScore.toFixed(1), views: s.totalCardViews }));
        const difficultWords = computedStats.filter(s => s.totalCardViews > 0 && s.avgCardScore < 0).map(s => ({ word: s.cardKey, score: s.avgCardScore.toFixed(1), views: s.totalCardViews }));

        const populateList = (listElement, words, sortFn) => {
            listElement.innerHTML = words.length === 0 ? '<li>None yet.</li>' : words.sort(sortFn).map(item => `<li>${item.word} (Score: ${item.score}, Views: ${item.views})</li>`).join('');
        };
        populateList(dom.masteredWordsList, masteredWords, (a, b) => b.score - a.score);
        populateList(dom.difficultWordsList, difficultWords, (a, b) => a.score - b.score);

        dom.dashboardModal.classList.remove('hidden');
    }

    async function renderHistoryTable() {
        if (!dom.historyTableContainer) return;
        let tableHTML = '<table><thead><tr>';
        state.headers.forEach((header, index) => {
            tableHTML += `<th class="sortable" data-column-index="${index}">${header}</th>`;
        });
        tableHTML += `<th class="sortable" data-column-index="${state.headers.length}">Mastery</th>`;
        tableHTML += `<th class="sortable" data-column-index="${state.headers.length + 1}">Views</th>`;
        tableHTML += `<th class="sortable" data-column-index="${state.headers.length + 2}">Last Seen</th>`;
        tableHTML += `<th class="sortable" data-column-index="${state.headers.length + 3}">Next Due</th>`;
        tableHTML += '</tr></thead>';
        const allCardStats = await getAllCardStats();
        const combinedData = state.cardData.map((card, index) => ({ card, stats: allCardStats[index] }));
        tableHTML += buildHistoryTbodyHtml(combinedData);
        tableHTML += '</table>';
        dom.historyTableContainer.innerHTML = tableHTML;
        dom.historyTableContainer.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', sortHistoryTable));
        dom.historyModal.classList.remove('hidden');
    }

    function buildHistoryTbodyHtml(data) {
        let tbodyHtml = '<tbody>';
        const now = Date.now();
        const userSkills = (state.configs[dom.configSelector.value] || {}).skills || [];
        data.forEach(item => {
            tbodyHtml += `<tr>${item.card.map(cell => `<td>${cell}</td>`).join('')}`;
            const masteryHtml = userSkills.map((skill, index) => {
                const skillStats = item.stats.skills[skill.id] || createDefaultSkillStats();
                const score = getRetentionScore(skillStats);
                return `<span title="${skill.name}: ${score}">${String.fromCharCode(65 + index)}:${score}</span>`;
            }).join(' ');
            tbodyHtml += `<td>${masteryHtml}</td>`;
            let totalViews = 0, lastSeen = 0;
            Object.values(item.stats.skills).forEach(s => {
                totalViews += s.viewCount;
                if (s.lastViewed > lastSeen) lastSeen = s.lastViewed;
            });
            tbodyHtml += `<td>${totalViews}</td><td>${formatTimeAgo(lastSeen)}</td>`;
            const dueTimesMs = Object.values(item.stats.skills).map(s => getTimeToDue(s, now).ms);
            const validDueTimes = dueTimesMs.filter(ms => ms !== -1);
            let nextDueFormatted = 'N/A';
            if (validDueTimes.length > 0) {
                if (validDueTimes.some(ms => ms <= 0)) nextDueFormatted = 'Now';
                else {
                    const nextDueTime = Math.min(...validDueTimes);
                    nextDueFormatted = nextDueTime === Infinity ? 'Learned' : formatTimeDifference(nextDueTime);
                }
            }
            tbodyHtml += `<td>${nextDueFormatted}</td></tr>`;
        });
        return tbodyHtml + '</tbody>';
    }

    async function sortHistoryTable(e) {
        const th = e.currentTarget;
        const columnIndex = parseInt(th.dataset.columnIndex);
        const now = Date.now();
        if (state.historySortColumn === columnIndex) {
            updateState({ historySortDirection: state.historySortDirection === 'asc' ? 'desc' : 'asc' });
        } else {
            updateState({ historySortColumn: columnIndex, historySortDirection: 'asc' });
        }
        const allCardStats = await getAllCardStats();
        const combinedData = state.cardData.map((card, index) => ({ card, stats: allCardStats[index] }));
        combinedData.sort((a, b) => {
            let valA, valB;
            if (columnIndex < state.headers.length) {
                valA = a.card[columnIndex]; valB = b.card[columnIndex];
            } else {
                const statsKeyIndex = columnIndex - state.headers.length;
                const skillsA = Object.values(a.stats.skills);
                const skillsB = Object.values(b.stats.skills);
                if (statsKeyIndex === 0) { // Mastery
                    valA = skillsA.reduce((sum, s) => sum + getRetentionScore(s), 0) / (skillsA.length || 1);
                    valB = skillsB.reduce((sum, s) => sum + getRetentionScore(s), 0) / (skillsB.length || 1);
                } else if (statsKeyIndex === 1) { // View Count
                    valA = skillsA.reduce((sum, s) => sum + s.viewCount, 0);
                    valB = skillsB.reduce((sum, s) => sum + s.viewCount, 0);
                } else if (statsKeyIndex === 2) { // Last Seen
                    valA = Math.max(0, ...skillsA.map(s => s.lastViewed || 0));
                    valB = Math.max(0, ...skillsB.map(s => s.lastViewed || 0));
                } else { // Time to Due
                    const getSortableDueTime = (skills) => {
                        const dueTimesMs = skills.map(s => getTimeToDue(s, now).ms);
                        const validDueTimes = dueTimesMs.filter(ms => ms !== -1);
                        if (validDueTimes.length === 0) return Infinity;
                        if (validDueTimes.some(ms => ms <= 0)) return -1;
                        return Math.min(...validDueTimes);
                    };
                    valA = getSortableDueTime(skillsA);
                    valB = getSortableDueTime(skillsB);
                }
            }
            if (valA < valB) return state.historySortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.historySortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        const newTbodyHtml = buildHistoryTbodyHtml(combinedData);
        const table = dom.historyTableContainer.querySelector('table');
        if (table) {
            table.querySelector('tbody')?.remove();
            table.insertAdjacentHTML('beforeend', newTbodyHtml);
        }
        dom.historyTableContainer.querySelectorAll('th.sortable').forEach(th => {
            th.classList.remove('asc', 'desc');
            if (parseInt(th.dataset.columnIndex) === state.historySortColumn) {
                th.classList.add(state.historySortDirection);
            }
        });
    }


    // --- Initial Load ---
    function loadVoices() {
        if (!('speechSynthesis' in window)) return;
        const setVoices = () => updateState({ voices: speechSynthesis.getVoices() });
        setVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = setVoices;
        }
    }

    loadVoices();
    populateAllSkillSelectors();
    loadInitialConfigs().then(() => {
        checkAuthStatus();
    });

    // Re-initialize verification now that dependent functions (getCurrentSkillConfig, getLanguageForRole, etc.) are defined
    try {
        dependencies.getCurrentSkillConfig = getCurrentSkillConfig;
        dependencies.getLanguageForRole = getLanguageForRole;
        dependencies.markCardAsKnown = markCardAsKnown;
        dependencies.flipCard = flipCard;
        dependencies.showNextCard = showNextCard;
        initVerification(dependencies);
    } catch (e) {
        // swallow - best-effort rewire
        console.warn('Failed to re-init verification with updated dependencies', e);
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('ServiceWorker registration successful with scope: ', reg.scope))
                .catch(err => console.log('ServiceWorker registration failed: ', err));
        });
    }
}

// --- Initialize The App ---
initializeApp();