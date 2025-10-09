/**
 * A tiny namespaced message bus used by the DAL and adapters.
 * Designed to be environment-agnostic and easy to test.
 */

const listeners = new Map();

function patternToRegex(pattern) {
    // Escape regex metacharacters except '*', then replace '*' with '.*'
    const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    const regexStr = `^${escaped.replace(/\*/g, '.*')}$`;
    return new RegExp(regexStr);
}

export function subscribe(namespace, handler) {
    if (!listeners.has(namespace)) listeners.set(namespace, new Set());
    listeners.get(namespace).add(handler);
    return () => listeners.get(namespace).delete(handler);
}

export function publish(namespace, payload) {
    const matched = [];
    for (const [ns, handlers] of listeners.entries()) {
        try {
            const rx = patternToRegex(ns);
            if (rx.test(namespace)) {
                handlers.forEach(h => {
                    try {
                        h({ name: namespace, payload });
                    } catch (e) {
                        console.error('Message bus handler error', e);
                    }
                });
                matched.push(ns);
            }
        } catch (e) {
            console.error('Invalid subscription pattern', ns, e);
        }
    }
    return matched;
}

export function clearAllListeners() {
    listeners.clear();
}
