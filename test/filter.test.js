import { expect } from 'chai';
import { getDeckWords, getHighlightHTML } from '../lib/filter-utils.js';

describe('getDeckWords', () => {
    const roleToColumnMap = {
        'TARGET_LANGUAGE': [0],
        'BASE_LANGUAGE': [1],
    };

    it('should return a Set of unique words from a standard dataset', () => {
        const cardData = [
            ['hello', 'hola'],
            ['world', 'mundo'],
            ['hello', 'bonjour'],
        ];
        const result = getDeckWords(cardData, roleToColumnMap);
        expect(result).to.be.an.instanceOf(Set);
        expect(result).to.deep.equal(new Set(['hello', 'world']));
    });

    it('should handle cards where the "Target Language" field is empty or missing', () => {
        const cardData = [
            ['apple', 'manzana'],
            [null, 'pera'],
            ['grape', 'uva'],
            ['', 'naranja'],
        ];
        const result = getDeckWords(cardData, roleToColumnMap);
        expect(result).to.deep.equal(new Set(['apple', 'grape']));
    });

    it('should handle an empty array of card data, returning an empty Set', () => {
        const cardData = [];
        const result = getDeckWords(cardData, roleToColumnMap);
        expect(result).to.be.an.instanceOf(Set);
        expect(result.size).to.equal(0);
    });

    it('should correctly parse fields containing multiple words', () => {
        const cardData = [
            ['ice cream', 'helado'],
            ['hot dog', 'perro caliente'],
        ];
        const result = getDeckWords(cardData, roleToColumnMap);
        expect(result).to.deep.equal(new Set(['ice', 'cream', 'hot', 'dog']));
    });

    it('should correctly handle duplicate words across different cards, only including them once', () => {
        const cardData = [
            ['red apple', 'manzana roja'],
            ['red car', 'coche rojo'],
        ];
        const result = getDeckWords(cardData, roleToColumnMap);
        expect(result).to.deep.equal(new Set(['red', 'apple', 'car']));
    });
});

describe('getHighlightHTML', () => {
    it('should wrap a single matching word in <span class="match">', () => {
        const text = 'hello world';
        const intersection = new Set(['hello']);
        const result = getHighlightHTML(text, intersection);
        expect(result).to.equal('<span class="match">hello</span> world');
    });

    it('should wrap multiple, non-adjacent matching words', () => {
        const text = 'the quick brown fox jumps over the lazy dog';
        const intersection = new Set(['fox', 'dog']);
        const result = getHighlightHTML(text, intersection);
        expect(result).to.equal('the quick brown <span class="match">fox</span> jumps over the lazy <span class="match">dog</span>');
    });

    it('should return the original text unmodified if there are no matching words', () => {
        const text = 'hello world';
        const intersection = new Set(['goodbye']);
        const result = getHighlightHTML(text, intersection);
        expect(result).to.equal('hello world');
    });

    it('should handle an empty input string, returning an empty string', () => {
        const text = '';
        const intersection = new Set(['hello']);
        const result = getHighlightHTML(text, intersection);
        expect(result).to.equal('');
    });

    it('should handle an empty intersection Set, returning the original text', () => {
        const text = 'this is a test';
        const intersection = new Set();
        const result = getHighlightHTML(text, intersection);
        expect(result).to.equal('this is a test');
    });

    it('(Security) should correctly escape HTML special characters in the input text', () => {
        const text = '<script>alert("xss")</script> & some text';
        const intersection = new Set(['script', 'text']);
        const result = getHighlightHTML(text, intersection);
        expect(result).to.equal('&lt;<span class="match">script</span>&gt;alert("xss")&lt;/<span class="match">script</span>&gt; &amp; some <span class="match">text</span>');
    });

    it('(Case Insensitivity) should match words regardless of their case', () => {
        const text = 'Apple and apple are the same.';
        const intersection = new Set(['apple']); // Intersection is lowercase
        const result = getHighlightHTML(text, intersection);
        expect(result).to.equal('<span class="match">Apple</span> and <span class="match">apple</span> are the same.');
    });
});
