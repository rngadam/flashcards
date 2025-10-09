/**
 * Shared, pure utilities for handling card statistics.
 */
export function mergeCardStats(existing, imported) {
    if (!existing.skills) existing.skills = {};
    if (!imported || !imported.skills) return existing;

    for (const skillId in imported.skills) {
        const importedSkill = imported.skills[skillId];
        const existingSkill = existing.skills[skillId];

        if (existingSkill) {
            const existingSuccess = existingSkill.successTimestamps || [];
            const importedSuccess = importedSkill.successTimestamps || [];
            const existingFailure = existingSkill.failureTimestamps || [];
            const importedFailure = importedSkill.failureTimestamps || [];

            existingSkill.successTimestamps = [...new Set([...existingSuccess, ...importedSuccess])].sort((a, b) => a - b);
            existingSkill.failureTimestamps = [...new Set([...existingFailure, ...importedFailure])].sort((a, b) => a - b);
            existingSkill.responseDelays = [...(existingSkill.responseDelays || []), ...(importedSkill.responseDelays || [])];
            existingSkill.viewCount = (existingSkill.viewCount || 0) + (importedSkill.viewCount || 0);
            existingSkill.lastViewed = Math.max(existingSkill.lastViewed || 0, importedSkill.lastViewed || 0);
            existingSkill.intervalIndex = Math.max(existingSkill.intervalIndex || 0, importedSkill.intervalIndex || 0);
        } else {
            existing.skills[skillId] = importedSkill;
        }
    }
    return existing;
}
