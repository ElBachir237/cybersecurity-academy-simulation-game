# HORIZON Cyber Academy — Deployment Guide

Deploy on **Vercel** + **Supabase** for fully hosted cloud gameplay. Play from anywhere, sync across devices.

---

## 🚀 Quick Start (5 minutes)

### 1. **Create Supabase Project**

1. Go to [supabase.com](https://supabase.com) → Sign up / Log in
2. **New Project** → Choose region (Europe, US, etc.)
3. Set password (save it!)
4. Copy **Connection String** from **Database** → **Connection pooling** (Session)
   - Format: `postgresql://user:password@host:5432/postgres?schema=public`

### 2. **Create Vercel Project**

1. Go to [vercel.com](https://vercel.com) → Import repo
2. Select `ElBachir237/cybersecurity-academy-simulation-game`
3. Click **Deploy**

### 3. **Link Database**

In Vercel dashboard:
1. **Settings** → **Environment Variables**
2. Add `DATABASE_URL` = your Supabase connection string
3. Add `API_SECRET_TOKEN` = generate a random token (e.g., `openssl rand -hex 32`)
4. **Save & Deploy**

### 4. **Run Migrations**

```bash
# In your local repo:
npm install -D drizzle-kit

# Generate & run migrations
npx drizzle-kit generate:pg
npx drizzle-kit migrate:pg

# Or on Vercel (via CLI):
vercel env pull .env.local
npx drizzle-kit migrate:pg
```

---

## ✅ What You Get

| Feature | Status | Details |
|---------|--------|--------|
| **Game playable offline** | ✅ | localStorage cache, sync when online |
| **Multi-device sync** | ✅ | Same profile, different devices |
| **Cloud saves** | ✅ | Automatic on POST /api/save |
| **Public cert verification** | ✅ | Share certs: /verify/[certId] |
| **Analytics** | 🟡 | Ready in schema, needs logging |
| **Formateur dashboard** | 🟡 | Query PostgreSQL, build admin panel |

---

## 🔑 Environment Variables

Create `.env.local` locally; add to Vercel **Environment Variables**:

```bash
# Required
DATABASE_URL=postgresql://...

# Required for API auth
API_SECRET_TOKEN=your-secret-token-here

# Optional
NEXT_PUBLIC_API_URL=https://your-vercel-app.vercel.app
```

---

## 📱 Client-Side (Game Engine)

The engine **automatically syncs** with PostgreSQL (if configured):

```typescript
import { cloudSync } from "@/game/sync";

// Boot time (in app layout or route):
cloudSync.init({
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  token: "your-jwt-or-bearer-token",
});

// Save queued automatically (debounced, 3s):
engine.save();

// Pull on startup (if remote newer):
const remote = await cloudSync.pullSave(profileId);
if (remote) {
  // Merge or replace local save
}
```

---

## 🛡️ Security Checklist

- [ ] `DATABASE_URL` is **private** (never commit to .env)
- [ ] `API_SECRET_TOKEN` is strong (32+ random chars)
- [ ] `/api/save` and `/api/certificates` require Bearer token
- [ ] `/api/verify/[certId]` is **public** (no auth) — certificate holders share links
- [ ] Supabase **Row Level Security (RLS)** can add profile-based access (future)
- [ ] Enable Vercel **Environment Variable Protection** (Pro plan)

---

## 🌍 URLs After Deployment

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `https://your-app.vercel.app/` | Game (play here) | ✅ localStorage |
| `https://your-app.vercel.app/api/save` | Cloud sync | ✅ Bearer token |
| `https://your-app.vercel.app/api/verify/HZN-XXXX-YYYY` | Public cert | ❌ Public |

---

## 📊 Analytics Setup (Future)

Events logged to `analytics_events` table:

```sql
-- Example: Player progression
SELECT
  profile_id,
  COUNT(*) as total_commands,
  AVG((payload->>'errors')::int) as avg_errors
FROM analytics_events
WHERE kind = 'cmd'
GROUP BY profile_id;
```

---

## 🔄 Offline → Online Sync

1. **Player plays offline** → saves to `localStorage`
2. **Connection restored** → `cloudSync` detects & flushes
3. **Conflict?** → Last-write-wins (newer `savedAt` timestamp)
4. **Next load** → Game checks remote first, merges cleanly

---

## 🐛 Troubleshooting

### Database connection fails
```
Error: ECONNREFUSED
```
→ Check `DATABASE_URL` in Vercel, not expired, firewall open

### API returns 401 (Unauthorized)
```
{"ok": false, "error": "unauthorized"}
```
→ Bearer token missing or incorrect. Check `Authorization: Bearer <token>` header

### Certificate not found
```
GET /api/verify/HZN-XXXX → 404
```
→ Cert not issued yet, or wrong ID. Check game is saving to DB.

### Deployment stuck
→ Check Vercel **Deployments** → logs for build errors

---

## 📚 Next Steps

1. ✅ Deploy (5 min)
2. 🔧 Add JWT auth (replace Bearer token with proper JWTs)
3. 📊 Build formateur dashboard (query analytics)
4. 🤝 Add team play (co-op missions, shared state)
5. 🎓 Add progression API for LMS integration

---

## 📞 Support

- **Vercel docs**: [vercel.com/docs](https://vercel.com/docs)
- **Supabase docs**: [supabase.com/docs](https://supabase.com/docs)
- **Drizzle ORM**: [orm.drizzle.team](https://orm.drizzle.team)

---

**Ready?** [Deploy to Vercel](https://vercel.com/new) now! 🚀