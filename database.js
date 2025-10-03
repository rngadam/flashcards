import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Use an environment variable for the database path, with a fallback for development.
const DB_PATH = process.env.DB_PATH || './database.db';

const db = await open({
  filename: DB_PATH,
  driver: sqlite3.Database
});

// Enable foreign key support
await db.exec('PRAGMA foreign_keys = ON;');

// Create the users table for canonical user profiles.
// The email is the unique identifier for a user across different providers.
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    displayName TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create the identities table to store provider-specific login information.
// This table links multiple OAuth identities to a single user in the users table.
await db.exec(`
  CREATE TABLE IF NOT EXISTS identities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    photos TEXT, -- Storing photos as a JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

console.log('Database initialized with users and identities tables.');

export default db;