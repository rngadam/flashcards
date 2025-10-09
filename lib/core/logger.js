// Simple configurable logger.
// Supports categories, outputs: console, in-memory buffer (for UI), and optional server POST.

const defaultConfig = {
  level: 'info', // not used fully yet, placeholder for future
  enabledCategories: new Set(['language', 'sync', 'ui', 'debug']),
  outputs: {
    console: true,
    inMemory: true,
    server: false
  },
  serverEndpoint: '/api/logs'
};

let config = { ...defaultConfig };
// in-memory circular buffer
const MAX_BUFFER = 1000;
const buffer = [];

function shouldLog(category) {
  return config.enabledCategories.has(category);
}

async function sendToServer(entry) {
  if (!config.outputs.server) return;
  try {
    await fetch(config.serverEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
  } catch (e) {
    // swallow errors to avoid affecting app
    if (config.outputs.console) console.warn('Logger: failed to send to server', e);
  }
}

export function log(category, message, meta = {}) {
  if (!shouldLog(category)) return;
  const entry = { ts: Date.now(), category, message, meta };
  if (config.outputs.console) console.log(`[${category}]`, message, meta);
  if (config.outputs.inMemory) {
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) buffer.shift();
  }
  if (config.outputs.server) sendToServer(entry);
}

export function getBuffer() {
  return [...buffer];
}

export function clearBuffer() {
  buffer.length = 0;
}

export function getConfig() {
  // shallow copy
  return {
    enabledCategories: new Set(config.enabledCategories),
    outputs: { ...config.outputs },
    serverEndpoint: config.serverEndpoint
  };
}

export function setConfig(newConf) {
  if (!newConf) return;
  if (newConf.enabledCategories) config.enabledCategories = new Set(newConf.enabledCategories);
  if (newConf.outputs) config.outputs = { ...config.outputs, ...newConf.outputs };
  if (newConf.serverEndpoint) config.serverEndpoint = newConf.serverEndpoint;
}

export default { log, getBuffer, clearBuffer, getConfig, setConfig };
