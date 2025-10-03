import { state } from './state.js';

const dom = {};
export function setDom(domElements) {
    Object.assign(dom, domElements);
}

let notificationTimeout;
export function showTopNotification(message, type = 'error', duration = 3000) {
    if (!dom.topNotification) return;

    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }

    dom.topNotification.textContent = message;
    dom.topNotification.className = `visible ${type}`;

    notificationTimeout = setTimeout(() => {
        dom.topNotification.className = `hidden ${type}`;
    }, duration);
}

export function updateLayout() {
    if (window.matchMedia('(min-width: 769px)').matches) {
        document.body.classList.add('desktop');
    } else {
        document.body.classList.remove('desktop');
    }
}

export function initializeTabSwitching() {
    document.querySelectorAll('.tabs').forEach(tabsContainer => {
        const container = tabsContainer.parentElement;
        if (!container) return;

        const tabPanels = container.querySelectorAll('.tab-panel');

        tabsContainer.addEventListener('click', e => {
            if (e.target.matches('.tab-button')) {
                const button = e.target;
                tabsContainer.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');

                const tabName = button.dataset.tab;
                tabPanels.forEach(panel => {
                    panel.classList.toggle('active', panel.id === tabName);
                });
            }
        });
    });
}

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

export function formatDuration(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
    if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
    if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
    return `${Math.round(seconds / 31536000)} years`;
}

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

export function dragStart(e) {
    if (e.target.closest('button')) return;
    state.isDragging = true;
    state.startX = e.pageX || e.touches[0].pageX;
    state.startY = e.pageY || e.touches[0].pageY;
    state.currentX = state.startX;
    state.currentY = state.startY;
    dom.card.style.transition = 'none';
}

export function dragMove(e) {
    if (!state.isDragging) return;
    e.preventDefault();
    state.currentX = e.pageX || e.touches[0].pageX;
    state.currentY = e.pageY || e.touches[0].pageY;
    const diffX = state.currentX - state.startX;
    const diffY = state.currentY - state.startY;
    dom.card.style.transform = `translate(${diffX}px, ${diffY}px) rotate(${diffX / 20}deg)`;
}

export function dragEnd() {
    if (!state.isDragging) return;
    state.isDragging = false;
    const diffX = state.currentX - state.startX;
    const diffY = state.currentY - state.startY;
    state.startX = 0;
    state.startY = 0;
    state.currentX = 0;
    state.currentY = 0;
    dom.card.style.transition = 'transform 0.3s ease';

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > state.dragThreshold) {
            dom.card.classList.add(diffX > 0 ? 'swipe-right' : 'swipe-left');
            setTimeout(() => {
                dom.iKnowButton.click();
                dom.card.style.transform = '';
                dom.card.classList.remove('swipe-right', 'swipe-left');
            }, 300);
        } else {
            dom.card.style.transform = '';
        }
    } else {
        if (Math.abs(diffY) > state.verticalDragThreshold) {
            dom.flipCardButton.click();
        }
        dom.card.style.transform = '';
    }
}