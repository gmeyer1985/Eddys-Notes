const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
    origin: ['http://localhost:8000', 'http://localhost:8001', 'http://127.0.0.1:8000', 'http://127.0.0.1:8001'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Serve the main application at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: Only images and PDFs are allowed!');
        }
    }
});

// Initialize SQLite database
const db = new sqlite3.Database('./fishing_log.db');

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        location TEXT,
        phone TEXT,
        bio TEXT,
        photo_data TEXT,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Fishing entries table
    db.run(`CREATE TABLE IF NOT EXISTS fishing_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        city_state TEXT,
        selected_lat REAL,
        selected_lon REAL,
        fishing_lat REAL,
        fishing_lon REAL,
        fishing_address TEXT,
        start_time TEXT,
        end_time TEXT,
        water_temp REAL,
        water_flow REAL,
        target_species TEXT,
        angler TEXT NOT NULL,
        flies_used TEXT,
        notes TEXT,
        river_name TEXT,
        site_number TEXT,
        weather_data TEXT,
        moon_phase TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Rivers table
    db.run(`CREATE TABLE IF NOT EXISTS saved_rivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        site_number TEXT NOT NULL,
        site_name TEXT NOT NULL,
        river_name TEXT,
        state TEXT,
        last_flow_rate REAL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Licenses table
    db.run(`CREATE TABLE IF NOT EXISTS fishing_licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        license_type TEXT NOT NULL,
        state TEXT NOT NULL,
        license_number TEXT,
        issue_date TEXT,
        expiration_date TEXT,
        cost REAL,
        document_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Create default admin user if not exists
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
        if (!row) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT INTO users (username, email, password, full_name, is_admin) 
                     VALUES ('admin', 'admin@eddysnotes.com', ?, 'Administrator', 1)`, 
                   [hashedPassword]);
            console.log('Default admin user created: admin/admin123');
        }
    });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// AUTH ROUTES
app.post('/api/auth/login', async (req, res) => {
    console.log('🔐 Login attempt:', req.body);
    const { username, password } = req.body;
    
    if (!username || !password) {
        console.log('❌ Missing username or password');
        return res.status(400).json({ error: 'Username and password required' });
    }

    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            console.log('❌ User not found:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('👤 User found:', user.username);
        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                console.log('❌ Invalid password for user:', username);
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            console.log('✅ Password valid for user:', username);

            const token = jwt.sign(
                { id: user.id, username: user.username, is_admin: user.is_admin },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.full_name,
                    is_admin: user.is_admin
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    });
});

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password, fullName } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password required' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(`INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)`,
               [username, email, hashedPassword, fullName || ''], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                console.error('Signup error:', err);
                return res.status(500).json({ error: 'Registration failed' });
            }

            const token = jwt.sign(
                { id: this.lastID, username, is_admin: false },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                user: {
                    id: this.lastID,
                    username,
                    email,
                    full_name: fullName || '',
                    is_admin: false
                }
            });
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get('SELECT id, username, email, full_name, location, phone, bio, photo_data, is_admin FROM users WHERE id = ?', 
           [req.user.id], (err, user) => {
        if (err) {
            console.error('Get user error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, user });
    });
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// FISHING ENTRIES ROUTES
app.get('/api/entries', authenticateToken, (req, res) => {
    db.all('SELECT * FROM fishing_entries WHERE user_id = ? ORDER BY date DESC, created_at DESC', 
           [req.user.id], (err, rows) => {
        if (err) {
            console.error('Get entries error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, entries: rows });
    });
});

app.post('/api/entries', authenticateToken, (req, res) => {
    const entry = req.body;
    const sql = `INSERT INTO fishing_entries (
        user_id, date, city_state, selected_lat, selected_lon, fishing_lat, fishing_lon,
        fishing_address, start_time, end_time, water_temp, water_flow, target_species,
        angler, flies_used, notes, river_name, site_number, weather_data, moon_phase
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        req.user.id, entry.date, entry.cityState, entry.selectedLat, entry.selectedLon,
        entry.fishingLat, entry.fishingLon, entry.fishingAddress, entry.startTime,
        entry.endTime, entry.waterTemp, entry.waterFlow, entry.targetSpecies,
        entry.angler, entry.fliesUsed, entry.notes, entry.riverName, entry.siteNumber,
        JSON.stringify(entry.weatherData), JSON.stringify(entry.moonPhase)
    ];

    db.run(sql, values, function(err) {
        if (err) {
            console.error('Create entry error:', err);
            return res.status(500).json({ error: 'Failed to create entry' });
        }
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/entries/:id', authenticateToken, (req, res) => {
    const entryId = req.params.id;
    const entry = req.body;
    
    const sql = `UPDATE fishing_entries SET
        date = ?, city_state = ?, selected_lat = ?, selected_lon = ?, fishing_lat = ?,
        fishing_lon = ?, fishing_address = ?, start_time = ?, end_time = ?, water_temp = ?,
        water_flow = ?, target_species = ?, angler = ?, flies_used = ?, notes = ?,
        river_name = ?, site_number = ?, weather_data = ?, moon_phase = ?
        WHERE id = ? AND user_id = ?`;

    const values = [
        entry.date, entry.cityState, entry.selectedLat, entry.selectedLon,
        entry.fishingLat, entry.fishingLon, entry.fishingAddress, entry.startTime,
        entry.endTime, entry.waterTemp, entry.waterFlow, entry.targetSpecies,
        entry.angler, entry.fliesUsed, entry.notes, entry.riverName, entry.siteNumber,
        JSON.stringify(entry.weatherData), JSON.stringify(entry.moonPhase),
        entryId, req.user.id
    ];

    db.run(sql, values, function(err) {
        if (err) {
            console.error('Update entry error:', err);
            return res.status(500).json({ error: 'Failed to update entry' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ success: true });
    });
});

app.delete('/api/entries/:id', authenticateToken, (req, res) => {
    const entryId = req.params.id;
    
    db.run('DELETE FROM fishing_entries WHERE id = ? AND user_id = ?', 
           [entryId, req.user.id], function(err) {
        if (err) {
            console.error('Delete entry error:', err);
            return res.status(500).json({ error: 'Failed to delete entry' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }
        res.json({ success: true });
    });
});

// RIVERS ROUTES
app.get('/api/rivers', authenticateToken, (req, res) => {
    db.all('SELECT * FROM saved_rivers WHERE user_id = ? ORDER BY created_at DESC', 
           [req.user.id], (err, rows) => {
        if (err) {
            console.error('Get rivers error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, rivers: rows });
    });
});

app.post('/api/rivers', authenticateToken, (req, res) => {
    const { siteNumber, siteName, riverName, state } = req.body;
    
    const sql = `INSERT INTO saved_rivers (user_id, site_number, site_name, river_name, state) 
                 VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [req.user.id, siteNumber, siteName, riverName, state], function(err) {
        if (err) {
            console.error('Save river error:', err);
            return res.status(500).json({ error: 'Failed to save river' });
        }
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/rivers/:id', authenticateToken, (req, res) => {
    const riverId = req.params.id;
    
    db.run('DELETE FROM saved_rivers WHERE id = ? AND user_id = ?', 
           [riverId, req.user.id], function(err) {
        if (err) {
            console.error('Delete river error:', err);
            return res.status(500).json({ error: 'Failed to delete river' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'River not found' });
        }
        res.json({ success: true });
    });
});

// LICENSES ROUTES
app.get('/api/licenses', authenticateToken, (req, res) => {
    db.all('SELECT * FROM fishing_licenses WHERE user_id = ? ORDER BY expiration_date DESC', 
           [req.user.id], (err, rows) => {
        if (err) {
            console.error('Get licenses error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, licenses: rows });
    });
});

app.post('/api/licenses', authenticateToken, upload.single('document'), (req, res) => {
    const { licenseType, state, licenseNumber, issueDate, expirationDate, cost } = req.body;
    const documentPath = req.file ? req.file.path : null;
    
    const sql = `INSERT INTO fishing_licenses (user_id, license_type, state, license_number, 
                 issue_date, expiration_date, cost, document_path) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const values = [req.user.id, licenseType, state, licenseNumber, issueDate, expirationDate, cost, documentPath];
    
    db.run(sql, values, function(err) {
        if (err) {
            console.error('Create license error:', err);
            return res.status(500).json({ error: 'Failed to create license' });
        }
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/licenses/:id', authenticateToken, (req, res) => {
    const licenseId = req.params.id;
    
    // First get the license to delete associated file
    db.get('SELECT document_path FROM fishing_licenses WHERE id = ? AND user_id = ?', 
           [licenseId, req.user.id], (err, license) => {
        if (err) {
            console.error('Get license error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // Delete the license record
        db.run('DELETE FROM fishing_licenses WHERE id = ? AND user_id = ?', 
               [licenseId, req.user.id], function(err) {
            if (err) {
                console.error('Delete license error:', err);
                return res.status(500).json({ error: 'Failed to delete license' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'License not found' });
            }
            
            // Delete associated file if exists
            if (license && license.document_path) {
                fs.unlink(license.document_path, (err) => {
                    if (err) console.error('File deletion error:', err);
                });
            }
            
            res.json({ success: true });
        });
    });
});

// PROFILE ROUTES
app.get('/api/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, username, email, full_name, location, phone, bio, photo_data FROM users WHERE id = ?', 
           [req.user.id], (err, user) => {
        if (err) {
            console.error('Get profile error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, profile: user });
    });
});

app.put('/api/profile', authenticateToken, (req, res) => {
    const { fullName, location, phone, bio, photoData } = req.body;
    
    const sql = `UPDATE users SET full_name = ?, location = ?, phone = ?, bio = ?, photo_data = ? 
                 WHERE id = ?`;
    
    db.run(sql, [fullName, location, phone, bio, photoData, req.user.id], function(err) {
        if (err) {
            console.error('Update profile error:', err);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
        res.json({ success: true });
    });
});

app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    db.get('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) {
            console.error('Change password error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        try {
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            
            db.run('UPDATE users SET password = ? WHERE id = ?', 
                   [hashedNewPassword, req.user.id], function(err) {
                if (err) {
                    console.error('Update password error:', err);
                    return res.status(500).json({ error: 'Failed to update password' });
                }
                res.json({ success: true, message: 'Password updated successfully' });
            });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ error: 'Password change failed' });
        }
    });
});

app.delete('/api/auth/delete-account', authenticateToken, async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
        return res.status(400).json({ error: 'Password required for account deletion' });
    }

    db.get('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) {
            console.error('Delete account error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Password is incorrect' });
            }

            // Delete user and all associated data
            db.serialize(() => {
                db.run('DELETE FROM fishing_entries WHERE user_id = ?', [req.user.id]);
                db.run('DELETE FROM saved_rivers WHERE user_id = ?', [req.user.id]);
                db.run('DELETE FROM fishing_licenses WHERE user_id = ?', [req.user.id]);
                db.run('DELETE FROM users WHERE id = ?', [req.user.id], function(err) {
                    if (err) {
                        console.error('Delete user error:', err);
                        return res.status(500).json({ error: 'Failed to delete account' });
                    }
                    res.json({ success: true, message: 'Account deleted successfully' });
                });
            });
        } catch (error) {
            console.error('Delete account error:', error);
            res.status(500).json({ error: 'Account deletion failed' });
        }
    });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎣 Fishing Log Backend Server running on port ${PORT}`);
    console.log(`📁 Database: ${path.join(__dirname, 'fishing_log.db')}`);
    console.log(`🌐 Frontend should connect to: http://localhost:${PORT}/api`);
    console.log(`🔧 Admin login: admin/admin123`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📴 Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('📊 Database connection closed.');
        }
        process.exit(0);
    });
});