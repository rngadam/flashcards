import { expect } from 'chai';
import { sanitizeCardStats, validateConfigShape, createDefaultSkillStats } from '../lib/shared/validation.js';

describe('Validation Shared Module', () => {
    describe('sanitizeCardStats', () => {
        it('should return default structure when input is null', () => {
            const out = sanitizeCardStats(null, [{ id: 's1' }]);
            expect(out).to.be.an('object');
            expect(out.skills).to.be.an('object');
            expect(out.skills.s1).to.deep.equal(createDefaultSkillStats());
        });

        it('should preserve existing valid skill stats but fix missing fields', () => {
            const raw = { skills: { s1: { successTimestamps: [1], viewCount: 'not-a-number' } } };
            const out = sanitizeCardStats(raw, [{ id: 's1' }]);
            expect(out.skills.s1.successTimestamps).to.deep.equal([1]);
            expect(out.skills.s1.viewCount).to.equal(0);
            expect(out.skills.s1.failureTimestamps).to.deep.equal([]);
        });
    });

    describe('validateConfigShape', () => {
        it('should return invalid when config missing TARGET_LANGUAGE', () => {
            const res = validateConfigShape({ roleToColumnMap: { BASE_LANGUAGE: [0] } });
            expect(res.valid).to.be.false;
            expect(res.errors).to.be.an('array').that.is.not.empty;
        });

        it('should return valid for correct config', () => {
            const res = validateConfigShape({ roleToColumnMap: { TARGET_LANGUAGE: [1] } });
            expect(res.valid).to.be.true;
            expect(res.errors).to.be.an('array').that.is.empty;
        });
    });
});
