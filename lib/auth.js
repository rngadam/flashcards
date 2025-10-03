import { get, set, keys } from './idb-keyval-wrapper.js';

/**
 * A utility to check if an item is a non-array object.
 * @param {*} item - The item to check.
 * @returns {boolean} True if the item is a non-array object.
 */
export function isObject(item) {
    return !!(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Recursively merges source objects into a target object.
 * @param {object} target - The target object to merge into.
 * @param  {...object} sources - The source objects to merge from.
 * @returns {object} The merged target object.
 */
export function deepMerge(target, ...sources) {
    if (!sources.length) {
        return target;
    }
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) {
                    Object.assign(target, { [key]: {} });
                }
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

export function populateLoginButtons(providers) {
    const loginProvidersContainer = document.getElementById('login-providers');
    if (!loginProvidersContainer) return;

    loginProvidersContainer.innerHTML = ''; // Clear existing buttons
    providers.forEach(provider => {
        const button = document.createElement('a');
        button.href = `/auth/${provider}`;
        button.className = `button login-button-${provider}`;
        // Capitalize provider name for display
        button.textContent = `Login with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;
        loginProvidersContainer.appendChild(button);
    });
}

export async function syncToServer(data, showTopNotification, isAuthenticated) {
    if (!isAuthenticated || !data) return;

    try {
        const response = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data) // e.g., { configs: allConfigs } or { cardStats: { cardKey: stats } }
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

export async function syncFromServer(actions, cardData, isAuthenticated) {
    const { get, set, keys, mergeCardStats, showTopNotification, populateConfigSelector, loadSelectedConfig, showNextCard } = actions;
    if (!isAuthenticated) return;

    try {
        const response = await fetch('/api/sync');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with ${response.status}`);
        }
        const serverData = await response.json();
        const localKeys = new Set(await keys());
        const serverStatKeys = new Set(Object.keys(serverData.cardStats || {}));

        // --- Config Merging ---
        const localConfigs = await get('flashcard-configs') || {};
        const mergedConfigs = deepMerge({}, localConfigs, serverData.configs || {});
        await set('flashcard-configs', mergedConfigs);

        // --- Card Stat Merging (Server -> Local) ---
        for (const cardKey of serverStatKeys) {
            const serverStats = serverData.cardStats[cardKey];
            const localStats = await get(cardKey);
            const mergedStats = mergeCardStats(localStats || { skills: {} }, serverStats);
            await set(cardKey, mergedStats);
        }

        // --- Two-Way Sync (Local -> Server) ---
        const localOnlyStats = {};
        for (const localKey of localKeys) {
            // Ignore config keys, only sync card stats
            if (localKey.startsWith('flashcard-')) continue;
            if (!serverStatKeys.has(localKey)) {
                localOnlyStats[localKey] = await get(localKey);
            }
        }

        if (Object.keys(localOnlyStats).length > 0) {
            console.log(`Found ${Object.keys(localOnlyStats).length} local-only card stats to upload.`);
            await syncToServer({ cardStats: localOnlyStats }, showTopNotification, isAuthenticated);
        }

        showTopNotification('Data sync complete.', 'success');

        // --- Refresh UI ---
        populateConfigSelector();
        const lastConfig = await get('flashcard-last-config');
        if (lastConfig && mergedConfigs[lastConfig]) {
            document.getElementById('config-selector').value = lastConfig;
            await loadSelectedConfig(lastConfig);
        } else if (cardData.length > 0) {
            showNextCard();
        }
        return mergedConfigs;

    } catch (error) {
        console.error('Failed to sync from server:', error);
        showTopNotification('Could not sync from server.', 'error');
        return await get('flashcard-configs') || {};
    }
}

function setupLoginModal(loginButton, loginModal, closeLoginModalButton) {
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            if (loginModal) loginModal.classList.remove('hidden');
        });
    }
    if (closeLoginModalButton) {
        closeLoginModalButton.addEventListener('click', () => {
            if (loginModal) loginModal.classList.add('hidden');
        });
    }
}

export async function checkAuthStatus() {
    const loginButton = document.getElementById('login-button');
    const loginModal = document.getElementById('login-modal');
    const closeLoginModalButton = document.getElementById('close-login-modal-button');
    const userProfile = document.getElementById('user-profile');
    const userDisplayName = document.getElementById('user-display-name');
    const logoutButton = document.getElementById('logout-button');
    const loginBlurb = document.getElementById('login-blurb');

    // Add blurb to login dialog
    if (loginBlurb) {
        loginBlurb.textContent = 'Log in to keep your progress and configurations synchronized across all your devices.';
    }

    try {
        // First, check if user is logged in
        const userResponse = await fetch('/api/user');
        if (!userResponse.ok) throw new Error('Backend not reachable');
        const userData = await userResponse.json();

        if (userData.user) {
            // --- User is Logged In ---
            if (userProfile) userProfile.classList.remove('hidden');
            if (loginButton) loginButton.classList.add('hidden');
            if (userDisplayName) userDisplayName.textContent = userData.user.displayName || userData.user.email;

            if (logoutButton) {
                logoutButton.addEventListener('click', async () => {
                    await fetch('/api/logout', { method: 'POST' });
                    window.location.reload(); // Reload is acceptable on logout
                });
            }
            return userData.user;

        } else {
            // --- User is a Guest ---
            if (userProfile) userProfile.classList.add('hidden');
            if (loginButton) loginButton.classList.remove('hidden');

            // Fetch available login providers
            const providersResponse = await fetch('/api/auth/providers');
            if (!providersResponse.ok) throw new Error('Backend not reachable');
            const providers = await providersResponse.json();

            if (providers.length > 0) {
                populateLoginButtons(providers);
                if (loginButton) {
                    loginButton.disabled = false;
                    loginButton.title = 'Login or create an account';
                }
            } else {
                 if (loginButton) {
                    loginButton.disabled = true;
                    loginButton.title = 'Login is not configured on the server.';
                }
            }
            return null;
        }
    } catch (error) {
        // --- API Offline/Error State ---
        console.warn('API is not reachable. Running in offline/guest mode.', error.message);
        if (userProfile) userProfile.classList.add('hidden');
        if (loginButton) {
            loginButton.classList.remove('hidden');
            loginButton.disabled = true;
            loginButton.title = 'Cannot connect to the server to log in.';
        }
        return null;
    } finally {
        // This setup should run regardless of API status
        setupLoginModal(loginButton, loginModal, closeLoginModalButton);
    }
}