import { expect } from 'chai';
import * as Bus from '../lib/core/message-bus.js';
import * as DAL from '../lib/core/dal.js';

describe('Message Bus and DAL', () => {
    afterEach(() => {
        Bus.clearAllListeners();
    });

    it('should allow subscribe and publish', (done) => {
        Bus.subscribe('foo', ({ name, payload }) => {
            expect(name).to.equal('foo');
            expect(payload).to.deep.equal({ a: 1 });
            done();
        });
        Bus.publish('foo', { a: 1 });
    });

    it('should match wildcard subscriptions', (done) => {
        Bus.subscribe('data:card:*', ({ name, payload }) => {
            expect(name).to.equal('data:card:stats:save');
            expect(payload).to.have.property('key');
            done();
        });
        Bus.publish('data:card:stats:save', { key: 'x' });
    });

    it('DAL.dispatch resolves on success message', async () => {
        const p = DAL.dispatch('data:config:load', { key: 'k' });
        // Simulate adapter responding
        Bus.publish('data:config:load:success', { key: 'k', value: { a: 1 } });
        const res = await p;
        expect(res).to.deep.equal({ key: 'k', value: { a: 1 } });
    });

    it('DAL.dispatch rejects on failure message', async () => {
        const p = DAL.dispatch('data:config:load', { key: 'k' }).catch(e => e);
        Bus.publish('data:config:load:failure', { error: new Error('boom') });
        const err = await p;
        expect(err).to.be.instanceOf(Error);
    });
});
