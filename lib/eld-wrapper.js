// eld-wrapper.js
// Fournit une façade pour la détection de langue.
// Comportement préféré :
// 1) Si un mock est injecté via __setMock, l'utiliser (utile en tests).
// 2) Tenter d'importer le package localement (si installé en node_modules).
// 3) Sinon, utiliser un fallback léger et synchrone (heuristique) pour éviter
//    d'importer dynamiquement depuis un CDN dans l'environnement Node.

let eldInstance = null;
import { log } from './core/logger.js';

async function tryImportLocal() {
    try {
        // Essayer d'importer le package installé localement.
        // Utiliser import() pour conserver l'API asynchrone.
        const mod = await import('efficient-language-detector-no-dynamic-import');
        if (mod && (mod.eld || mod.default)) {
            // Normaliser l'API : mod.eld.detect ou mod.default.eld.detect
            return mod.eld || mod.default?.eld || mod.default || mod;
        }
        return mod;
    } catch (e) {
        // Pas installé ou import échoué en Node — on retournera null et on utilisera le fallback.
        return null;
    }
}

function lightweightFallback() {
    // Heuristique simple : si le texte contient des caractères CJK -> 'zh', sinon 'en'.
    return {
        detect(text) {
            if (!text || text.trim() === '') return { language: 'N/A' };
            const sample = String(text);
            // CJK unicode block check
            if (/\p{Script=Han}/u.test(sample) || /\p{Script=Hiragana}|\p{Script=Katakana}/u.test(sample)) {
                return { language: 'zh' };
            }
            // rudimentary detection for common Latin languages fallback
            return { language: 'en' };
        }
    };
}

export async function getEld() {
    if (eldInstance) return eldInstance;
    // Try injected/mock (handled via __setMock which sets eldInstance directly)
    // then try local import
    const local = await tryImportLocal();
    if (local) {
        eldInstance = local;
        log('language', 'eld-wrapper.strategy', { strategy: 'local' });
        return eldInstance;
    }

    // If in a browser-like environment, attempt to import from CDN before using fallback.
    if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
        try {
            const mod = await import('https://cdn.jsdelivr.net/npm/efficient-language-detector-no-dynamic-import@1.0.3/+esm');
            const resolved = mod.eld || mod.default?.eld || mod.default || mod;
            eldInstance = resolved;
            log('language', 'eld-wrapper.strategy', { strategy: 'cdn' });
            return eldInstance;
        } catch (e) {
            // fall through to fallback
            log('language', 'eld-wrapper.strategy', { strategy: 'cdn-failed', error: String(e) });
        }
    }

    // Fallback lightweight implementation
    eldInstance = { eld: lightweightFallback() };
    log('language', 'eld-wrapper.strategy', { strategy: 'fallback' });
    return eldInstance;
}

export const eld = {
    async detect(...args) {
        const mod = await getEld();
        // Support both shapes: mod.eld.detect and mod.detect
        if (mod.eld && typeof mod.eld.detect === 'function') {
            return mod.eld.detect(...args);
        }
        if (typeof mod.detect === 'function') {
            return mod.detect(...args);
        }
        // Last resort: use fallback
        return lightweightFallback().detect(...args);
    }
};

// Pour les tests : permet d'injecter un mock
export function __setMock(mock) {
    // mock is expected to be an object exposing detect(text)
    eldInstance = { eld: mock };
}