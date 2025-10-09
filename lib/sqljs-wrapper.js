// Wrapper pour initSqlJs pour permettre l'injection d'un mock en tests
let _initSqlJsMock = null;

export function __setMock(fn) {
    _initSqlJsMock = fn;
}

export async function initSqlJsWrapper(options) {
    if (_initSqlJsMock) {
        return _initSqlJsMock(options);
    }
    // Try to use a global initSqlJs (browser build) if available
    if (typeof globalThis.initSqlJs === 'function') {
        return await globalThis.initSqlJs(options);
    }
    // As a last resort, attempt to import sql.js package if installed
    try {
        const mod = await import('sql.js');
        if (mod && typeof mod.default === 'function') {
            return await mod.default(options);
        }
        return await mod(options);
    } catch (e) {
        throw new Error('initSqlJs is not available. In tests, inject a mock via __setMock.');
    }
}

export default initSqlJsWrapper;
