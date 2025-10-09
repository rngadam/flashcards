import * as Bus from './message-bus.js';

/**
 * Simple Data Abstraction Layer (DAL) that exposes dispatch/request helpers.
 * For now, it simply forwards messages on the bus and returns Promises that
 * resolve when adapters publish a corresponding :success message.
 */

export async function dispatch(name, payload) {
    return new Promise((resolve, reject) => {
        const successName = `${name}:success`;
        const failureName = `*:failure`;

        let unsubSuccess;
        let unsubFailure;

        unsubSuccess = Bus.subscribe(successName, ({ payload: p }) => {
            if (typeof unsubSuccess === 'function') unsubSuccess();
            if (typeof unsubFailure === 'function') unsubFailure();
            resolve(p);
        });
        unsubFailure = Bus.subscribe(failureName, ({ payload: p }) => {
            if (typeof unsubSuccess === 'function') unsubSuccess();
            if (typeof unsubFailure === 'function') unsubFailure();
            reject(p && p.error ? p.error : new Error('Adapter failure'));
        });

        // Finally publish the original request for adapters to handle.
        Bus.publish(name, payload);
    });
}

export function subscribe(name, handler) {
    return Bus.subscribe(name, handler);
}

export function clear() {
    Bus.clearAllListeners();
}
