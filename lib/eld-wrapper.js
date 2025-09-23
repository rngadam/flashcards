// eld-wrapper.js
// Permet d'utiliser eld depuis un CDN en prod, ou d'injecter un mock en test.

let eldInstance = null;

export async function getEld() {
  if (eldInstance) return eldInstance;
  eldInstance = await import('https://cdn.jsdelivr.net/npm/efficient-language-detector-no-dynamic-import@1.0.3/+esm');
  return eldInstance;
}

export const eld = {
  async detect(...args) {
    const mod = await getEld();
    return mod.eld.detect(...args);
  }
};

// Pour les tests : permet d'injecter un mock
export function __setMock(mock) {
  eldInstance = { eld: mock };
}