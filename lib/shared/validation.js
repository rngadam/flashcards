/**
 * Pure validation and sanitization helpers for shared, isomorphic code.
 * These functions make no reference to DOM or environment and can run in
 * both browser and Node.js.
 */

export function createDefaultSkillStats() {
    return {
        successTimestamps: [],
        failureTimestamps: [],
        responseDelays: [],
        lastViewed: null,
        intervalIndex: 0,
        viewCount: 0
    };
}

/**
 * Ensure a cardStats object has the expected shape. If it's null/invalid,
 * returns a sanitized object. Also ensures that every skill id listed in
 * `userSkills` exists on the returned object with default stats.
 *
 * @param {any} raw
 * @param {Array<object>} userSkills - array of skill objects with an `id` property
 * @returns {object} sanitized cardStats
 */
export function sanitizeCardStats(raw, userSkills = []) {
    let cardStats = raw;
    if (!cardStats || typeof cardStats !== 'object') {
        cardStats = { skills: {} };
    }
    if (!cardStats.skills || typeof cardStats.skills !== 'object') {
        cardStats.skills = {};
    }

    if (Array.isArray(userSkills) && userSkills.length > 0) {
        userSkills.forEach(skill => {
            if (!skill || !skill.id) return;
            if (!cardStats.skills[skill.id] || typeof cardStats.skills[skill.id] !== 'object') {
                cardStats.skills[skill.id] = createDefaultSkillStats();
            } else {
                // Ensure shape for existing skill stats
                const s = cardStats.skills[skill.id];
                s.successTimestamps = Array.isArray(s.successTimestamps) ? s.successTimestamps : [];
                s.failureTimestamps = Array.isArray(s.failureTimestamps) ? s.failureTimestamps : [];
                s.responseDelays = Array.isArray(s.responseDelays) ? s.responseDelays : [];
                s.lastViewed = s.lastViewed || null;
                s.intervalIndex = typeof s.intervalIndex === 'number' ? s.intervalIndex : 0;
                s.viewCount = typeof s.viewCount === 'number' ? s.viewCount : 0;
            }
        });
    }
    return cardStats;
}

/**
 * Validate a configuration object at a basic level. Returns an object with
 * `valid: boolean` and `errors: string[]`.
 *
 * @param {object} config
 */
export function validateConfigShape(config) {
    const errors = [];
    if (!config || typeof config !== 'object') {
        errors.push('Config must be an object.');
        return { valid: false, errors };
    }
    const roleToColumnMap = config.roleToColumnMap || {};
    const targetCols = roleToColumnMap['TARGET_LANGUAGE'] || [];
    if (!Array.isArray(targetCols) || targetCols.length !== 1) {
        errors.push('Config must assign exactly one TARGET_LANGUAGE column.');
    }
    return { valid: errors.length === 0, errors };
}
