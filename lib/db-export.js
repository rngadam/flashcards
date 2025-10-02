/* global initSqlJs */

// Function to create and export the SQLite database
export async function createDatabase(allCardStats, cardData, getCardKey, configs, currentConfigName) {
    // Load the sql.js library
    const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
    });

    // Create a new database
    const db = new SQL.Database();

    // Define the schema
    const schema = `
        CREATE TABLE cards (
            card_id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_key TEXT UNIQUE NOT NULL
        );

        CREATE TABLE skills (
            skill_id TEXT PRIMARY KEY,
            skill_name TEXT NOT NULL,
            skill_order INTEGER
        );

        CREATE TABLE stats (
            stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL,
            skill_id TEXT NOT NULL,
            view_count INTEGER DEFAULT 0,
            last_viewed INTEGER,
            interval_index INTEGER DEFAULT 0,
            FOREIGN KEY (card_id) REFERENCES cards(card_id),
            FOREIGN KEY (skill_id) REFERENCES skills(skill_id)
        );

        CREATE TABLE timestamps (
            timestamp_id INTEGER PRIMARY KEY AUTOINCREMENT,
            stat_id INTEGER NOT NULL,
            timestamp_type TEXT NOT NULL, -- 'success' or 'failure'
            timestamp_value INTEGER NOT NULL,
            FOREIGN KEY (stat_id) REFERENCES stats(stat_id)
        );

        CREATE TABLE response_delays (
            delay_id INTEGER PRIMARY KEY AUTOINCREMENT,
            stat_id INTEGER NOT NULL,
            delay_ms INTEGER NOT NULL,
            FOREIGN KEY (stat_id) REFERENCES stats(stat_id)
        );

        CREATE TABLE configs (
            config_key TEXT PRIMARY KEY,
            config_value TEXT
        );
    `;

    db.exec(schema);

    // --- Insert Data using Transactions and Prepared Statements for efficiency and safety ---
    db.exec('BEGIN TRANSACTION;');

    try {
        // Insert Cards
        const cardStmt = db.prepare('INSERT INTO cards (card_key) VALUES (:key);');
        const cardIdMap = new Map();
        cardData.forEach(card => {
            const key = getCardKey(card);
            cardStmt.bind({ ':key': key });
            cardStmt.step();
            cardStmt.reset();
            const cardId = db.exec("SELECT last_insert_rowid();")[0].values[0][0];
            cardIdMap.set(key, cardId);
        });
        cardStmt.free();

        // Insert Skills
        const currentConfig = configs[currentConfigName];
        const skillStmt = db.prepare('INSERT INTO skills (skill_id, skill_name, skill_order) VALUES (:id, :name, :order);');
        if (currentConfig && currentConfig.skills) {
            currentConfig.skills.forEach((skill, index) => {
                skillStmt.run({
                    ':id': skill.id,
                    ':name': skill.name,
                    ':order': index
                });
            });
        }
        skillStmt.free();

        // Insert Stats, Timestamps, and Delays
        const statStmt = db.prepare('INSERT INTO stats (card_id, skill_id, view_count, last_viewed, interval_index) VALUES (?, ?, ?, ?, ?);');
        const tsStmt = db.prepare('INSERT INTO timestamps (stat_id, timestamp_type, timestamp_value) VALUES (?, ?, ?);');
        const delayStmt = db.prepare('INSERT INTO response_delays (stat_id, delay_ms) VALUES (?, ?);');

        allCardStats.forEach((cardStats, index) => {
            const cardKey = getCardKey(cardData[index]);
            const cardId = cardIdMap.get(cardKey);
            if (!cardId) return;

            for (const skillId in cardStats.skills) {
                const skill = cardStats.skills[skillId];
                statStmt.run([cardId, skillId, skill.viewCount, skill.lastViewed, skill.intervalIndex]);
                const statId = db.exec("SELECT last_insert_rowid();")[0].values[0][0];

                skill.successTimestamps.forEach(ts => tsStmt.run([statId, 'success', ts]));
                skill.failureTimestamps.forEach(ts => tsStmt.run([statId, 'failure', ts]));
                (skill.responseDelays || []).forEach(delay => delayStmt.run([statId, delay]));
            }
        });
        statStmt.free();
        tsStmt.free();
        delayStmt.free();

        // Insert Configs
        const configStmt = db.prepare('INSERT INTO configs (config_key, config_value) VALUES (?, ?);');
        for (const key in configs) {
             configStmt.run([key, JSON.stringify(configs[key])]);
        }
        configStmt.free();

        db.exec('COMMIT;');
    } catch (e) {
        console.error("Error during database transaction:", e);
        db.exec('ROLLBACK;');
        throw e; // re-throw the error after rolling back
    }

    // Export the database to a Uint8Array
    return db.export();
}