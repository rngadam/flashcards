import * as Bus from '../core/message-bus.js';

/**
 * Minimal HTTP adapter that listens for DAL sync messages and performs fetch
 * calls to a configured endpoint. For tests we will mock `global.fetch`.
 */

export function initHttpAdapter({ baseUrl = '/api' } = {}) {
    Bus.subscribe('data:sync:all:load', async () => {
        try {
            const res = await fetch(`${baseUrl}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'load' }) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            Bus.publish('data:sync:all:load:success', data);
        } catch (e) {
            Bus.publish('data:sync:all:load:failure', { error: e });
        }
    });

    Bus.subscribe('data:card:stats:save', async ({ payload }) => {
        try {
            const res = await fetch(`${baseUrl}/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'save', payload }) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data && (data.conflicts || data.conflict)) {
                Bus.publish('data:card:stats:save:failure', { error: new Error('conflicts'), conflicts: data.conflicts || data.conflict });
            } else {
                Bus.publish('data:card:stats:save:success', data);
            }
        } catch (e) {
            Bus.publish('data:card:stats:save:failure', { error: e });
        }
    });
}
