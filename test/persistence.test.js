
// Tests unitaires pour la logique de persistance (lib/persistence.js)

import { expect } from 'chai';
import { stub } from 'sinon';

import * as wrapper from '../lib/idb-keyval-wrapper.js';
import { saveConfig, loadConfig } from '../lib/persistence.js';

describe('Persistence Module', function () {
    let mock;
    beforeEach(function () {
        mock = {
            set: stub().resolves(),
            get: stub().resolves(),
            del: stub().resolves(),
            keys: stub().resolves(),
        };
        wrapper.__setMock(mock);
    });
    afterEach(function () {
        wrapper.__setMock(null);
    });

    it('saveConfig should call set with correct arguments', async function () {
        const config = { foo: 'bar', filterIsEnabled: true };
        await saveConfig(config);
        expect(mock.set.calledOnceWith('userConfig', config)).to.be.true;
    });

    it('loadConfig should call get and return config', async function () {
        const config = { filterText: 'abc', filterIsEnabled: false };
        mock.get.resolves(config);
        const result = await loadConfig();
        expect(result).to.deep.equal(config);
    });

    it('loadConfig should return {} if get returns null/undefined', async function () {
        mock.get.resolves(undefined);
        const result = await loadConfig();
        expect(result).to.deep.equal({});
    });
});
