import { expect } from 'chai';
import sinon from 'sinon';
import { setupDOM, teardownDOM } from './test-helpers.js';
import { isObject, deepMerge, populateLoginButtons, syncToServer, syncFromServer, checkAuthStatus } from '../lib/auth.js';

describe('Auth Module', () => {
    describe('isObject', () => {
        it('should return true for an object', () => {
            expect(isObject({})).to.be.true;
        });

        it('should return false for an array', () => {
            expect(isObject([])).to.be.false;
        });

        it('should return false for null', () => {
            expect(isObject(null)).to.be.false;
        });

        it('should return false for a string', () => {
            expect(isObject('hello')).to.be.false;
        });

        it('should return false for a number', () => {
            expect(isObject(123)).to.be.false;
        });

        it('should return false for a boolean', () => {
            expect(isObject(true)).to.be.false;
        });

        it('should return false for undefined', () => {
            expect(isObject(undefined)).to.be.false;
        });
    });

    describe('deepMerge', () => {
        it('should merge two simple objects', () => {
            const target = { a: 1 };
            const source = { b: 2 };
            const result = deepMerge(target, source);
            expect(result).to.deep.equal({ a: 1, b: 2 });
        });

        it('should overwrite properties in the target object', () => {
            const target = { a: 1 };
            const source = { a: 2 };
            const result = deepMerge(target, source);
            expect(result).to.deep.equal({ a: 2 });
        });

        it('should merge nested objects', () => {
            const target = { a: { b: 1 } };
            const source = { a: { c: 2 } };
            const result = deepMerge(target, source);
            expect(result).to.deep.equal({ a: { b: 1, c: 2 } });
        });

        it('should handle multiple source objects', () => {
            const target = { a: 1 };
            const source1 = { b: 2 };
            const source2 = { c: 3 };
            const result = deepMerge(target, source1, source2);
            expect(result).to.deep.equal({ a: 1, b: 2, c: 3 });
        });
    });

    describe('populateLoginButtons', () => {
        beforeEach(setupDOM);
        afterEach(teardownDOM);

        it('should create login buttons for each provider', () => {
            const loginProvidersContainer = document.createElement('div');
            loginProvidersContainer.id = 'login-providers';
            document.body.appendChild(loginProvidersContainer);

            const providers = ['github', 'google'];
            populateLoginButtons(providers);

            const buttons = loginProvidersContainer.querySelectorAll('a');
            expect(buttons.length).to.equal(2);
            expect(buttons[0].href).to.contain('/auth/github');
            expect(buttons[0].textContent).to.equal('Login with Github');
            expect(buttons[1].href).to.contain('/auth/google');
            expect(buttons[1].textContent).to.equal('Login with Google');
        });
    });

    describe('syncToServer', () => {
        let fetchStub;
        let showTopNotificationSpy;

        beforeEach(() => {
            fetchStub = sinon.stub(global, 'fetch');
            showTopNotificationSpy = sinon.spy();
        });

        afterEach(() => {
            fetchStub.restore();
        });

        it('should not fetch if not authenticated', async () => {
            await syncToServer({}, showTopNotificationSpy, false);
            expect(fetchStub.called).to.be.false;
        });

        it('should send a POST request with the correct data', async () => {
            const data = { test: 'data' };
            fetchStub.resolves({ ok: true });

            await syncToServer(data, showTopNotificationSpy, true);

            expect(fetchStub.calledOnce).to.be.true;
            const [url, options] = fetchStub.getCall(0).args;
            expect(url).to.equal('/api/sync');
            expect(options.method).to.equal('POST');
            expect(options.headers['Content-Type']).to.equal('application/json');
            expect(options.body).to.equal(JSON.stringify(data));
        });

        it('should call showTopNotification on fetch error', async () => {
            fetchStub.rejects(new Error('Network error'));
            await syncToServer({ test: 'data' }, showTopNotificationSpy, true);
            expect(showTopNotificationSpy.calledOnceWith('Failed to sync to server. Your work is saved locally.', 'error')).to.be.true;
        });

        it('should call showTopNotification on non-ok response', async () => {
            fetchStub.resolves({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server Error' })
            });
            await syncToServer({ test: 'data' }, showTopNotificationSpy, true);
            expect(showTopNotificationSpy.calledOnceWith('Failed to sync to server. Your work is saved locally.', 'error')).to.be.true;
        });
    });

    describe('checkAuthStatus', () => {
        let fetchStub;

        beforeEach(() => {
            setupDOM(`
                <div id="user-profile" class="hidden">
                    <span id="user-display-name"></span>
                    <button id="logout-button"></button>
                </div>
                <button id="login-button" class="hidden"></button>
                <div id="login-modal" class="hidden">
                    <button id="close-login-modal-button"></button>
                    <div id="login-providers"></div>
                </div>
                <div id="login-blurb"></div>
            `);
            fetchStub = sinon.stub(global, 'fetch');
        });

        afterEach(() => {
            teardownDOM();
            fetchStub.restore();
        });

        it('should handle logged-in user', async () => {
            const user = { displayName: 'Test User' };
            fetchStub.withArgs('/api/user').resolves({
                ok: true,
                json: () => Promise.resolve({ user })
            });

            const resultUser = await checkAuthStatus();

            expect(resultUser).to.deep.equal(user);
            expect(document.getElementById('user-profile').classList.contains('hidden')).to.be.false;
            expect(document.getElementById('login-button').classList.contains('hidden')).to.be.true;
            expect(document.getElementById('user-display-name').textContent).to.equal('Test User');
        });

        it('should handle guest user with providers', async () => {
            fetchStub.withArgs('/api/user').resolves({
                ok: true,
                json: () => Promise.resolve({ user: null })
            });
            fetchStub.withArgs('/api/auth/providers').resolves({
                ok: true,
                json: () => Promise.resolve(['github'])
            });

            const resultUser = await checkAuthStatus();

            expect(resultUser).to.be.null;
            expect(document.getElementById('user-profile').classList.contains('hidden')).to.be.true;
            expect(document.getElementById('login-button').classList.contains('hidden')).to.be.false;
            expect(document.getElementById('login-button').disabled).to.be.false;
            expect(document.querySelector('#login-providers a').textContent).to.equal('Login with Github');
        });

        it('should handle guest user with no providers', async () => {
            fetchStub.withArgs('/api/user').resolves({
                ok: true,
                json: () => Promise.resolve({ user: null })
            });
            fetchStub.withArgs('/api/auth/providers').resolves({
                ok: true,
                json: () => Promise.resolve([])
            });

            await checkAuthStatus();

            const loginButton = document.getElementById('login-button');
            expect(loginButton.disabled).to.be.true;
            expect(loginButton.title).to.equal('Login is not configured on the server.');
        });

        it('should handle API offline state', async () => {
            fetchStub.withArgs('/api/user').rejects(new Error('API offline'));

            await checkAuthStatus();

            const loginButton = document.getElementById('login-button');
            expect(loginButton.disabled).to.be.true;
            expect(loginButton.title).to.equal('Cannot connect to the server to log in.');
        });
    });

    describe('syncFromServer', () => {
        let fetchStub, showTopNotificationSpy, mergeCardStatsSpy, populateConfigSelectorSpy, loadSelectedConfigSpy, showNextCardSpy;
        let mockActions;

        beforeEach(() => {
            fetchStub = sinon.stub(global, 'fetch');
            showTopNotificationSpy = sinon.spy();
            mergeCardStatsSpy = sinon.stub().callsFake((local, remote) => ({ ...local, ...remote }));
            populateConfigSelectorSpy = sinon.spy();
            loadSelectedConfigSpy = sinon.spy();
            showNextCardSpy = sinon.spy();

            mockActions = {
                get: sinon.stub(),
                set: sinon.stub(),
                keys: sinon.stub(),
                mergeCardStats: mergeCardStatsSpy,
                showTopNotification: showTopNotificationSpy,
                populateConfigSelector: populateConfigSelectorSpy,
                loadSelectedConfig: loadSelectedConfigSpy,
                showNextCard: showNextCardSpy,
            };
        });

        afterEach(() => {
            fetchStub.restore();
        });

        it('should not run if not authenticated', async () => {
            await syncFromServer(mockActions, [], false);
            expect(fetchStub.called).to.be.false;
        });

        it('should merge server configs and stats into local', async () => {
            const serverData = {
                configs: { 'server-config': { url: 'server' } },
                cardStats: { 'card1': { score: 10 } }
            };
            fetchStub.withArgs('/api/sync').resolves({ ok: true, json: () => Promise.resolve(serverData) });
            mockActions.get.withArgs('flashcard-configs').resolves({ 'local-config': { url: 'local' } });
            mockActions.get.withArgs('card1').resolves({ score: 5 });
            mockActions.keys.resolves(['card1']);

            await syncFromServer(mockActions, [], true);

            expect(mockActions.set.calledWith('flashcard-configs', { 'local-config': { url: 'local' }, 'server-config': { url: 'server' } })).to.be.true;
            expect(mockActions.mergeCardStats.calledWith({ score: 5 }, { score: 10 })).to.be.true;
            expect(mockActions.set.calledWith('card1', { score: 10 })).to.be.true;
            expect(showTopNotificationSpy.calledWith('Data sync complete.', 'success')).to.be.true;
        });

        it('should upload local-only stats to server', async () => {
            const serverData = { configs: {}, cardStats: { 'card1': { score: 10 } } };
            fetchStub.withArgs('/api/sync').resolves({ ok: true, json: () => Promise.resolve(serverData) });
            mockActions.get.withArgs('flashcard-configs').resolves({});
            mockActions.keys.resolves(['card1', 'local-only-card']);
            mockActions.get.withArgs('local-only-card').resolves({ score: 1 });

            await syncFromServer(mockActions, [], true);

            const postCall = fetchStub.getCalls().find(c => c.args[1] && c.args[1].method === 'POST');
            expect(postCall).to.not.be.undefined;
            const body = JSON.parse(postCall.args[1].body);
            expect(body).to.deep.equal({ cardStats: { 'local-only-card': { score: 1 } } });
        });

        it('should handle fetch failure gracefully', async () => {
            fetchStub.withArgs('/api/sync').rejects(new Error('Network Error'));
            mockActions.get.withArgs('flashcard-configs').resolves({ 'local-config': { url: 'local' } });

            const result = await syncFromServer(mockActions, [], true);

            expect(showTopNotificationSpy.calledWith('Could not sync from server.', 'error')).to.be.true;
            expect(result).to.deep.equal({ 'local-config': { url: 'local' } });
        });
    });
});