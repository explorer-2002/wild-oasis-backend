// improved oauth

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from './models/Users.js';

dotenv.config();

const app = express();

// ============================================
// 1. IMPROVED SESSION STORAGE (MongoDB/Redis)
// ============================================
app.use(session({
    secret: process.env.SESSION_SECRET, // Strong random secret from env
    resave: false,
    saveUninitialized: false, // Don't create session until something stored
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_DB_URI,
        touchAfter: 24 * 3600, // Lazy session update (once per 24hrs)
        crypto: {
            secret: process.env.SESSION_STORE_SECRET
        }
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS in prod
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// ============================================
// 2. IMPROVED SERIALIZATION (Store only ID)
// ============================================
passport.serializeUser((user, done) => {
    // Only store MongoDB _id in session
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        // Fetch fresh user data from DB on each request
        const user = await User.findById(id).select('-__v').lean();
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// ============================================
// 3. IMPROVED GOOGLE STRATEGY
// ============================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_URL}/auth/google/callback`,
    passReqToCallback: true
},
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            // Find or create user
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                // Create new user
                user = await User.create({
                    googleId: profile.id,
                    userName: profile.displayName,
                    userEmail: profile.emails[0].value,
                    avatar: profile.photos[0]?.value,
                    role: 'user',
                    // Store tokens for API calls (encrypted in production)
                    oauth: {
                        provider: 'google',
                        accessToken,
                        refreshToken,
                        tokenExpiry: Date.now() + 3600000 // 1 hour
                    }
                });
            } else {
                // Update existing user's tokens and profile
                user.oauth = {
                    provider: 'google',
                    accessToken,
                    refreshToken,
                    tokenExpiry: Date.now() + 3600000
                };
                user.avatar = profile.photos[0]?.value;
                user.userName = profile.displayName;
                await user.save();
            }

            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));

// ============================================
// 4. IMPROVED AUTH ROUTES
// ============================================

// Start OAuth flow
app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account' // Always show account selector
    })
);

// OAuth callback
app.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`,
        failureMessage: true
    }),
    (req, res) => {
        // Success - redirect to frontend
        res.redirect(`${process.env.CLIENT_URL}/dashboard`);
    }
);

// Auth status check - CACHED & OPTIMIZED
app.get('/auth/status', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.json({ authenticated: false });
    }

    // req.user already fetched by deserializeUser
    return res.json({
        authenticated: true,
        user: {
            id: req.user._id,
            userName: req.user.userName,
            userEmail: req.user.userEmail,
            role: req.user.role,
            avatar: req.user.avatar,
            mobileNumber: req.user.mobileNumber || ''
        }
    });
});

// Logout with proper cleanup
app.post('/auth/logout', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(400).json({ message: 'Not logged in' });
    }

    const sessionId = req.sessionID;

    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed', error: err.message });
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction failed:', err);
            }

            res.clearCookie('connect.sid', {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
            });

            res.json({ message: 'Logged out successfully' });
        });
    });
});

// ============================================
// 5. MIDDLEWARE FOR PROTECTED ROUTES
// ============================================

export const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            message: 'Authentication required',
            code: 'UNAUTHORIZED'
        });
    }
    next();
};

export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Insufficient permissions',
                required: roles,
                current: req.user.role
            });
        }

        next();
    };
};

// Usage example:
// app.use('/api/bookings', requireAuth, bookingRoutes);
// app.use('/api/admin', requireRole('admin', 'superadmin'), adminRoutes);

// ============================================
// 6. TOKEN REFRESH UTILITY (for API calls)
// ============================================

export const refreshGoogleToken = async (userId) => {
    const user = await User.findById(userId);

    if (!user?.oauth?.refreshToken) {
        throw new Error('No refresh token available');
    }

    // Check if token expired
    if (user.oauth.tokenExpiry > Date.now()) {
        return user.oauth.accessToken; // Still valid
    }

    // Refresh the token
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: user.oauth.refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error('Token refresh failed');
    }

    // Update user with new token
    user.oauth.accessToken = data.access_token;
    user.oauth.tokenExpiry = Date.now() + data.expires_in * 1000;
    await user.save();

    return data.access_token;
};

// ============================================
// 7. HEALTH CHECK & SESSION STATS
// ============================================

app.get('/auth/health', async (req, res) => {
    try {
        // Check MongoDB connection
        const dbState = mongoose.connection.readyState;

        res.json({
            status: 'ok',
            database: dbState === 1 ? 'connected' : 'disconnected',
            session: {
                authenticated: req.isAuthenticated(),
                store: 'mongodb'
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

export default app;

// Improved User model

import mongoose from 'mongoose';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
    // Google OAuth ID (primary identifier)
    googleId: {
        type: String,
        unique: true,
        sparse: true, // Allows null for non-Google users
        index: true
    },

    // User information
    userName: {
        type: String,
        required: true,
        trim: true
    },

    userEmail: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },

    mobileNumber: {
        type: String,
        trim: true
    },

    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },

    avatar: {
        type: String
    },

    // OAuth tokens (ENCRYPTED in production)
    oauth: {
        provider: {
            type: String,
            enum: ['google', 'facebook', 'local']
        },
        accessToken: String, // Should be encrypted
        refreshToken: String, // Should be encrypted
        tokenExpiry: Date
    },

    // Account metadata
    isActive: {
        type: Boolean,
        default: true
    },

    lastLogin: {
        type: Date,
        default: Date.now
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
userSchema.index({ googleId: 1 });
userSchema.index({ userEmail: 1 });
userSchema.index({ createdAt: -1 });

// Update lastLogin on authentication
userSchema.methods.updateLastLogin = function() {
    this.lastLogin = new Date();
    return this.save();
};

// Encrypt sensitive fields before saving (PRODUCTION)
userSchema.pre('save', function(next) {
    if (process.env.NODE_ENV === 'production' && this.oauth?.accessToken) {
        // Encrypt tokens (example - use proper encryption library)
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
        const iv = crypto.randomBytes(16);

        if (this.isModified('oauth.accessToken')) {
            const cipher = crypto.createCipheriv(algorithm, key, iv);
            let encrypted = cipher.update(this.oauth.accessToken, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            this.oauth.accessToken = `${iv.toString('hex')}:${encrypted}`;
        }
    }
    next();
});

// Remove sensitive data from JSON output
// userSchema.methods.toJSON = function() {
//     const obj = this.toObject();
//     delete obj.oauth;
//     delete obj.__v;
//     return obj;
// };

// export const User = mongoose.model('User', userSchema);

// use redis

// import RedisStore from 'connect-redis';
// import { createClient } from 'redis';

// const redisClient = createClient({
//     url: process.env.REDIS_URL,
//     password: process.env.REDIS_PASSWORD
// });

// await redisClient.connect();

// app.use(session({
//     store: new RedisStore({ client: redisClient }),
    
// }));

// add rate limiting

import RedisStore from 'connect-redis';
import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD
});

await redisClient.connect();

app.use(session({
    store: new RedisStore({ client: redisClient }),
    // ... other config
}));

// add rate limiting

import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per IP
    message: 'Too many login attempts'
});

app.use('/auth/google', authLimiter);

// implement CSRF protection

import csrf from 'csurf';

const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// Send CSRF token to frontend
app.get('/auth/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Required package updates

// npm install connect-mongo      # MongoDB session store
// npm install connect-redis redis # Redis session store (recommended)
// npm install express-rate-limit  # Rate limiting
// npm install helmet             # Security headers
// npm install winston            # Logging