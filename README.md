# Anime Walls - Professional Wallpaper Gallery

A modern, full-featured anime wallpaper gallery with user authentication, image uploads, and professional UI.

## Features

- 🔐 **User Authentication**: Email verification with random password generation
- 📤 **Image Uploads**: Drag-and-drop upload with metadata
- 🎨 **Professional UI**: Modern design with dark mode support
- 🔍 **Search & Filter**: Advanced filtering by categories and tags
- 📱 **Responsive**: Works on all devices
- ☁️ **Cloud Storage**: Supabase integration for images and data

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Email**: Nodemailer with Gmail
- **Hosting**: Render.com

## Local Development

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Supabase account

### Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASS=your-gmail-app-password
   FRONTEND_URL=http://localhost:8000
   ```

3. **Supabase Setup:**
   - Create a new Supabase project
   - Run the SQL commands from `supabase-setup.sql` in the SQL Editor
   - Create a storage bucket named `wallpapers` with public access

4. **Start the servers:**
   ```bash
   # Terminal 1: Backend
   npm start

   # Terminal 2: Frontend
   python3 -m http.server 8000
   ```

5. **Open in browser:**
   - Frontend: http://localhost:8000
   - Backend API: http://localhost:3000

## Deployment to Render

### 1. Backend Deployment

1. **Create a new Web Service** on Render
2. **Connect your GitHub repository**
3. **Configure build settings:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Environment Variables:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASS=your-gmail-app-password
   FRONTEND_URL=https://your-frontend-app.onrender.com
   ```
5. **Deploy**

### 2. Frontend Deployment

1. **Create a new Static Site** on Render
2. **Connect your GitHub repository**
3. **Configure build settings:**
   - **Build Command:** (leave empty for static)
   - **Publish Directory:** `.` (root directory)
4. **Environment Variables:**
   ```
   BACKEND_URL=https://your-backend-app.onrender.com
   ```
5. **Update script.js:**
   Change the `backendUrl` variable to use the deployed backend URL:
   ```javascript
   const backendUrl = process.env.BACKEND_URL || 'https://your-backend-app.onrender.com';
   ```

## Supabase Database Setup

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Users table extension
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallpapers table
CREATE TABLE wallpapers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'fanart',
  likes_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Verification tokens table
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('wallpapers', 'wallpapers', true);

-- RLS Policies
CREATE POLICY "Users can view public wallpapers"
  ON wallpapers FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view their own wallpapers"
  ON wallpapers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can upload"
  ON wallpapers FOR INSERT
  WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own wallpapers"
  ON wallpapers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallpapers"
  ON wallpapers FOR DELETE
  USING (auth.uid() = user_id);
```

## Email Configuration

For Gmail:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use your Gmail address as EMAIL_USER
4. Use the App Password as EMAIL_PASS

## API Endpoints

- `POST /api/send-verification-email` - Send verification email
- `GET /api/verify-email` - Verify email and create account
- `GET /api/health` - Health check

## File Structure

```
/
├── index.html          # Main HTML page
├── style.css           # Stylesheets
├── script.js           # Frontend JavaScript
├── server.js           # Backend server
├── package.json        # Node.js dependencies
└── README.md          # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes.