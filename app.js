/* global Sortable */

import { get, set, del, keys } from './lib/idb-keyval-wrapper.js';
import { checkAuthStatus, syncFromServer, syncToServer } from './lib/auth.js';
import { displayCard, flipCard, getTimeToDue, adjustFontSize } from './lib/card-display.js';
import { showNextCard, showPrevCard, getCardKey, markCardAsKnown, findNextCardFromList } from './lib/card-logic.js';
import { getLenientString, transformSlashText, stripParentheses } from './lib/string-utils.js';
import { Skill, createSkillId, createSkill, VERIFICATION_METHODS } from './lib/skill-utils.js';
import { getDeckWords, getHighlightHTML } from './lib/filter-utils.js';
import { detectColumnLanguages } from './lib/detect-column-languages.js';
import { createDatabase } from './lib/db-export.js';
import { TEST_DATA } from './lib/test-data.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    const dom = {
        hamburgerMenu: document.getElementById('hamburger-menu'),
        mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
        closeMobileMenuButton: document.getElementById('close-mobile-menu-button'),
        mobileHistoryButton: document.getElementById('mobile-history-button'),
        mobileSettingsButton: document.getElementById('mobile-settings-button'),
        mobileHelpButton: document.getElementById('mobile-help-button'),
        fullscreenButton: document.getElementById('fullscreen-button'),
        mobileFullscreenButton: document.getElementById('mobile-fullscreen-button'),
        settingsButton: document.getElementById('settings-button'),
        closeSettingsButton: document.getElementById('close-settings-button'),
        settingsModal: document.getElementById('settings-modal'),
        historyButton: document.getElementById('history-button'),
        closeHistoryButton: document.getElementById('close-history-button'),
        historyModal: document.getElementById('history-modal'),
        helpButton: document.getElementById('help-button'),
        closeHelpButton: document.getElementById('close-help-button'),
        helpModal: document.getElementById('help-modal'),
        historyTableContainer: document.getElementById('history-table-container'),
        configTitle: document.getElementById('config-title'),
        loadDataButton: document.getElementById('load-data'),
        saveConfigButton: document.getElementById('save-config'),
        resetStatsButton: document.getElementById('reset-stats'),
        dataUrlInput: document.getElementById('data-url'),
        columnRolesContainer: document.getElementById('column-roles-container'),
        fontSelector: document.getElementById('font-selector'),
        ttsRateSlider: document.getElementById('tts-rate'),
        ttsRateBaseSlider: document.getElementById('tts-rate-base'),
        disableAnimationCheckbox: document.getElementById('disable-animation'),
        audioOnlyFrontCheckbox: document.getElementById('audio-only-front'),
        multipleChoiceCount: document.getElementById('multiple-choice-count'),
        voiceCorrectDelayInput: document.getElementById('voice-correct-delay'),
        configNameInput: document.getElementById('config-name'),
        skillSelectorCheckboxes: document.getElementById('skill-selector-checkboxes'),
        mobileSkillSelectorCheckboxes: document.getElementById('mobile-skill-selector-checkboxes'),
        repetitionIntervalsTextarea: document.getElementById('repetition-intervals'),
        configSelector: document.getElementById('config-selector'),
        cardContainer: document.getElementById('card-container'),
        skillMasteryDashboard: document.getElementById('skill-mastery-dashboard'),
        cardSpecificStats: document.getElementById('card-specific-stats'),
        cardFront: document.querySelector('.card-front'),
        cardFrontContent: document.getElementById('card-front-content'),
        cardBackContent: document.getElementById('card-back-content'),
        flipCardButton: document.getElementById('flip-card'),
        card: document.getElementById('card'),
        nextCardButton: document.getElementById('next-card'),
        prevCardButton: document.getElementById('prev-card'),
        iKnowButton: document.getElementById('i-know'),
        iDontKnowButton: document.getElementById('i-dont-know'),
        explanationMessage: document.getElementById('explanation-message'),
        cacheStatus: document.getElementById('cache-status'),
        applyFilterButton: document.getElementById('apply-filter-button'),
        clearFilterButton: document.getElementById('clear-filter-button'),
        filterTextarea: document.getElementById('filter-text'),
        filterAllowOverflowCheckbox: document.getElementById('filter-allow-overflow'),
        filterToggleButton: document.getElementById('filter-toggle-button'),
        mobileFilterToggleButton: document.getElementById('mobile-filter-toggle-button'),
        enableFilterSettingsCheckbox: document.getElementById('enable-filter-settings-checkbox'),
        filterIntersectionInfo: document.getElementById('filter-intersection-info'),
        filterHighlightLayer: document.getElementById('filter-highlight-layer'),
        filterStatusIndicator: document.getElementById('filter-status-indicator'),
        mobileFilterStatusIndicator: document.getElementById('mobile-filter-status-indicator'),
        writingPracticeContainer: document.getElementById('writing-practice-container'),
        writingInput: document.getElementById('writing-input'),
        writingSubmit: document.getElementById('writing-submit'),
        multipleChoiceContainer: document.getElementById('multiple-choice-container'),
        voiceInputContainer: document.getElementById('voice-input-container'),
        voiceInputButton: document.getElementById('voice-input-button'),
        voiceInputFeedback: document.getElementById('voice-input-feedback'),
        comparisonContainer: document.getElementById('comparison-container'),
        slowReplayButton: document.getElementById('slow-replay-button'),
        slowReplayHotkey: document.getElementById('slow-replay-hotkey'),
        deckTitle: document.getElementById('deck-title'),
        lastSeen: document.getElementById('last-seen'),
        topNotification: document.getElementById('top-notification'),
        ttsLangDisplayFront: document.getElementById('tts-lang-display-front'),
        ttsLangDisplayBack: document.getElementById('tts-lang-display-back'),
        dashboardButton: document.getElementById('dashboard-button'),
        mobileDashboardButton: document.getElementById('mobile-dashboard-button'),
        dashboardModal: document.getElementById('dashboard-modal'),
        closeDashboardButton: document.getElementById('close-dashboard-button'),
        masteredWordsList: document.getElementById('mastered-words-list'),
        difficultWordsList: document.getElementById('difficult-words-list'),
        addSkillButton: document.getElementById('add-skill-button'),
        presetSkillsButton: document.getElementById('preset-skills-button'),
        exportSkillsButton: document.getElementById('export-skills-button'),
        exportAllDataButton: document.getElementById('export-all-data-button'),
        exportSqliteButton: document.getElementById('export-sqlite-button'),
        importAllDataButton: document.getElementById('import-all-data-button'),
        importFileInput: document.getElementById('import-file-input'),
        deleteAllSkillsButton: document.getElementById('delete-all-skills-button'),
        skillsList: document.getElementById('skills-list'),
        closeSkillConfigButton: document.getElementById('close-skill-config-button'),
        skillVerificationMethod: document.getElementById('skill-verification-method'),
        saveSkillButton: document.getElementById('save-skill-button')
    };

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
    const defaultIntervals = [5, 25, 120, 600, 3600, 18000, 86400, 432000, 2160000, 10368000, 63072000];
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const state = {
        isAuthenticated: false,
        cardData: [],
        headers: [],
        currentCardIndex: 0,
        currentSkillId: null,
        configs: {},
        voices: [],
        viewHistory: [],
        currentRandomBaseIndex: -1,
        baseLanguageRotationIndex: 0,
        frontParts: [],
        backParts: [],
        ttsFrontParts: [],
        ttsBackParts: [],
        useUppercase: false,
        replayRate: 1.0,
        cardShownTimestamp: null,
        isCurrentCardDue: false,
        columnLanguages: [],
        activeFilterWords: new Set(),
        recognitionInstance: null,
        recognitionActive: false,
        historySortColumn: -1,
        historySortDirection: 'asc',
        repetitionIntervals: [...defaultIntervals],
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        dragThreshold: 100,
        verticalDragThreshold: 50,
        dom: dom
    };

    const actions = {};

    Object.assign(actions, {
        showTopNotification: (message, type = 'error', duration = 3000) => {
            if (!dom.topNotification) return;
            if (state.notificationTimeout) {
                clearTimeout(state.notificationTimeout);
            }
            dom.topNotification.textContent = message;
            dom.topNotification.className = `visible ${type}`;
            state.notificationTimeout = setTimeout(() => {
                dom.topNotification.className = `hidden ${type}`;
            }, duration);
        },
        updateLayout: () => {
            if (window.matchMedia('(min-width: 769px)').matches) {
                document.body.classList.add('desktop');
            } else {
                document.body.classList.remove('desktop');
            }
        },
        toggleFullscreen: () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        },
        loadData: async () => {
            const url = dom.dataUrlInput.value;
            if (!url) return;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    const cache = await caches.open('flashcards-cache-v1');
                    const cachedResponse = await cache.match(url);
                    if (cachedResponse) {
                        const text = await cachedResponse.text();
                        await actions.parseData(text);
                        actions.updateCacheStatus(cachedResponse);
                    } else {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                } else {
                    const text = await response.text();
                    await actions.parseData(text);
                    actions.updateCacheStatus(response);
                }
                if (dom.settingsModal) dom.settingsModal.classList.add('hidden');
                document.body.classList.add('debug-data-loaded');
            } catch (error) {
                console.error('Failed to load data, trying cache...', error);
                try {
                    const cache = await caches.open('flashcards-cache-v1');
                    const cachedResponse = await cache.match(url);
                    if (cachedResponse) {
                        const text = await cachedResponse.text();
                        await actions.parseData(text);
                        const headers = new Headers(cachedResponse.headers);
                        headers.set('X-From-Cache', 'true');
                        const syntheticResponse = new Response(cachedResponse.body, {
                            status: cachedResponse.status,
                            statusText: cachedResponse.statusText,
                            headers: headers
                        });
                        actions.updateCacheStatus(syntheticResponse);
                        if (dom.settingsModal) dom.settingsModal.classList.add('hidden');
                        document.body.classList.add('debug-data-loaded');
                    } else {
                        const message = `Failed to load data: ${error.message}. No cached data available.`;
                        console.error(message);
                        actions.showTopNotification(message);
                    }
                } catch (cacheError) {
                    const message = `Failed to load data from both network and cache: ${cacheError.message}`;
                    console.error(message);
                    actions.showTopNotification(message);
                }
            }
        },
        parseData: async (text) => {
            const cleanCell = (cell) => cell.replace(/[\r\n\s]+/g, ' ').trim();
            const rows = text.trim().split('\n').filter(row => row.trim() !== '');
            if (rows.length < 1) {
                state.cardData = [];
                state.headers = [];
                return;
            }
            const delimiter = rows[0].includes('\t') ? '\t' : ',';
            state.headers = rows[0].split(delimiter).map(cleanCell);
            state.cardData = rows.slice(1).map(row => row.split(delimiter).map(cleanCell)).filter(row => row.length === state.headers.length);
            state.viewHistory = [];
            await actions.updateColumnLanguages();
            if (dom.repetitionIntervalsTextarea) dom.repetitionIntervalsTextarea.value = state.repetitionIntervals.join(', ');
        },
        updateColumnLanguages: async () => {
            state.columnLanguages = await detectColumnLanguages(state.cardData, state.headers);
            actions.populateColumnRolesUI();
        },
        populateColumnRolesUI: () => {
            if (!dom.columnRolesContainer) return;
            dom.columnRolesContainer.innerHTML = '';
            const title = document.createElement('label');
            title.textContent = 'Column Roles (for Auto-Configuration):';
            title.style.display = 'block';
            title.style.marginBottom = '10px';
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
                const headerLower = header.toLowerCase();
                for (const roleKey in COLUMN_ROLES) {
                    if (roleKey === 'NONE') continue;
                    const roleName = COLUMN_ROLES[roleKey].toLowerCase();
                    const roleNameAsKeyword = roleKey.replace(/_/g, ' ').toLowerCase();
                    if (headerLower.includes(roleName) || headerLower.includes(roleNameAsKeyword)) {
                        select.value = roleKey;
                        break;
                    }
                }
                if (select.value === 'NONE') {
                    if (headerLower.includes('greek')) select.value = 'TARGET_LANGUAGE';
                    if (headerLower.includes('english')) select.value = 'BASE_LANGUAGE';
                }
                rolesGrid.appendChild(label);
                rolesGrid.appendChild(select);
            });
            dom.columnRolesContainer.appendChild(rolesGrid);
        },
        updateCacheStatus: (response) => {
            if (!dom.cacheStatus) return;
            const date = response.headers.get('date');
            const timestamp = date ? new Date(date).toLocaleString() : 'N/A';
            const isFromCache = response.headers.get('X-From-Cache') === 'true';
            if (isFromCache) {
                dom.cacheStatus.textContent = `Offline. Data from: ${timestamp}`;
                dom.cacheStatus.classList.add('cached');
            } else {
                dom.cacheStatus.textContent = `Live data. Updated: ${timestamp}`;
                dom.cacheStatus.classList.remove('cached');
            }
        },
        saveCurrentConfig: async () => {
            const configName = dom.configSelector.value;
            if (!configName) return false;
            const currentConfig = state.configs[configName] || {};
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
                actions.showTopNotification('Config not saved: Assign exactly one "Target Language" column.', 'error');
                return false;
            }
            if (!currentConfig.skills) {
                currentConfig.skills = [];
            }
            state.configs[configName] = {
                ...currentConfig,
                dataUrl: currentConfig.subsetData ? null : dom.dataUrlInput.value,
                repetitionIntervals: dom.repetitionIntervalsTextarea.value,
                activeSkills: actions.getSelectedSkills(),
                columnRoleAssignments: columnRoleAssignments,
                roleToColumnMap: roleToColumnMap,
                font: dom.fontSelector.value,
                ttsRate: dom.ttsRateSlider.value,
                ttsRateBase: dom.ttsRateBaseSlider.value,
                disableAnimation: dom.disableAnimationCheckbox.checked,
                multipleChoiceCount: dom.multipleChoiceCount.value,
                voiceCorrectDelay: dom.voiceCorrectDelayInput.value,
                filterIsEnabled: dom.enableFilterSettingsCheckbox.checked,
                filterText: dom.filterTextarea.value,
                filterAllowOverflow: dom.filterAllowOverflowCheckbox.checked
            };
            await set('flashcard-configs', state.configs);
            await set('flashcard-last-config', configName);
            if (dom.configTitle) dom.configTitle.textContent = configName;
            if (dom.deckTitle) dom.deckTitle.textContent = configName;
            return true;
        },
        saveConfig: async () => {
            if (!dom.configNameInput) return;
            const newConfigName = dom.configNameInput.value.trim();
            if (!newConfigName) {
                actions.showTopNotification('Please enter a new configuration name.', 'error');
                return;
            }
            if (state.configs[newConfigName]) {
                actions.showTopNotification(`Configuration '${newConfigName}' already exists. Please choose a different name.`, 'error');
                return;
            }
            const sourceConfigName = dom.configSelector.value;
            const sourceConfig = sourceConfigName ? state.configs[sourceConfigName] : {};
            state.configs[newConfigName] = JSON.parse(JSON.stringify(sourceConfig || {}));
            actions.populateConfigSelector();
            dom.configSelector.value = newConfigName;
            const success = await actions.saveCurrentConfig();
            if (success) {
                actions.showTopNotification(`Configuration '${newConfigName}' created successfully.`, 'success');
                const newConfigData = { configs: { [newConfigName]: state.configs[newConfigName] } };
                await syncToServer(newConfigData, actions.showTopNotification, state.isAuthenticated);
            }
        },
        resetDeckStats: async () => {
            if (state.cardData.length === 0) {
                actions.showTopNotification('No deck is loaded. Please load a deck first.');
                return;
            }
            const confirmation = confirm('Are you sure you want to reset all statistics for every card in the current deck? This action cannot be undone.');
            if (!confirmation) return;
            try {
                const promises = state.cardData.map(card => del(getCardKey(card, state)));
                await Promise.all(promises);
                actions.showTopNotification('Statistics for the current deck have been reset.', 'success');
                if (state.currentCardIndex >= 0) {
                    await displayCard(state.currentCardIndex, {}, state, actions);
                }
            } catch (error) {
                console.error('Failed to reset deck statistics:', error);
                actions.showTopNotification('An error occurred while trying to reset the deck statistics.');
            }
        },
        loadSelectedConfig: async (configName) => {
            if (!configName || !state.configs[configName]) return;
            const config = state.configs[configName];
            dom.configNameInput.value = configName;
            dom.dataUrlInput.value = config.dataUrl || '';
            dom.fontSelector.value = config.font;
            dom.cardContainer.style.fontFamily = config.font;
            if (dom.configTitle) dom.configTitle.textContent = configName;
            if (dom.deckTitle) dom.deckTitle.textContent = configName;
            if (config.subsetData && Array.isArray(config.subsetData)) {
                const tsvString = [config.headers.join('\t'), ...config.subsetData.map(row => row.join('\t'))].join('\n');
                await actions.parseData(tsvString);
                if (dom.cacheStatus) {
                    dom.cacheStatus.textContent = `Loaded from subset "${configName}"`;
                    dom.cacheStatus.classList.add('cached');
                }
                if (dom.settingsModal) dom.settingsModal.classList.add('hidden');
            } else {
                await actions.loadData();
            }
            if (config.skills && Array.isArray(config.skills)) {
                config.skills = config.skills.map(plainSkill => {
                    const skill = new Skill(plainSkill.name, plainSkill.id);
                    return Object.assign(skill, plainSkill);
                });
            } else {
                config.skills = [];
            }
            if (config.skills.length === 0) {
                await actions.addDefaultSkill(config);
                actions.handleSettingsChange();
            }
            if (!config.activeSkills) {
                config.activeSkills = config.skills.length > 0 ? [config.skills[0].id] : [];
            }
            // actions.renderSkillsList();
            actions.populateAllSkillSelectors();
            if (config.columnRoleAssignments) {
                for (const colIndex in config.columnRoleAssignments) {
                    const select = document.getElementById(`column-role-${colIndex}`);
                    if (select) {
                        select.value = config.columnRoleAssignments[colIndex];
                    }
                }
            }
            if (dom.ttsRateSlider) dom.ttsRateSlider.value = config.ttsRate || 1;
            if (dom.ttsRateBaseSlider) dom.ttsRateBaseSlider.value = config.ttsRateBase || 1.5;
            if (dom.disableAnimationCheckbox) dom.disableAnimationCheckbox.checked = config.disableAnimation || false;
            if (dom.multipleChoiceCount) dom.multipleChoiceCount.value = config.multipleChoiceCount || 4;
            if (dom.voiceCorrectDelayInput) dom.voiceCorrectDelayInput.value = config.voiceCorrectDelay || 1000;
            if (dom.repetitionIntervalsTextarea) {
                const configIntervalsString = config.repetitionIntervals;
                if (configIntervalsString && configIntervalsString.trim() !== '') {
                    state.repetitionIntervals = configIntervalsString.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                }
                if (state.repetitionIntervals.length === 0) {
                    state.repetitionIntervals = [...defaultIntervals];
                }
                dom.repetitionIntervalsTextarea.value = state.repetitionIntervals.join(', ');
            }
            if (dom.card) {
                if (dom.disableAnimationCheckbox.checked) {
                    dom.card.classList.add('no-animation');
                } else {
                    dom.card.classList.remove('no-animation');
                }
            }
            if (dom.filterTextarea) dom.filterTextarea.value = config.filterText || '';
            if (dom.filterAllowOverflowCheckbox) dom.filterAllowOverflowCheckbox.checked = config.filterAllowOverflow !== false;
            // actions.setFilterEnabled(config.filterIsEnabled || false);
            // actions.updateFilterState(config.filterIsEnabled ? 'learning' : 'off');
            // actions.updateFilterHighlights();
            const wordsArray = (config.filterText || '').match(/[\p{L}\p{N}]+/gu) || [];
            state.activeFilterWords = new Set(wordsArray.map(w => w.toLowerCase()));
            await set('flashcard-last-config', configName);
            if (state.cardData.length > 0) {
                await showNextCard({}, state, actions);
            }
            if (dom.saveConfigButton) dom.saveConfigButton.disabled = true;
        },
        populateConfigSelector: () => {
            if (!dom.configSelector) return;
            dom.configSelector.innerHTML = '<option value="">-- Load a Configuration --</option>';
            Object.keys(state.configs).forEach(name => {
                const option = new Option(name, name);
                dom.configSelector.add(option);
            });
        },
        loadInitialConfigs: async () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('test') === 'true') {
                console.log('TEST MODE: Bypassing IndexedDB and loading local test data.');
                await actions.parseData(TEST_DATA);
                const testConfigName = 'test-config';
                const testConfig = {
                    name: testConfigName,
                    skills: [],
                    activeSkills: [],
                    subsetData: state.cardData,
                    headers: state.headers,
                    font: 'Arial',
                    ttsRate: '1',
                    ttsRateBase: '1.5',
                    disableAnimation: false,
                    multipleChoiceCount: '4',
                    voiceCorrectDelay: '1000',
                    repetitionIntervals: defaultIntervals.join(','),
                    filterIsEnabled: false,
                    filterText: '',
                    filterAllowOverflow: true
                };
                state.configs[testConfigName] = testConfig;
                await actions.addDefaultSkill(testConfig);
                actions.populateConfigSelector();
                dom.configSelector.value = testConfigName;
                await actions.loadSelectedConfig(testConfigName);
                document.body.classList.add('debug-data-loaded');
                return;
            }
            try {
                const savedConfigs = await get('flashcard-configs');
                if (savedConfigs) {
                    state.configs = savedConfigs;
                    actions.populateConfigSelector();
                }
                const lastConfig = await get('flashcard-last-config');
                if (lastConfig && state.configs[lastConfig]) {
                    dom.configSelector.value = lastConfig;
                    await actions.loadSelectedConfig(lastConfig);
                } else {
                    if (dom.settingsModal) {
                        dom.settingsModal.classList.remove('hidden');
                    }
                }
            } catch (error) {
                console.error('Error loading initial configs from IndexedDB:', error);
                document.body.style.backgroundColor = 'red';
                if (dom.settingsModal) {
                    dom.settingsModal.classList.remove('hidden');
                }
            }
        },
        getSelectedSkills: () => {
            if (!dom.skillSelectorCheckboxes) return [];
            return Array.from(dom.skillSelectorCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
        },
        populateAllSkillSelectors: () => {
            actions.populateSkillSelector(dom.skillSelectorCheckboxes, false);
            actions.populateSkillSelector(dom.mobileSkillSelectorCheckboxes, true);
        },
        populateSkillSelector: (container, isMobile = false) => {
            if (!container) return;
            container.innerHTML = '';
            const currentConfigName = dom.configSelector.value;
            const currentConfig = state.configs[currentConfigName];
            if (!currentConfig || !currentConfig.skills) return;
            currentConfig.skills.forEach((skill, index) => {
                const div = document.createElement('div');
                const input = document.createElement('input');
                input.type = 'checkbox';
                const idSuffix = isMobile ? `-mobile-${skill.id}` : `-${skill.id}`;
                input.id = `skill-checkbox${idSuffix}`;
                input.value = skill.id;
                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.title = skill.name;
                const letter = String.fromCharCode(65 + index);
                label.textContent = `(${letter}) ${skill.name}`;
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
        },
        addDefaultSkill: async (currentConfig) => {
            if (!currentConfig || !currentConfig.skills) {
                return;
            }
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
            const id = await createSkillId(defaultSkillData);
            defaultSkillData.id = id;
            const created = await createSkill(defaultSkillData);
            currentConfig.skills.push(created);
            if (!currentConfig.activeSkills) currentConfig.activeSkills = [];
            currentConfig.activeSkills.push(created.id);
        },
    });

    if (dom.loadDataButton) {
        dom.loadDataButton.addEventListener('click', async () => {
            await actions.loadData();
            if (state.cardData.length > 0) {
                await showNextCard({}, state, actions);
            }
        });
    }
    if (dom.saveConfigButton) dom.saveConfigButton.addEventListener('click', actions.saveConfig);
    if (dom.resetStatsButton) dom.resetStatsButton.addEventListener('click', actions.resetDeckStats);
    if (dom.configSelector) dom.configSelector.addEventListener('change', () => actions.loadSelectedConfig(dom.configSelector.value));
    if (dom.flipCardButton) dom.flipCardButton.addEventListener('click', () => flipCard(state, actions));
    if (dom.nextCardButton) dom.nextCardButton.addEventListener('click', () => showNextCard({}, state, actions));
    if (dom.prevCardButton) dom.prevCardButton.addEventListener('click', () => showPrevCard(state, actions));
    if (dom.iKnowButton) dom.iKnowButton.addEventListener('click', async () => { await markCardAsKnown(true, state, actions); await showNextCard({}, state, actions); });

    const syncFromServerWrapper = async () => {
        const mergedConfigs = await syncFromServer(actions, state.cardData, state.isAuthenticated);
        if (mergedConfigs) {
            state.configs = mergedConfigs;
        }
    };

    checkAuthStatus().then(user => {
        if (user) {
            state.isAuthenticated = true;
            syncFromServerWrapper();
        } else {
            state.isAuthenticated = false;
        }
    });

    actions.loadInitialConfigs();

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
}