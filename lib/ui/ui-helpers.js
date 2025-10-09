/**
 * @file A collection of UI utility functions.
 * These functions handle common UI tasks like showing notifications,
 * adjusting font sizes, and formatting timestamps.
 */

import dom from './dom-elements.js';

let notificationTimeout;

/**
 * Displays a notification message at the top of the screen.
 * @param {string} message - The message to display.
 * @param {string} [type='error'] - The type of notification ('error', 'success', etc.).
 * @param {number} [duration=3000] - The duration to show the message in ms.
 */
export function showTopNotification(message, type = 'error', duration = 3000) {
    if (!dom.topNotification) return;

    // Clear any existing timeout to prevent the notification from disappearing early
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    dom.topNotification.textContent = message;
    // The 'hidden' class is removed and 'visible' is added to trigger the transition
    dom.topNotification.className = `visible ${type}`;

    // Set a timeout to hide the notification after the specified duration
    notificationTimeout = setTimeout(() => {
        dom.topNotification.className = `hidden ${type}`;
    }, duration);
}

/**
 * Dynamically adjusts the font size of an element to fit its container.
 * Uses a binary search approach for efficiency.
 * @param {HTMLElement} element - The text element to resize.
 * @param {boolean} isFront - A flag to determine the max font size.
 */
export function adjustFontSize(element, isFront) {
    if (!element) return;
    const container = element.closest('.card-face');
    if (!container) return;
    let min = 10, max = isFront ? 150 : 80;
    let bestSize = min;

    while (min <= max) {
        let mid = Math.floor((min + max) / 2);
        element.style.fontSize = `${mid}px`;
        if (element.scrollWidth <= container.clientWidth && element.scrollHeight <= container.clientHeight) {
            bestSize = mid;
            min = mid + 1;
        } else {
            max = mid - 1;
        }
    }
    element.style.fontSize = `${bestSize}px`;
}

/**
 * Converts a timestamp into a human-readable "time ago" string.
 * @param {number|null} timestamp - The timestamp to format.
 * @returns {string} A human-readable string like "5 minutes ago" or "just now".
 */
export function formatTimeAgo(timestamp) {
    if (!timestamp) return 'never';
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(months / 12);
    return `${years} years ago`;
}

/**
 * Formats a duration in seconds into a human-readable string.
 * @param {number} seconds - The duration in seconds.
 * @returns {string} A formatted string (e.g., "5 minutes", "2 hours").
 */
export function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
    if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
    return `${Math.round(seconds / 31536000)} years`;
}

/**
 * Formats a time difference in milliseconds into a compact, human-readable string.
 * @param {number} ms - The time difference in milliseconds.
 * @returns {string} A compact string (e.g., "5s", "10m", "2d").
 */
export function formatTimeDifference(ms) {
    if (ms <= 0) return 'Now';

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;

    const days = Math.floor(hours / 24);
    return `${days}d`;
}

// --- Logger UI helpers ---
import logger from '../core/logger.js';

/**
 * Render a simple logging controls panel into a container element.
 * container should be a DOM element where checkboxes and buttons will be appended.
 */
export function renderLoggingControls(container) {
    if (!container) return;
    container.innerHTML = '';
    const cfg = logger.getConfig();

    const title = document.createElement('h4');
    title.textContent = 'Logging';
    container.appendChild(title);

    const cats = ['language', 'sync', 'ui', 'debug', 'speech'];
    cats.forEach(cat => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = cfg.enabledCategories.has(cat);
        cb.addEventListener('change', () => {
            const newCats = new Set(logger.getConfig().enabledCategories);
            if (cb.checked) newCats.add(cat); else newCats.delete(cat);
            logger.setConfig({ enabledCategories: newCats });
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(` ${cat}`));
        container.appendChild(label);
        container.appendChild(document.createElement('br'));
    });

    const erConsole = document.createElement('label');
    const cbConsole = document.createElement('input'); cbConsole.type = 'checkbox'; cbConsole.checked = cfg.outputs.console;
    cbConsole.addEventListener('change', () => logger.setConfig({ outputs: { console: cbConsole.checked } }));
    erConsole.appendChild(cbConsole); erConsole.appendChild(document.createTextNode(' Console'));
    container.appendChild(erConsole); container.appendChild(document.createElement('br'));

    const erServer = document.createElement('label');
    const cbServer = document.createElement('input'); cbServer.type = 'checkbox'; cbServer.checked = cfg.outputs.server;
    cbServer.addEventListener('change', () => logger.setConfig({ outputs: { server: cbServer.checked } }));
    erServer.appendChild(cbServer); erServer.appendChild(document.createTextNode(' Send to server'));
    container.appendChild(erServer); container.appendChild(document.createElement('br'));

    const viewBtn = document.createElement('button'); viewBtn.textContent = 'Show Logs';
    const logContainer = document.createElement('div'); logContainer.className = 'log-buffer'; logContainer.style.maxHeight = '200px'; logContainer.style.overflow = 'auto';
    viewBtn.addEventListener('click', () => {
        const buf = logger.getBuffer();
        logContainer.innerHTML = buf.map(e => `<div>[${new Date(e.ts).toLocaleTimeString()}] [${e.category}] ${e.message} <pre>${JSON.stringify(e.meta)}</pre></div>`).join('');
    });
    container.appendChild(viewBtn);
    container.appendChild(logContainer);
}

/**
 * Render a small speech testing panel into a container.
 * Provides Start/Stop, interim/final transcript display and an audio level bar.
 */
export function renderSpeechPanel(container) {
    if (!container) return;
    container.innerHTML = '';
    const title = document.createElement('h4');
    title.textContent = 'Speech Tester';
    container.appendChild(title);

    const status = document.createElement('div'); status.className = 'speech-status'; status.textContent = 'Idle';
    const interim = document.createElement('div'); interim.className = 'speech-interim'; interim.textContent = '';
    const final = document.createElement('div'); final.className = 'speech-final'; final.textContent = '';
    const levelOuter = document.createElement('div'); levelOuter.className = 'level-outer'; levelOuter.style.width = '100%'; levelOuter.style.height = '8px'; levelOuter.style.background = '#eee';
    const levelInner = document.createElement('div'); levelInner.className = 'level-inner'; levelInner.style.width = '0%'; levelInner.style.height = '100%'; levelInner.style.background = '#4caf50';
    levelOuter.appendChild(levelInner);

    const startBtn = document.createElement('button'); startBtn.textContent = 'Start Test';
    const stopBtn = document.createElement('button'); stopBtn.textContent = 'Stop Test'; stopBtn.disabled = true;

    container.appendChild(status);
    container.appendChild(interim);
    container.appendChild(final);
    container.appendChild(levelOuter);
    container.appendChild(document.createElement('br'));
    container.appendChild(startBtn); container.appendChild(stopBtn);

    // dynamic import to avoid loading in Node tests
    import('./speech-test.js').then(mod => {
        const { createSpeechTester } = mod;
        const tester = createSpeechTester({
            onInterim: (t) => { interim.textContent = `Interim: ${t}`; },
            onResult: (t) => { final.textContent = `Final: ${t}`; },
            onError: (e) => { status.textContent = `Error: ${e && e.message ? e.message : String(e)}`; },
            onLevel: (v) => { levelInner.style.width = `${Math.round(v * 100)}%`; },
            onState: (s) => { status.textContent = s; }
        });

        startBtn.addEventListener('click', async () => {
            try { await tester.start(); startBtn.disabled = true; stopBtn.disabled = false; } catch (e) { status.textContent = `Error: ${e.message}`; }
        });
        stopBtn.addEventListener('click', () => { tester.stop(); startBtn.disabled = false; stopBtn.disabled = true; });
    }).catch(() => {
        status.textContent = 'Speech testing not available in this environment';
    });
}

/**
 * Renders a visual diff between the user's answer and the correct answer.
 * @param {string} userAnswer - The user's submitted answer.
 * @param {string} correctAnswer - The correct answer.
 * @param {boolean} isCorrect - Whether the user's answer was correct.
 * @returns {DocumentFragment} A document fragment containing the diff elements.
 */
export function renderDiff(userAnswer, correctAnswer, isCorrect) {
    const userAnswerLower = userAnswer.toLowerCase();
    const correctAnswerLower = correctAnswer.toLowerCase();
    // The user wants to see how to get from THEIR answer to the correct one.
    const diff = Diff.diffChars(userAnswerLower, correctAnswerLower);
    const fragment = document.createDocumentFragment();

    const resultDiv = document.createElement('div');
    resultDiv.innerHTML = `<strong>${isCorrect ? 'Correct!' : 'Incorrect.'}</strong>`;
    resultDiv.style.color = isCorrect ? 'green' : 'red';
    fragment.appendChild(resultDiv);

    // --- Your Answer ---
    const userDiv = document.createElement('div');
    userDiv.innerHTML = '<strong>Your Answer:</strong> ';
    const userContent = document.createElement('div');
    let userPointer = 0;
    diff.forEach(part => {
        // We only care about parts that were in the original user answer
        if (part.added) return;

        const span = document.createElement('span');
        // 'removed' means it's in the user's answer but not the correct one (an error).
        span.className = part.removed ? 'diff-removed' : 'diff-common';
        const originalText = userAnswer.substring(userPointer, userPointer + part.value.length);
        span.appendChild(document.createTextNode(originalText));
        userContent.appendChild(span);
        userPointer += part.value.length;
    });
    userDiv.appendChild(userContent);

    // --- Correct Answer ---
    const correctDiv = document.createElement('div');
    correctDiv.innerHTML = '<strong>Correct Answer:</strong> ';
    const correctContent = document.createElement('div');
    let correctPointer = 0;
    diff.forEach(part => {
        // We only care about parts that ended up in the correct answer
        if (part.removed) return;

        const span = document.createElement('span');
        // 'added' means it's in the correct answer but not the user's (a good addition).
        span.className = part.added ? 'diff-added' : 'diff-common';
        const originalText = correctAnswer.substring(correctPointer, correctPointer + part.value.length);
        span.appendChild(document.createTextNode(originalText));
        correctContent.appendChild(span);
        correctPointer += part.value.length;
    });
    correctDiv.appendChild(correctContent);


    fragment.appendChild(userDiv);
    fragment.appendChild(correctDiv);

    return fragment;
}