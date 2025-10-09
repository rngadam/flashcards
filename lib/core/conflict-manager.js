import { get, set, del, keys } from '../idb-keyval-wrapper.js';
import * as DAL from './dal.js';

/**
 * Conflict manager: lists unresolved conflicts and provides resolution helpers.
 */

export async function getUnresolvedConflicts() {
    const allKeys = await keys();
    const unresolved = allKeys.filter(k => k.startsWith('unresolved_conflicts:'));
    const results = [];
    for (const storageKey of unresolved) {
        const value = await get(storageKey);
        results.push({ storageKey, conflict: value });
    }
    return results;
}

export async function resolveUseServer(storageKey) {
    const conflict = await get(storageKey);
    if (!conflict) throw new Error('Conflict not found');
    const originalKey = conflict.key;
    const serverValue = conflict.server || null;
    if (serverValue === null) throw new Error('No server value to apply');
    // Apply server value locally
    await set(originalKey, serverValue);
    // Remove unresolved conflict entry
    await del(storageKey);
    return { key: originalKey, applied: 'server', value: serverValue };
}

export async function resolveKeepLocal(storageKey) {
    const conflict = await get(storageKey);
    if (!conflict) throw new Error('Conflict not found');
    const originalKey = conflict.key;
    const clientData = conflict.client;
    const serverVersion = typeof conflict.server_version === 'number' ? conflict.server_version : (conflict.server && conflict.server._version) || 0;
    const base = serverVersion;
    const newVersion = base + 1;

    // Attempt to resubmit to server via DAL (this will trigger adapters)
    await DAL.dispatch('data:card:stats:save', { key: originalKey, value: { data: clientData, base_version: base, new_version: newVersion } });
    // on success, delete unresolved
    await del(storageKey);
    return { key: originalKey, applied: 'keep_local', value: { ...clientData, _version: newVersion } };
}
