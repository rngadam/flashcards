const events = {};

function on(eventName, listener) {
    if (!events[eventName]) {
        events[eventName] = [];
    }
    events[eventName].push(listener);
}

function off(eventName, listener) {
    if (!events[eventName]) {
        return;
    }
    events[eventName] = events[eventName].filter(l => l !== listener);
}

function dispatch(eventName, payload) {
    if (!events[eventName]) {
        return;
    }
    events[eventName].forEach(listener => listener(payload));
}

export default {
    on,
    off,
    dispatch,
};
