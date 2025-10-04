/**
 * @file Manages the shared state of the application.
 * This module centralizes all dynamic data, such as the current deck,
 * user configurations, and UI state, into a single object. It provides
 * getter and setter functions to ensure controlled access and modification
 * of the application's state.
 */

// --- Constants ---
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

export const defaultIntervals = [5, 25, 120, 600, 3600, 18000, 86400, 432000, 2160000, 10368000, 63072000]; // in seconds

// --- State Object ---
const state = {
    cardData: [], // Holds the parsed card data from the TSV/CSV file.
    headers: [], // Holds the column headers from the data file.
    currentCardIndex: 0, // The index of the currently displayed card in cardData.
    currentSkillId: null, // The ID of the skill being practiced.
    configs: {}, // Stores all saved deck configurations.
    voices: [], // Holds the list of available TTS voices from the browser.
    viewHistory: [], // A stack to keep track of the sequence of viewed cards for the "previous" button.
    currentRandomBaseIndex: -1, // The randomly selected index for the base language for the current card view.
    baseLanguageRotationIndex: 0, // For sequential rotation of base languages.
    frontParts: [], // Structured data for the front of the card: [{text, role}, ...]
    backParts: [], // Structured data for the back of the card.
    ttsFrontParts: [], // TTS-specific parts for the front.
    ttsBackParts: [], // TTS-specific parts for the back.
    useUppercase: false, // A flag for the "Alternate Uppercase" feature.
    replayRate: 1.0, // Tracks the current playback rate for the 'f' key replay feature.
    cardShownTimestamp: null, // Tracks when the card was shown to calculate response delay.
    isCurrentCardDue: false, // Tracks if the current card was shown because it was due for review.
    columnLanguages: [], // Holds the detected language for each column.
    activeFilterWords: new Set(), // Holds the words for the current filter.
    recognitionInstance: null,
    recognitionActive: false, // Use a flag to control the recognition loop

    // History table sort state
    historySortColumn: -1,
    historySortDirection: 'asc',

    // Spaced Repetition State
    repetitionIntervals: [...defaultIntervals],

    // Drag state for swipe gestures
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragThreshold: 100,
    verticalDragThreshold: 50,

    // Auth & Sync State
    isAuthenticated: false,
};

// --- State Accessors and Mutators ---

/**
 * Retrieves the entire state object.
 * @returns {object} The current application state.
 */
export function getState() {
    return state;
}

/**
 * Updates one or more properties of the state object.
 * @param {object} newState - An object with the properties to update.
 */
export function updateState(newState) {
    Object.assign(state, newState);
}

// --- Specific State Helpers ---

/**
 * Pushes a state to the view history stack.
 * @param {{cardIndex: number, skillId: string}} historyState - The state to save.
 */
export function pushToViewHistory(historyState) {
    state.viewHistory.push(historyState);
}

/**
 * Pops the last state from the view history stack.
 * @returns {{cardIndex: number, skillId: string} | undefined} The last state or undefined if history is empty.
 */
export function popFromViewHistory() {
    return state.viewHistory.pop();
}

/**
 * Clears the view history.
 */
export function clearViewHistory() {
    state.viewHistory = [];
}