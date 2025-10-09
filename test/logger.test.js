import { expect } from 'chai';
import { __setMock as __setEldMock } from '../lib/eld-wrapper.js';
import logger from '../lib/core/logger.js';
import { detectColumnLanguages } from '../lib/shared/detect-column-languages.js';

describe('logger', function () {
    afterEach(function () {
        logger.clearBuffer();
        logger.setConfig({ outputs: { inMemory: true, console: false, server: false } });
        __setEldMock(null);
    });

    it('records entries in buffer and detectColumnLanguages logs sample and result', async function () {
        const eldMock = { detect: async (text) => ({ language: 'el' }) };
        __setEldMock(eldMock);
        logger.setConfig({ outputs: { console: false, inMemory: true, server: false }, enabledCategories: ['language'] });
        const cardData = [["γεια", "foo"]];
        const headers = ['A', 'B'];
        const res = await detectColumnLanguages(cardData, headers);
        expect(res[0]).to.equal('el');
        const buf = logger.getBuffer();
        // expect at least two entries: sample and result
        expect(buf.length).to.be.at.least(2);
        expect(buf.some(e => e.message === 'detectColumnLanguages.sample')).to.be.true;
        expect(buf.some(e => e.message === 'detectColumnLanguages.result')).to.be.true;
    });
});
