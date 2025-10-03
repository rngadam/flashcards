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

app.use(express.static(path.join(__dirname, '/')));

// --- Session Management ---
app.use(session({
    store: new SQLiteStore({
        db: 'session.db',
        dir: './',
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'a-secure-secret-for-development',
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
// This determines what user information is stored in the session.
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
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

        let user = await db.get('SELECT * FROM users WHERE provider = ? AND provider_id = ?', [provider, provider_id]);

        if (user) {
            return done(null, user);
        } else {
            const result = await db.run(
                'INSERT INTO users (provider, provider_id, displayName, email, photos) VALUES (?, ?, ?, ?, ?)',
                [provider, provider_id, displayName, email, photoUrl ? JSON.stringify(photos) : null]
            );
            user = await db.get('SELECT * FROM users WHERE id = ?', result.lastID);
            return done(null, user);
        }
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
    }, findOrCreateUser));
}

// Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${callbackBaseUrl}/auth/google/callback`
    }, findOrCreateUser));
}

// LinkedIn
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    passport.use(new LinkedInStrategy({
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: `${callbackBaseUrl}/auth/linkedin/callback`,
        scope: ['r_emailaddress', 'r_liteprofile'],
    }, findOrCreateUser));
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
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME_STATE' }));
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
// All other GET requests not handled before will return the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '/', 'index.html'));
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});