// persistence.js
// Logique de persistance des paramètres utilisateur (sauvegarde/chargement)
// Ce module est pur Node.js et n'utilise aucun import CDN.

import { get, set } from './idb-keyval-wrapper.js';

/**
 * Sauvegarde la configuration utilisateur.
 * @param {Object} config - L'objet de configuration à sauvegarder.
 * @returns {Promise<void>}
 */
export async function saveConfig(config) {
  await set('userConfig', config);
}

/**
 * Charge la configuration utilisateur.
 * @returns {Promise<Object>} L'objet de configuration ou {} par défaut.
 */
export async function loadConfig() {
  return (await get('userConfig')) || {};
}
