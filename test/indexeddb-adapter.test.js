/* global describe, it, before, after, beforeEach, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';
import 'fake-indexeddb/auto';
import messageBus from '../lib/core/message-bus.js';
import * as idbAdapter from '../lib/core/indexeddb-adapter.js';
import { get, set, clear, __setMock } from '../lib/idb-keyval-wrapper.js';

describe('IndexedDB Adapter', () => {
    let dispatchSpy;
    const store = new Map();

    before(() => {
        const mockIdbKeyval = {
            get: async (key) => store.get(key),
            set: async (key, value) => store.set(key, value),
            del: async (key) => store.delete(key),
            keys: async () => Array.from(store.keys()),
            clear: async () => store.clear(),
        };
        __setMock(mockIdbKeyval);
    });

    beforeEach(async () => {
        dispatchSpy = sinon.spy(messageBus, 'dispatch');
        idbAdapter.init();
        await clear();
    });

    afterEach(() => {
        dispatchSpy.restore();
        store.clear();
    });

    it('should load a config', (done) => {
        set('flashcard-configs', { 'my-key': 'my-value' });
        messageBus.dispatch('data:config:load', { key: 'my-key' });
        setTimeout(() => {
            expect(dispatchSpy.calledWith('data:config:load:success', { key: 'my-key', value: 'my-value' })).to.be.true;
            done();
        }, 0);
    });

    it('should save a config', (done) => {
        messageBus.dispatch('data:config:save', { key: 'my-key', value: 'my-value' });
        setTimeout(async () => {
            const configs = await get('flashcard-configs');
            expect(configs).to.deep.equal({ 'my-key': 'my-value' });
            expect(dispatchSpy.calledWith('data:config:save:success', { key: 'my-key', value: 'my-value' })).to.be.true;
            done();
        }, 0);
    });

    it('should load card stats', (done) => {
        set('my-card', { views: 1 });
        messageBus.dispatch('data:card:stats:load', { key: 'my-card' });
        setTimeout(() => {
            expect(dispatchSpy.calledWith('data:card:stats:load:success', { key: 'my-card', value: { views: 1 } })).to.be.true;
            done();
        }, 0);
    });

    it('should save card stats', (done) => {
        messageBus.dispatch('data:card:stats:save', { key: 'my-card', value: { views: 1 } });
        setTimeout(async () => {
            const stats = await get('my-card');
            expect(stats).to.deep.equal({ views: 1 });
            expect(dispatchSpy.calledWith('data:card:stats:save:success', { key: 'my-card', value: { views: 1 } })).to.be.true;
            done();
        }, 0);
    });
});
