import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import bookingRoutes from './routes/bookingRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import userRoutes from './routes/userRoutes.js';

import dotenv from 'dotenv';
import { upload } from './upload.js';
import fs from 'fs';
import path from 'path';
import { Image } from './models/ImageModel.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import passport from 'passport';
import session from 'express-session';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from './models/Users.js';
import rateLimit from 'express-rate-limit';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import csrf from 'csurf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const csrfProtection = csrf({ cookie: true });

app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS.split(','), // Your frontend URL
    credentials: true // Allow credentials (cookies, authorization headers, etc.)
}));

app.use(session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_DB_URI,
        touchAfter: 24 * 3600, // Lazy session update (once per 24hrs)
        crypto: {
            secret: process.env.SESSION_STORE_SECRET
        }
    }),
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax' // Important for cross-origin
    }
}));

app.use(csrfProtection);
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_URL}/auth/google/callback`
},
    (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts'
});

app.use('/auth/google', authLimiter);
app.get('/auth/google', passport.authenticate('google', { scope: ["profile", "email"], prompt: 'select_account'}));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), async (req, res) => {
    console.log(req.user);

    try {
        const existingUser = await User.findOne({ userEmail: req.user.emails[0].value });

        if (!existingUser) {
            await User.create({
                id: req.user.id,
                userName: req.user.displayName,
                userEmail: req.user.emails[0].value,
                role: 'user',
                avatar: req.user.photos[0].value,
            });
        }

        res.redirect('http://localhost:5173')
    }

    catch (err) {
        res.redirect('http://localhost:5173/login');
    }
});

app.get('/auth/status', async (req, res) => {
    console.log("Auth status check: ", req.user);

    const user = await User.findOne({ id: req.user.id });

    if (req.isAuthenticated()) {
        return res.json({
            authenticated: true,
            user: {
                id: user?.id ? user.id : req.user.id,
                displayName: user?.userName ? user?.userName : req.user.displayName,
                role: user?.role ? user.role : 'user',
                email: user?.userEmail ? user.userEmail : req.user.emails[0].value,
                phone: user?.mobileNumber ? user.mobileNumber : '',
                avatar: user?.avatar ? user.avatar : req.user.photos[0].value
                // Add any other user fields you want to expose
            }
        });
    } else {
        return res.json({
            authenticated: false
        });
    }
});

app.get('/auth/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.get('/auth/logout', (req, res) => {
    // req.logout(() => {
    //     res.redirect('/');
    // });

    return req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Session destruction failed' });
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            res.redirect('http://localhost:5173/login');
        });
    });
});

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

app.use('/api', bookingRoutes);
app.use('/api', roomRoutes);
app.use('/api', userRoutes);

app.post('/upload', upload.single('image'), async (req, res, next) => {
    try {
        let obj = {
            name: req.body.name,
            desc: req.body.desc,
            img: {
                data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
                contentType: 'image/png'
            }
        }

        console.log("Image uploaded");

        const image = new Image(obj);
        await image.save()

        res.json({
            message: "success",
            data: obj
        });
    }

    catch (error) {
        res.json({ error: error });
    }
});

app.get('/image/:id/download', async (req, res, next) => {
    try {
        const image = await Image.findById(req.params.id);

        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        // Determine file extension
        const extension = image.img.contentType.split('/')[1];
        const filename = `${image.name}.${extension}`;

        // Set headers to trigger download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', image.img.contentType);
        res.setHeader('Content-Length', image.img.data.length);

        // Send the buffer
        res.send(image.img.data);

    } catch (err) {
        next(err);
    }
});

app.use((req, res, next) => {
    next(new AppError("Route not found", 404));
});

app.use(errorHandler);

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_DB_URI);

        console.log("Mongo db connected");
    }

    catch (err) {
        console.error("Connection error: ", err);
        process.exit(1);
    }
}

const PORT = process.env.PORT || 3000;

connectDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on Port ${PORT}`);
    })
})

