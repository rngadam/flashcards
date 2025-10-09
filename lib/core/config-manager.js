/**
 * @file Manages loading, saving, and handling of user configurations.
 * This includes IndexedDB operations for configs, data import/export,
 * and applying settings to the application state.
 */

import { get, set, del, keys } from '../idb-keyval-wrapper.js';
import { TEST_DATA } from '../test-data.js';
import { createDatabase } from '../db-export.js';
import { COLUMN_ROLES, defaultIntervals } from './state.js';
import { mergeCardStats } from '../shared/stats-utils.js';

// Dependencies to be injected
let dom;
let state;
let updateState;
let syncToServer;
let loadData;
let parseData;
let showNextCard;
let displayCard;
let addDefaultSkill;
let renderSkillsList;
let populateAllSkillSelectors;
let getCardKey;
let getAllCardStats;
let showTopNotification;
let getSelectedSkills;
let setFilterEnabled;
let updateFilterState;
let updateFilterHighlights;

// The init function for dependency injection
export function initConfigManager(dependencies) {
    dom = dependencies.dom;
    state = dependencies.state;
    updateState = dependencies.updateState;
    syncToServer = dependencies.syncToServer;
    loadData = dependencies.loadData;
    parseData = dependencies.parseData;
    showNextCard = dependencies.showNextCard;
    displayCard = dependencies.displayCard;
    addDefaultSkill = dependencies.addDefaultSkill;
    renderSkillsList = dependencies.renderSkillsList;
    populateAllSkillSelectors = dependencies.populateAllSkillSelectors;
    getCardKey = dependencies.getCardKey;
    getAllCardStats = dependencies.getAllCardStats;
    showTopNotification = dependencies.showTopNotification;
    getSelectedSkills = dependencies.getSelectedSkills;
    setFilterEnabled = dependencies.setFilterEnabled;
    updateFilterState = dependencies.updateFilterState;
    updateFilterHighlights = dependencies.updateFilterHighlights;
}

/**
 * The core, unified function for saving the current configuration to IndexedDB.
 * It gathers all settings from the UI and state, validates them, and persists.
 * It does not show notifications, making it suitable for background saves.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on validation failure.
 */
export async function saveCurrentConfig() {
    const configName = dom.configSelector.value;
    if (!configName) {
        return false; // Silently fail if no config is selected.
    }

    const currentConfig = state.configs[configName] || {};

    const columnRoleAssignments = {};
    dom.columnRolesContainer.querySelectorAll('select').forEach(select => {
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
    state.configs[configName] = {
        ...currentConfig,
        dataUrl: currentConfig.subsetData ? null : dom.dataUrlInput.value,
        repetitionIntervals: dom.repetitionIntervalsTextarea.value,
        activeSkills: getSelectedSkills(),
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
}

/**
 * Handles the "Save As New..." button click. It creates a new configuration,
 * either by copying an existing one or by creating a new blank one, and then
 * saves the current UI settings into it.
 */
export async function saveConfig() {
    if (!dom.configNameInput) return;
    const newConfigName = dom.configNameInput.value.trim();
    if (!newConfigName) {
        showTopNotification('Please enter a new configuration name.', 'error');
        return;
    }
    if (state.configs[newConfigName]) {
        showTopNotification(`Configuration '${newConfigName}' already exists. Please choose a different name.`, 'error');
        return;
    }

    const sourceConfigName = dom.configSelector.value;
    const sourceConfig = sourceConfigName ? state.configs[sourceConfigName] : {};

    state.configs[newConfigName] = JSON.parse(JSON.stringify(sourceConfig || {}));

    populateConfigSelector();
    dom.configSelector.value = newConfigName;

    const success = await saveCurrentConfig();
    if (success) {
        showTopNotification(`Configuration '${newConfigName}' created successfully.`, 'success');
        const newConfigData = { configs: { [newConfigName]: state.configs[newConfigName] } };
        await syncToServer(newConfigData);
    }
}

/**
 * Resets the statistics for all cards in the currently loaded deck.
 */
export async function resetDeckStats() {
    if (state.cardData.length === 0) {
        showTopNotification('No deck is loaded. Please load a deck first.');
        return;
    }

    const confirmation = confirm('Are you sure you want to reset all statistics for every card in the current deck? This action cannot be undone.');
    if (!confirmation) {
        return;
    }

    try {
        const promises = state.cardData.map(card => del(getCardKey(card)));
        await Promise.all(promises);
        showTopNotification('Statistics for the current deck have been reset.', 'success');
        if (state.currentCardIndex >= 0) {
            await displayCard(state.currentCardIndex);
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
export async function loadSelectedConfig(configName) {
    if (!configName || !state.configs[configName]) return;
    const config = state.configs[configName];

    dom.configNameInput.value = configName;
    dom.dataUrlInput.value = config.dataUrl || '';
    dom.fontSelector.value = config.font;
    dom.cardContainer.style.fontFamily = config.font;
    if (dom.configTitle) dom.configTitle.textContent = configName;
    if (dom.deckTitle) dom.deckTitle.textContent = configName;

    if (config.subsetData && Array.isArray(config.subsetData)) {
        const tsvString = [
            config.headers.join('\t'),
            ...config.subsetData.map(row => row.join('\t'))
        ].join('\n');
        await parseData(tsvString);
        if (dom.cacheStatus) {
            dom.cacheStatus.textContent = `Loaded from subset "${configName}"`;
            dom.cacheStatus.classList.add('cached');
        }
        if (dom.settingsModal) dom.settingsModal.classList.add('hidden');
    } else {
        await loadData();
    }

    if (!config.skills || !Array.isArray(config.skills)) {
        config.skills = [];
    }

    if (config.skills.length === 0) {
        await addDefaultSkill(config);
    }

    if (!config.activeSkills) {
        config.activeSkills = config.skills.length > 0 ? [config.skills[0].id] : [];
    }

    renderSkillsList();
    populateAllSkillSelectors();

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
        let newIntervals = [...defaultIntervals];
        if (configIntervalsString && configIntervalsString.trim() !== '') {
            const parsedIntervals = configIntervalsString.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            if (parsedIntervals.length > 0) {
                newIntervals = parsedIntervals;
            }
        }
        updateState({ repetitionIntervals: newIntervals });
        dom.repetitionIntervalsTextarea.value = newIntervals.join(', ');
    }

    if (dom.card) {
        dom.card.classList.toggle('no-animation', dom.disableAnimationCheckbox.checked);
    }

    if (dom.filterTextarea) dom.filterTextarea.value = config.filterText || '';
    if (dom.filterAllowOverflowCheckbox) dom.filterAllowOverflowCheckbox.checked = config.filterAllowOverflow !== false;
    setFilterEnabled(config.filterIsEnabled || false);
    updateFilterState(config.filterIsEnabled ? 'learning' : 'off');
    updateFilterHighlights();
    const wordsArray = (config.filterText || '').match(/[\p{L}\p{N}]+/gu) || [];
    updateState({ activeFilterWords: new Set(wordsArray.map(w => w.toLowerCase())) });

    await set('flashcard-last-config', configName);

    if (state.cardData.length > 0) {
        showNextCard();
    }
    if (dom.saveConfigButton) dom.saveConfigButton.disabled = true;
}

/**
 * Populates the configuration dropdown in the settings modal with the names
 * of all saved configurations.
 */
export function populateConfigSelector() {
    if (!dom.configSelector) return;
    const currentVal = dom.configSelector.value;
    dom.configSelector.innerHTML = '<option value="">-- Load a Configuration --</option>';
    Object.keys(state.configs).forEach(name => {
        const option = new Option(name, name);
        dom.configSelector.add(option);
    });
    dom.configSelector.value = currentVal;
}

/**
 * Loads configurations from IndexedDB on startup.
 * If a "last used" configuration is found, it is loaded automatically.
 */
export async function loadInitialConfigs() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test') === 'true') {
        console.log('TEST MODE: Bypassing IndexedDB and loading local test data.');
        await parseData(TEST_DATA);

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
        await addDefaultSkill(testConfig);

        populateConfigSelector();
        dom.configSelector.value = testConfigName;
        await loadSelectedConfig(testConfigName);

        document.body.classList.add('debug-data-loaded');
        return;
    }

    try {
        const savedConfigs = await get('flashcard-configs');
        if (savedConfigs) {
            updateState({ configs: savedConfigs });
            populateConfigSelector();
        }

        const lastConfig = await get('flashcard-last-config');
        if (lastConfig && state.configs[lastConfig]) {
            dom.configSelector.value = lastConfig;
            await loadSelectedConfig(lastConfig);
        } else {
            if (dom.settingsModal) {
                dom.settingsModal.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading initial configs from IndexedDB:', error);
        if (dom.settingsModal) {
            dom.settingsModal.classList.remove('hidden');
        }
    }
}

/**
 * Exports the current deck and all related statistics to a portable SQLite database file.
 */
export async function exportSQLite() {
    if (state.cardData.length === 0) {
        showTopNotification('No deck loaded. Please load a deck to export.', 'error');
        return;
    }
    try {
        showTopNotification('Generating SQLite database... this may take a moment.', 'success');
        const allCardStats = await getAllCardStats();
        const dbData = await createDatabase(allCardStats, state.cardData, getCardKey, state.configs, dom.configSelector.value);
        const blob = new Blob([dbData], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const configName = dom.configSelector.value || 'flashcards';
        a.download = `${configName}-backup.db`;
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showTopNotification('SQLite database exported successfully!', 'success');
    } catch (error) {
        console.error('Failed to export SQLite database:', error);
        showTopNotification(`Error exporting SQLite database: ${error.message}`, 'error');
    }
}

/**
 * Exports all application data (configs and stats) to a single JSON file.
 */
export async function exportAllData() {
    try {
        showTopNotification('Exporting all data... this may take a moment.', 'success');

        const allKeys = await keys();
        const dataToExport = {
            version: 1,
            exportDate: new Date().toISOString(),
            configs: null,
            cardStats: {}
        };

        const dataPromises = allKeys.map(async (key) => ({ key, value: await get(key) }));
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
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        a.download = `flashcards-backup-${timestamp}.json`;

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

/**
 * Imports application data from a JSON backup file, overwriting existing data.
 * @param {File} file - The JSON file to import.
 */
export function importAllData(file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (!data.version || !data.configs || !data.cardStats) {
                throw new Error('Invalid backup file format.');
            }

            const confirmation = confirm('Are you sure you want to import this backup? This will overwrite all existing configurations and merge card statistics. This action cannot be undone.');
            if (!confirmation) {
                showTopNotification('Import cancelled.', 'success');
                return;
            }

            showTopNotification('Importing data... please wait.', 'success');

            await set('flashcard-configs', data.configs);

            const cardKeys = Object.keys(data.cardStats);
            const existingStatsPromises = cardKeys.map(key => get(key));
            const existingStatsList = await Promise.all(existingStatsPromises);

            const writePromises = [];
            for (let i = 0; i < cardKeys.length; i++) {
                const cardKey = cardKeys[i];
                const importedStats = data.cardStats[cardKey];
                const existingStats = existingStatsList[i];
                const mergedStats = mergeCardStats(existingStats || { skills: {} }, importedStats);
                writePromises.push(set(cardKey, mergedStats));
            }
            await Promise.all(writePromises);

            showTopNotification('Import successful! The application will now reload.', 'success');
            setTimeout(() => window.location.reload(), 2000);

        } catch (error) {
            console.error('Failed to import data:', error);
            showTopNotification(`Error importing data: ${error.message}`, 'error');
        } finally {
            dom.importFileInput.value = '';
        }
    };
    reader.readAsText(file);
}