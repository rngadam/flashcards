import { expect } from 'chai';
import * as DAL from '../lib/core/dal.js';
import * as Bus from '../lib/core/message-bus.js';
import { initIndexedDBAdapter } from '../lib/adapters/indexeddb-adapter.js';
import * as idbWrapper from '../lib/idb-keyval-wrapper.js';

describe('IndexedDB Adapter integration', () => {
    beforeEach(() => {
        Bus.clearAllListeners();
        // inject an in-memory mock for idb-keyval to avoid remote ESM import
        const store = new Map();
        idbWrapper.__setMock({
            get: async (k) => (store.has(k) ? store.get(k) : null),
            set: async (k, v) => { store.set(k, v); return v; },
            del: async (k) => { store.delete(k); },
            keys: async () => Array.from(store.keys())
        });
        initIndexedDBAdapter();
    });

    afterEach(() => {
        Bus.clearAllListeners();
    });

    it('should save and load a config via DAL', async () => {
        const key = 'test-config-key';
        const value = { foo: 'bar' };

        // Save
        const saveP = DAL.dispatch('data:config:save', { key, value });
        const saved = await saveP;
        expect(saved).to.deep.equal({ key, value });

        // Load
        const loaded = await DAL.dispatch('data:config:load', { key });
        expect(loaded).to.deep.equal({ key, value });
    });
});
