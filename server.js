require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

// Application-level locks to prevent concurrent signups
const signupLocks = new Map();

// Cleanup function for stuck locks (safety mechanism)
setInterval(() => {
    const now = Date.now();
    for (const [email, lockData] of signupLocks.entries()) {
        if (typeof lockData === 'object' && now - lockData.timestamp > 30000) { // 30 seconds
            console.log('WARNING: Cleaning up stuck signup lock for:', email);
            signupLocks.delete(email);
        }
    }
}, 10000); // Check every 10 seconds

const app = express();
const PORT = process.env.PORT || 3004;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Temporarily disable Redis to use MemoryStore for session stability
// Redis session store for production
let RedisStore, redisClient;
const DISABLE_REDIS = true; // Temporarily force MemoryStore

if (NODE_ENV === 'production' && !DISABLE_REDIS) {
    try {
        RedisStore = require('connect-redis').default;
        const { createClient } = require('redis');
        
        // Railway provides REDIS_URL environment variable
        redisClient = createClient({
            url: process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL
        });
        
        redisClient.connect().catch((err) => {
            console.error('Redis connection failed:', err);
        });
        
        redisClient.on('connect', () => {
            console.log('Redis client connected for session storage');
        });
        
        redisClient.on('error', (err) => {
            console.error('Redis client error:', err);
        });
        
        redisClient.on('disconnect', () => {
            console.warn('Redis client disconnected');
        });
    } catch (error) {
        console.warn('Redis not available, falling back to MemoryStore:', error.message);
    }
} else {
    console.log('Redis disabled for debugging, using MemoryStore');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'fishing-log-secret-key-' + uuidv4();

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
const sessionConfig = {
    secret: SESSION_SECRET,
    name: 'connect.sid', // Explicit session cookie name
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Temporarily disable secure to test cookie issues
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // Use lax for compatibility
        httpOnly: true, // Security: prevent XSS
        path: '/' // Explicit path
    }
};

// Always use MemoryStore for now (Redis is disabled)
console.log('Using MemoryStore for sessions (Redis temporarily disabled)');

app.use(session(sessionConfig));

app.use('/uploads', express.static('uploads'));
app.use(express.static('.'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Safe database migration logic for volume implementation
const isProduction = process.env.NODE_ENV === 'production';
const oldDbPath = 'fishing_log.db';                        // Current location

// Migration function to safely move database to volume
function migrateToVolumeSync() {
    const newDbPath = isProduction && process.env.USE_VOLUME 
        ? '/data/fishing_log.db'                           // Volume path (only when explicitly enabled)
        : 'fishing_log.db';                                // Default path

    console.log('Target database path:', newDbPath);
    console.log('USE_VOLUME environment variable:', process.env.USE_VOLUME);

    if (isProduction && process.env.USE_VOLUME && newDbPath !== oldDbPath) {
        console.log('🔄 Volume migration mode enabled');
        
        // Check if old database exists and new location is empty
        if (fs.existsSync(oldDbPath) && !fs.existsSync(newDbPath)) {
            console.log('📦 Migrating database from', oldDbPath, 'to', newDbPath);
            
            try {
                // Ensure volume directory exists
                const volumeDir = path.dirname(newDbPath);
                if (!fs.existsSync(volumeDir)) {
                    console.log('Creating volume directory:', volumeDir);
                    fs.mkdirSync(volumeDir, { recursive: true });
                }
                
                // Copy database to new location
                fs.copyFileSync(oldDbPath, newDbPath);
                console.log('✅ Database successfully migrated to volume');
                
                // Keep old database as backup for one deployment
                const backupPath = oldDbPath + '.backup';
                fs.renameSync(oldDbPath, backupPath);
                console.log('📦 Original database backed up to:', backupPath);
                
                return newDbPath;
                
            } catch (error) {
                console.error('❌ Migration failed:', error);
                console.log('⚠️ Continuing with original database location');
                return oldDbPath; // Fallback to original location
            }
        } else if (fs.existsSync(newDbPath)) {
            console.log('📁 Volume database already exists, using it');
            return newDbPath;
        }
    }
    
    return newDbPath;
}

// Get final database path after potential migration
const dbPath = migrateToVolumeSync();
console.log('Final database path:', dbPath);

// Initialize SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        state TEXT,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1
    )`);

    // Check if users table needs admin migration
    db.all("PRAGMA table_info(users)", (err, columns) => {
        const hasIsAdmin = columns.some(col => col.name === 'is_admin');
        const hasState = columns.some(col => col.name === 'state');
        
        if (!hasIsAdmin) {
            console.log('Adding is_admin column to users table...');
            db.run("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0", (err) => {
                if (err) {
                    console.error('Error adding is_admin to users:', err);
                } else {
                    console.log('Successfully added is_admin column to users');
                    // Create default admin user if none exists
                    createDefaultAdmin();
                }
            });
        } else {
            // Check if admin user exists
            createDefaultAdmin();
        }
        
        if (!hasState) {
            console.log('Adding state column to users table...');
            db.run("ALTER TABLE users ADD COLUMN state TEXT", (err) => {
                if (err) {
                    console.error('Error adding state to users:', err);
                } else {
                    console.log('Successfully added state column to users');
                }
            });
        }
    });

    // Check if fishing_entries table exists and has required columns
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='fishing_entries'", (err, row) => {
        if (row) {
            // Table exists, check for missing columns
            db.all("PRAGMA table_info(fishing_entries)", (err, columns) => {
                const hasUserId = columns.some(col => col.name === 'user_id');
                const hasFliesUsed = columns.some(col => col.name === 'flies_used');
                const hasWindSpeed = columns.some(col => col.name === 'wind_speed');
                const hasWindDirection = columns.some(col => col.name === 'wind_direction');
                
                if (!hasUserId) {
                    console.log('Adding user_id column to fishing_entries table...');
                    db.run("ALTER TABLE fishing_entries ADD COLUMN user_id INTEGER", (err) => {
                        if (err) {
                            console.error('Error adding user_id to fishing_entries:', err);
                        } else {
                            console.log('Successfully added user_id column to fishing_entries');
                        }
                    });
                }
                
                if (!hasFliesUsed) {
                    console.log('Adding flies_used column to fishing_entries table...');
                    db.run("ALTER TABLE fishing_entries ADD COLUMN flies_used TEXT", (err) => {
                        if (err) {
                            console.error('Error adding flies_used to fishing_entries:', err);
                        } else {
                            console.log('Successfully added flies_used column to fishing_entries');
                        }
                    });
                }
                
                if (!hasWindSpeed) {
                    console.log('Adding wind_speed column to fishing_entries table...');
                    db.run("ALTER TABLE fishing_entries ADD COLUMN wind_speed REAL", (err) => {
                        if (err) {
                            console.error('Error adding wind_speed to fishing_entries:', err);
                        } else {
                            console.log('Successfully added wind_speed column to fishing_entries');
                        }
                    });
                }
                
                if (!hasWindDirection) {
                    console.log('Adding wind_direction column to fishing_entries table...');
                    db.run("ALTER TABLE fishing_entries ADD COLUMN wind_direction TEXT", (err) => {
                        if (err) {
                            console.error('Error adding wind_direction to fishing_entries:', err);
                        } else {
                            console.log('Successfully added wind_direction column to fishing_entries');
                        }
                    });
                }
            });
            
            // Check and add cached_flow_data column
            db.get("PRAGMA table_info(fishing_entries)", (err, result) => {
                if (err) return;
                
                db.all("PRAGMA table_info(fishing_entries)", (err, columns) => {
                    if (err) return;
                    
                    const hasCachedFlowData = columns.some(col => col.name === 'cached_flow_data');
                    if (!hasCachedFlowData) {
                        console.log('Adding cached_flow_data column to fishing_entries table...');
                        db.run("ALTER TABLE fishing_entries ADD COLUMN cached_flow_data TEXT", (err) => {
                            if (err) {
                                console.error('Error adding cached_flow_data to fishing_entries:', err);
                            } else {
                                console.log('Successfully added cached_flow_data column to fishing_entries');
                            }
                        });
                    }
                });
            });
        } else {
            // Create new table with user_id
            db.run(`CREATE TABLE fishing_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                angler TEXT NOT NULL,
                species TEXT,
                length REAL,
                weight REAL,
                city_state TEXT,
                latitude REAL,
                longitude REAL,
                site_number TEXT,
                river_name TEXT,
                water_flow REAL,
                weather_temp REAL,
                barometric_pressure REAL,
                wind_speed REAL,
                wind_direction TEXT,
                moon_phase TEXT,
                notes TEXT,
                flies_used TEXT,
                photo_path TEXT,
                cached_flow_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);
        }
    });

    // Similar migration for licenses table
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='licenses'", (err, row) => {
        if (row) {
            db.all("PRAGMA table_info(licenses)", (err, columns) => {
                const hasUserId = columns.some(col => col.name === 'user_id');
                if (!hasUserId) {
                    console.log('Adding user_id column to licenses table...');
                    db.run("ALTER TABLE licenses ADD COLUMN user_id INTEGER", (err) => {
                        if (err) {
                            console.error('Error adding user_id to licenses:', err);
                        } else {
                            console.log('Successfully added user_id column to licenses');
                        }
                    });
                }
            });
        } else {
            db.run(`CREATE TABLE licenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                state TEXT NOT NULL,
                type TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                notifications BOOLEAN DEFAULT 0,
                document_path TEXT,
                document_type TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);
        }
    });

    // User profile table (updated with user_id)
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='user_profile'", (err, row) => {
        if (err) return;
        
        if (!row) {
            // Create new table
            db.run(`CREATE TABLE user_profile (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                first_name TEXT,
                last_name TEXT,
                address TEXT,
                phone TEXT,
                email TEXT,
                photo_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`);
        } else {
            // Check if user_id column exists
            db.all("PRAGMA table_info(user_profile)", (err, columns) => {
                if (err) return;
                
                const hasUserId = columns.some(col => col.name === 'user_id');
                if (!hasUserId) {
                    console.log('Adding user_id column to user_profile table...');
                    db.run("ALTER TABLE user_profile ADD COLUMN user_id INTEGER", (err) => {
                        if (err) {
                            console.error('Error adding user_id to user_profile:', err);
                        } else {
                            console.log('Successfully added user_id column to user_profile');
                        }
                    });
                }
            });
        }
    });

    // Similar migration for rivers table
    db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='rivers'", (err, row) => {
        if (row) {
            db.all("PRAGMA table_info(rivers)", (err, columns) => {
                const hasUserId = columns.some(col => col.name === 'user_id');
                if (!hasUserId) {
                    console.log('Adding user_id column to rivers table...');
                    db.run("ALTER TABLE rivers ADD COLUMN user_id INTEGER", (err) => {
                        if (err) {
                            console.error('Error adding user_id to rivers:', err);
                        } else {
                            console.log('Successfully added user_id column to rivers');
                        }
                    });
                }
            });
        } else {
            db.run(`CREATE TABLE rivers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                site_number TEXT NOT NULL,
                river_name TEXT NOT NULL,
                location TEXT,
                current_flow REAL,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, site_number)
            )`);
        }
    });

    console.log('Database tables initialized with migrations');
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

// Optional authentication middleware (for endpoints that work with or without auth)
function optionalAuth(req, res, next) {
    // This middleware doesn't block, just sets user info if available
    next();
}

// Admin authentication middleware
function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is admin
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.session.userId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!row || !row.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        next();
    });
}

// Create default admin user if none exists
function createDefaultAdmin() {
    db.get('SELECT id FROM users WHERE is_admin = 1', (err, row) => {
        if (!row) {
            console.log('Creating default admin user...');
            const defaultAdminPassword = 'admin123'; // Should be changed immediately
            
            bcrypt.hash(defaultAdminPassword, 10, (err, hash) => {
                if (err) {
                    console.error('Error creating admin password hash:', err);
                    return;
                }
                
                const sql = `INSERT INTO users (username, email, password_hash, first_name, last_name, is_admin, state)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`;
                
                db.run(sql, [
                    'admin', 
                    'admin@fishinglog.com', 
                    hash, 
                    'System', 
                    'Administrator', 
                    1,
                    'MN'
                ], function(err) {
                    if (err) {
                        console.error('Error creating default admin:', err);
                    } else {
                        console.log('✅ Default admin created!');
                        console.log('📧 Username: admin');
                        console.log('🔑 Password: admin123');
                        console.log('⚠️  IMPORTANT: Change the admin password immediately!');
                    }
                });
            });
        }
    });
}

// API Routes

// Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, firstName, lastName, state } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    try {
        console.log('Signup attempt - Username:', username, 'Email:', email);
        
        // Check if signup is already in progress for this email
        const lockKey = email.toLowerCase();
        if (signupLocks.has(lockKey)) {
            console.log('Signup already in progress for:', email);
            return res.status(400).json({ 
                error: 'A signup request is already being processed for this email address. Please wait a moment and try again.' 
            });
        }
        
        // Set lock for this email with timestamp
        signupLocks.set(lockKey, { timestamp: Date.now() });
        console.log('Set signup lock for:', email);
        
        // Cleanup function to remove lock
        const cleanupLock = () => {
            signupLocks.delete(lockKey);
            console.log('Removed signup lock for:', email);
        };
        
        // Use database serialization for proper operation ordering
        db.serialize(() => {

            // Single query to check both username and email
            const checkQuery = 'SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)';
            console.log('DEBUG: Running duplicate check query:', checkQuery);
            console.log('DEBUG: Query parameters:', [username, email]);
            
            db.get(checkQuery, [username, email], async (err, existingUser) => {
                if (err) {
                    console.error('Database error during user existence check:', err);
                    cleanupLock();
                    return res.status(500).json({ error: 'Database error occurred' });
                }

                console.log('DEBUG: Duplicate check result:', existingUser || 'No duplicates found');

                if (existingUser) {
                    console.log('Duplicate found - Existing user:', existingUser);
                    cleanupLock();
                    
                    if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                        return res.status(400).json({ 
                            error: 'An account with this email address already exists. Please try logging in instead.' 
                        });
                    } else {
                        return res.status(400).json({ 
                            error: 'This username is already taken. Please choose a different username.' 
                        });
                    }
                }

                console.log('No duplicates found, proceeding with user creation...');

                // Hash password and create user
                bcrypt.hash(password, 10, (hashErr, passwordHash) => {
                    if (hashErr) {
                        console.error('Password hashing error:', hashErr);
                        cleanupLock();
                        return res.status(500).json({ error: 'Failed to process account creation. Please try again.' });
                    }

                    // Create user
                    const sql = `INSERT INTO users (username, email, password_hash, first_name, last_name, state)
                                 VALUES (?, ?, ?, ?, ?, ?)`;

                    console.log('DEBUG: About to insert user with SQL:', sql);
                    console.log('DEBUG: Insert parameters:', [username, email, '[REDACTED]', firstName || null, lastName || null, state || null]);
                    
                    db.run(sql, [username, email, passwordHash, firstName || null, lastName || null, state || null], function(err) {
                        if (err) {
                            console.error('Database error during user creation:', err);
                            cleanupLock();
                            
                            // Handle specific SQLite constraint errors (fallback safety)
                            if (err.message.includes('UNIQUE constraint failed: users.email')) {
                                return res.status(400).json({ 
                                    error: 'An account with this email address already exists. Please try logging in instead.' 
                                });
                            } else if (err.message.includes('UNIQUE constraint failed: users.username')) {
                                return res.status(400).json({ 
                                    error: 'This username is already taken. Please choose a different username.' 
                                });
                            } else if (err.message.includes('UNIQUE constraint failed')) {
                                return res.status(400).json({ 
                                    error: 'This username or email is already in use. Please try different values.' 
                                });
                            } else {
                                return res.status(500).json({ error: 'Failed to create account. Please try again.' });
                            }
                        }

                        console.log('DEBUG: User creation successful!');
                        console.log('New user created successfully:', username, 'with ID:', this.lastID);
                        cleanupLock();
                        req.session.userId = this.lastID;
                        req.session.username = username;
                        
                        // Force session save and wait for it
                        req.session.save((saveErr) => {
                            if (saveErr) {
                                console.error('Session save error:', saveErr);
                                return res.status(500).json({ error: 'Failed to save session' });
                            }
                            
                            res.json({ 
                                id: this.lastID, 
                                username: username, 
                                email: email,
                                message: 'Account created successfully!'
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        // Cleanup lock on any uncaught error
        const lockKey = email?.toLowerCase();
        if (lockKey && signupLocks.has(lockKey)) {
            signupLocks.delete(lockKey);
            console.log('Cleaned up signup lock on error for:', email);
        }
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint to check existing users (temporarily enabled for production debugging)
app.get('/api/debug/users', (req, res) => {
    console.log('Debug users endpoint called');
    
    db.all('SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 20', (err, rows) => {
        if (err) {
            console.error('Debug users error:', err);
            res.status(500).json({ error: err.message });
        } else {
            console.log('Found users:', rows);
            res.json(rows);
        }
    });
});


app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    const sql = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.get(sql, [username, username], async (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!user) {
            console.log('User not found for username:', username);
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        
        console.log('User found:', user.username, 'ID:', user.id);

        try {
            const validPassword = await bcrypt.compare(password, user.password_hash);
            console.log('Password valid:', validPassword);
            
            if (!validPassword) {
                console.log('Invalid password for user:', username);
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            // Update last login
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

            // Set session
            req.session.userId = user.id;
            req.session.username = user.username;
            console.log('Login successful for user:', user.username, 'Session ID:', req.sessionID);
            console.log('Session data before save:', req.session);

            // Prepare response data
            const responseData = {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                is_admin: user.is_admin || false,
                message: 'Login successful'
            };

            // Try to save session with timeout fallback
            console.log('Attempting to save session...');
            const sessionSaveTimeout = setTimeout(() => {
                console.warn('Session save timed out after 5 seconds, sending response anyway');
                if (!res.headersSent) {
                    console.log('Sending response despite session save timeout:', responseData);
                    res.json(responseData);
                    console.log('Response sent successfully (timeout fallback)');
                }
            }, 5000);

            req.session.save((saveErr) => {
                clearTimeout(sessionSaveTimeout);
                
                if (saveErr) {
                    console.error('Session save error:', saveErr);
                    if (!res.headersSent) {
                        console.log('Sending response despite session save error:', responseData);
                        res.json(responseData);
                        console.log('Response sent successfully (error fallback)');
                    }
                    return;
                }
                
                console.log('Session saved successfully, sending response...');
                console.log('Final session data:', req.session);
                
                if (!res.headersSent) {
                    console.log('Sending response:', responseData);
                    res.json(responseData);
                    console.log('Response sent successfully');
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.status(500).json({ error: 'Could not log out' });
        } else {
            res.json({ message: 'Logout successful' });
        }
    });
});

app.get('/api/auth/user', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.get('SELECT id, username, email, first_name, last_name, state, is_admin, is_active FROM users WHERE id = ?', 
           [req.session.userId], (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!user) {
            res.status(401).json({ error: 'User not found' });
        } else {
            res.json(user);
        }
    });
});

// Alias for admin authentication checks
app.get('/api/auth/profile', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.get('SELECT id, username, email, first_name, last_name, state, is_admin, is_active FROM users WHERE id = ?', 
           [req.session.userId], (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!user) {
            res.status(401).json({ error: 'User not found' });
        } else {
            res.json(user);
        }
    });
});

// Fishing Entries
app.get('/api/fishing-entries', requireAuth, (req, res) => {
    db.all('SELECT * FROM fishing_entries WHERE user_id = ? ORDER BY date DESC', [req.session.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.post('/api/fishing-entries', requireAuth, (req, res) => {
    const {
        date, start_time, end_time, angler, species, length, weight,
        city_state, latitude, longitude, site_number, river_name,
        water_flow, weather_temp, barometric_pressure, wind_speed, wind_direction,
        moon_phase, notes, flies_used, photo_data, cached_flow_data
    } = req.body;

    let photo_path = null;
    if (photo_data) {
        // Save base64 image to file
        const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
        photo_path = `uploads/${Date.now()}-fishing-photo.jpg`;
        fs.writeFileSync(photo_path, base64Data, 'base64');
    }

    const sql = `INSERT INTO fishing_entries (
        user_id, date, start_time, end_time, angler, species, length, weight,
        city_state, latitude, longitude, site_number, river_name,
        water_flow, weather_temp, barometric_pressure, wind_speed, wind_direction,
        moon_phase, notes, flies_used, photo_path, cached_flow_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        req.session.userId, date, start_time, end_time, angler, species, length, weight,
        city_state, latitude, longitude, site_number, river_name,
        water_flow, weather_temp, barometric_pressure, wind_speed, wind_direction,
        moon_phase, notes, flies_used, photo_path, cached_flow_data
    ], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ id: this.lastID, message: 'Fishing entry created successfully' });
        }
    });
});

app.put('/api/fishing-entries/:id', requireAuth, (req, res) => {
    const entryId = req.params.id;
    const {
        date, start_time, end_time, angler, species, length, weight,
        city_state, latitude, longitude, site_number, river_name,
        water_flow, weather_temp, barometric_pressure, wind_speed, wind_direction,
        moon_phase, notes, flies_used, photo_data, cached_flow_data
    } = req.body;

    // Check if entry belongs to user first
    db.get('SELECT id, photo_path FROM fishing_entries WHERE id = ? AND user_id = ?', [entryId, req.session.userId], (err, existingEntry) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!existingEntry) {
            return res.status(404).json({ error: 'Fishing entry not found or access denied' });
        }

        let photo_path = existingEntry.photo_path; // Keep existing photo by default

        // Handle new photo if provided
        if (photo_data) {
            // Delete old photo if it exists
            if (existingEntry.photo_path && fs.existsSync(existingEntry.photo_path)) {
                fs.unlinkSync(existingEntry.photo_path);
            }
            // Save new photo
            const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
            photo_path = `uploads/${Date.now()}-fishing-photo.jpg`;
            fs.writeFileSync(photo_path, base64Data, 'base64');
        }

        const sql = `UPDATE fishing_entries SET
            date = ?, start_time = ?, end_time = ?, angler = ?, species = ?, length = ?, weight = ?,
            city_state = ?, latitude = ?, longitude = ?, site_number = ?, river_name = ?,
            water_flow = ?, weather_temp = ?, barometric_pressure = ?, wind_speed = ?, wind_direction = ?,
            moon_phase = ?, notes = ?, flies_used = ?, photo_path = ?, cached_flow_data = ?
            WHERE id = ? AND user_id = ?`;

        db.run(sql, [
            date, start_time, end_time, angler, species, length, weight,
            city_state, latitude, longitude, site_number, river_name,
            water_flow, weather_temp, barometric_pressure, wind_speed, wind_direction,
            moon_phase, notes, flies_used, photo_path, cached_flow_data,
            entryId, req.session.userId
        ], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Fishing entry not found or no changes made' });
            } else {
                res.json({ id: entryId, message: 'Fishing entry updated successfully' });
            }
        });
    });
});

app.delete('/api/fishing-entries/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    
    // Get the entry to delete associated photo (ensure it belongs to the user)
    db.get('SELECT photo_path FROM fishing_entries WHERE id = ? AND user_id = ?', [id, req.session.userId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'Fishing entry not found or access denied' });
            return;
        }
        
        // Delete the photo file if it exists
        if (row.photo_path && fs.existsSync(row.photo_path)) {
            fs.unlinkSync(row.photo_path);
        }
        
        // Delete the database entry
        db.run('DELETE FROM fishing_entries WHERE id = ? AND user_id = ?', [id, req.session.userId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ message: 'Fishing entry deleted successfully' });
            }
        });
    });
});

// Licenses
app.get('/api/licenses', requireAuth, (req, res) => {
    db.all('SELECT * FROM licenses WHERE user_id = ? ORDER BY end_date DESC', [req.session.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.post('/api/licenses', requireAuth, (req, res) => {
    const { state, type, start_date, end_date, notifications, document_data, document_type } = req.body;

    let document_path = null;
    if (document_data) {
        // Save base64 document to file
        const base64Data = document_data.replace(/^data:[^;]+;base64,/, '');
        const extension = document_type === 'pdf' ? 'pdf' : 'jpg';
        document_path = `uploads/${Date.now()}-license.${extension}`;
        fs.writeFileSync(document_path, base64Data, 'base64');
    }

    const sql = `INSERT INTO licenses (user_id, state, type, start_date, end_date, notifications, document_path, document_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [req.session.userId, state, type, start_date, end_date, notifications, document_path, document_type], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ id: this.lastID, message: 'License created successfully' });
        }
    });
});

app.delete('/api/licenses/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    
    // Get the license to delete associated document (ensure it belongs to the user)
    db.get('SELECT document_path FROM licenses WHERE id = ? AND user_id = ?', [id, req.session.userId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!row) {
            res.status(404).json({ error: 'License not found or access denied' });
            return;
        }
        
        // Delete the document file if it exists
        if (row.document_path && fs.existsSync(row.document_path)) {
            fs.unlinkSync(row.document_path);
        }
        
        // Delete the database entry
        db.run('DELETE FROM licenses WHERE id = ? AND user_id = ?', [id, req.session.userId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ message: 'License deleted successfully' });
            }
        });
    });
});

// User Profile
app.get('/api/profile', requireAuth, (req, res) => {
    // First check if user_profile table has user_id column
    db.all("PRAGMA table_info(user_profile)", (err, columns) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const hasUserId = columns.some(col => col.name === 'user_id');
        
        if (hasUserId) {
            // Table has user_id column, use normal query
            db.get('SELECT * FROM user_profile WHERE user_id = ?', [req.session.userId], (err, profileRow) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                if (profileRow) {
                    // Profile exists, return it
                    res.json(profileRow);
                } else {
                    // No profile exists, get user account data to pre-populate
                    db.get('SELECT first_name, last_name, email FROM users WHERE id = ?', [req.session.userId], (err, userRow) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                        } else {
                            // Return user account data for profile pre-population
                            res.json({
                                first_name: userRow ? userRow.first_name : '',
                                last_name: userRow ? userRow.last_name : '',
                                email: userRow ? userRow.email : '',
                                address: '',
                                phone: '',
                                photo_path: null
                            });
                        }
                    });
                }
            });
        } else {
            // Table doesn't have user_id column yet, just return user account data
            db.get('SELECT first_name, last_name, email FROM users WHERE id = ?', [req.session.userId], (err, userRow) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                } else {
                    // Return user account data for profile pre-population
                    res.json({
                        first_name: userRow ? userRow.first_name : '',
                        last_name: userRow ? userRow.last_name : '',
                        email: userRow ? userRow.email : '',
                        address: '',
                        phone: '',
                        photo_path: null
                    });
                }
            });
        }
    });
});

app.post('/api/profile', requireAuth, (req, res) => {
    const { first_name, last_name, address, phone, photo_data } = req.body;

    let photo_path = null;
    if (photo_data) {
        // Save base64 image to file
        const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
        photo_path = `uploads/${Date.now()}-profile-photo.jpg`;
        fs.writeFileSync(photo_path, base64Data, 'base64');
    }

    // Update the user account with name changes only (email is locked)
    const updateUserSql = `UPDATE users SET first_name = ?, last_name = ? WHERE id = ?`;
    db.run(updateUserSql, [first_name, last_name, req.session.userId], function(userErr) {
        if (userErr) {
            res.status(500).json({ error: userErr.message });
            return;
        }

        // Check if profile exists for this user
        db.get('SELECT id FROM user_profile WHERE user_id = ?', [req.session.userId], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (row) {
                // Update existing profile (email is taken from users table, not updated)
                const sql = `UPDATE user_profile SET 
                            first_name = ?, last_name = ?, address = ?, phone = ?, 
                            photo_path = COALESCE(?, photo_path), updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ?`;
                db.run(sql, [first_name, last_name, address, phone, photo_path, req.session.userId], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                    } else {
                        res.json({ message: 'Profile updated successfully' });
                    }
                });
            } else {
                // Create new profile (get email from users table)
                db.get('SELECT email FROM users WHERE id = ?', [req.session.userId], (err, userRow) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    const sql = `INSERT INTO user_profile (user_id, first_name, last_name, address, phone, email, photo_path)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
                    db.run(sql, [req.session.userId, first_name, last_name, address, phone, userRow.email, photo_path], function(err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                        } else {
                            res.json({ id: this.lastID, message: 'Profile created successfully' });
                        }
                    });
                });
            }
        });
    });
});

// Password Change
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    try {
        // Get current user's password hash
        db.get('SELECT password_hash FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            try {
                // Verify current password
                const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
                if (!validPassword) {
                    res.status(400).json({ error: 'Current password is incorrect' });
                    return;
                }

                // Hash new password
                const newPasswordHash = await bcrypt.hash(newPassword, 10);

                // Update password in database
                db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.session.userId], function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                    } else {
                        res.json({ message: 'Password changed successfully' });
                    }
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Account
app.post('/api/auth/delete-account', requireAuth, async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Password is required to delete account' });
    }

    try {
        // Get current user's password hash
        db.get('SELECT password_hash FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            try {
                // Verify password
                const validPassword = await bcrypt.compare(password, user.password_hash);
                if (!validPassword) {
                    res.status(400).json({ error: 'Password is incorrect' });
                    return;
                }

                // Delete all user data in the correct order (respecting foreign keys)
                db.serialize(() => {
                    // Delete fishing entries and associated photos
                    db.all('SELECT photo_path FROM fishing_entries WHERE user_id = ?', [req.session.userId], (err, entries) => {
                        if (!err && entries) {
                            entries.forEach(entry => {
                                if (entry.photo_path && fs.existsSync(entry.photo_path)) {
                                    fs.unlinkSync(entry.photo_path);
                                }
                            });
                        }
                    });

                    // Delete licenses and associated documents
                    db.all('SELECT document_path FROM licenses WHERE user_id = ?', [req.session.userId], (err, licenses) => {
                        if (!err && licenses) {
                            licenses.forEach(license => {
                                if (license.document_path && fs.existsSync(license.document_path)) {
                                    fs.unlinkSync(license.document_path);
                                }
                            });
                        }
                    });

                    // Delete profile photo
                    db.get('SELECT photo_path FROM user_profile WHERE user_id = ?', [req.session.userId], (err, profile) => {
                        if (!err && profile && profile.photo_path && fs.existsSync(profile.photo_path)) {
                            fs.unlinkSync(profile.photo_path);
                        }
                    });

                    // Delete all user-related data
                    db.run('DELETE FROM fishing_entries WHERE user_id = ?', [req.session.userId]);
                    db.run('DELETE FROM licenses WHERE user_id = ?', [req.session.userId]);
                    db.run('DELETE FROM user_profile WHERE user_id = ?', [req.session.userId]);
                    db.run('DELETE FROM rivers WHERE user_id = ?', [req.session.userId]);
                    
                    // Finally delete the user account
                    db.run('DELETE FROM users WHERE id = ?', [req.session.userId], function(err) {
                        if (err) {
                            res.status(500).json({ error: err.message });
                        } else {
                            // Destroy the session
                            req.session.destroy((sessionErr) => {
                                if (sessionErr) {
                                    console.error('Error destroying session:', sessionErr);
                                }
                                res.json({ message: 'Account deleted successfully' });
                            });
                        }
                    });
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rivers - include user's rivers plus system-wide rivers (admin rivers)
app.get('/api/rivers', requireAuth, (req, res) => {
    const sql = `
        SELECT *, 
               CASE WHEN user_id = 1 THEN 1 ELSE 0 END as is_system_river
        FROM rivers 
        WHERE user_id = ? OR user_id = 1 
        ORDER BY is_system_river DESC, river_name
    `;
    
    db.all(sql, [req.session.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Debug endpoint to see all river sites (admin only)
app.get('/api/debug/rivers', requireAdmin, (req, res) => {
    console.log('Fetching all river sites from database');
    db.all('SELECT * FROM rivers ORDER BY user_id, river_name', (err, rows) => {
        if (err) {
            console.error('Error fetching rivers:', err);
            res.status(500).json({ error: err.message });
        } else {
            console.log('Found', rows.length, 'river sites');
            res.json(rows);
        }
    });
});

// Bulk add USGS sites endpoint (admin only)
app.post('/api/debug/add-usgs-sites', requireAdmin, async (req, res) => {
    const { siteNumbers, userId } = req.body;
    
    if (!siteNumbers || !Array.isArray(siteNumbers)) {
        return res.status(400).json({ error: 'siteNumbers array is required' });
    }
    
    const targetUserId = userId || req.session.userId;
    console.log('Adding USGS sites for user ID:', targetUserId);
    
    const results = [];
    
    for (const siteNumber of siteNumbers) {
        try {
            console.log('Processing USGS site:', siteNumber);
            
            // Check if site already exists for this user
            const existing = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM rivers WHERE user_id = ? AND site_number = ?', 
                    [targetUserId, siteNumber], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (existing) {
                console.log('Site', siteNumber, 'already exists, skipping');
                results.push({ siteNumber, status: 'skipped', reason: 'already exists' });
                continue;
            }
            
            // Fetch site info from USGS API
            const usgsUrl = `https://waterservices.usgs.gov/nwis/site/?format=json&sites=${siteNumber}&siteOutput=expanded`;
            
            let siteData;
            try {
                const response = await fetch(usgsUrl);
                const data = await response.json();
                siteData = data.value?.timeSeries?.[0]?.sourceInfo || null;
            } catch (fetchError) {
                console.warn('Could not fetch USGS data for', siteNumber, ':', fetchError.message);
                siteData = null;
            }
            
            // Use USGS data if available, otherwise use defaults
            const riverName = siteData?.siteName || `USGS Site ${siteNumber}`;
            const location = siteData?.geoLocation?.geogLocation 
                ? `${siteData.geoLocation.geogLocation.latitude}, ${siteData.geoLocation.geogLocation.longitude}`
                : 'Location TBD';
            
            // Insert into database
            await new Promise((resolve, reject) => {
                const sql = `INSERT INTO rivers (user_id, site_number, river_name, location, current_flow, last_updated)
                           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
                
                db.run(sql, [targetUserId, siteNumber, riverName, location, null], function(err) {
                    if (err) reject(err);
                    else {
                        console.log('✅ Added site', siteNumber, 'as ID', this.lastID);
                        resolve(this.lastID);
                    }
                });
            });
            
            results.push({ 
                siteNumber, 
                status: 'added', 
                riverName, 
                location 
            });
            
        } catch (error) {
            console.error('Error processing site', siteNumber, ':', error);
            results.push({ 
                siteNumber, 
                status: 'error', 
                error: error.message 
            });
        }
    }
    
    console.log('Bulk USGS site addition complete');
    res.json({ 
        message: 'Bulk site addition complete',
        results: results,
        summary: {
            total: siteNumbers.length,
            added: results.filter(r => r.status === 'added').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            errors: results.filter(r => r.status === 'error').length
        }
    });
});

// Quick endpoint to add the requested USGS sites system-wide (admin only)
app.post('/api/debug/add-requested-sites', requireAdmin, async (req, res) => {
    const allSites = [
        // Original batch (8 sites)
        "05356000","05356500","05367055","05366800","05365550","05365500","05369500","05371200",
        // Second batch (21 sites)
        "05357500","05358330","05359500","05360000","05360490","05360500",
        "05357157","05357302","05357335","05357295","053572942",
        "05380806","05381000","05381360","053813595","05382000","05382220",
        "05404000","05400760","05407000","05398000","05398100","05395000",
        // Third batch (26 sites)
        "04082400","04084445","04073500","04073365","04085000","040851385",
        "05544348","05545750","05544475","05545334","04027500","04027525",
        "04027250","04027498","04073440","04073405","05545300","04087000",
        "04086600","04086250","04086150","04087170","040870104","040871457",
        "040870115","04086096",
        // Fourth batch (20 sites)
        "04027000","04027595","04026511","04026450","04025000","04025033",
        "04024500","04067500","04067650","04065106","04066003","04071765",
        "04071775","04071000","04070325","04070640","04069500","04067958",
        "04069416","04069509"
    ];
    
    console.log('Adding', allSites.length, 'USGS sites to admin account (system-wide)');
    
    const results = [];
    
    for (const siteNumber of allSites) {
        try {
            console.log('Processing USGS site:', siteNumber);
            
            // Check if site already exists for admin user
            const existing = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM rivers WHERE user_id = 1 AND site_number = ?', 
                    [siteNumber], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (existing) {
                console.log('Site', siteNumber, 'already exists, skipping');
                results.push({ siteNumber, status: 'skipped', reason: 'already exists' });
                continue;
            }
            
            // Fetch site info from USGS API
            const usgsUrl = `https://waterservices.usgs.gov/nwis/site/?format=json&sites=${siteNumber}&siteOutput=expanded`;
            
            let siteData;
            try {
                const response = await fetch(usgsUrl);
                const data = await response.json();
                siteData = data.value?.timeSeries?.[0]?.sourceInfo || null;
            } catch (fetchError) {
                console.warn('Could not fetch USGS data for', siteNumber, ':', fetchError.message);
                siteData = null;
            }
            
            // Use USGS data if available, otherwise use defaults
            const riverName = siteData?.siteName || `USGS Site ${siteNumber}`;
            const location = siteData?.geoLocation?.geogLocation 
                ? `${siteData.geoLocation.geogLocation.latitude}, ${siteData.geoLocation.geogLocation.longitude}`
                : 'Location TBD';
            
            // Insert into database as admin user (system-wide)
            await new Promise((resolve, reject) => {
                const sql = `INSERT INTO rivers (user_id, site_number, river_name, location, current_flow, last_updated)
                           VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
                
                db.run(sql, [siteNumber, riverName, location, null], function(err) {
                    if (err) reject(err);
                    else {
                        console.log('✅ Added system site', siteNumber, 'as ID', this.lastID);
                        resolve(this.lastID);
                    }
                });
            });
            
            results.push({ 
                siteNumber, 
                status: 'added', 
                riverName, 
                location 
            });
            
        } catch (error) {
            console.error('Error processing site', siteNumber, ':', error);
            results.push({ 
                siteNumber, 
                status: 'error', 
                error: error.message 
            });
        }
    }
    
    console.log('System-wide USGS site addition complete');
    res.json({ 
        message: 'System-wide USGS sites added to admin account',
        results: results,
        summary: {
            total: allSites.length,
            added: results.filter(r => r.status === 'added').length,
            skipped: results.filter(r => r.status === 'skipped').length,
            errors: results.filter(r => r.status === 'error').length
        }
    });
});

app.post('/api/rivers', requireAuth, (req, res) => {
    const { site_number, river_name, location, current_flow } = req.body;

    const sql = `INSERT OR REPLACE INTO rivers (user_id, site_number, river_name, location, current_flow, last_updated)
                 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    db.run(sql, [req.session.userId, site_number, river_name, location, current_flow], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ id: this.lastID, message: 'River saved successfully' });
        }
    });
});

app.delete('/api/rivers/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM rivers WHERE id = ? AND user_id = ?', [id, req.session.userId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'River not found or access denied' });
        } else {
            res.json({ message: 'River deleted successfully' });
        }
    });
});

// Admin API Routes
// Get all users (admin only)
app.get('/api/admin/users', requireAdmin, (req, res) => {
    const sql = `
        SELECT 
            u.id, 
            u.username, 
            u.email, 
            u.first_name, 
            u.last_name, 
            u.state,
            u.is_admin,
            u.is_active,
            u.created_at, 
            u.last_login,
            COUNT(fe.id) as entry_count,
            COUNT(l.id) as license_count
        FROM users u
        LEFT JOIN fishing_entries fe ON u.id = fe.user_id
        LEFT JOIN licenses l ON u.id = l.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `;
    
    db.all(sql, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Get user details (admin only)
app.get('/api/admin/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    const sql = `
        SELECT 
            u.id, 
            u.username, 
            u.email, 
            u.first_name, 
            u.last_name, 
            u.state,
            u.is_admin,
            u.is_active,
            u.created_at, 
            u.last_login,
            up.address,
            up.phone,
            up.photo_path
        FROM users u
        LEFT JOIN user_profile up ON u.id = up.user_id
        WHERE u.id = ?
    `;
    
    db.get(sql, [userId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'User not found' });
        } else {
            res.json(row);
        }
    });
});

// Update user (admin only)
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    const { first_name, last_name, email, state, is_admin, is_active } = req.body;
    
    const sql = `
        UPDATE users 
        SET first_name = ?, last_name = ?, email = ?, state = ?, is_admin = ?, is_active = ?
        WHERE id = ?
    `;
    
    db.run(sql, [first_name, last_name, email, state, is_admin ? 1 : 0, is_active ? 1 : 0, userId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'User not found' });
        } else {
            res.json({ message: 'User updated successfully' });
        }
    });
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    // Don't allow deleting the current admin user
    if (parseInt(userId) === req.session.userId) {
        return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }
    
    // Start transaction - delete user and all related data
    db.serialize(() => {
        db.run('DELETE FROM fishing_entries WHERE user_id = ?', [userId]);
        db.run('DELETE FROM licenses WHERE user_id = ?', [userId]);
        db.run('DELETE FROM user_profile WHERE user_id = ?', [userId]);
        db.run('DELETE FROM rivers WHERE user_id = ?', [userId]);
        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'User not found' });
            } else {
                res.json({ message: 'User and all related data deleted successfully' });
            }
        });
    });
});

// Get system statistics (admin only)
app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const queries = {
        totalUsers: 'SELECT COUNT(*) as count FROM users WHERE is_active = 1',
        totalEntries: 'SELECT COUNT(*) as count FROM fishing_entries',
        totalLicenses: 'SELECT COUNT(*) as count FROM licenses',
        recentActivity: `
            SELECT 
                'entry' as type, 
                u.username, 
                fe.created_at as date,
                fe.city_state as details
            FROM fishing_entries fe
            JOIN users u ON fe.user_id = u.id
            ORDER BY fe.created_at DESC
            LIMIT 10
        `
    };
    
    const results = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;
    
    Object.entries(queries).forEach(([key, sql]) => {
        if (key === 'recentActivity') {
            db.all(sql, (err, rows) => {
                results[key] = err ? [] : rows;
                completed++;
                if (completed === totalQueries) {
                    res.json(results);
                }
            });
        } else {
            db.get(sql, (err, row) => {
                results[key] = err ? 0 : row.count;
                completed++;
                if (completed === totalQueries) {
                    res.json(results);
                }
            });
        }
    });
});

// Reset user password (admin only)
app.post('/api/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    try {
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'User not found' });
            } else {
                res.json({ message: 'Password reset successfully' });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error hashing password' });
    }
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin panel (admin authentication handled by client-side JavaScript)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown handlers
function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        console.log('Server shutdown complete');
        process.exit(0);
    });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));