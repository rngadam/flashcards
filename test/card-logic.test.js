import { expect } from 'chai';
import sinon from 'sinon';
import { getCardKey, markCardAsKnown } from '../lib/card-logic.js';

describe('Card Logic Module', () => {
    describe('getCardKey', () => {
        it('should return the correct key when config is valid', () => {
            const card = ['key', 'value'];
            const state = {
                dom: { configSelector: { value: 'test-config' } },
                configs: {
                    'test-config': {
                        roleToColumnMap: {
                            TARGET_LANGUAGE: [0]
                        }
                    }
                }
            };
            const key = getCardKey(card, state);
            expect(key).to.equal('key');
        });

        it('should return null if no config is selected', () => {
            const card = ['key', 'value'];
            const state = {
                dom: { configSelector: { value: '' } },
                configs: {}
            };
            const key = getCardKey(card, state);
            expect(key).to.be.null;
        });

        it('should return null if roleToColumnMap is missing', () => {
            const card = ['key', 'value'];
            const state = {
                dom: { configSelector: { value: 'test-config' } },
                configs: { 'test-config': {} }
            };
            const key = getCardKey(card, state);
            expect(key).to.be.null;
        });

        it('should return null if TARGET_LANGUAGE has more than one index', () => {
            const card = ['key', 'value'];
            const state = {
                dom: { configSelector: { value: 'test-config' } },
                configs: {
                    'test-config': {
                        roleToColumnMap: {
                            TARGET_LANGUAGE: [0, 1]
                        }
                    }
                }
            };
            const key = getCardKey(card, state);
            expect(key).to.be.null;
        });

        it('should return null for invalid card data', () => {
            const state = {
                dom: { configSelector: { value: 'test-config' } },
                configs: {
                    'test-config': {
                        roleToColumnMap: {
                            TARGET_LANGUAGE: [0]
                        }
                    }
                }
            };
            expect(getCardKey(null, state)).to.be.null;
            expect(getCardKey([], state)).to.be.null;
            expect(getCardKey([''], state)).to.be.null;
        });
    });

    describe('markCardAsKnown', () => {
        let state;
        let actions;

        beforeEach(() => {
            state = {
                cardData: [['key']],
                currentCardIndex: 0,
                currentSkillId: 'skill1',
                cardShownTimestamp: Date.now() - 1000,
                repetitionIntervals: [60, 300],
                isCurrentCardDue: false,
                dom: { configSelector: { value: 'test-config' } },
                configs: {
                    'test-config': {
                        roleToColumnMap: {
                            TARGET_LANGUAGE: [0]
                        }
                    }
                }
            };
            actions = {
                getCardKey: sinon.stub().returns('key'),
                getSanitizedStats: sinon.stub().resolves({
                    skills: {
                        skill1: {
                            successTimestamps: [],
                            failureTimestamps: [],
                            responseDelays: [],
                            intervalIndex: 0,
                        }
                    }
                }),
                getRetentionScore: sinon.stub().returns(0),
                saveCardStats: sinon.spy(),
            };
        });

        it('should handle "known" correctly', async () => {
            await markCardAsKnown(true, state, actions);
            const cardStats = await actions.getSanitizedStats.getCall(0).returnValue;
            const skillStats = cardStats.skills.skill1;

            expect(skillStats.successTimestamps.length).to.equal(1);
            expect(skillStats.failureTimestamps.length).to.equal(0);
            expect(skillStats.intervalIndex).to.equal(0); // Not due, so index doesn't change
            expect(actions.saveCardStats.calledOnce).to.be.true;
        });

        it('should increment intervalIndex if card was due', async () => {
            state.isCurrentCardDue = true;
            await markCardAsKnown(true, state, actions);
            const cardStats = await actions.getSanitizedStats.getCall(0).returnValue;
            const skillStats = cardStats.skills.skill1;
            expect(skillStats.intervalIndex).to.equal(1);
        });

        it('should handle "unknown" correctly', async () => {
            await markCardAsKnown(false, state, actions);
            const cardStats = await actions.getSanitizedStats.getCall(0).returnValue;
            const skillStats = cardStats.skills.skill1;

            expect(skillStats.successTimestamps.length).to.equal(0);
            expect(skillStats.failureTimestamps.length).to.equal(1);
            expect(skillStats.intervalIndex).to.equal(0);
            expect(actions.saveCardStats.calledOnce).to.be.true;
        });

        it('should record response delay', async () => {
            await markCardAsKnown(true, state, actions);
            const cardStats = await actions.getSanitizedStats.getCall(0).returnValue;
            const skillStats = cardStats.skills.skill1;
            expect(skillStats.responseDelays.length).to.equal(1);
            expect(skillStats.responseDelays[0]).to.be.a('number');
        });
    });
});