import { expect } from 'chai';
import sinon from 'sinon';
import * as Bus from '../lib/core/message-bus.js';
import * as DAL from '../lib/core/dal.js';
import { initHttpAdapter } from '../lib/adapters/http-adapter.js';

describe('HTTP Adapter (simulated)', () => {
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

    it('should perform sync all load and DAL resolves on success', async () => {
        const mockResponse = { configs: { a: 1 }, cardStats: {} };
        fetchStub.resolves({ ok: true, json: async () => mockResponse });

        const res = DAL.dispatch('data:sync:all:load', null);
        const value = await res;
        expect(value).to.deep.equal(mockResponse);
        // ensure fetch was called
        sinon.assert.calledOnce(fetchStub);
    });
});
