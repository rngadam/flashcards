import messageBus from './message-bus.js';

async function postToServer(data) {
    const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

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

handle('data:config:save', async ({ key, value }) => {
    return await postToServer({ configs: { [key]: value } });
});

handle('data:card:stats:save', async ({ key, value }) => {
    return await postToServer({ cardStats: { [key]: value } });
});

handle('data:sync:all:load', async () => {
    const response = await fetch('/api/sync');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
});

handle('data:sync:all:save', async (data) => {
    return await postToServer(data);
});

export function init() {
    console.log('HTTP adapter initialized');
}
