import { eld } from '../eld-wrapper.js';

/**
 * Detects the language of a given text.
 * @param {string} text
 * @returns {Promise<string>} The detected language code (e.g., 'en', 'fr')
 */
export async function detectLanguage(text) {
    if (!text || text.trim() === '') {
        return 'N/A';
    }
    const result = await eld.detect(text);
    const finalLang = result && result.language;
    return finalLang && finalLang !== 'und' ? finalLang : 'en';
}
