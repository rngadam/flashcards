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
        name: skill.name || '',
        verificationMethod: skill.verificationMethod || 'none',
        front: [...(skill.front || [])].sort(),
        back: [...(skill.back || [])].sort(),
        validationColumn: skill.validationColumn || 'none',
        ttsFrontColumn: skill.ttsFrontColumn || 'none',
        ttsBackColumn: skill.ttsBackColumn || 'none',
        alternateUppercase: !!skill.alternateUppercase,
        ttsOnHotkeyOnly: !!skill.ttsOnHotkeyOnly,
    };
    const canonicalString = `name:${importantParts.name};verificationMethod:${importantParts.verificationMethod};front:${importantParts.front.join(',')};back:${importantParts.back.join(',')};validationColumn:${importantParts.validationColumn};ttsFrontColumn:${importantParts.ttsFrontColumn};ttsBackColumn:${importantParts.ttsBackColumn};alternateUppercase:${importantParts.alternateUppercase};ttsOnHotkeyOnly:${importantParts.ttsOnHotkeyOnly};`;
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
}
export class Skill {
    constructor(name, id) {
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
    const skillId = await createSkillId(skillData);
    const newSkill = new Skill(skillData.name, skillId);
    Object.assign(newSkill, skillData);
    return newSkill;
}
