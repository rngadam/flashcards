let crypto;
async function getCrypto() {
    if (crypto) return crypto;
    if (typeof window === 'undefined') {
        const { webcrypto } = await import('crypto');
        crypto = webcrypto;
    } else {
        crypto = window.crypto;
    }
    return crypto;
}
function bufferToHex(buffer) {
    return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function createSkillId(skill) {
    const crypto = await getCrypto();
    const importantParts = {
        verificationMethod: skill.verificationMethod,
        front: [...skill.front].sort(),
        validationColumn: skill.validationColumn,
        ttsFrontColumn: skill.ttsFrontColumn,
    };
    const jsonString = JSON.stringify(importantParts, Object.keys(importantParts).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
}
export class Skill {
    constructor(name, id) {
        this.id = id || `temp-${Math.random()}`;
        this.name = name;
        this.verificationMethod = 'none';
        this.front = [];
        this.back = [];
        this.validationColumn = 'none';
        this.ttsFrontColumn = 'none';
        this.ttsBackColumn = 'none';
        this.alternateUppercase = false;
        this.ttsOnHotkeyOnly = false;
        if (!id) {
            getCrypto().then(c => { this.id = c.randomUUID(); });
        }
    }
}
