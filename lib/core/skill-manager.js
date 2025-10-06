/**
 * @file Manages all aspects of skill creation, editing, and selection.
 * This module handles the UI for the skills settings tab, including
 * creating, editing, deleting, and reordering skills. It also populates
 * the skill selection checkboxes in the main UI.
 */
import { createSkillId, createSkill, VERIFICATION_METHODS } from '../skill-utils.js';
import { COLUMN_ROLES } from './state.js';

// Dependencies to be injected
let dom;
let state;
let updateState;
let showTopNotification;
let handleSettingsChange;

/**
 * Initializes the skill manager with required dependencies.
 * @param {object} dependencies - The dependencies to inject.
 */
export function initSkillManager(dependencies) {
    dom = dependencies.dom;
    state = dependencies.state;
    updateState = dependencies.updateState;
    showTopNotification = dependencies.showTopNotification;
    handleSettingsChange = dependencies.handleSettingsChange;
}

/**
 * Renders the list of user-defined skills in the settings panel.
 */
export function renderSkillsList() {
    if (!dom.skillsList) return;

    const currentConfig = state.configs[dom.configSelector.value];
    if (!currentConfig || !currentConfig.skills || currentConfig.skills.length === 0) {
        dom.skillsList.innerHTML = '<p>No skills configured. Add a new skill or load presets.</p>';
        return;
    }

    dom.skillsList.innerHTML = '';
    currentConfig.skills.forEach(skill => {
        const skillItem = document.createElement('div');
        skillItem.className = 'skill-item';
        skillItem.dataset.skillId = skill.id;

        const leftDiv = document.createElement('div');
        const nameDiv = document.createElement('div');
        nameDiv.className = 'skill-item-name';
        const shortId = skill.id ? ` (${skill.id.substring(0, 8)})` : '';
        nameDiv.textContent = `${skill.name}${shortId}`;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'skill-item-details';
        const frontDetails = Array.isArray(skill.front) ? skill.front.join(', ') : 'None';
        const backDetails = Array.isArray(skill.back) ? skill.back.join(', ') : 'None';
        detailsDiv.textContent = `Front: ${frontDetails || 'None'} | Back: ${backDetails || 'None'} | Validation: ${skill.verificationMethod}`;

        leftDiv.appendChild(nameDiv);
        leftDiv.appendChild(detailsDiv);

        const rightDiv = document.createElement('div');
        rightDiv.className = 'skill-item-actions';
        const editButton = document.createElement('button');
        editButton.className = 'edit-skill-button';
        editButton.textContent = 'Edit';
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-skill-button danger';
        deleteButton.textContent = 'Delete';
        rightDiv.appendChild(editButton);
        rightDiv.appendChild(deleteButton);

        skillItem.appendChild(leftDiv);
        skillItem.appendChild(rightDiv);
        dom.skillsList.appendChild(skillItem);
    });
}

function openTransformDialog(side, role) {
    const { transientSkill } = state;
    if (!transientSkill) return;

    const isNewSkill = !transientSkill.id;
    let transform = transientSkill.transforms?.[side]?.[role] || {};

    // If it's a new skill and no transform has been set for this column yet,
    // apply the default random transforms for display in the dialog.
    if (isNewSkill && Object.keys(transform).length === 0) {
        transform = { font: 'Random', casing: 'random' };
    }

    dom.editingTransformSide.value = side;
    dom.editingTransformRole.value = role;

    dom.transformConfigTitle.textContent = `Transform for ${COLUMN_ROLES[role]} on ${side}`;
    dom.transformHideString.checked = transform.hideString || false;
    dom.transformHideStringColumn.value = transform.hideStringColumn || 'none';
    dom.transformSuppressParentheses.checked = transform.suppressParentheses || false;
    dom.transformFont.value = transform.font || '';
    dom.transformCasing.value = transform.casing || 'default';

    dom.transformHideStringColumn.disabled = !dom.transformHideString.checked;

    dom.textTransformModal.classList.remove('hidden');
}

export function saveTransform() {
    const side = dom.editingTransformSide.value;
    const role = dom.editingTransformRole.value;
    if (!side || !role) return;

    const { transientSkill } = state;
    if (!transientSkill) return;

    if (!transientSkill.transforms) transientSkill.transforms = { front: {}, back: {} };
    if (!transientSkill.transforms[side]) transientSkill.transforms[side] = {};

    const transformData = {
        hideString: dom.transformHideString.checked,
        hideStringColumn: dom.transformHideStringColumn.value,
        suppressParentheses: dom.transformSuppressParentheses.checked,
        font: dom.transformFont.value,
        casing: dom.transformCasing.value,
    };

    if (Object.values(transformData).some(v => v && v !== 'default' && v !== false)) {
        transientSkill.transforms[side][role] = transformData;
    } else {
        delete transientSkill.transforms[side][role];
    }

    const label = document.querySelector(`#skill-${side}-columns label[for$="${role}"]`);
    if (label) {
        label.classList.toggle('has-transform', !!transientSkill.transforms[side][role]);
    }

    dom.textTransformModal.classList.add('hidden');
}

export function openSkillDialog(skillId = null) {
    const populateVerificationMethodSelector = (select) => {
        select.innerHTML = '';
        const displayTexts = {
            [VERIFICATION_METHODS.NONE]: 'None (Self-Assessed)',
            [VERIFICATION_METHODS.TEXT]: 'Text Input',
            [VERIFICATION_METHODS.MULTIPLE_CHOICE]: 'Multiple Choice',
            [VERIFICATION_METHODS.VOICE]: 'Voice Input',
        };
        for (const method of Object.values(VERIFICATION_METHODS)) {
            select.add(new Option(displayTexts[method], method));
        }
    };

    const populateRoleSelector = (select, includeNone = true) => {
        select.innerHTML = '';
        if (includeNone) select.add(new Option('None', 'none'));
        for (const roleKey in COLUMN_ROLES) {
            if (roleKey !== 'NONE') select.add(new Option(COLUMN_ROLES[roleKey], roleKey));
        }
    };

    const populateColumnCheckboxes = (container, side, skill) => {
        container.innerHTML = '';
        for (const roleKey in COLUMN_ROLES) {
            if (roleKey !== 'NONE') {
                const roleName = COLUMN_ROLES[roleKey];
                const id = `skill-config-${container.id}-${roleKey}`;
                const div = document.createElement('div');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = id;
                checkbox.value = roleKey;
                checkbox.checked = skill[side].includes(roleKey);
                const label = document.createElement('label');
                label.htmlFor = id;
                label.textContent = roleName;
                label.classList.toggle('has-transform', !!skill.transforms?.[side]?.[roleKey]);
                label.addEventListener('click', (e) => {
                    e.preventDefault();
                    openTransformDialog(side, roleKey);
                });
                div.appendChild(checkbox);
                div.appendChild(label);
                container.appendChild(div);
            }
        }
    };

    populateVerificationMethodSelector(dom.skillVerificationMethod);
    populateRoleSelector(dom.skillValidationColumn);
    populateRoleSelector(dom.skillTtsFrontColumn, false);
    populateRoleSelector(dom.skillTtsBackColumn, false);
    populateRoleSelector(dom.transformHideStringColumn, false);

    const currentConfig = state.configs[dom.configSelector.value];
    let transientSkill;

    if (skillId && currentConfig?.skills) {
        const foundSkill = currentConfig.skills.find(s => s.id === skillId);
        if (foundSkill) {
            transientSkill = structuredClone(foundSkill);
        }
    }

    if (!transientSkill) {
        transientSkill = {
            id: '',
            name: '',
            verificationMethod: VERIFICATION_METHODS.NONE,
            validationColumn: 'none',
            ttsFrontColumn: 'TARGET_LANGUAGE',
            ttsBackColumn: 'BASE_LANGUAGE',
            ttsOnHotkeyOnly: false,
            front: [],
            back: [],
            transforms: { front: {}, back: {} },
        };
    }

    updateState({ transientSkill });

    dom.skillConfigTitle.textContent = skillId ? 'Edit Skill' : 'Add New Skill';
    dom.editingSkillIdInput.value = transientSkill.id;
    dom.skillNameInput.value = transientSkill.name;
    dom.skillVerificationMethod.value = transientSkill.verificationMethod;
    dom.skillValidationColumn.value = transientSkill.validationColumn;
    dom.skillTtsFrontColumn.value = transientSkill.ttsFrontColumn;
    dom.skillTtsBackColumn.value = transientSkill.ttsBackColumn;
    dom.skillTtsOnHotkeyOnly.checked = transientSkill.ttsOnHotkeyOnly || false;

    populateColumnCheckboxes(dom.skillFrontColumns, 'front', transientSkill);
    populateColumnCheckboxes(dom.skillBackColumns, 'back', transientSkill);

    dom.skillValidationColumn.disabled = transientSkill.verificationMethod === 'none';
    dom.skillConfigModal.classList.remove('hidden');
}

function getSelectedRoles(checkboxContainer) {
    if (!checkboxContainer) return [];
    return Array.from(checkboxContainer.querySelectorAll('input:checked')).map(cb => cb.value);
}

/**
 * Saves the skill from the configuration dialog to the current configuration.
 */
export async function saveSkill() {
    const currentConfig = state.configs[dom.configSelector.value];
    if (!currentConfig) {
        showTopNotification('No configuration selected.');
        return;
    }

    const skillName = dom.skillNameInput.value.trim();
    if (!skillName) {
        showTopNotification('Skill name cannot be empty.');
        return;
    }

    const editingSkillId = dom.editingSkillIdInput.value;
    const { transientSkill } = state;
    if (!transientSkill) {
        showTopNotification('Error: No skill data to save.');
        return;
    }

    // Update the transient skill with the latest form values before saving
    transientSkill.name = skillName;
    transientSkill.verificationMethod = dom.skillVerificationMethod.value;
    transientSkill.validationColumn = dom.skillValidationColumn.value;
    transientSkill.ttsFrontColumn = dom.skillTtsFrontColumn.value;
    transientSkill.ttsBackColumn = dom.skillTtsBackColumn.value;
    transientSkill.ttsOnHotkeyOnly = dom.skillTtsOnHotkeyOnly.checked;
    transientSkill.front = getSelectedRoles(dom.skillFrontColumns);
    transientSkill.back = getSelectedRoles(dom.skillBackColumns);

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
    renderSkillsList();
    populateAllSkillSelectors();
    handleSettingsChange();
    dom.skillConfigModal.classList.add('hidden');
    showTopNotification(`Skill '${skillToSave.name}' saved.`, 'success');
}

/**
 * Deletes a skill from the current configuration.
 * @param {string} skillId - The ID of the skill to delete.
 */
export function deleteSkill(skillId) {
    const currentConfig = state.configs[dom.configSelector.value];
    if (!currentConfig || !currentConfig.skills) return;

    const skillToDelete = currentConfig.skills.find(s => s.id === skillId);
    if (!skillToDelete) return;

    if (confirm(`Are you sure you want to delete the skill "${skillToDelete.name}"?`)) {
        currentConfig.skills = currentConfig.skills.filter(s => s.id !== skillId);
        if (currentConfig.activeSkills) {
            currentConfig.activeSkills = currentConfig.activeSkills.filter(id => id !== skillId);
        }

        renderSkillsList();
        populateAllSkillSelectors();
        handleSettingsChange();
        showTopNotification(`Skill "${skillToDelete.name}" deleted.`, 'success');
    }
}

/**
 * Deletes all skills from the current configuration.
 */
export function deleteAllSkills() {
    const currentConfig = state.configs[dom.configSelector.value];
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
    const currentConfig = state.configs[dom.configSelector.value];
    if (!currentConfig) {
        showTopNotification('Please select or save a configuration first.');
        return;
    }
    if (!confirm('This will add preset skills to your configuration. Any existing skills will be kept. Continue?')) {
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

        renderSkillsList();
        populateAllSkillSelectors();
        handleSettingsChange();
        showTopNotification('Preset skills added.', 'success');
    } catch (error) {
        console.error('Failed to load preset skills:', error);
        showTopNotification('Error: Could not load preset skills.', 'error');
    }
}

/**
 * Exports the skills from the current configuration to a JSON file.
 */
export async function exportSkills() {
    const currentConfig = state.configs[dom.configSelector.value];
    if (!currentConfig || !currentConfig.skills || currentConfig.skills.length === 0) {
        showTopNotification('No skills to export in the current configuration.', 'error');
        return;
    }

    const skillsJson = JSON.stringify(currentConfig.skills, null, 2);
    const blob = new Blob([skillsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dom.configSelector.value || 'flashcards'}-skills.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showTopNotification('Skills exported successfully.', 'success');
}

/**
 * Populates a single skill selector container (desktop or mobile) with checkboxes.
 * @param {HTMLElement} container - The container element to populate.
 * @param {boolean} isMobile - Flag to create unique IDs for mobile checkboxes.
 */
function populateSkillSelector(container, isMobile = false) {
    if (!container) return;
    const listContainer = container.querySelector('.skill-checkbox-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const currentConfig = state.configs[dom.configSelector.value];
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
        listContainer.appendChild(div);
    });

    if (currentConfig.activeSkills) {
        currentConfig.activeSkills.forEach(skillId => {
            const cb = listContainer.querySelector(`input[value="${skillId}"]`);
            if (cb) cb.checked = true;
        });
    }
}

/**
 * Populates both the main and mobile skill selector checkboxes.
 */
export function populateAllSkillSelectors() {
    populateSkillSelector(dom.skillSelectorCheckboxes, false);
    populateSkillSelector(dom.mobileSkillSelectorCheckboxes, true);
}

/**
 * Gets the IDs of the currently selected skills from the UI checkboxes.
 * @returns {string[]} An array of selected skill IDs.
 */
export function getSelectedSkills() {
    if (!dom.skillSelectorCheckboxes) return [];
    return Array.from(dom.skillSelectorCheckboxes.querySelectorAll('input[type="checkbox"]:checked:not([name="toggle-all-skills"])')).map(cb => cb.value);
}

/**
 * Gets the active skills from the current configuration state.
 * @returns {string[]} An array of active skill IDs.
 */
export function getActiveSkills() {
    const currentConfig = state.configs[dom.configSelector.value];
    return (currentConfig && currentConfig.activeSkills) ? currentConfig.activeSkills : [];
}