import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findJsFiles(dir) {
    const res = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            res.push(...findJsFiles(p));
        } else if (entry.isFile() && p.endsWith('.js')) {
            res.push(p);
        }
    }
    return res;
}

function parseNamedImports(source) {
    // Very small parser: finds `import { a, b as c } from './mod.js'` forms
    const imports = [];
    const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(source)) !== null) {
        const rawSpec = m[1].trim();
        const specifiers = rawSpec.split(',').map(s => s.trim().split(/\s+as\s+/).pop().trim()).filter(Boolean);
        const fromPath = m[2];
        imports.push({ specifiers, fromPath });
    }
    return imports;
}

function parseExports(source) {
    const exports = new Set();
    // match export function/class/const/let/var (with optional async)
    const declRegex = /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g;
    let m;
    while ((m = declRegex.exec(source)) !== null) {
        exports.add(m[1]);
    }
    // match export { ... }
    const namedExportRegex = /export\s*\{([^}]+)\}/g;
    while ((m = namedExportRegex.exec(source)) !== null) {
        const parts = m[1].split(',').map(p => p.trim()).filter(Boolean);
        for (const p of parts) {
            const sub = p.split(/\s+as\s+/).pop().trim();
            if (sub) exports.add(sub);
        }
    }
    // match export default name
    const defaultRegex = /export\s+default\s+([A-Za-z0-9_$]+)/g;
    while ((m = defaultRegex.exec(source)) !== null) {
        exports.add('default');
    }
    return exports;
}

describe('static import validation', function () {
    it('should ensure named imports exist on target modules', async function () {
        this.timeout(10_000);
        const projectRoot = path.resolve(__dirname, '..');
        const files = [
            ...findJsFiles(path.join(projectRoot, 'lib')),
            path.join(projectRoot, 'app.js'),
            path.join(projectRoot, 'dictation.js')
        ].filter(f => fs.existsSync(f));

        for (const file of files) {
            const src = fs.readFileSync(file, 'utf8');
            const imports = parseNamedImports(src);
            for (const imp of imports) {
                // resolve the module path relative to the importing file
                const resolved = path.resolve(path.dirname(file), imp.fromPath);
                const target = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
                if (!fs.existsSync(target)) {
                    throw new Error(`Imported module ${target} referenced from ${file} does not exist`);
                }
                const targetSrc = fs.readFileSync(target, 'utf8');
                const exported = parseExports(targetSrc);
                for (const spec of imp.specifiers) {
                    if (!exported.has(spec)) {
                        throw new Error(`Missing export '${spec}' in module ${target} referenced from ${file}. Exports found: ${[...exported].join(', ')}`);
                    }
                }
            }
        }
    });
});
