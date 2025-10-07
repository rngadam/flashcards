/* global describe, it, before, after, beforeEach, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';
import messageBus from '../lib/core/message-bus.js';
import * as dal from '../lib/core/dal.js';

describe('Data Abstraction Layer (DAL)', () => {
    let dispatchSpy;

    beforeEach(() => {
        dispatchSpy = sinon.spy(messageBus, 'dispatch');
    });

    afterEach(() => {
        dispatchSpy.restore();
    });

    it('should dispatch a load config message and resolve on success', async () => {
        const promise = dal.loadConfig('my-key');
        expect(dispatchSpy.calledOnceWith('data:config:load', { key: 'my-key' })).to.be.true;

        messageBus.dispatch('data:config:load:success', { key: 'my-key', value: 'my-value' });

        const result = await promise;
        expect(result).to.deep.equal({ key: 'my-key', value: 'my-value' });
    });

    it('should dispatch a load config message and reject on failure', async () => {
        const promise = dal.loadConfig('my-key');
        expect(dispatchSpy.calledOnceWith('data:config:load', { key: 'my-key' })).to.be.true;

        const testError = new Error('Test Error');
        messageBus.dispatch('data:config:load:failure', { error: testError });

        try {
            await promise;
        } catch (e) {
            expect(e.error).to.equal(testError);
        }
    });

    it('should dispatch a save config message and resolve on success', async () => {
        const promise = dal.saveConfig('my-key', 'my-value');
        expect(dispatchSpy.calledOnceWith('data:config:save', { key: 'my-key', value: 'my-value' })).to.be.true;

        messageBus.dispatch('data:config:save:success', { key: 'my-key', value: 'my-value' });

        const result = await promise;
        expect(result).to.deep.equal({ key: 'my-key', value: 'my-value' });
    });
});
