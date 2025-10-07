/**
 * @file Manages all aspects of skill creation, editing, and selection.
 * This module handles the UI for the skills settings tab, including
 * creating, editing, deleting, and reordering skills. It also populates
 * the skill selection checkboxes in the main UI.
 */
import { createSkillId, createSkill } from '../skill-utils.js';

// Dependencies to be injected
let state;
let updateState;
let showTopNotification;
let handleSettingsChange;

/**
 * Initializes the skill manager with required dependencies.
 * @param {object} dependencies - The dependencies to inject.
 */
export function initSkillManager(dependencies) {
    state = dependencies.state;
    updateState = dependencies.updateState;
    showTopNotification = dependencies.showTopNotification;
    handleSettingsChange = dependencies.handleSettingsChange;
}

/**
 * Saves the skill from the configuration dialog to the current configuration.
 */
export async function saveSkill(skillData) {
    const currentConfig = state.configs[state.currentConfig];
    if (!currentConfig) {
        showTopNotification('No configuration selected.');
        return;
    }

    const { editingSkillId, transientSkill, ...formData } = skillData;

    if (!formData.name) {
        showTopNotification('Skill name cannot be empty.');
        return;
    }

    if (!transientSkill) {
        showTopNotification('Error: No skill data to save.');
        return;
    }

    // Update the transient skill with the latest form values before saving
    Object.assign(transientSkill, formData);

    const newSkillId = await createSkillId(transientSkill);

    if (currentConfig.skills.find(s => s.id === newSkillId && s.id !== editingSkillId)) {
        showTopNotification(`A skill with these exact settings already exists.`, 'error');
        return;
    }

    const skillToSave = { ...transientSkill, id: newSkillId };

    if (editingSkillId) {
        const index = currentConfig.skills.findIndex(s => s.id === editingSkillId);
        if (index > -1) {
            currentConfig.skills[index] = skillToSave;
            // Update active skills if the ID changed
            if (editingSkillId !== newSkillId && currentConfig.activeSkills.includes(editingSkillId)) {
                currentConfig.activeSkills = currentConfig.activeSkills.map(id => (id === editingSkillId ? newSkillId : id));
            }
        } else {
            showTopNotification('Error: Skill not found for editing.');
            return;
        }
    } else {
        currentConfig.skills.push(skillToSave);
    }

    updateState({ transientSkill: null });
    handleSettingsChange();
    showTopNotification(`Skill '${skillToSave.name}' saved.`, 'success');
}

/**
 * Deletes a skill from the current configuration.
 * @param {string} skillId - The ID of the skill to delete.
 */
export function deleteSkill(skillId) {
    const currentConfig = state.configs[state.currentConfig];
    if (!currentConfig || !currentConfig.skills) return;

    const skillToDelete = currentConfig.skills.find(s => s.id === skillId);
    if (!skillToDelete) return;


    currentConfig.skills = currentConfig.skills.filter(s => s.id !== skillId);
    if (currentConfig.activeSkills) {
        currentConfig.activeSkills = currentConfig.activeSkills.filter(id => id !== skillId);
    }

    handleSettingsChange();
    showTopNotification(`Skill "${skillToDelete.name}" deleted.`, 'success');
}

/**
 * Deletes all skills from the current configuration.
 */
export function deleteAllSkills() {
    const currentConfig = state.configs[state.currentConfig];
    if (!currentConfig || !currentConfig.skills) return;

    currentConfig.skills = [];
    currentConfig.activeSkills = [];

    handleSettingsChange();
    showTopNotification('All skills have been deleted.', 'success');
}

/**
 * Adds a default skill to the given configuration object.
 * @param {object} currentConfig - The configuration to modify.
 */
export async function addDefaultSkill(currentConfig) {
    if (!currentConfig || !currentConfig.skills) return;

    const defaultSkillData = {
        name: 'Reading & Listening',
        front: ['TARGET_LANGUAGE'],
        back: ['BASE_LANGUAGE', 'PRONUNCIATION', 'GRAMMATICAL_TYPE'],
        verificationMethod: 'none',
        ttsFrontColumn: 'TARGET_LANGUAGE',
        ttsBackColumn: 'BASE_LANGUAGE',
        ttsOnHotkeyOnly: true,
        transforms: {
            front: {
                TARGET_LANGUAGE: { casing: 'alternate' }
            }
        }
    };
    const id = await createSkillId(defaultSkillData);
    if (currentConfig.skills.some(s => s.id === id)) return; // Don't add if it already exists

    const created = await createSkill({ ...defaultSkillData, id });
    currentConfig.skills.push(created);
    if (!currentConfig.activeSkills) currentConfig.activeSkills = [];
    currentConfig.activeSkills.push(created.id);
}

/**
 * Loads preset skills from a JSON file and adds them to the current configuration.
 */
export async function createPresetSkills() {
    const currentConfig = state.configs[state.currentConfig];
    if (!currentConfig) {
        showTopNotification('Please select or save a configuration first.');
        return;
    }

    try {
        const response = await fetch('lib/default-skills.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const presets = await response.json();

        if (!currentConfig.skills) currentConfig.skills = [];
        if (!currentConfig.activeSkills) currentConfig.activeSkills = [];

        const newSkillIds = [];
        for (const p of presets) {
            const skillData = {
                name: p.name,
                front: p.front || [],
                back: p.back || [],
                verificationMethod: p.verificationMethod || 'none',
                validationColumn: p.validationColumn || 'none',
                ttsFrontColumn: p.ttsFrontColumn || 'none',
                ttsBackColumn: p.ttsBackColumn || 'none',
                ttsOnHotkeyOnly: p.ttsOnHotkeyOnly || false,
                transforms: p.transforms || { front: {}, back: {} }
            };

            const id = await createSkillId(skillData);
            if (currentConfig.skills.find(s => s.id === id)) continue;
            const created = await createSkill({ ...skillData, id });
            currentConfig.skills.push(created);
            newSkillIds.push(created.id);
        }
        currentConfig.activeSkills = [...new Set([...currentConfig.activeSkills, ...newSkillIds])];

        handleSettingsChange();
        showTopNotification('Preset skills added.', 'success');
    } catch (error) {
        console.error('Failed to load preset skills:', error);
        showTopNotification('Error: Could not load preset skills.', 'error');
    }
}

/**
 * Gets the active skills from the current configuration state.
 * @returns {string[]} An array of active skill IDs.
 */
export function getActiveSkills() {
    const currentConfig = state.configs[state.currentConfig];
    return (currentConfig && currentConfig.activeSkills) ? currentConfig.activeSkills : [];
}