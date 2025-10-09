import { expect } from 'chai';
import sinon from 'sinon';
import * as Bus from '../lib/core/message-bus.js';
import * as DAL from '../lib/core/dal.js';
import { initHttpAdapter } from '../lib/adapters/http-adapter.js';

describe('HTTP Adapter - Conflict handling', () => {
    let fetchStub;

    beforeEach(() => {
        Bus.clearAllListeners();
        fetchStub = sinon.stub(global, 'fetch');
        initHttpAdapter({ baseUrl: 'https://example.com/api' });
    });

    afterEach(() => {
        fetchStub.restore();
        Bus.clearAllListeners();
    });

    it('should publish failure when server returns conflicts', async () => {
        const conflicts = [{ key: 'card-X', server_version: 2 }];
        fetchStub.resolves({ ok: true, json: async () => ({ conflicts }) });

        let caught = null;
        try {
            await DAL.dispatch('data:card:stats:save', { cardStats: { 'card-X': { data: { a: 1 }, base_version: 1, new_version: 2 } } });
        } catch (e) {
            caught = e;
        }
        expect(caught).to.be.instanceOf(Error);
    });
});
