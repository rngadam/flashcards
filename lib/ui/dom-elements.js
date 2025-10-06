/**
 * @file Centralized DOM element queries for the application.
 * This module queries all necessary DOM elements and exports them as a single
 * object to be used throughout the UI-related modules. This avoids repetitive
* document.getElementById calls and makes the codebase easier to maintain.
 */

const dom = {
    // Top Bar & Mobile Menu
    hamburgerMenu: document.getElementById('hamburger-menu'),
    mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
    closeMobileMenuButton: document.getElementById('close-mobile-menu-button'),
    mobileHistoryButton: document.getElementById('mobile-history-button'),
    mobileSettingsButton: document.getElementById('mobile-settings-button'),
    mobileHelpButton: document.getElementById('mobile-help-button'),
    fullscreenButton: document.getElementById('fullscreen-button'),
    mobileFullscreenButton: document.getElementById('mobile-fullscreen-button'),

    // Modals
    settingsModal: document.getElementById('settings-modal'),
    historyModal: document.getElementById('history-modal'),
    helpModal: document.getElementById('help-modal'),
    dashboardModal: document.getElementById('dashboard-modal'),
    loginModal: document.getElementById('login-modal'),
    skillConfigModal: document.getElementById('skill-config-modal'),


    // Modal Close Buttons
    closeSettingsButton: document.getElementById('close-settings-button'),
    closeHistoryButton: document.getElementById('close-history-button'),
    closeHelpButton: document.getElementById('close-help-button'),
    closeDashboardButton: document.getElementById('close-dashboard-button'),
    closeLoginModalButton: document.getElementById('close-login-modal-button'),

    // Main UI Buttons
    settingsButton: document.getElementById('settings-button'),
    historyButton: document.getElementById('history-button'),
    helpButton: document.getElementById('help-button'),
    dashboardButton: document.getElementById('dashboard-button'),
    mobileDashboardButton: document.getElementById('mobile-dashboard-button'),
    loginButton: document.getElementById('login-button'),


    // Settings - General
    configTitle: document.getElementById('config-title'),
    loadDataButton: document.getElementById('load-data'),
    saveConfigButton: document.getElementById('save-config'),
    resetStatsButton: document.getElementById('reset-stats'),
    dataUrlInput: document.getElementById('data-url'),
    columnRolesContainer: document.getElementById('column-roles-container'),
    fontSelector: document.getElementById('font-selector'),
    configNameInput: document.getElementById('config-name'),
    configSelector: document.getElementById('config-selector'),
    cacheStatus: document.getElementById('cache-status'),

    // Settings - Advanced
    ttsRateSlider: document.getElementById('tts-rate'),
    ttsRateBaseSlider: document.getElementById('tts-rate-base'),
    disableAnimationCheckbox: document.getElementById('disable-animation'),
    repetitionIntervalsTextarea: document.getElementById('repetition-intervals'),
    multipleChoiceCount: document.getElementById('multiple-choice-count'),
    voiceCorrectDelayInput: document.getElementById('voice-correct-delay'),

    // Settings - Skills
    skillSelectorCheckboxes: document.getElementById('skill-selector-checkboxes'),
    mobileSkillSelectorCheckboxes: document.getElementById('mobile-skill-selector-checkboxes'),
    addSkillButton: document.getElementById('add-skill-button'),
    presetSkillsButton: document.getElementById('preset-skills-button'),
    exportSkillsButton: document.getElementById('export-skills-button'),
    deleteAllSkillsButton: document.getElementById('delete-all-skills-button'),
    skillsList: document.getElementById('skills-list'),
    closeSkillConfigButton: document.getElementById('close-skill-config-button'),
    skillVerificationMethod: document.getElementById('skill-verification-method'),
    saveSkillButton: document.getElementById('save-skill-button'),
    skillConfigTitle: document.getElementById('skill-config-title'),
    skillNameInput: document.getElementById('skill-name-input'),
    skillValidationColumn: document.getElementById('skill-validation-column'),
    skillTtsFrontColumn: document.getElementById('skill-tts-front-column'),
    skillTtsBackColumn: document.getElementById('skill-tts-back-column'),
    skillFrontColumns: document.getElementById('skill-front-columns'),
    skillBackColumns: document.getElementById('skill-back-columns'),
    editingSkillIdInput: document.getElementById('editing-skill-id'),
    skillTtsOnHotkeyOnly: document.getElementById('skill-tts-on-hotkey-only'),

    // Text Transform Configuration
    textTransformModal: document.getElementById('text-transform-modal'),
    closeTransformButton: document.getElementById('close-transform-button'),
    transformConfigTitle: document.getElementById('transform-config-title'),
    editingTransformSide: document.getElementById('editing-transform-side'),
    editingTransformRole: document.getElementById('editing-transform-role'),
    transformHideString: document.getElementById('transform-hide-string'),
    transformHideStringColumn: document.getElementById('transform-hide-string-column'),
    transformSuppressParentheses: document.getElementById('transform-suppress-parentheses'),
    transformFont: document.getElementById('transform-font'),
    transformCasing: document.getElementById('transform-casing'),
    saveTransformButton: document.getElementById('save-transform-button'),


    // Settings - Data & Backup
    exportAllDataButton: document.getElementById('export-all-data-button'),
    exportSqliteButton: document.getElementById('export-sqlite-button'),
    importAllDataButton: document.getElementById('import-all-data-button'),
    importFileInput: document.getElementById('import-file-input'),


    // Settings - Filter
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

    // Card Elements
    cardContainer: document.getElementById('card-container'),
    skillMasteryDashboard: document.getElementById('skill-mastery-dashboard'),
    cardSpecificStats: document.getElementById('card-specific-stats'),
    cardFront: document.querySelector('.card-front'),
    cardFrontContent: document.getElementById('card-front-content'),
    cardBackContent: document.getElementById('card-back-content'),
    card: document.getElementById('card'),
    deckTitle: document.getElementById('deck-title'),
    lastSeen: document.getElementById('last-seen'),
    explanationMessage: document.getElementById('explanation-message'),
    ttsLangDisplayFront: document.getElementById('tts-lang-display-front'),
    ttsLangDisplayBack: document.getElementById('tts-lang-display-back'),

    // Card Controls
    flipCardButton: document.getElementById('flip-card'),
    nextCardButton: document.getElementById('next-card'),
    prevCardButton: document.getElementById('prev-card'),
    iKnowButton: document.getElementById('i-know'),
    iDontKnowButton: document.getElementById('i-dont-know'),

    // Verification Method Containers
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

    // Notifications
    topNotification: document.getElementById('top-notification'),

    // Dashboard
    masteredWordsList: document.getElementById('mastered-words-list'),
    difficultWordsList: document.getElementById('difficult-words-list'),
    historyTableContainer: document.getElementById('history-table-container'),

    // Auth
    userProfile: document.getElementById('user-profile'),
    userDisplayName: document.getElementById('user-display-name'),
    logoutButton: document.getElementById('logout-button'),
    loginProviders: document.getElementById('login-providers'),
    loginBlurb: document.getElementById('login-blurb'),
};

export default dom;