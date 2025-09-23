// detectColumnLanguages.test.js
// Tests unitaires pour la détection de langue des colonnes (mock eld)

import { expect } from 'chai';
import sinon from 'sinon';
import { __setMock } from '../lib/eld-wrapper.js';
import { detectColumnLanguages } from '../lib/detect-column-languages.js';

describe('detectColumnLanguages', function () {
    let eldMock;
    beforeEach(function () {
        eldMock = {
            detect: sinon.stub()
        };
        __setMock(eldMock);
    });
    afterEach(function () {
        __setMock(null);
    });

    it('retourne N/A pour colonne vide', async function () {
        const cardData = [['', '']];
        const headers = ['Col1', 'Col2'];
        eldMock.detect.resolves({ language: 'en' }); // ne sera pas appelé
        const result = await detectColumnLanguages(cardData, headers);
        expect(result).to.deep.equal(['N/A', 'N/A']);
    });

    it('utilise eld.detect et retourne la langue détectée', async function () {
        eldMock.detect.onFirstCall().resolves({ language: 'fr' });
        eldMock.detect.onSecondCall().resolves({ language: 'en' });
        const cardData = [['bonjour', 'hello'], ['salut', 'hi']];
        const headers = ['French', 'English'];
        const result = await detectColumnLanguages(cardData, headers);
        expect(result).to.deep.equal(['fr', 'en']);
        expect(eldMock.detect.callCount).to.equal(2);
    });

    it('retourne en si eld.detect retourne und', async function () {
        eldMock.detect.resolves({ language: 'und' });
        const cardData = [['???', '???']];
        const headers = ['Mystery', 'Mystery2'];
        const result = await detectColumnLanguages(cardData, headers);
        expect(result).to.deep.equal(['en', 'en']);
    });

    it('retourne en si eld.detect retourne undefined', async function () {
        eldMock.detect.resolves({});
        const cardData = [['???', '???']];
        const headers = ['Mystery', 'Mystery2'];
        const result = await detectColumnLanguages(cardData, headers);
        expect(result).to.deep.equal(['en', 'en']);
    });
});
