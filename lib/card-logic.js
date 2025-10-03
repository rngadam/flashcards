function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function getCardKey(card, state) {
    const { configs, dom } = state;
    const currentConfigName = dom.configSelector.value;
    const currentConfig = configs[currentConfigName];
    if (!currentConfig) {
        console.error('getCardKey failed: No configuration selected.');
        return null;
    }
    const roleToColumnMap = currentConfig.roleToColumnMap;
    if (!roleToColumnMap) {
        console.error('getCardKey failed: roleToColumnMap is missing in the current configuration.');
        return null;
    }
    const keyIndices = roleToColumnMap['TARGET_LANGUAGE'] || [];

    if (keyIndices.length !== 1) {
        return null;
    }
    const keyIndex = keyIndices[0];

    if (!card || !Array.isArray(card) || keyIndex >= card.length || !card[keyIndex] || typeof card[keyIndex] !== 'string' || card[keyIndex].trim() === '') {
        console.warn('getCardKey failed: Invalid card data or key is empty/not a string.', { card, keyIndex });
        return null;
    }
    return card[keyIndex].trim();
}

export async function markCardAsKnown(known, state, actions) {
    const { cardData, currentCardIndex, currentSkillId, cardShownTimestamp, repetitionIntervals } = state;
    const { getCardKey, getSanitizedStats, getRetentionScore, saveCardStats } = actions;
    const cardKey = getCardKey(cardData[currentCardIndex]);
    const cardStats = await getSanitizedStats(cardKey);
    const skillStats = cardStats.skills[currentSkillId];

    if (!skillStats) {
        console.error(`Could not find stats for skill ${currentSkillId} on card ${cardKey}.`);
        return;
    }

    if (cardShownTimestamp) {
        const delay = Date.now() - cardShownTimestamp;
        skillStats.responseDelays = skillStats.responseDelays || [];
        skillStats.responseDelays.push(delay);
    }

    if (known) {
        const currentScore = getRetentionScore(skillStats);
        skillStats.successTimestamps.push(Date.now());

        if (currentScore < 0) {
            const successes = skillStats.successTimestamps.length;
            const failures = skillStats.failureTimestamps.length;
            const failuresToRemove = failures - successes;
            if (failuresToRemove > 0) {
                skillStats.failureTimestamps.splice(0, failuresToRemove);
            }
        }

        if (state.isCurrentCardDue && skillStats.intervalIndex < repetitionIntervals.length - 1) {
            skillStats.intervalIndex++;
        }
    } else {
        skillStats.failureTimestamps.push(Date.now());
        skillStats.intervalIndex = 0;
    }
    await saveCardStats(cardKey, cardStats);
}

export function findNextCardFromList(items, { forceNew = false, now = Date.now(), allCardStats = [], userSkills = [], isFiltered = false, repetitionIntervals, getRetentionScore, getTimeToDue, currentCardIndex, currentSkillId } = {}) {
    if (items.length === 0) return null;

    const dueItems = items.filter(item => {
        if (!item.skillStats.lastViewed) return false;
        const intervalSeconds = repetitionIntervals[item.skillStats.intervalIndex];
        return intervalSeconds !== undefined && (now - item.skillStats.lastViewed > intervalSeconds * 1000);
    });

    if (dueItems.length > 0) {
        shuffleArray(dueItems);
        dueItems.sort((a, b) => getRetentionScore(a.skillStats) - getRetentionScore(b.skillStats));
        let nextItem = dueItems[0];
        if (forceNew && nextItem.cardIndex === currentCardIndex && nextItem.skillId === currentSkillId && dueItems.length > 1) {
            nextItem = dueItems[1];
        }
        const reason = { type: 'due_review', expiredInterval: repetitionIntervals[nextItem.skillStats.intervalIndex], nextInterval: repetitionIntervals[nextItem.skillStats.intervalIndex + 1] || 0, isFiltered };
        return { nextItem, reason };
    }

    const unseenItems = items.filter(item => item.skillStats.viewCount === 0);
    if (unseenItems.length > 0) {
        const skillOrderMap = new Map(userSkills.map((skill, index) => [skill.id, index]));
        const bridgingItems = [];
        const trulyNewItems = [];

        unseenItems.forEach(item => {
            const cardStats = allCardStats[item.cardIndex];
            const currentSkillOrder = skillOrderMap.get(item.skillId);
            let seenInPreviousSkill = false;
            if (currentSkillOrder > 0) {
                for (const [skillId, stats] of Object.entries(cardStats.skills)) {
                    const skillIdx = skillOrderMap.get(skillId);
                    if (skillIdx !== undefined && skillIdx < currentSkillOrder && stats.viewCount > 0) {
                        seenInPreviousSkill = true;
                        break;
                    }
                }
            }
            if (seenInPreviousSkill) {
                bridgingItems.push(item);
            } else {
                trulyNewItems.push(item);
            }
        });

        if (bridgingItems.length > 0) {
            bridgingItems.sort((a, b) => {
                const orderA = skillOrderMap.get(a.skillId);
                const orderB = skillOrderMap.get(b.skillId);
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                const cardStatsA = allCardStats[a.cardIndex];
                const cardStatsB = allCardStats[b.cardIndex];
                const totalScoreA = Object.values(cardStatsA.skills).reduce((sum, s) => sum + getRetentionScore(s), 0);
                const totalScoreB = Object.values(cardStatsB.skills).reduce((sum, s) => sum + getRetentionScore(s), 0);
                return totalScoreA - totalScoreB;
            });
            const nextItem = bridgingItems[0];
            return { nextItem, reason: { type: 'bridging_card', isFiltered } };
        }
        if (trulyNewItems.length > 0) {
            const nextItem = trulyNewItems[Math.floor(Math.random() * trulyNewItems.length)];
            return { nextItem, reason: { type: 'new_card', isFiltered } };
        }
    }

    let reasonForDisplay;
    const allSkillsLearned = items.every(item => getRetentionScore(item.skillStats) > 0);
    if (allSkillsLearned) {
        let minTimeToDue = Infinity, maxTimeToDue = 0;
        items.forEach(item => {
            const timeToDue = getTimeToDue(item.skillStats, repetitionIntervals, now).ms;
            if (timeToDue > 0 && timeToDue < minTimeToDue) minTimeToDue = timeToDue;
            if (timeToDue > maxTimeToDue) maxTimeToDue = timeToDue;
        });
        reasonForDisplay = { type: 'deck_learned', timeToNextReview: minTimeToDue, timeToLastReview: maxTimeToDue, isFiltered };
    } else {
        reasonForDisplay = { type: 'least_learned', isFiltered };
    }

    let candidateItems = [...items];
    if (forceNew && candidateItems.length > 1) {
        candidateItems = candidateItems.filter(item => item.cardIndex !== currentCardIndex || item.skillId !== currentSkillId);
    }
    if (candidateItems.length === 0) candidateItems = [...items];

    shuffleArray(candidateItems);
    candidateItems.sort((a, b) => {
        const scoreA = getRetentionScore(a.skillStats);
        const scoreB = getRetentionScore(b.skillStats);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (a.skillStats.lastViewed || 0) - (b.skillStats.lastViewed || 0);
    });

    const nextItem = candidateItems[0];
    return { nextItem, reason: reasonForDisplay };
}

export async function showNextCard({ forceNew = false, now = Date.now() } = {}, state, actions) {
    const { cardData, configs, activeFilterWords, filterAllowOverflowCheckbox, dom } = state;
    const { getActiveSkills, getAllCardStats, createDefaultSkillStats, showTopNotification, displayCard, findNextCardFromList, updateFilterState } = actions;
    if (cardData.length === 0) return;

    const currentConfigName = dom.configSelector.value;
    const currentConfig = configs[currentConfigName];
    const activeSkills = getActiveSkills();
    const userSkills = currentConfig ? currentConfig.skills : [];

    if (activeSkills.length === 0) {
        showTopNotification('No active skills. Please select skills to practice in Settings.', 'error');
        return;
    }

    const allCardStats = await getAllCardStats();

    let allReviewableItems = [];
    allCardStats.forEach((cardStats, cardIndex) => {
        activeSkills.forEach(skillId => {
            allReviewableItems.push({
                cardIndex,
                skillId,
                skillStats: cardStats.skills[skillId] || createDefaultSkillStats()
            });
        });
    });

    if (allReviewableItems.length === 0) {
        showTopNotification('No cards to display.', 'error');
        return;
    }

    let itemsToSelectFrom = allReviewableItems;
    let isFiltered = currentConfig.filterIsEnabled && activeFilterWords.size > 0;
    let filteredItems = [];

    if (isFiltered) {
        const roleToColumnMap = (configs[currentConfigName] || {}).roleToColumnMap || {};
        const keyIndices = roleToColumnMap['TARGET_LANGUAGE'] || [];
        if (keyIndices.length === 1) {
            const keyIndex = keyIndices[0];
            filteredItems = allReviewableItems.filter(item => {
                const cardText = cardData[item.cardIndex][keyIndex]?.toLowerCase();
                if (!cardText) return false;
                const cardWords = cardText.match(/[\p{L}\p{N}]+/gu) || [];
                return cardWords.some(word => activeFilterWords.has(word));
            });

            if (filteredItems.length > 0) {
                itemsToSelectFrom = filteredItems;
            } else {
                showTopNotification('No matching cards for the current filter.', 'error');
                return;
            }
        }
    }

    const findNextCardOptions = { forceNew, now, allCardStats, userSkills, isFiltered, ...state, ...actions };
    let result = findNextCardFromList(itemsToSelectFrom, findNextCardOptions);

    const filteredDeckIsLearned = isFiltered && result && result.reason.type === 'deck_learned';

    if (isFiltered) {
        updateFilterState(filteredDeckIsLearned ? 'learned' : 'learning');
    } else {
        updateFilterState('off');
    }

    if (filteredDeckIsLearned && filterAllowOverflowCheckbox.checked) {
        const overflowResult = findNextCardFromList(allReviewableItems, { ...findNextCardOptions, isFiltered: false });
        if (overflowResult) {
            result = overflowResult;
        }
    } else if (!result && isFiltered && filterAllowOverflowCheckbox.checked) {
        const overflowResult = findNextCardFromList(allReviewableItems, { ...findNextCardOptions, isFiltered: false });
        if (overflowResult) {
            result = overflowResult;
        }
    }

    if (result) {
        const { nextItem, reason } = result;
        state.currentCardIndex = nextItem.cardIndex;
        state.currentSkillId = nextItem.skillId;
        await displayCard(state.currentCardIndex, { reason }, state, actions);
    } else {
        const message = isFiltered ? 'You have learned all cards in the filtered set!' : 'You have learned all cards in the deck!';
        showTopNotification(message, 'success');
    }
}

export async function showPrevCard(state, actions) {
    const { viewHistory } = state;
    const { displayCard } = actions;
    if (viewHistory.length > 0) {
        const prevState = viewHistory.pop();
        state.currentSkillId = prevState.skillId; // Restore the skill for that card
        await displayCard(prevState.cardIndex, { isNavigatingBack: true }, state, actions);
    }
}