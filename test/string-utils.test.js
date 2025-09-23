import { expect } from 'chai';
import { getLenientString, transformSlashText, stripParentheses } from '../lib/string-utils.js';
describe('String Utilities', () => {
    describe('stripParentheses', () => {
        it('should remove parentheses and their content', () => {
            expect(stripParentheses('hello (world)')).to.equal('hello');
        });
        it('should handle multiple sets of parentheses', () => {
            expect(stripParentheses('a (b) c (d) e')).to.equal('a c e');
        });
        it('should return the original string if no parentheses are present', () => {
            expect(stripParentheses('hello world')).to.equal('hello world');
        });
        it('should handle empty strings', () => {
            expect(stripParentheses('')).to.equal('');
        });
        it('should handle strings with only parentheses', () => {
            expect(stripParentheses('(hello)')).to.equal('');
        });
    });
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
