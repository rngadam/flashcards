/* global describe, it, before, after, beforeEach, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';
import messageBus from '../lib/core/message-bus.js';
import * as httpAdapter from '../lib/core/http-adapter.js';

describe('HTTP Adapter', () => {
    let fetchStub;
    let dispatchSpy;

    beforeEach(() => {
        fetchStub = sinon.stub(global, 'fetch');
        dispatchSpy = sinon.spy(messageBus, 'dispatch');
        httpAdapter.init();
    });

    afterEach(() => {
        fetchStub.restore();
        dispatchSpy.restore();
    });

    it('should save a config', (done) => {
        fetchStub.resolves(new Response(JSON.stringify({ success: true }), { status: 200 }));
        messageBus.dispatch('data:config:save', { key: 'my-key', value: 'my-value' });
        setTimeout(() => {
            expect(fetchStub.calledOnceWith('/api/sync')).to.be.true;
            expect(dispatchSpy.calledWith('data:config:save:success')).to.be.true;
            done();
        }, 0);
    });

    it('should save card stats', (done) => {
        fetchStub.resolves(new Response(JSON.stringify({ success: true }), { status: 200 }));
        messageBus.dispatch('data:card:stats:save', { key: 'my-card', value: { views: 1 } });
        setTimeout(() => {
            expect(fetchStub.calledOnceWith('/api/sync')).to.be.true;
            expect(dispatchSpy.calledWith('data:card:stats:save:success')).to.be.true;
            done();
        }, 0);
    });

    it('should sync all data on load', (done) => {
        const mockData = { configs: { 'my-key': 'my-value' }, cardStats: { 'my-card': { views: 1 } } };
        fetchStub.resolves(new Response(JSON.stringify(mockData), { status: 200 }));
        messageBus.dispatch('data:sync:all:load', null);
        setTimeout(() => {
            expect(fetchStub.calledOnceWith('/api/sync')).to.be.true;
            expect(dispatchSpy.calledWith('data:sync:all:load:success', mockData)).to.be.true;
            done();
        }, 0);
    });

    it('should sync all data on save', (done) => {
        const mockData = { configs: { 'my-key': 'my-value' }, cardStats: { 'my-card': { views: 1 } } };
        fetchStub.resolves(new Response(JSON.stringify({ success: true }), { status: 200 }));
        messageBus.dispatch('data:sync:all:save', mockData);
        setTimeout(() => {
            expect(fetchStub.calledOnceWith('/api/sync')).to.be.true;
            expect(dispatchSpy.calledWith('data:sync:all:save:success')).to.be.true;
            done();
        }, 0);
    });

    it('should handle fetch errors', (done) => {
        fetchStub.rejects(new Error('Network error'));
        messageBus.dispatch('data:config:save', { key: 'my-key', value: 'my-value' });
        setTimeout(() => {
            expect(dispatchSpy.calledWith('data:config:save:failure')).to.be.true;
            done();
        }, 0);
    });
});
