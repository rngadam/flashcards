let cryptoImpl;
async function getCrypto() {
    if (cryptoImpl) return cryptoImpl;
    if (typeof window === 'undefined') {
        const { webcrypto } = await import('crypto');
        cryptoImpl = webcrypto;
    } else {
        cryptoImpl = window.crypto;
    }
    return cryptoImpl;
}

function bufferToHex(buffer) {
    return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Build a canonical string from skill data deterministically.
function buildCanonicalString(skill) {
    // Only include the properties that should affect identity
    const parts = [];
    // We include verificationMethod
    parts.push(`verificationMethod:${String(skill.verificationMethod || 'none')}`);

    // front is treated as a set => sort to make order-independent
    const front = Array.isArray(skill.front) ? [...skill.front].slice().sort() : [];
    parts.push(`front:${front.join('|')}`);

    // validationColumn and ttsFrontColumn
    parts.push(`validationColumn:${String(skill.validationColumn || 'none')}`);
    parts.push(`ttsFrontColumn:${String(skill.ttsFrontColumn || 'none')}`);

    // Note: intentionally do NOT include name, back, ttsBackColumn, or other
    // non-essential fields. Only include the properties that determine identity
    // per design/tests: verificationMethod, sorted front, validationColumn,
    // and ttsFrontColumn.

    return parts.join(';');
}

export async function createSkillId(skill) {
    const crypto = await getCrypto();
    const canonical = buildCanonicalString(skill);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
}

export class Skill {
    // constructor is synchronous and requires the id to be provided by the factory
    constructor(name, id) {
        if (!id) throw new Error('Skill constructor requires an id. Use createSkill factory.');
        this.id = id;
        this.name = name;
        this.verificationMethod = 'none';
        this.front = [];
        this.back = [];
        this.validationColumn = 'none';
        this.ttsFrontColumn = 'none';
        this.ttsBackColumn = 'none';
        this.alternateUppercase = false;
        this.ttsOnHotkeyOnly = false;
    }
}

export async function createSkill(skillData) {
    // If caller already computed an id (to avoid double hashing), use it.
    const id = skillData.id ? skillData.id : await createSkillId(skillData);
    const skill = new Skill(skillData.name || 'Unnamed Skill', id);
    // Copy known properties
    skill.verificationMethod = skillData.verificationMethod || 'none';
    skill.front = Array.isArray(skillData.front) ? [...skillData.front] : [];
    skill.back = Array.isArray(skillData.back) ? [...skillData.back] : [];
    skill.validationColumn = skillData.validationColumn || 'none';
    skill.ttsFrontColumn = skillData.ttsFrontColumn || 'none';
    skill.ttsBackColumn = skillData.ttsBackColumn || 'none';
    skill.alternateUppercase = !!skillData.alternateUppercase;
    skill.ttsOnHotkeyOnly = !!skillData.ttsOnHotkeyOnly;
    return skill;
}
