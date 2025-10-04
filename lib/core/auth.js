/**
 * @file Manages user authentication and data synchronization with the server.
 */

import { get, set, keys } from '../idb-keyval-wrapper.js';

// Dependencies
let dom;
let state;
let updateState;
let showTopNotification;
let populateConfigSelector;
let loadSelectedConfig;
let showNextCard;

/**
 * Initializes the auth manager with required dependencies.
 * @param {object} dependencies - The dependencies to inject.
 */
export function initAuth(dependencies) {
    dom = dependencies.dom;
    state = dependencies.state;
    updateState = dependencies.updateState;
    showTopNotification = dependencies.showTopNotification;
    populateConfigSelector = dependencies.populateConfigSelector;
    loadSelectedConfig = dependencies.loadSelectedConfig;
    showNextCard = dependencies.showNextCard;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return deepMerge(target, ...sources);
}

function populateLoginButtons(providers) {
    if (!dom.loginProviders) return;
    dom.loginProviders.innerHTML = '';
    providers.forEach(provider => {
        const button = document.createElement('a');
        button.href = `/auth/${provider}`;
        button.className = `button login-button-${provider}`;
        button.textContent = `Login with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;
        dom.loginProviders.appendChild(button);
    });
}

/**
 * Synchronizes data to the server.
 * @param {object} data - The data to send (e.g., { configs: ... } or { cardStats: ... }).
 */
export async function syncToServer(data) {
    if (!state.isAuthenticated || !data) return;

    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with ${response.status}`);
        }
        console.log('Sync to server successful for:', Object.keys(data));
    } catch (error) {
        console.error('Failed to sync to server:', error);
        showTopNotification('Failed to sync to server. Your work is saved locally.', 'error');
    }
}

function mergeCardStats(existing, imported) {
    if (!existing.skills) existing.skills = {};
    if (!imported || !imported.skills) return existing;

    for (const skillId in imported.skills) {
        const importedSkill = imported.skills[skillId];
        const existingSkill = existing.skills[skillId];

        if (existingSkill) {
            const existingSuccess = existingSkill.successTimestamps || [];
            const importedSuccess = importedSkill.successTimestamps || [];
            const existingFailure = existingSkill.failureTimestamps || [];
            const importedFailure = importedSkill.failureTimestamps || [];

            existingSkill.successTimestamps = [...new Set([...existingSuccess, ...importedSuccess])].sort((a, b) => a - b);
            existingSkill.failureTimestamps = [...new Set([...existingFailure, ...importedFailure])].sort((a, b) => a - b);
            existingSkill.responseDelays = [...(existingSkill.responseDelays || []), ...(importedSkill.responseDelays || [])];
            existingSkill.viewCount = (existingSkill.viewCount || 0) + (importedSkill.viewCount || 0);
            existingSkill.lastViewed = Math.max(existingSkill.lastViewed || 0, importedSkill.lastViewed || 0);
            existingSkill.intervalIndex = Math.max(existingSkill.intervalIndex || 0, importedSkill.intervalIndex || 0);
        } else {
            existing.skills[skillId] = importedSkill;
        }
    }
    return existing;
}


async function syncFromServer() {
    if (!state.isAuthenticated) return;

    try {
        const response = await fetch('/api/sync');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with ${response.status}`);
        }
        const serverData = await response.json();
        const localKeys = new Set(await keys());
        const serverStatKeys = new Set(Object.keys(serverData.cardStats || {}));

        const localConfigs = await get('flashcard-configs') || {};
        const mergedConfigs = deepMerge({}, localConfigs, serverData.configs || {});
        await set('flashcard-configs', mergedConfigs);
        updateState({ configs: mergedConfigs });

        for (const cardKey of serverStatKeys) {
            const serverStats = serverData.cardStats[cardKey];
            const localStats = await get(cardKey);
            const mergedStats = mergeCardStats(localStats || { skills: {} }, serverStats);
            await set(cardKey, mergedStats);
        }

        const localOnlyStats = {};
        for (const localKey of localKeys) {
            if (localKey.startsWith('flashcard-')) continue;
            if (!serverStatKeys.has(localKey)) {
                localOnlyStats[localKey] = await get(localKey);
            }
        }

        if (Object.keys(localOnlyStats).length > 0) {
            await syncToServer({ cardStats: localOnlyStats });
        }

        showTopNotification('Data sync complete.', 'success');

        populateConfigSelector();
        const lastConfig = await get('flashcard-last-config');
        if (lastConfig && state.configs[lastConfig]) {
            dom.configSelector.value = lastConfig;
            await loadSelectedConfig(lastConfig);
        } else if (state.cardData.length > 0) {
            showNextCard();
        }

    } catch (error) {
        console.error('Failed to sync from server:', error);
        showTopNotification('Could not sync from server.', 'error');
    }
}

/**
 * Checks the user's authentication status and updates the UI accordingly.
 */
export async function checkAuthStatus() {
    if (dom.loginBlurb) {
        dom.loginBlurb.textContent = 'Log in to keep your progress and configurations synchronized across all your devices.';
    }

    try {
        const userResponse = await fetch('/api/user');
        if (!userResponse.ok) throw new Error('Backend not reachable');
        const userData = await userResponse.json();

        if (userData.user) {
            updateState({ isAuthenticated: true });
            if (dom.userProfile) dom.userProfile.classList.remove('hidden');
            if (dom.loginButton) dom.loginButton.classList.add('hidden');
            if (dom.userDisplayName) dom.userDisplayName.textContent = userData.user.displayName || userData.user.email;

            if (dom.logoutButton) {
                dom.logoutButton.addEventListener('click', async () => {
                    await fetch('/api/logout', { method: 'POST' });
                    updateState({ isAuthenticated: false });
                    window.location.reload();
                });
            }
            await syncFromServer();

        } else {
            updateState({ isAuthenticated: false });
            if (dom.userProfile) dom.userProfile.classList.add('hidden');
            if (dom.loginButton) dom.loginButton.classList.remove('hidden');

            const providersResponse = await fetch('/api/auth/providers');
            if (!providersResponse.ok) throw new Error('Backend not reachable');
            const providers = await providersResponse.json();

            if (providers.length > 0) {
                populateLoginButtons(providers);
                if (dom.loginButton) {
                    dom.loginButton.disabled = false;
                    dom.loginButton.title = 'Login or create an account';
                }
            } else {
                 if (dom.loginButton) {
                    dom.loginButton.disabled = true;
                    dom.loginButton.title = 'Login is not configured on the server.';
                }
            }
        }
    } catch (error) {
        console.warn('API is not reachable. Running in offline/guest mode.', error.message);
        updateState({ isAuthenticated: false });
        if (dom.userProfile) dom.userProfile.classList.add('hidden');
        if (dom.loginButton) {
            dom.loginButton.classList.remove('hidden');
            dom.loginButton.disabled = true;
            dom.loginButton.title = 'Cannot connect to the server to log in.';
        }
    }
}