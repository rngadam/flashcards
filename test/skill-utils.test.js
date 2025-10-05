import { expect } from 'chai';
import { createSkillId, createSkill } from '../lib/skill-utils.js';

describe('Skill ID Generation', () => {
    let baseSkill;
    beforeEach(() => {
        baseSkill = {
            verificationMethod: 'text',
            front: ['TARGET_LANGUAGE', 'PRONUNCIATION'],
            validationColumn: 'TARGET_LANGUAGE',
            ttsFrontColumn: 'TARGET_LANGUAGE',
            name: 'Test Skill',
            back: ['BASE_LANGUAGE'],
            ttsBackColumn: 'BASE_LANGUAGE',
            ttsOnHotkeyOnly: false
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
        const modifiedSkill = {
            ...baseSkill,
            name: 'A New Name',
            back: ['BASE_LANGUAGE', 'EXAMPLE_SENTENCE'],
            ttsBackColumn: 'TARGET_LANGUAGE',
            ttsOnHotkeyOnly: true,
            transforms: { front: { TARGET_LANGUAGE: { casing: 'uppercase' } } }
        };
        const id2 = await createSkillId(modifiedSkill);
        expect(id1).to.equal(id2);
    });
});

describe('Skill Creation', () => {
    let baseSkillData;
    beforeEach(() => {
        baseSkillData = {
            name: 'Test Skill',
            verificationMethod: 'text',
            front: ['TARGET_LANGUAGE'],
            back: ['BASE_LANGUAGE'],
            validationColumn: 'TARGET_LANGUAGE',
            ttsFrontColumn: 'TARGET_LANGUAGE',
            ttsBackColumn: 'BASE_LANGUAGE',
            ttsOnHotkeyOnly: false
        };
    });

    it('should create a skill with default empty transforms if none are provided', async () => {
        const skill = await createSkill(baseSkillData);
        expect(skill.transforms).to.deep.equal({ front: {}, back: {} });
    });

    it('should correctly copy the transforms object from skill data', async () => {
        const transforms = {
            front: {
                TARGET_LANGUAGE: {
                    casing: 'uppercase',
                    font: 'Arial'
                }
            },
            back: {
                BASE_LANGUAGE: {
                    suppressParentheses: true
                }
            }
        };
        const skillDataWithTransforms = { ...baseSkillData, transforms };
        const skill = await createSkill(skillDataWithTransforms);
        expect(skill.transforms).to.deep.equal(transforms);
    });

    it('should handle an empty transforms object in skill data', async () => {
        const skillDataWithEmptyTransforms = { ...baseSkillData, transforms: {} };
        const skill = await createSkill(skillDataWithEmptyTransforms);
        expect(skill.transforms).to.deep.equal({});
    });

    it('should correctly parse skill-affecting transforms', async () => {
        const transforms = {
            front: {
                EXAMPLE_SENTENCE: {
                    hideString: true,
                    hideStringColumn: 'TARGET_LANGUAGE',
                    suppressParentheses: true
                }
            }
        };
        const skillData = { ...baseSkillData, front: ['EXAMPLE_SENTENCE'], transforms };
        const skill = await createSkill(skillData);
        expect(skill.transforms.front.EXAMPLE_SENTENCE.hideString).to.be.true;
        expect(skill.transforms.front.EXAMPLE_SENTENCE.hideStringColumn).to.equal('TARGET_LANGUAGE');
        expect(skill.transforms.front.EXAMPLE_SENTENCE.suppressParentheses).to.be.true;
    });
});
