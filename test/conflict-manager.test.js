import { expect } from 'chai';
import * as idbWrapper from '../lib/idb-keyval-wrapper.js';
import * as Bus from '../lib/core/message-bus.js';
import { initIndexedDBAdapter } from '../lib/adapters/indexeddb-adapter.js';
import * as ConflictManager from '../lib/core/conflict-manager.js';
import * as DAL from '../lib/core/dal.js';

describe('Conflict Manager', () => {
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

    it('lists unresolved conflicts and resolves by using server value', async () => {
        // seed an unresolved conflict
        const conflictKey = 'unresolved_conflicts:card-Z';
        const conflictObj = { key: 'card-Z', client: { a: 1 }, server: { a: 2, _version: 5 }, server_version: 5 };
        await DAL.dispatch('data:card:stats:save', { key: conflictKey, value: conflictObj });

        const list = await ConflictManager.getUnresolvedConflicts();
        expect(list).to.have.lengthOf(1);
        expect(list[0]).to.have.property('storageKey', conflictKey);

        const res = await ConflictManager.resolveUseServer(conflictKey);
        expect(res).to.have.property('applied', 'server');
        // local key should now exist with server value
        const loaded = await DAL.dispatch('data:card:stats:load', { key: 'card-Z' });
        expect(loaded).to.have.property('key', 'card-Z');
        expect(loaded.value).to.have.property('_version', 5);
    });

    it('resolves by keeping local and re-submits to DAL', async () => {
    const conflictKey = 'unresolved_conflicts:card-Y';
    const conflictObj = { key: 'card-Y', client: { b: 3 }, server: { b: 4, _version: 3 }, server_version: 3 };
    await DAL.dispatch('data:card:stats:save', { key: conflictKey, value: conflictObj });
    // Also seed the actual server-side stored value so the base_version matches
    await DAL.dispatch('data:card:stats:save', { key: 'card-Y', value: { ...conflictObj.server } });

    const result = await ConflictManager.resolveKeepLocal(conflictKey);
        expect(result).to.have.property('applied', 'keep_local');
        // verify local store updated with new version
        const loaded = await DAL.dispatch('data:card:stats:load', { key: 'card-Y' });
        expect(loaded.value).to.have.property('_version', 4);
    });
});
