# NextAuth.js + Google OAuth Setup

## Environment Variables

Add these to `.env.local` and Vercel:

```bash
# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth secret (generate with: openssl rand -hex 32)
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

## Google OAuth Setup (2 min)

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Create new project (or use existing)
3. Search **"OAuth consent screen"** → Set up
   - Choose **External**
   - Fill: App name, user support email, developer email
4. Go to **"Credentials"** → **"Create Credentials"** → **"OAuth 2.0 Client ID"**
   - Type: **Web application**
   - Add Authorized JavaScript origins:
     - `http://localhost:3000` (dev)
     - `https://your-app.vercel.app` (production)
   - Add Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://your-app.vercel.app/api/auth/callback/google` (production)
5. Copy **Client ID** and **Client Secret** → paste to `.env.local`

## Deploy to Vercel

1. Go to Vercel dashboard
2. **Settings** → **Environment Variables**
3. Add:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET` (generate: `openssl rand -hex 32`)
   - `NEXTAUTH_URL=https://your-app.vercel.app`

## Flow

```
1. User clicks "Sign in with Google"
   ↓
2. Redirects to /auth/signin
   ↓
3. Google OAuth login
   ↓
4. Returns to /api/auth/callback/google
   ↓
5. Session created + stored in cookies
   ↓
6. POST /api/profile creates DB profile
   ↓
7. User can now play + profile auto-syncs!
```

## Schema Update

`profiles` table already has `email` column. When user signs in with Google:
- Email verified ✅
- Profile auto-creates if needed
- Game state loads or creates new
- Next time user signs in → auto-loads their save

## Multi-Device Sync

```
Desktop (Google login):
  - Sign in with Google
  - Create profile
  - Play Chapter 1
  ↓ Auto-sync to PostgreSQL
  
Phone (same Google account):
  - Sign in with Google
  - Same email → Same profile
  - Load latest save
  - Continue Chapter 1
```

All data synced via `email` field in database.