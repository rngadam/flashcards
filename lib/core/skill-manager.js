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
let showTopNotification;
let handleSettingsChange;

/**
 * Initializes the skill manager with required dependencies.
 * @param {object} dependencies - The dependencies to inject.
 */
export function initSkillManager(dependencies) {
    dom = dependencies.dom;
    state = dependencies.state;
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

/**
 * Opens the skill configuration dialog to add a new skill or edit an existing one.
 * @param {string|null} [skillId=null] - The ID of the skill to edit, or null to add a new one.
 */
function openTransformDialog(side, role) {
    const skillId = dom.editingSkillIdInput.value;
    const currentConfig = state.configs[dom.configSelector.value];
    const skill = skillId ? currentConfig.skills.find(s => s.id === skillId) : state.transientSkill;
    if (!skill) return;

    const transform = skill.transforms?.[side]?.[role] || {};

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

    const skillId = dom.editingSkillIdInput.value;
    const currentConfig = state.configs[dom.configSelector.value];
    // When creating a new skill, we modify the transientSkill object.
    // When editing an existing skill, we modify it directly.
    const skill = skillId ? currentConfig.skills.find(s => s.id === skillId) : state.transientSkill;
    if (!skill) return;

    if (!skill.transforms) skill.transforms = { front: {}, back: {} };
    if (!skill.transforms[side]) skill.transforms[side] = {};

    const transformData = {
        hideString: dom.transformHideString.checked,
        hideStringColumn: dom.transformHideStringColumn.value,
        suppressParentheses: dom.transformSuppressParentheses.checked,
        font: dom.transformFont.value,
        casing: dom.transformCasing.value
    };

    // Only save the transform if it's not default
    if (Object.values(transformData).some(v => v && v !== 'default')) {
        skill.transforms[side][role] = transformData;
    } else {
        delete skill.transforms[side][role];
    }


    // Visually indicate that a transform is active
    const label = document.querySelector(`#skill-${side}-columns label[for$="-${role}"]`);
    if (label) {
        label.classList.toggle('has-transform', !!skill.transforms[side][role]);
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
            [VERIFICATION_METHODS.VOICE]: 'Voice Input'
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
                // Prevent checkbox from toggling, and open transform dialog instead.
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
    let skillToEdit;

    if (skillId && currentConfig && currentConfig.skills) {
        const foundSkill = currentConfig.skills.find(s => s.id === skillId);
        // Deep copy for editing, to avoid modifying state directly until save
        if (foundSkill) skillToEdit = JSON.parse(JSON.stringify(foundSkill));
    }

    if (skillToEdit) {
        updateState({ transientSkill: null }); // Clear any old transient skill
        dom.skillConfigTitle.textContent = 'Edit Skill';
        dom.editingSkillIdInput.value = skillToEdit.id;
        dom.skillNameInput.value = skillToEdit.name;
        dom.skillVerificationMethod.value = skillToEdit.verificationMethod;
        dom.skillValidationColumn.value = skillToEdit.validationColumn;
        dom.skillTtsFrontColumn.value = skillToEdit.ttsFrontColumn;
        dom.skillTtsBackColumn.value = skillToEdit.ttsBackColumn;
        dom.skillTtsOnHotkeyOnly.checked = skillToEdit.ttsOnHotkeyOnly || false;
    } else {
        // For new skills, create a transient skill object to hold data
        const newSkill = {
            id: '',
            name: '',
            verificationMethod: VERIFICATION_METHODS.NONE,
            validationColumn: 'none',
            ttsFrontColumn: 'TARGET_LANGUAGE',
            ttsBackColumn: 'BASE_LANGUAGE',
            ttsOnHotkeyOnly: false,
            front: [],
            back: [],
            transforms: { front: {}, back: {} }
        };
        updateState({ transientSkill: newSkill });
        skillToEdit = newSkill;

        dom.skillConfigTitle.textContent = 'Add New Skill';
        dom.editingSkillIdInput.value = '';
        dom.skillNameInput.value = '';
        dom.skillVerificationMethod.value = VERIFICATION_METHODS.NONE;
        dom.skillValidationColumn.value = 'none';
        dom.skillTtsFrontColumn.value = 'TARGET_LANGUAGE';
        dom.skillTtsBackColumn.value = 'BASE_LANGUAGE';
        dom.skillTtsOnHotkeyOnly.checked = false;
    }

    populateColumnCheckboxes(dom.skillFrontColumns, 'front', skillToEdit);
    populateColumnCheckboxes(dom.skillBackColumns, 'back', skillToEdit);

    dom.skillValidationColumn.disabled = dom.skillVerificationMethod.value === 'none';
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
    const transientSkill = state.transientSkill;

    const skillData = {
        name: skillName,
        verificationMethod: dom.skillVerificationMethod.value,
        validationColumn: dom.skillValidationColumn.value,
        ttsFrontColumn: dom.skillTtsFrontColumn.value,
        ttsBackColumn: dom.skillTtsBackColumn.value,
        ttsOnHotkeyOnly: dom.skillTtsOnHotkeyOnly.checked,
        front: getSelectedRoles(dom.skillFrontColumns),
        back: getSelectedRoles(dom.skillBackColumns),
        transforms: editingSkillId ? (currentConfig.skills.find(s => s.id === editingSkillId)?.transforms || {}) : (transientSkill?.transforms || {})
    };

    const newSkillId = await createSkillId(skillData);

    if (currentConfig.skills.find(s => s.id === newSkillId && s.id !== editingSkillId)) {
        showTopNotification(`A skill with these exact settings already exists.`, 'error');
        return;
    }

    let skill;
    if (editingSkillId) {
        skill = currentConfig.skills.find(s => s.id === editingSkillId);
        if (!skill) {
            showTopNotification('Error: Skill not found for editing.');
            return;
        }
        // If the ID changes, we need to remove the old one and add the new one.
        if (skill.id !== newSkillId) {
            currentConfig.skills = currentConfig.skills.filter(s => s.id !== editingSkillId);
            const newSkill = { ...skillData, id: newSkillId };
            currentConfig.skills.push(newSkill);
            // Update active skills if necessary
            if (currentConfig.activeSkills.includes(editingSkillId)) {
                currentConfig.activeSkills = currentConfig.activeSkills.map(id => id === editingSkillId ? newSkillId : id);
            }
            skill = newSkill;
        } else {
            Object.assign(skill, skillData);
        }
    } else {
        skill = await createSkill(skillData);
        currentConfig.skills.push(skill);
    }

    updateState({ transientSkill: null }); // Clear the transient skill
    renderSkillsList();
    populateAllSkillSelectors();
    handleSettingsChange();
    dom.skillConfigModal.classList.add('hidden');
    showTopNotification(`Skill '${skill.name}' saved.`, 'success');
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
            // Legacy support for alternateUppercase
            if (p.alternateUppercase) {
                if (!skillData.transforms.front) skillData.transforms.front = {};
                skillData.transforms.front.TARGET_LANGUAGE = { casing: 'alternate' };
            }

            const id = await createSkillId(skillData);
            if (currentConfig.skills.find(s => s.id === id)) continue;
            const created = await createSkill({ ...skillData, id });
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
    container.innerHTML = '';
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
        container.appendChild(div);
    });

    if (currentConfig.activeSkills) {
        currentConfig.activeSkills.forEach(skillId => {
            const cb = container.querySelector(`input[value="${skillId}"]`);
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
    return Array.from(dom.skillSelectorCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
}

/**
 * Gets the active skills from the current configuration state.
 * @returns {string[]} An array of active skill IDs.
 */
export function getActiveSkills() {
    const currentConfig = state.configs[dom.configSelector.value];
    return (currentConfig && currentConfig.activeSkills) ? currentConfig.activeSkills : [];
}