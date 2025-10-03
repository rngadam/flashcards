import { expect } from 'chai';
import { setupDOM, teardownDOM } from './test-helpers.js';
import { formatTimeAgo, formatDuration, formatTimeDifference, getTimeToDue } from '../lib/card-display.js';

describe('Card Display Module', () => {
    describe('formatTimeAgo', () => {
        const now = Date.now();

        it('should return "never" for a null timestamp', () => {
            expect(formatTimeAgo(null)).to.equal('never');
        });

        it('should return "just now" for a very recent timestamp', () => {
            expect(formatTimeAgo(now - 1000)).to.equal('just now');
        });

        it('should return "X seconds ago"', () => {
            expect(formatTimeAgo(now - 30 * 1000)).to.equal('30 seconds ago');
        });

        it('should return "X minutes ago"', () => {
            expect(formatTimeAgo(now - 5 * 60 * 1000)).to.equal('5 minutes ago');
        });

        it('should return "X hours ago"', () => {
            expect(formatTimeAgo(now - 2 * 60 * 60 * 1000)).to.equal('2 hours ago');
        });

        it('should return "X days ago"', () => {
            expect(formatTimeAgo(now - 3 * 24 * 60 * 60 * 1000)).to.equal('3 days ago');
        });

        it('should return "X months ago"', () => {
            expect(formatTimeAgo(now - 4 * 30 * 24 * 60 * 60 * 1000)).to.equal('4 months ago');
        });

        it('should return "X years ago"', () => {
            expect(formatTimeAgo(now - 2 * 12 * 30 * 24 * 60 * 60 * 1000)).to.equal('2 years ago');
        });
    });

    describe('formatDuration', () => {
        it('should format seconds', () => {
            expect(formatDuration(30)).to.equal('30 seconds');
        });

        it('should format minutes', () => {
            expect(formatDuration(300)).to.equal('5 minutes');
        });

        it('should format hours', () => {
            expect(formatDuration(7200)).to.equal('2 hours');
        });

        it('should format days', () => {
            expect(formatDuration(259200)).to.equal('3 days');
        });

        it('should format months', () => {
            expect(formatDuration(5184000)).to.equal('2 months');
        });

        it('should format years', () => {
            expect(formatDuration(63072000)).to.equal('2 years');
        });
    });

    describe('formatTimeDifference', () => {
        it('should return "Now" for 0 or less', () => {
            expect(formatTimeDifference(0)).to.equal('Now');
            expect(formatTimeDifference(-100)).to.equal('Now');
        });

        it('should format seconds', () => {
            expect(formatTimeDifference(30000)).to.equal('30s');
        });

        it('should format minutes', () => {
            expect(formatTimeDifference(300000)).to.equal('5m');
        });

        it('should format hours', () => {
            expect(formatTimeDifference(7200000)).to.equal('2h');
        });

        it('should format days', () => {
            expect(formatTimeDifference(259200000)).to.equal('3d');
        });
    });

    describe('getTimeToDue', () => {
        const repetitionIntervals = [60, 300, 900]; // 1m, 5m, 15m
        const now = Date.now();

        it('should return "N/A" for a skill never viewed', () => {
            const skillStats = { lastViewed: null };
            const result = getTimeToDue(skillStats, repetitionIntervals, now);
            expect(result.formatted).to.equal('N/A');
        });

        it('should return "Learned" when intervalIndex is out of bounds', () => {
            const skillStats = { lastViewed: now, intervalIndex: 3 };
            const result = getTimeToDue(skillStats, repetitionIntervals, now);
            expect(result.formatted).to.equal('Learned');
        });

        it('should calculate time to due correctly', () => {
            const skillStats = { lastViewed: now - 30000, intervalIndex: 0 }; // last seen 30s ago, interval is 60s
            const result = getTimeToDue(skillStats, repetitionIntervals, now);
            expect(result.formatted).to.equal('30s');
        });

        it('should return "Now" for a due card', () => {
            const skillStats = { lastViewed: now - 70000, intervalIndex: 0 }; // last seen 70s ago, interval is 60s
            const result = getTimeToDue(skillStats, repetitionIntervals, now);
            expect(result.formatted).to.equal('Now');
        });
    });
});