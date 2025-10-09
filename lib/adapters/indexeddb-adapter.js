import * as Bus from '../core/message-bus.js';
import { get, set, keys } from '../idb-keyval-wrapper.js';

/**
 * Minimal IndexedDB adapter that listens for DAL messages and responds.
 * This adapter is intentionally small for testability. It subscribes to the
 * primary messages defined in DESIGN.md and responds with <message>:success
 * or <message>:failure.
 */

export function initIndexedDBAdapter() {
    // config load
    Bus.subscribe('data:config:load', async ({ payload }) => {
        try {
            const { key } = payload || {};
            const value = await get(key);
            Bus.publish('data:config:load:success', { key, value });
        } catch (e) {
            Bus.publish('data:config:load:failure', { error: e });
        }
    });

    // config save
    Bus.subscribe('data:config:save', async ({ payload }) => {
        try {
            const { key, value } = payload || {};
            await set(key, value);
            Bus.publish('data:config:save:success', { key, value });
        } catch (e) {
            Bus.publish('data:config:save:failure', { error: e });
        }
    });

    // card stats load
    Bus.subscribe('data:card:stats:load', async ({ payload }) => {
        try {
            const { key } = payload || {};
            const value = await get(key);
            Bus.publish('data:card:stats:load:success', { key, value });
        } catch (e) {
            Bus.publish('data:card:stats:load:failure', { error: e });
        }
    });

    // card stats save with versioning/conflict detection
    Bus.subscribe('data:card:stats:save', async ({ payload }) => {
        try {
            const obj = payload || {};
            // payload may be { key, value } or { cardStats: { key: value } }
            const handleEntry = async (k, v) => {
                // If v includes versioning info, expect: { data, base_version, new_version }
                if (v && typeof v === 'object' && ('base_version' in v || 'new_version' in v || 'data' in v)) {
                    const incomingData = v.data !== undefined ? v.data : v;
                    const base = v.base_version ?? null;
                    const incomingNew = v.new_version ?? (typeof base === 'number' ? base + 1 : 1);

                    const existing = await get(k);
                    const existingVersion = existing && typeof existing._version === 'number' ? existing._version : 0;

                    if (base === existingVersion) {
                        // accept
                        const toStore = { ...incomingData, _version: incomingNew };
                        await set(k, toStore);
                        return { ok: true, key: k, value: toStore };
                    } else {
                        // conflict detected: do not overwrite; save unresolved conflict
                        const serverValue = existing || null;
                        const conflict = { key: k, client: incomingData, client_base_version: base, client_new_version: incomingNew, server: serverValue, server_version: existingVersion };
                        // store in unresolved_conflicts
                        const unresolvedKey = `unresolved_conflicts:${k}`;
                        await set(unresolvedKey, conflict);
                        return { ok: false, key: k, conflict };
                    }
                } else {
                    // simple write
                    await set(k, v);
                    return { ok: true, key: k, value: v };
                }
            };

            if (obj.key && obj.value !== undefined) {
                const result = await handleEntry(obj.key, obj.value);
                if (result.ok) Bus.publish('data:card:stats:save:success', { key: result.key, value: result.value });
                else Bus.publish('data:card:stats:save:failure', { error: new Error('conflict'), conflict: result.conflict });
            } else if (obj.cardStats && typeof obj.cardStats === 'object') {
                const entries = Object.entries(obj.cardStats);
                const results = await Promise.all(entries.map(([k, v]) => handleEntry(k, v)));
                const conflicts = results.filter(r => !r.ok).map(r => r.conflict);
                if (conflicts.length === 0) {
                    Bus.publish('data:card:stats:save:success', { value: null });
                } else {
                    Bus.publish('data:card:stats:save:failure', { error: new Error('conflicts'), conflicts });
                }
            } else {
                throw new Error('Invalid payload');
            }
        } catch (e) {
            Bus.publish('data:card:stats:save:failure', { error: e });
        }
    });

    // sync all load
    Bus.subscribe('data:sync:all:load', async () => {
        try {
            const allKeys = await keys();
            const data = {};
            await Promise.all(allKeys.map(async k => { data[k] = await get(k); }));
            Bus.publish('data:sync:all:load:success', { configs: data['flashcard-configs'], cardStats: Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'flashcard-configs' && k !== 'flashcard-last-config')) });
        } catch (e) {
            Bus.publish('data:sync:all:load:failure', { error: e });
        }
    });
}

export function teardownIndexedDBAdapter() {
    // The message bus keeps subscribers; for tests we'll rely on clearing the bus.
}
