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
app.use(express.static(path.join(__dirname, '/')));

// --- Session Management ---

// Enforce session secret in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('FATAL: SESSION_SECRET environment variable is not set in production.');
}

app.use(session({
    store: new SQLiteStore({
        db: 'session.db',
        dir: './',
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET,
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
// Get current user
app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.json({ user: null });
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
