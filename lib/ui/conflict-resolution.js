import dom from './dom-elements.js';

let unresolvedConflicts = [];
let resolveConflictCallback = null;

function renderConflictList() {
    dom.conflictList.innerHTML = '';
    unresolvedConflicts.forEach((conflict, index) => {
        const item = document.createElement('div');
        item.className = 'conflict-item';
        item.textContent = conflict.key;
        item.dataset.index = index;
        item.addEventListener('click', () => showConflictComparison(index));
        dom.conflictList.appendChild(item);
    });
}

function showConflictComparison(index) {
    const conflict = unresolvedConflicts[index];
    if (!conflict) return;

    dom.conflictItemKey.textContent = conflict.key;
    dom.clientVersionData.textContent = JSON.stringify(conflict.client_data, null, 2);
    dom.serverVersionData.textContent = JSON.stringify(conflict.server_data, null, 2);

    dom.keepClientVersion.onclick = () => {
        resolveConflictCallback('client', conflict);
        unresolvedConflicts.splice(index, 1);
        renderConflictList();
        dom.conflictComparison.classList.add('hidden');
        if (unresolvedConflicts.length === 0) {
            hideModal();
        }
    };

    dom.keepServerVersion.onclick = () => {
        resolveConflictCallback('server', conflict);
        unresolvedConflicts.splice(index, 1);
        renderConflictList();
        dom.conflictComparison.classList.add('hidden');
        if (unresolvedConflicts.length === 0) {
            hideModal();
        }
    };

    dom.conflictComparison.classList.remove('hidden');
}

function hideModal() {
    dom.conflictResolutionModal.classList.add('hidden');
    dom.conflictComparison.classList.add('hidden');
}

export function showConflictResolutionModal(conflicts) {
    unresolvedConflicts = conflicts;
    renderConflictList();
    dom.conflictResolutionModal.classList.remove('hidden');
    // Show the first conflict automatically
    if (conflicts.length > 0) {
        showConflictComparison(0);
    }
}

export function init(dependencies) {
    resolveConflictCallback = dependencies.resolveConflictCallback;
    if (dom.closeConflictResolutionButton) {
        dom.closeConflictResolutionButton.addEventListener('click', hideModal);
    }
}
