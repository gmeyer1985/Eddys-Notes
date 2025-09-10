# Fishing Log - 1&1 Deployment Guide

## Option 1: Static HTML Version (Recommended for Shared Hosting)

### Steps:
1. Copy `table.html` to `index.html`
2. Remove all API calls and use localStorage
3. Upload via FTP to your 1&1 web space

### Files to upload:
- `index.html` (renamed from table.html)
- `art/` folder (with fishLogLogo.png)

## Option 2: PHP Version (For Shared Hosting with Database)

### Requirements:
- 1&1 shared hosting with PHP support
- SQLite or MySQL database

### Conversion needed:
- Convert Node.js API endpoints to PHP
- Keep the same database structure
- Upload via FTP

## Option 3: Full Node.js (For VPS/Dedicated Server)

### Requirements:
- 1&1 VPS or dedicated server
- SSH access
- Node.js support

### Deployment steps:
1. Upload project files via FTP/SSH
2. Install Node.js dependencies: `npm install`
3. Configure port and database paths
4. Start with PM2: `pm2 start server.js`
5. Configure reverse proxy (Nginx/Apache)

## Check Your 1&1 Plan

Log into your 1&1 control panel and check:
- Hosting type (Shared/VPS/Dedicated)
- Supported technologies (PHP, Node.js, etc.)
- Database options (MySQL, PostgreSQL, SQLite)
- FTP access details