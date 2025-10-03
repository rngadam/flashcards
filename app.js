import { state, dom as appDom } from './lib/state.js';
import { setDom as setAuthDom, checkAuthStatus } from './lib/auth.js';
import { setDom as setUiDom, updateLayout, initializeTabSwitching, dragStart, dragMove, dragEnd } from './lib/ui.js';
import { setDom as setCardLogicDom, loadData, showNextCard, showPrevCard, flipCard, markCardAsKnown } from './lib/card-logic.js';
import { setDom as setSkillDom, initializeSkillManagement, loadSelectedConfig, saveConfig, resetDeckStats, handleSkillSelectionChange } from './lib/skill-management.js';


document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // --- 1. Gather all DOM elements into a single object ---
    const elements = {
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
        multipleChoiceCount: document.getElementById('multiple-choice-count'),
        voiceCorrectDelayInput: document.getElementById('voice-correct-delay'),
        configNameInput: document.getElementById('config-name'),
        skillSelectorCheckboxes: document.getElementById('skill-selector-checkboxes'),
        mobileSkillSelectorCheckboxes: document.getElementById('mobile-skill-selector-checkboxes'),
        repetitionIntervalsTextarea: document.getElementById('repetition-intervals'),
        configSelector: document.getElementById('config-selector'),
        cardContainer: document.getElementById('card-container'),
        skillMasteryDashboard: document.getElementById('skill-mastery-dashboard'),
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
        loginButton: document.getElementById('login-button'),
        mobileLoginButton: document.getElementById('mobile-login-button'),
        loginModal: document.getElementById('login-modal'),
        closeLoginModalButton: document.getElementById('close-login-modal-button'),
        loginProviderButtons: document.getElementById('login-provider-buttons'),
        userProfile: document.getElementById('user-profile'),
        mobileUserProfile: document.getElementById('mobile-user-profile'),
        userDisplayName: document.getElementById('user-display-name'),
        mobileUserDisplayName: document.getElementById('mobile-user-display-name'),
        logoutButton: document.getElementById('logout-button'),
        mobileLogoutButton: document.getElementById('mobile-logout-button'),
        apiUrlInput: document.getElementById('api-url'),
        addSkillButton: document.getElementById('add-skill-button'),
        saveSkillButton: document.getElementById('save-skill-button'),
        presetSkillsButton: document.getElementById('preset-skills-button'),
        exportSkillsButton: document.getElementById('export-skills-button'),
        deleteAllSkillsButton: document.getElementById('delete-all-skills-button'),
        exportAllDataButton: document.getElementById('export-all-data-button'),
        importAllDataButton: document.getElementById('import-all-data-button'),
        importFileInput: document.getElementById('import-file-input'),
        exportSqliteButton: document.getElementById('export-sqlite-button'),
        skillsList: document.getElementById('skills-list'),
    };
    Object.assign(appDom, elements);

    // --- 2. Initialize Modules & UI ---
    setAuthDom(appDom);
    setUiDom(appDom);
    setCardLogicDom(appDom);
    setSkillDom(appDom);

    initializeTabSwitching();
    updateLayout();
    window.addEventListener('resize', updateLayout);

    initializeSkillManagement();
    checkAuthStatus(); // This will also handle the initial sync and config load

    // --- 3. Setup Main Event Listeners ---
    appDom.loadDataButton.addEventListener('click', async () => {
        await loadData();
        if (state.cardData.length > 0) {
            showNextCard();
        }
    });

    appDom.saveConfigButton.addEventListener('click', saveConfig);
    appDom.resetStatsButton.addEventListener('click', resetDeckStats);
    appDom.configSelector.addEventListener('change', () => loadSelectedConfig(appDom.configSelector.value));

    appDom.flipCardButton.addEventListener('click', flipCard);
    appDom.nextCardButton.addEventListener('click', () => showNextCard());
    appDom.prevCardButton.addEventListener('click', showPrevCard);
    appDom.iKnowButton.addEventListener('click', async () => { await markCardAsKnown(true); await showNextCard(); });
    appDom.iDontKnowButton.addEventListener('click', async () => { await markCardAsKnown(false); await showNextCard({ forceNew: true }); });

    appDom.card.addEventListener('mousedown', dragStart);
    appDom.card.addEventListener('touchstart', dragStart, { passive: false });
    appDom.card.addEventListener('mousemove', dragMove);
    appDom.card.addEventListener('touchmove', dragMove, { passive: false });
    appDom.card.addEventListener('mouseup', dragEnd);
    appDom.card.addEventListener('touchend', dragEnd);
    appDom.card.addEventListener('mouseleave', dragEnd);

    appDom.skillSelectorCheckboxes.addEventListener('change', handleSkillSelectionChange);
    appDom.mobileSkillSelectorCheckboxes.addEventListener('change', handleSkillSelectionChange);

    document.addEventListener('keydown', handleHotkeys);
}

function handleHotkeys(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        if (e.target.tagName === 'TEXTAREA') return;
        if (e.code !== 'Enter') return;
    }

    switch(e.code) {
        case 'Space':
            e.preventDefault();
            if (appDom.card && !appDom.card.classList.contains('flipped')) {
                flipCard();
            }
            break;
        case 'ArrowRight':
            showNextCard();
            break;
        case 'ArrowLeft':
            showPrevCard();
            break;
        case 'KeyK':
            markCardAsKnown(true).then(() => showNextCard());
            break;
        case 'KeyJ':
            markCardAsKnown(false).then(() => showNextCard({ forceNew: true }));
            break;
    }
}