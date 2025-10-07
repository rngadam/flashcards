import messageBus from './message-bus.js';
import { get, set, del, keys, clear } from '../idb-keyval-wrapper.js';

function handle(eventName, handler) {
    messageBus.on(eventName, async (payload) => {
        try {
            const result = await handler(payload);
            messageBus.dispatch(`${eventName}:success`, result);
        } catch (error) {
            messageBus.dispatch(`${eventName}:failure`, { error });
        }
    });
}

handle('data:config:load', async ({ key }) => {
    const configs = await get('flashcard-configs') || {};
    return { key, value: configs[key] };
});

handle('data:config:save', async ({ key, value }) => {
    const configs = await get('flashcard-configs') || {};
    configs[key] = value;
    await set('flashcard-configs', configs);
    return { key, value };
});

handle('data:card:stats:load', async ({ key }) => {
    const stats = await get(key);
    return { key, value: stats };
});

handle('data:card:stats:save', async ({ key, value }) => {
    await set(key, value);
    return { key, value };
});

handle('data:sync:all:load', async () => {
    const allKeys = await keys();
    const data = {
        configs: {},
        cardStats: {}
    };
    for (const key of allKeys) {
        if (key === 'flashcard-configs') {
            data.configs = await get(key);
        } else if (key !== 'flashcard-last-config') {
            data.cardStats[key] = await get(key);
        }
    }
    return data;
});

handle('data:sync:all:save', async ({ configs, cardStats }) => {
    await set('flashcard-configs', configs);
    for (const key in cardStats) {
        await set(key, cardStats[key]);
    }
    return null;
});

export function init() {
    console.log('IndexedDB adapter initialized');
}
