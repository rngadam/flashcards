import { get, set } from './idb-keyval-wrapper.js';
import { state } from './state.js';
import { showTopNotification } from './ui.js';

// This object will be populated in app.js with all the DOM elements.
const dom = {};
export function setDom(domElements) {
    Object.assign(dom, domElements);
}

function getApiEndpoint(path) {
    const baseUrl = dom.apiUrlInput.value.trim();
    return `${baseUrl}${path}`;
}

export async function syncToServer(type, key, value) {
    if (!state.isAuthenticated) return;

    try {
        const response = await fetch(getApiEndpoint('/api/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, key, value })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with ${response.status}`);
        }
        // console.log(`Successfully synced ${type}:${key} to server.`);
    } catch (error) {
        console.error(`Failed to sync ${type}:${key} to server:`, error);
        showTopNotification('Sync to server failed. Your work is saved locally.', 'error');
    }
}

function setupLoginModal(loginButtons, loginModal, closeLoginModalButton) {
    loginButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                if (loginModal) loginModal.classList.remove('hidden');
            });
        }
    });
    if (closeLoginModalButton) {
        closeLoginModalButton.addEventListener('click', () => {
            if (loginModal) loginModal.classList.add('hidden');
        });
    }
}

function mergeCardStats(existing, imported) {
    if (!existing.skills) existing.skills = {};
    if (!imported.skills) return existing;

    for (const skillId in imported.skills) {
        const importedSkill = imported.skills[skillId];
        const existingSkill = existing.skills[skillId];

        if (existingSkill) {
            existingSkill.successTimestamps = [...new Set([...existingSkill.successTimestamps, ...importedSkill.successTimestamps])].sort((a, b) => a - b);
            existingSkill.failureTimestamps = [...new Set([...existingSkill.failureTimestamps, ...importedSkill.failureTimestamps])].sort((a, b) => a - b);
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
    try {
        showTopNotification('Syncing data from your account...', 'success');
        const response = await fetch(getApiEndpoint('/api/sync'));
        if (!response.ok) {
            throw new Error('Failed to fetch data from server.');
        }
        const serverData = await response.json();

        if (serverData.configs) {
            const localConfigs = await get('flashcard-configs') || {};
            const mergedConfigs = { ...localConfigs, ...serverData.configs };
            await set('flashcard-configs', mergedConfigs);
        }

        if (serverData.cardStats) {
            for (const key in serverData.cardStats) {
                const serverStat = serverData.cardStats[key];
                const localStat = await get(key);
                if (localStat) {
                    const mergedStat = mergeCardStats(localStat, serverStat);
                    await set(key, mergedStat);
                } else {
                    await set(key, serverStat);
                }
            }
        }
        showTopNotification('Sync complete!', 'success');
        setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
        console.error('Error syncing from server:', error);
        showTopNotification('Could not sync data from your account.', 'error');
    }
}

export async function checkAuthStatus() {
    const allLoginButtons = [dom.loginButton, dom.mobileLoginButton];

    const showLoggedInState = (user) => {
        dom.userProfile.classList.remove('hidden');
        dom.mobileUserProfile.classList.remove('hidden');
        dom.userDisplayName.textContent = user.displayName || user.email;
        dom.mobileUserDisplayName.textContent = user.displayName || user.email;
        allLoginButtons.forEach(btn => { if (btn) btn.classList.add('hidden'); });
    };

    const showLoggedOutState = () => {
        dom.userProfile.classList.add('hidden');
        dom.mobileUserProfile.classList.add('hidden');
        allLoginButtons.forEach(btn => { if (btn) btn.classList.remove('hidden'); });
    };

    try {
        const providersResponse = await fetch(getApiEndpoint('/api/auth/providers'));
        if (!providersResponse.ok) {
            throw new Error('Backend is not reachable. Login is disabled.');
        }
        const providers = await providersResponse.json();

        dom.loginProviderButtons.innerHTML = '';
        if (providers.length > 0) {
            providers.forEach(provider => {
                const a = document.createElement('a');
                a.href = getApiEndpoint(`/auth/${provider}`);
                a.className = `login-button ${provider}`;
                a.textContent = `Login with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;
                dom.loginProviderButtons.appendChild(a);
            });
        } else {
            dom.loginProviderButtons.textContent = 'No login providers are configured on the server.';
        }

        const userResponse = await fetch(getApiEndpoint('/api/user'));
        if (!userResponse.ok) {
            throw new Error(`API request failed with status ${userResponse.status}`);
        }
        const data = await userResponse.json();

        if (data.user) {
            state.isAuthenticated = true;
            showLoggedInState(data.user);
            await syncFromServer();
            showTopNotification(`Logged in as ${data.user.displayName || data.user.email}. Progress is being synced.`, 'success');

            const handleLogout = async () => {
                await fetch(getApiEndpoint('/api/logout'), { method: 'POST' });
                state.isAuthenticated = false;
                window.location.reload();
            };
            dom.logoutButton.addEventListener('click', handleLogout);
            dom.mobileLogoutButton.addEventListener('click', handleLogout);
        } else {
            state.isAuthenticated = false;
            showLoggedOutState();
            setupLoginModal(allLoginButtons, dom.loginModal, dom.closeLoginModalButton);
        }
    } catch (error) {
        console.error('Error during auth check:', error);
        showTopNotification(error.message, 'error', 5000);
        state.isAuthenticated = false;
        showLoggedOutState();
        allLoginButtons.forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.title = 'Cannot connect to the server to log in.';
                btn.classList.add('disabled');
            }
        });
    }
}