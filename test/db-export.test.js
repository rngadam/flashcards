import { createDatabase } from '../lib/db-export.js';
import { __setMock as __setSqlMock } from '../lib/sqljs-wrapper.js';

describe('createDatabase', function () {
    afterEach(() => {
        __setSqlMock(null);
    });

    it('should use injected sql.js and return exported Uint8Array', async function () {
        // Create a fake SQL object with Database stub
        const fakeDb = {
            exec: () => {},
            prepare: () => ({ run: () => {}, step: () => {}, reset: () => {}, free: () => {} }),
            export: () => new Uint8Array([1,2,3])
        };
        const fakeSQL = {
            Database: function () { return fakeDb; }
        };

        __setSqlMock(() => Promise.resolve(fakeSQL));

        const allCardStats = [];
        const cardData = [];
        const getCardKey = () => 'k';
        const configs = { default: { skills: [] } };

        const result = await createDatabase(allCardStats, cardData, getCardKey, configs, 'default');
        if (!(result instanceof Uint8Array)) throw new Error('Expected Uint8Array');
    });
});
