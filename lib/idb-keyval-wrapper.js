// idb-keyval-wrapper.js
// Ce wrapper permet d'utiliser idb-keyval depuis un CDN en prod, ou d'injecter un mock en test.


let idbKeyval = null;

export async function get(...args) {
  if (idbKeyval) {
    return idbKeyval.get(...args);
  }
  idbKeyval = await import('https://cdn.jsdelivr.net/npm/idb-keyval/+esm');
  return idbKeyval.get(...args);
}

export async function set(...args) {
  if (idbKeyval) {
    return idbKeyval.set(...args);
  }
  idbKeyval = await import('https://cdn.jsdelivr.net/npm/idb-keyval/+esm');
  return idbKeyval.set(...args);
}

export async function del(...args) {
  if (idbKeyval) {
    return idbKeyval.del(...args);
  }
  idbKeyval = await import('https://cdn.jsdelivr.net/npm/idb-keyval/+esm');
  return idbKeyval.del(...args);
}

export async function keys(...args) {
  if (idbKeyval) {
    return idbKeyval.keys(...args);
  }
  idbKeyval = await import('https://cdn.jsdelivr.net/npm/idb-keyval/+esm');
  return idbKeyval.keys(...args);
}

// Pour les tests : permet d'injecter un mock complet (set/get/del/keys)
export function __setMock(mock) {
  idbKeyval = mock;
}
