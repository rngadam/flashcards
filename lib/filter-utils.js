export function getDeckWords(data, roleToColumnMap) {
    if (!roleToColumnMap || !data) {
        return new Set();
    }
    const keyIndices = roleToColumnMap['TARGET_LANGUAGE'] || [];
    if (keyIndices.length !== 1) return new Set();

    const keyIndex = keyIndices[0];
    const deckWords = new Set();
    data.forEach(card => {
        const key = card[keyIndex]?.toLowerCase();
        if (key) {
            // Split by non-letter characters to handle multiple words in one cell
            key.match(/[\p{L}\p{N}]+/gu)?.forEach(word => deckWords.add(word));
        }
    });
    return deckWords;
}

export function getHighlightHTML(text, intersection) {
    // Escape HTML to prevent XSS and then highlight
    const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const highlightedHtml = escapedText.replace(/[\p{L}\p{N}]+/gu, (word) => {
        if (intersection.has(word.toLowerCase())) {
            return `<span class="match">${word}</span>`;
        }
        return word;
    });
    return highlightedHtml;
}
