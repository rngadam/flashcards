
import { adjustFontSize, formatTimeDifference } from './ui-helpers.js';
import { COLUMN_ROLES } from '../core/state.js';
import { VERIFICATION_METHODS } from '../skill-utils.js';

// Dependencies to be injected
let dom;
let state;
let getRetentionScore;
let getTimeToDue;
let createDefaultSkillStats;
let updateState;

export function initUIManager(dependencies) {
    dom = dependencies.dom;
    state = dependencies.state;
    getRetentionScore = dependencies.getRetentionScore;
    getTimeToDue = dependencies.getTimeToDue;
    createDefaultSkillStats = dependencies.createDefaultSkillStats;
    updateState = dependencies.updateState;
}

export function isAudioOnly(skillConfig) {
    return skillConfig && skillConfig.front.length === 0 && skillConfig.ttsFrontColumn && skillConfig.ttsFrontColumn !== 'none';
}

export function renderSkillMastery(cardStats) {
    if (!dom.skillMasteryDashboard) return;

    const currentConfig = state.configs[state.currentConfig] || {};
    const userSkills = currentConfig.skills || [];
    const activeSkills = new Set(currentConfig.activeSkills || []);

    let html = '';
    let totalScore = 0;
    let totalViews = 0;

    userSkills.forEach((skill, index) => {
        const skillStats = cardStats.skills[skill.id] || createDefaultSkillStats();
        const score = getRetentionScore(skillStats);
        const timeToDueResult = getTimeToDue(skillStats);
        const timeToDue = {
            ms: timeToDueResult.ms,
            formatted: formatTimeDifference(timeToDueResult.ms)
        };
        const letter = String.fromCharCode(65 + index);

        totalScore += score;
        totalViews += skillStats.viewCount || 0;

        let classes = 'skill-mastery-item';
        if (skill.id === state.currentSkillId) classes += ' active';
        if (activeSkills.has(skill.id)) classes += ' active-session';

        html += `
            <div class="${classes}" data-skill-id="${skill.id}" title="${skill.name} - Next review: ${timeToDue.formatted}">
                <span class="skill-name">${letter}</span>
                <span class="skill-score">${score}</span>
            </div>
        `;
    });

    dom.skillMasteryDashboard.innerHTML = html;
    dom.skillMasteryDashboard.title = 'Click to configure skills';

    // Synchronize the highlight with the top skill selector checkboxes
    document.querySelectorAll('#skill-selector-checkboxes label, #mobile-skill-selector-checkboxes label').forEach(label => {
        label.classList.remove('current-skill-highlight');
    });
    if (state.currentSkillId) {
        const desktopLabel = document.querySelector(`#skill-selector-checkboxes label[for="skill-checkbox-${state.currentSkillId}"]`);
        if (desktopLabel) desktopLabel.classList.add('current-skill-highlight');

        const mobileLabel = document.querySelector(`#mobile-skill-selector-checkboxes label[for="skill-checkbox-mobile-${state.currentSkillId}"]`);
        if (mobileLabel) mobileLabel.classList.add('current-skill-highlight');
    }


    if (dom.successRate) {
        if (totalViews > 0) {
            const rate = (totalScore / totalViews) * 100;
            dom.successRate.textContent = `Success: ${rate.toFixed(0)}%`;
        } else {
            dom.successRate.textContent = 'Success: N/A';
        }
    }
}


export function renderCardFaces(frontParts, backParts, skillConfig) {
    dom.cardFrontContent.innerHTML = '';
    dom.cardBackContent.innerHTML = '';

    const applyTransforms = (part, side) => {
        const transform = skillConfig.transforms?.[side]?.[part.role];
        let text = part.text;
        if (transform) {
            let casing = transform.casing;
            if (casing === 'random') {
                const options = ['uppercase', 'lowercase', 'initial'];
                casing = options[Math.floor(Math.random() * options.length)];
            }

            switch (casing) {
                case 'uppercase': text = text.toUpperCase(); break;
                case 'lowercase': text = text.toLowerCase(); break;
                case 'initial': text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(); break;
                case 'alternate':
                    if (side === 'front') {
                        text = state.useUppercase ? text.toUpperCase() : text;
                    }
                    break;
            }
        }
        return text;
    };

    if (isAudioOnly(skillConfig)) {
        dom.cardFrontContent.innerHTML = '<span class="speech-icon">🔊</span>';
    } else {
        frontParts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.className = `card-role-${part.role.toLowerCase()}`;
            partDiv.textContent = applyTransforms(part, 'front');

            const transform = skillConfig.transforms?.front?.[part.role];
            if (transform?.font) {
                if (transform.font === 'Random') {
                    const availableFonts = ['Arial', 'Verdana', 'Times New Roman', 'Courier New'];
                    partDiv.style.fontFamily = availableFonts[Math.floor(Math.random() * availableFonts.length)];
                } else {
                    partDiv.style.fontFamily = transform.font;
                }
            }
            dom.cardFrontContent.appendChild(partDiv);
        });
    }

    backParts.forEach(part => {
        const partDiv = document.createElement('div');
        partDiv.className = `card-role-${part.role.toLowerCase()}`;
        partDiv.textContent = applyTransforms(part, 'back');
        const transform = skillConfig.transforms?.back?.[part.role];
        if (transform?.font) {
            if (transform.font === 'Random') {
                const availableFonts = ['Arial', 'Verdana', 'Times New Roman', 'Courier New'];
                partDiv.style.fontFamily = availableFonts[Math.floor(Math.random() * availableFonts.length)];
            } else {
                partDiv.style.fontFamily = transform.font;
            }
        }
        dom.cardBackContent.appendChild(partDiv);
    });

    dom.cardFront.style.fontSize = '';
    dom.cardBackContent.style.fontSize = '';
    setTimeout(() => {
        adjustFontSize(dom.cardFrontContent, true);
        adjustFontSize(dom.cardBackContent, false);
    }, 50);
}

export function renderSkillsList() {
    if (!dom.skillsList) return;

    const currentConfig = state.configs[state.currentConfig];
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

    const currentConfig = state.configs[state.currentConfig];
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

function populateSkillSelector(container, isMobile = false) {
    if (!container) return;
    const listContainer = container.querySelector('.skill-checkbox-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const currentConfig = state.configs[state.currentConfig];
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

export function populateAllSkillSelectors() {
    populateSkillSelector(dom.skillSelectorCheckboxes, false);
    populateSkillSelector(dom.mobileSkillSelectorCheckboxes, true);
}

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