import { VERIFICATION_METHODS, createSkillId } from '../lib/skill-utils.js';
import fs from 'fs';
import path from 'path';
import { strict as assert } from 'assert';

const defaultSkills = JSON.parse(fs.readFileSync(path.resolve('./lib/default-skills.json'), 'utf-8'));

describe('Default Skills Configuration', () => {
    it('should use valid verification methods', () => {
        const validMethods = Object.values(VERIFICATION_METHODS);
        for (const skill of defaultSkills) {
            assert(validMethods.includes(skill.verificationMethod), `Invalid verificationMethod: ${skill.verificationMethod} in skill "${skill.name}"`);
        }
    });

    it('should have stable, unchanging skill IDs', async () => {
        const expectedHashes = {
            'Reading & Listening': '2fa4e7c26ce716d7a1a654fbf5624d6b97d026a828e2c50db12c4a2b305e331f',
            'Translation Practice': 'ffac7e8a2968d929e1fbe4abda98788ed7fb07634590664b82de70ce7db29f89',
            'Reading Comprehension': '5b414b7c8891dd8384c20e7017a16141aabe9d4bc7379de712dca86e7d527b16',
            'Listening Comprehension': 'a771fa3da1b0947bbd9083ea8d8df9a9ae29fd04fcb4cc89f38bc97d5aeba8a4',
            'Validated Writing Practice': '840c4cbbeb3b4dd2f708f1f943498a60cf442b214b2005348b22427977a8107d',
            'Related words': 'bca6f1f962fa4d6398fcc26ca4dc738bd69c45fdb41be242bd2f3789f2266a64',
            'Speaking Practice': 'e7d1afaee19dee8fe97256f3026773b7d1124761ec975e64f00ef4d9307e9a7f',
            'Sentence Completion': '71d97424906413da6a9d6111aa8776dcf4995ea5a9a07557b5965e1736343da0'
        };

        for (const skill of defaultSkills) {
            const calculatedHash = await createSkillId(skill);
            const expectedHash = expectedHashes[skill.name];
            assert(expectedHash, `Missing expected hash for skill: "${skill.name}"`);
            assert.equal(calculatedHash, expectedHash, `Hash mismatch for skill: "${skill.name}"`);
        }
    });
});
