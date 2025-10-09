import { expect } from 'chai';
import * as Bus from '../lib/core/message-bus.js';
import * as DAL from '../lib/core/dal.js';
import { initIndexedDBAdapter } from '../lib/adapters/indexeddb-adapter.js';
import * as idbWrapper from '../lib/idb-keyval-wrapper.js';

describe('IndexedDB Adapter - Versioning and Conflicts', () => {
    beforeEach(() => {
        Bus.clearAllListeners();
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

    it('accepts save when base_version matches existing version', async () => {
        const key = 'card-A';
        // seed existing value with version 1
        await DAL.dispatch('data:card:stats:save', { key, value: { data: { foo: 'bar' }, base_version: 0, new_version: 1 } });
        const res = await DAL.dispatch('data:card:stats:save', { key, value: { data: { foo: 'baz' }, base_version: 1, new_version: 2 } });
        // success returns key/value (adapter returns null in batch success, but single returns stored)
        expect(res).to.have.property('key').that.equals(key);
        expect(res.value).to.have.property('_version').that.equals(2);
    });

    it('detects conflict when base_version mismatches and stores unresolved_conflicts', async () => {
        const key = 'card-B';
    // seed existing value with version 2 (two-step: 0->1, 1->2)
    await DAL.dispatch('data:card:stats:save', { key, value: { data: { foo: 'orig' }, base_version: 0, new_version: 1 } });
    await DAL.dispatch('data:card:stats:save', { key, value: { data: { foo: 'orig2' }, base_version: 1, new_version: 2 } });

        // attempt to save with stale base_version
        let caught = null;
        try {
            await DAL.dispatch('data:card:stats:save', { key, value: { data: { foo: 'client' }, base_version: 0, new_version: 1 } });
        } catch (e) {
            caught = e;
        }
        expect(caught).to.be.instanceOf(Error);

        // unresolved conflict should be saved under unresolved_conflicts:key
    const conflict = await DAL.dispatch('data:card:stats:load', { key: `unresolved_conflicts:${key}` });
    // The adapter stores the conflict under the unresolved_conflicts:<key> key
    // The returned payload has { key: 'unresolved_conflicts:card-B', value: conflictObject }
    expect(conflict).to.have.property('key').that.equals(`unresolved_conflicts:${key}`);
    expect(conflict.value).to.have.property('key').that.equals(key);
    expect(conflict.value).to.have.nested.property('client.foo', 'client');
    });
});
