// Détection de la langue des colonnes, extraite de app.js pour testabilité
import { eld } from './eld-wrapper.js';

/**
 * Détecte la langue de chaque colonne d'un tableau de données.
 * @param {Array<Array<string>>} cardData
 * @param {Array<string>} headers
 * @returns {Promise<Array<string>>} Tableau des langues détectées
 */
export async function detectColumnLanguages(cardData, headers) {
    if (cardData.length === 0) {
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
        const result = await eld.detect(sampleText);
        const finalLang = result.language;
        return finalLang && finalLang !== 'und' ? finalLang : 'en';
    });
    return await Promise.all(languagePromises);
}