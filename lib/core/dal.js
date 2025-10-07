import messageBus from './message-bus.js';

function request(eventName, payload) {
    return new Promise((resolve, reject) => {
        const successEvent = `${eventName}:success`;
        const failureEvent = `${eventName}:failure`;

        const successListener = (data) => {
            cleanup();
            resolve(data);
        };

        const failureListener = (error) => {
            cleanup();
            reject(error);
        };

        function cleanup() {
            messageBus.off(successEvent, successListener);
            messageBus.off(failureEvent, failureListener);
        }

        messageBus.on(successEvent, successListener);
        messageBus.on(failureEvent, failureListener);

        messageBus.dispatch(eventName, payload);
    });
}

export function loadConfig(key) {
    return request('data:config:load', { key });
}

export function saveConfig(key, value) {
    return request('data:config:save', { key, value });
}

export function loadCardStats(key) {
    return request('data:card:stats:load', { key });
}

export function saveCardStats(key, value) {
    return request('data:card:stats:save', { key, value });
}

export function syncAllLoad() {
    return request('data:sync:all:load', null);
}

export function syncAllSave(data) {
    return request('data:sync:all:save', data);
}
