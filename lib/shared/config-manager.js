/**
 * @file Manages loading, saving, and handling of user configurations.
 * This includes IndexedDB operations for configs, data import/export,
 * and applying settings to the application state.
 */

import { COLUMN_ROLES, defaultIntervals } from './state.js';

// Dependencies to be injected
let state;
let updateState;
let syncToServer;
let addDefaultSkill;
let showTopNotification;
let saveConfigs, saveLastConfig;


// The init function for dependency injection
export function initConfigManager(dependencies) {
    state = dependencies.state;
    updateState = dependencies.updateState;
    syncToServer = dependencies.syncToServer;
    addDefaultSkill = dependencies.addDefaultSkill;
    showTopNotification = dependencies.showTopNotification;
    saveConfigs = dependencies.saveConfigs;
    saveLastConfig = dependencies.saveLastConfig;
}

/**
 * The core, unified function for saving the current configuration to IndexedDB.
 * It gathers all settings from the UI and state, validates them, and persists.
 * It does not show notifications, making it suitable for background saves.
 * @returns {Promise<boolean>} A promise that resolves to true on success, false on validation failure.
 */
export async function saveCurrentConfig(configData) {
    const { configName, ...rest } = configData;
    if (!configName) {
        return false; // Silently fail if no config is selected.
    }

    const currentConfig = state.configs[configName] || {};

    const { columnRoleAssignments } = rest;

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
        ...rest,
        roleToColumnMap,
    };

    await saveConfigs(state.configs);
    await saveLastConfig(configName);

    return true;
}

/**
 * Handles the "Save As New..." button click. It creates a new configuration,
 * either by copying an existing one or by creating a new blank one, and then
 * saves the current UI settings into it.
 */
export async function saveConfig(newConfigName, sourceConfigName, currentSettings) {
    if (!newConfigName) {
        showTopNotification('Please enter a new configuration name.', 'error');
        return;
    }
    if (state.configs[newConfigName]) {
        showTopNotification(`Configuration '${newConfigName}' already exists. Please choose a different name.`, 'error');
        return;
    }

    const sourceConfig = sourceConfigName ? state.configs[sourceConfigName] : {};

    state.configs[newConfigName] = JSON.parse(JSON.stringify(sourceConfig || {}));

    const success = await saveCurrentConfig({ configName: newConfigName, ...currentSettings });
    if (success) {
        showTopNotification(`Configuration '${newConfigName}' created successfully.`, 'success');
        const newConfigData = { configs: { [newConfigName]: state.configs[newConfigName] } };
        await syncToServer(newConfigData);
    }
}

/**
 * Loads a saved configuration by name, updating the UI and loading its data.
 * @param {string} configName - The name of the configuration to load.
 */
export async function loadSelectedConfig(configName) {
    if (!configName || !state.configs[configName]) return null;
    const config = state.configs[configName];

    let cardData, headers;
    if (config.subsetData && Array.isArray(config.subsetData)) {
        const tsvString = [
            config.headers.join('\t'),
            ...config.subsetData.map(row => row.join('\t'))
        ].join('\n');
        ({ cardData, headers } = parseTsv(tsvString));
    } else {
        // This part will be handled by the DAL in the future
        // For now, it's a placeholder.
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

    const configIntervalsString = config.repetitionIntervals;
    let newIntervals = [...defaultIntervals];
    if (configIntervalsString && configIntervalsString.trim() !== '') {
        const parsedIntervals = configIntervalsString.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (parsedIntervals.length > 0) {
            newIntervals = parsedIntervals;
        }
    }
    updateState({ repetitionIntervals: newIntervals });

    const wordsArray = (config.filterText || '').match(/[\p{L}\p{N}]+/gu) || [];
    updateState({ activeFilterWords: new Set(wordsArray.map(w => w.toLowerCase())) });

    await saveLastConfig(configName);

    return { config, cardData, headers };
}

function parseTsv(text) {
    const cleanCell = (cell) => cell.replace(/[\r\n\s]+/g, ' ').trim();
    const rows = text.trim().split('\n').filter(row => row.trim() !== '');
    if (rows.length < 1) {
        return { cardData: [], headers: [] };
    }
    const delimiter = rows[0].includes('\t') ? '\t' : ',';
    const headers = rows[0].split(delimiter).map(cleanCell);
    const cardData = rows.slice(1).map(row => row.split(delimiter).map(cleanCell)).filter(row => row.length === headers.length);
    return { cardData, headers };
}