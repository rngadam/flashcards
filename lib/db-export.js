/* global initSqlJs */

/**
 * Creates an in-memory SQLite database from the application's data,
 * normalizes the data into a relational schema, and returns the database
 * as a Uint8Array.
 *
 * @param {Array<Object>} allCardStats - An array of card statistics objects.
 * @param {Array<Array<string>>} cardData - The raw card data.
 * @param {Function} getCardKey - A function to get the unique key for a card.
 * @param {Object} configs - The application's configuration object.
 * @param {string} currentConfigName - The name of the currently active configuration.
 * @returns {Promise<Uint8Array>} A promise that resolves with the SQLite database file as a Uint8Array.
 */
export async function createDatabase(allCardStats, cardData, getCardKey, configs, currentConfigName) {
    const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}` });
    const db = new SQL.Database();

    // --- Define Schema ---
    const createTablesSQL = `
        CREATE TABLE cards (
            card_id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_key TEXT UNIQUE NOT NULL
        );

        CREATE TABLE skills (
            skill_id TEXT PRIMARY KEY,
            skill_name TEXT NOT NULL,
            skill_order INTEGER
        );

        CREATE TABLE card_skill_stats (
            stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER,
            skill_id TEXT,
            view_count INTEGER,
            success_count INTEGER,
            failure_count INTEGER,
            last_viewed_timestamp INTEGER,
            FOREIGN KEY (card_id) REFERENCES cards(card_id),
            FOREIGN KEY (skill_id) REFERENCES skills(skill_id)
        );

        CREATE TABLE response_delays (
            delay_id INTEGER PRIMARY KEY AUTOINCREMENT,
            stat_id INTEGER,
            delay_ms INTEGER,
            FOREIGN KEY (stat_id) REFERENCES card_skill_stats(stat_id)
        );
    `;
    db.run(createTablesSQL);

    // --- Prepare Statements ---
    const insertCard = db.prepare('INSERT INTO cards (card_key) VALUES (:key)');
    const insertSkill = db.prepare('INSERT INTO skills (skill_id, skill_name, skill_order) VALUES (:id, :name, :order)');
    const insertStat = db.prepare('INSERT INTO card_skill_stats (card_id, skill_id, view_count, success_count, failure_count, last_viewed_timestamp) VALUES (:card_id, :skill_id, :views, :success, :fail, :last_viewed)');
    const insertDelay = db.prepare('INSERT INTO response_delays (stat_id, delay_ms) VALUES (:stat_id, :delay)');

    // --- Populate Skills ---
    const currentConfig = configs[currentConfigName] || {};
    const userSkills = currentConfig.skills || [];
    userSkills.forEach((skill, index) => {
        insertSkill.run({ ':id': skill.id, ':name': skill.name, ':order': index });
    });

    // --- Populate Cards and Stats ---
    db.exec('BEGIN TRANSACTION;');
    try {
        allCardStats.forEach((cardStats, index) => {
            const cardKey = getCardKey(cardData[index]);
            insertCard.run({ ':key': cardKey });
            const cardId = db.getRowsModified(); // Get the last inserted row ID

            for (const skillId in cardStats.skills) {
                const skill = cardStats.skills[skillId];
                if (userSkills.some(s => s.id === skillId)) { // Only insert stats for existing skills
                    insertStat.run({
                        ':card_id': cardId,
                        ':skill_id': skillId,
                        ':views': skill.viewCount,
                        ':success': skill.successTimestamps.length,
                        ':fail': skill.failureTimestamps.length,
                        ':last_viewed': skill.lastViewed
                    });
                    const statId = db.getRowsModified();

                    (skill.responseDelays || []).forEach(delay => {
                        insertDelay.run({ ':stat_id': statId, ':delay': delay });
                    });
                }
            }
        });
        db.exec('COMMIT;');
    } catch (e) {
        console.error("Error during DB transaction, rolling back:", e);
        db.exec('ROLLBACK;');
    } finally {
        // --- Clean up ---
        insertCard.free();
        insertSkill.free();
        insertStat.free();
        insertDelay.free();
    }


    // --- Export Database ---
    const data = db.export();
    db.close();
    return data;
}