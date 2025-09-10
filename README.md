# Fishing Log Application

A full-stack web application for tracking fishing trips, managing licenses, and monitoring river conditions.

## Features

- 🎣 **Fishing Trip Tracking**: Log your fishing trips with detailed information
- 📄 **License Management**: Upload and manage fishing licenses (viewable for DNR wardens)
- 🌊 **River Flow Monitoring**: Track river conditions and flow rates
- 📱 **Mobile Responsive**: Works great on phones and tablets
- 👤 **User Profiles**: Manage your personal information and preferences

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (production ready)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: Session-based with bcrypt
- **File Uploads**: Multer for license documents

## Quick Start

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. Visit: `http://localhost:3004`

### Default Admin Account
- Username: `admin`
- Password: `admin123`
- **⚠️ Change this immediately in production!**

## Railway Deployment

### Step 1: Prepare for Deployment

1. **Login to Railway**: Visit [railway.app](https://railway.app) and create an account

2. **Create a new project**: 
   - Connect your GitHub repository OR
   - Use Railway CLI (requires login in browser)

### Step 2: Environment Variables

Set these environment variables in Railway dashboard:

```env
NODE_ENV=production
SESSION_SECRET=your-super-secure-session-secret-here
PORT=3004
```

### Step 3: Deploy

Railway will automatically:
- Detect your Node.js app
- Install dependencies
- Start your application
- Provide HTTPS domain

### Step 4: Post-Deployment

1. **Update CORS origins** in your Railway dashboard environment variables if needed
2. **Change admin password** immediately
3. **Test all functionality** including file uploads

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `PORT`: Server port (default: 3004)
- `NODE_ENV`: Environment (development/production)
- `SESSION_SECRET`: Secure session secret
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins

## File Structure

```
fishing-log-app/
├── server.js              # Main server file
├── index.html             # Frontend application
├── css/                   # Stylesheets
├── js/                    # Frontend JavaScript
│   ├── components/        # Modular components
│   └── utils/            # Utility functions
├── uploads/              # User uploaded files
├── package.json          # Dependencies and scripts
├── railway.json          # Railway configuration
└── README.md            # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

### Fishing Entries
- `GET /api/fishing-entries` - Get user's fishing entries
- `POST /api/fishing-entries` - Create new fishing entry
- `DELETE /api/fishing-entries/:id` - Delete fishing entry

### Licenses
- `GET /api/licenses` - Get user's licenses
- `POST /api/licenses` - Create new license (with file upload)
- `DELETE /api/licenses/:id` - Delete license

### Profile
- `GET /api/profile` - Get user profile
- `POST /api/profile` - Update user profile

## License

This project is for beta testing and development purposes.

## Support

For issues or questions, please contact the development team.