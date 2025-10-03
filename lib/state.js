/**
 * @file Manages the shared state of the application.
 * This includes data, configurations, and UI state that needs to be accessed by multiple modules.
 */

export const COLUMN_ROLES = {
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

export const state = {
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
    repetitionIntervals: [5, 25, 120, 600, 3600, 18000, 86400, 432000, 2160000, 10368000, 63072000],
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragThreshold: 100,
    verticalDragThreshold: 50,
    isAuthenticated: false,
};

export const dom = {
    // This object will be populated in app.js with all the DOM elements.
};

export function getActiveSkills() {
    const currentConfigName = dom.configSelector.value;
    const currentConfig = state.configs[currentConfigName];
    return (currentConfig && currentConfig.activeSkills) ? currentConfig.activeSkills : [];
}

export function getCurrentSkillConfig() {
    const currentConfigName = dom.configSelector.value;
    const currentConfig = state.configs[currentConfigName];
    if (!currentConfig || !currentConfig.skills || !state.currentSkillId) {
        return null;
    }
    const skillConfig = currentConfig.skills.find(s => s.id === state.currentSkillId);

    if (!skillConfig && currentConfig.skills.length > 0) {
        return currentConfig.skills[0];
    }
    return skillConfig;
}