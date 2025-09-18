export function getLenientString(str) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '').trim();
}
export function transformSlashText(text) {
    if (!text || !text.includes('/')) return text;
    const parts = text.split(/(\s?\(.*\))/);
    const mainPart = parts[0];
    const rest = parts.slice(1).join('');
    return mainPart.replace(/[^/\s]+\/([^/\s]+)/g, '$1') + rest;
}
