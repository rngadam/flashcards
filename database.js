import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// This is a top-level await, which is allowed in ES modules.
const db = await open({
  filename: './database.db',
  driver: sqlite3.Database
});

// Create the users table if it doesn't exist.
// This is the central table for storing user information from all OAuth providers.
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    displayName TEXT,
    email TEXT,
    photos TEXT, -- Storing photos as a JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id)
  )
`);

console.log('Database initialized and users table is ready.');

export default db;