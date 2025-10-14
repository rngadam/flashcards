import * as Bus from './message-bus.js';
import { initHttpAdapter } from '../adapters/http-adapter.js';
import { initIndexedDBAdapter } from '../adapters/indexeddb-adapter.js';
import { getState } from './state.js';

/**
 * Initializes the data access layer by setting up the correct adapters based on auth status.
 */
export function initDal() {
    Bus.subscribe('auth:state:change', setupAdapters);
    setupAdapters();
}

function setupAdapters() {
    Bus.clearAllListeners();
    Bus.subscribe('auth:state:change', setupAdapters); // re-subscribe

    const state = getState();
    if (state.isAuthenticated) {
        initHttpAdapter();
        // Also init IndexedDB, but a version that doesn't handle sync events
        // For now, we accept the overlap, assuming UI or another layer prevents issues.
        initIndexedDBAdapter();
    } else {
        initIndexedDBAdapter();
    }
}

/**
 * Simple Data Abstraction Layer (DAL) that exposes dispatch/request helpers.
 * For now, it simply forwards messages on the bus and returns Promises that
 * resolve when adapters publish a corresponding :success message.
 */

export async function dispatch(name, payload) {
    if (!Bus.hasSubscribers(name)) {
        const error = new Error(`No subscribers for DAL event: ${name}`);
        console.error(error);
        return Promise.reject(error);
    }

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
