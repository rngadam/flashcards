import { eld } from '../eld-wrapper.js';
import { log } from '../core/logger.js';

/**
 * Détecte la langue de chaque colonne d'un tableau de données.
 * @param {Array<Array<string>>} cardData
 * @param {Array<string>} headers
 * @returns {Promise<Array<string>>} Tableau des langues détectées
 */
export async function detectColumnLanguages(cardData, headers) {
    if (!Array.isArray(cardData) || cardData.length === 0) {
        return [];
    }
    const languagePromises = headers.map(async (header, colIndex) => {
        let sampleText = '';
        const sampleSize = Math.min(cardData.length, 50);
        const shuffledData = [...cardData].sort(() => 0.5 - Math.random());
        for (let i = 0; i < sampleSize; i++) {
            const cell = shuffledData[i][colIndex];
            if (cell) {
                sampleText += cell.replace(/\s?\(.*\)\s?/g, ' ').trim() + ' ';
            }
        }
        if (sampleText.trim() === '') {
            return 'N/A';
        }
        // Log sampleText for diagnostics (category 'language')
        log('language', 'detectColumnLanguages.sample', { sampleText });
        const result = await eld.detect(sampleText);
        const finalLang = result && result.language;
        const resolved = finalLang && finalLang !== 'und' ? finalLang : 'en';
        log('language', 'detectColumnLanguages.result', { sampleText, result, resolved });
        return resolved;
    });
    return await Promise.all(languagePromises);
}
