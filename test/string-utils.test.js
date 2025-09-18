import { expect } from 'chai';
import { getLenientString, transformSlashText } from '../lib/string-utils.js';
describe('String Utilities', () => {
    describe('getLenientString', () => {
        it('should handle a combination of transformations', () => {
            expect(getLenientString('  HÉLLÖ, WÖRLD!  ')).to.equal('hello world');
        });
        it('should return an empty string for non-string inputs', () => {
            expect(getLenientString(null)).to.equal('');
        });
    });
    describe('transformSlashText', () => {
        it('should preserve text in parentheses', () => {
            expect(transformSlashText('他/她微笑 (tā/tā wéixiào)')).to.equal('她微笑 (tā/tā wéixiào)');
        });
    });
});
