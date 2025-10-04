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

/**
 * Renders a visual diff between the user's answer and the correct answer.
 * @param {string} userAnswer - The user's submitted answer.
 * @param {string} correctAnswer - The correct answer.
 * @param {boolean} isCorrect - Whether the user's answer was correct.
 * @returns {DocumentFragment} A document fragment containing the diff elements.
 */
export function renderDiff(userAnswer, correctAnswer, isCorrect) {
    /* global Diff */
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