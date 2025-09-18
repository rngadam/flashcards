import { expect } from 'chai';
import { createSkillId } from '../lib/skill-utils.js';
describe('Skill ID Generation', () => {
    let baseSkill;
    beforeEach(() => {
        baseSkill = {
            verificationMethod: 'text',
            front: ['TARGET_LANGUAGE', 'PRONUNCIATION'],
            validationColumn: 'TARGET_LANGUAGE',
            ttsFrontColumn: 'TARGET_LANGUAGE',
            name: 'Test Skill', back: ['BASE_LANGUAGE'], ttsBackColumn: 'BASE_LANGUAGE', alternateUppercase: false, ttsOnHotkeyOnly: false
        };
    });
    it('should create a consistent SHA-256 hash for the same skill data', async () => {
        const id1 = await createSkillId(baseSkill);
        const id2 = await createSkillId(baseSkill);
        expect(id1).to.be.a('string').and.have.lengthOf(64);
        expect(id1).to.equal(id2);
    });
    it('should produce the same hash regardless of the order of front columns', async () => {
        const skill1 = { ...baseSkill, front: ['TARGET_LANGUAGE', 'PRONUNCIATION'] };
        const skill2 = { ...baseSkill, front: ['PRONUNCIATION', 'TARGET_LANGUAGE'] };
        const id1 = await createSkillId(skill1);
        const id2 = await createSkillId(skill2);
        expect(id1).to.equal(id2);
    });
    it('should NOT create a different hash if non-important properties change', async () => {
        const id1 = await createSkillId(baseSkill);
        const modifiedSkill = { ...baseSkill, name: 'A New Name', back: ['BASE_LANGUAGE', 'EXAMPLE_SENTENCE'], ttsBackColumn: 'TARGET_LANGUAGE', alternateUppercase: true, ttsOnHotkeyOnly: true };
        const id2 = await createSkillId(modifiedSkill);
        expect(id1).to.equal(id2);
    });
});
