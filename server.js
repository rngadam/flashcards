import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';
import connectSqlite3 from 'connect-sqlite3';

const SQLiteStore = connectSqlite3(session);
const app = express();
const PORT = process.env.PORT || 3000;

// --- Basic Express Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.enable("trust proxy");
app.use(express.json({ limit: '1mb' })); // Middleware to parse JSON bodies, with a reasonable limit
app.use(express.static(path.join(__dirname, '/')));

// --- Session Management ---

// Enforce session secret in production, provide a default for development
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret';
if (process.env.NODE_ENV === 'production' && sessionSecret === 'dev-secret') {
    throw new Error('FATAL: SESSION_SECRET environment variable must be set in production.');
}

app.use(session({
    store: new SQLiteStore({
        db: 'session.db',
        dir: './',
        table: 'sessions'
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
}));

// --- Passport.js Initialization ---
app.use(passport.initialize());
app.use(passport.session());

// --- User Serialization/Deserialization ---
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        // Fetch the canonical user from the users table
        const user = await db.get('SELECT * FROM users WHERE id = ?', id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// --- Generic OAuth Strategy Handler ---
const findOrCreateUser = async (profile, done) => {
    try {
        const { provider, id: provider_id, displayName, emails, photos } = profile;
        const email = emails?.[0]?.value;
        const photoUrl = photos?.[0]?.value;

        // An email is required to link accounts.
        if (!email) {
            return done(new Error('Email not provided by OAuth provider. Cannot link account.'), null);
        }

        // 1. Find an existing identity
        const identity = await db.get('SELECT * FROM identities WHERE provider = ? AND provider_id = ?', [provider, provider_id]);
        if (identity) {
            const user = await db.get('SELECT * FROM users WHERE id = ?', [identity.user_id]);
            return done(null, user);
        }

        // 2. No identity found, find or create user by email
        let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            // 3. If no user with this email, create one
            const result = await db.run(
                'INSERT INTO users (email, displayName) VALUES (?, ?)',
                [email, displayName]
            );
            user = await db.get('SELECT * FROM users WHERE id = ?', result.lastID);
        }

        // 4. Create and link the new identity to the user (either found or newly created)
        await db.run(
            'INSERT INTO identities (user_id, provider, provider_id, photos) VALUES (?, ?, ?, ?)',
            [user.id, provider, provider_id, photoUrl ? JSON.stringify(photos) : null]
        );

        return done(null, user);

    } catch (err) {
        return done(err);
    }
};


// --- Passport.js Strategies ---

// Defang provides the DEFANG_HOST environment variable with the public hostname of the service.
const callbackBaseUrl = process.env.DEFANG_HOST ? `https://${process.env.DEFANG_HOST}` : '';

// GitHub
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${callbackBaseUrl}/auth/github/callback`
    }, (accessToken, refreshToken, profile, done) => findOrCreateUser(profile, done)));
}

// Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${callbackBaseUrl}/auth/google/callback`
    }, (accessToken, refreshToken, profile, done) => findOrCreateUser(profile, done)));
}

// LinkedIn
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    passport.use(new LinkedInStrategy({
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: `${callbackBaseUrl}/auth/linkedin/callback`,
        scope: ['r_emailaddress', 'r_liteprofile'],
        state: true
    }, (accessToken, refreshToken, profile, done) => findOrCreateUser(profile, done)));
}


// --- Authentication Routes ---
// GitHub
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);

// Google
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);

// LinkedIn
app.get('/auth/linkedin', passport.authenticate('linkedin')); // 'state' is now handled by the strategy
app.get('/auth/linkedin/callback',
    passport.authenticate('linkedin', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);


// --- API Routes ---

// API endpoint to get the list of configured OAuth providers
app.get('/api/auth/providers', (req, res) => {
    const providers = [];
    if (process.env.GITHUB_CLIENT_ID) providers.push('github');
    if (process.env.GOOGLE_CLIENT_ID) providers.push('google');
    if (process.env.LINKEDIN_CLIENT_ID) providers.push('linkedin');
    res.json(providers);
});

// Middleware to ensure a user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'User not authenticated' });
};

// Get current user
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.json({ user: null });
    }
});

// GET endpoint to retrieve all user data (configs and stats)
app.get('/api/sync', ensureAuthenticated, async (req, res) => {
    try {
        const data = await db.all('SELECT type, key, value FROM user_data WHERE user_id = ?', [req.user.id]);
        const result = {
            configs: {},
            cardStats: {}
        };
        data.forEach(row => {
            if (row.type === 'configs') {
                result.configs[row.key] = JSON.parse(row.value);
            } else if (row.type === 'cardStat') {
                result.cardStats[row.key] = JSON.parse(row.value);
            }
        });
        res.json(result);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});

// POST endpoint to bulk save user data
app.post('/api/sync', ensureAuthenticated, async (req, res) => {
    const { configs, cardStats } = req.body;

    if (!configs && !cardStats) {
        return res.status(400).json({ error: 'No data provided to sync' });
    }

    const userId = req.user.id;

    try {
        await db.run('BEGIN TRANSACTION');

        const upsert = async (type, key, value) => {
            const valueJson = JSON.stringify(value);
            await db.run(`
                INSERT INTO user_data (user_id, type, key, value, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, type, key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, type, key, valueJson]);
        };

        if (configs) {
            for (const key in configs) {
                await upsert('configs', key, configs[key]);
            }
        }

        if (cardStats) {
            for (const key in cardStats) {
                await upsert('cardStat', key, cardStats[key]);
            }
        }

        await db.run('COMMIT');
        res.status(200).json({ message: 'Data saved successfully' });
    } catch (error) {
        await db.run('ROLLBACK');
        console.error('Error saving user data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// --- Logging ingestion endpoint ---
// Accepts basic JSON logs from the client for debugging/diagnostics.
// Body shape: { category?: string, event?: string, payload?: any }
app.post('/api/logs', (req, res) => {
    try {
        const { category, event, payload } = req.body || {};
        // Basic size/shape checks to avoid huge payloads hitting the console
        if (!category && !event && !payload) {
            return res.status(400).json({ error: 'Empty log payload' });
        }

        // Print a concise, structured log to the server console for now.
        console.log('[CLIENT-LOG]', category || 'unknown', event || '-', JSON.stringify(payload));

        // Respond quickly. In future we can persist or forward to telemetry.
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Error receiving client log:', err);
        res.status(500).json({ error: 'Failed to receive log' });
    }
});

// Logout
app.post('/api/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ message: 'Logged out successfully' });
        });
    });
});

// --- Serve Frontend ---
// All other GET requests not handled before will return the app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '/', 'index.html'));
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
