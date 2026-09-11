# Cloud Sync System — Technical Reference

How HORIZON Cyber Academy syncs between client (browser) and cloud (PostgreSQL via Vercel).

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ GameEngine (TypeScript)                                │ │
│  │  - Manages game state (missions, world, dossier, etc) │ │
│  │  - localStorage: Primary (always available)           │ │
│  │  - cloudSync: Optional (push/pull to PostgreSQL)      │ │
│  └─────────���──────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP (Bearer token)
                       │
           ┌───────────▼──────────────┐
           │   Vercel (Edge)          │
           │  - Next.js API routes    │
           │  - Auth checks           │
           │  - Data validation       │
           └───────────┬──────────────┘
                       │
           ┌───────────▼──────────────┐
           │  Supabase PostgreSQL     │
           │  - profiles              │
           │  - saves                 │
           │  - certificates          │
           │  - mission_runs          │
           │  - decisions             │
           │  - analytics_events      │
           │  - game_events           │
           └──────────────────────────┘
```

---

## 📝 Save Format (SaveDocument)

```typescript
interface SaveDocument {
  version: number;           // SAVE_VERSION (for migrations)
  savedAt: number;           // Timestamp (ms since epoch)
  state: GameState;          // Full game state
}

interface GameState {
  version: number;
  profile: Profile;
  booted: boolean;
  timeMin: number;           // In-game time
  day: number;
  chapter: number;
  xp: number;
  reputation: number;
  missions: Record<string, MissionRuntime>;
  mails: Mail[];
  chat: ChatMessage[];
  // ... + world, skills, certificates, dossier, etc
}
```

---

## 🔄 Sync Lifecycle

### **On Game Boot**

```typescript
// 1. Load from localStorage (instant, always available)
const local = loadLocalSave();
const engine = new GameEngine(local.state);

// 2. Pull from cloud (async, non-blocking)
cloudSync.init({
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  token: "bearer-token-from-env",
});
const remote = await cloudSync.pullSave(profileId);

// 3. Resolve conflict (last-write-wins)
if (remote && remote.savedAt > local.savedAt) {
  engine.state = remote.state;
}
```

### **During Gameplay**

```typescript
// Every state change bumps listeners (React components)
// → Triggers queueSave (debounced 3s)
engine.save();

// → cloudSync.queueSave() batches writes
// → HTTP POST /api/save (Bearer token auth)
// → Vercel validates, stores in PostgreSQL
```

### **When Back Online**

```typescript
// Browser "online" event fires
window.addEventListener("online", () => {
  cloudSync.flushPending(); // Retry queued saves
});
```

---

## 🔐 Authentication

### **Bearer Token (Current)**

Simple token-based auth for MVP:

```typescript
// Client
const headers = {
  "Authorization": "Bearer " + process.env.API_SECRET_TOKEN,
  "Content-Type": "application/json",
};

// Server (/api/save, /api/certificates)
const token = req.headers.get("authorization")?.split(" ")[1];
if (token !== process.env.API_SECRET_TOKEN) {
  return Response(401, "Unauthorized");
}
```

### **JWT (Recommended for Production)**

Replace Bearer token with proper JWTs (email-based):

```typescript
// Client
const token = await jwt.sign(
  { sub: profileId, email },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

// Server
const payload = jwt.verify(token, process.env.JWT_SECRET);
if (payload.sub !== profileId) {
  return Response(401, "Unauthorized");
}
```

---

## 📤 POST /api/save

Save game state (player → cloud).

### Request

```bash
curl -X POST https://your-app.vercel.app/api/save \
  -H "Authorization: Bearer $API_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": { "name": "Alice", "avatar": "a1", "lang": "fr" },
    "state": { /* full GameState */ }
  }'
```

### Response (Success)

```json
{
  "ok": true,
  "profileId": "alice",
  "savedAt": 1694500000000
}
```

### Response (Error)

```json
{
  "ok": false,
  "error": "unauthorized"
}
```

---

## 📥 GET /api/save

Load game state (cloud → player).

### Request

```bash
curl https://your-app.vercel.app/api/save?profileId=alice \
  -H "Authorization: Bearer $API_SECRET_TOKEN"
```

### Response

```json
{
  "ok": true,
  "state": { /* full GameState */ },
  "updatedAt": "2024-09-11T14:30:00Z"
}
```

---

## 🎓 GET /api/verify/[certId]

Public certificate verification (no auth).

### Request

```bash
curl https://your-app.vercel.app/api/verify/HZN-XXXX-YYYY
```

### Response

```json
{
  "ok": true,
  "id": "HZN-XXXX-YYYY",
  "holderName": "Alice",
  "titleKey": "cert.cyberExplorer",
  "level": "practice",
  "skills": [
    { "id": "dns", "label": "DNS", "level": "practice" },
    { "id": "dhcp", "label": "DHCP", "level": "mastery" }
  ],
  "score": 85,
  "issuedAt": "2024-09-10T12:00:00Z",
  "verifiedAt": "2024-09-11T14:30:00Z"
}
```

---

## 🔍 Conflict Resolution

**Default: Last-Write-Wins**

```typescript
function resolveConflict(local, remote) {
  const localTime = local.savedAt ?? 0;
  const remoteTime = remote.savedAt ?? 0;
  
  if (localTime >= remoteTime) {
    return { chosen: local, reason: "local-newer" };
  } else {
    return { chosen: remote, reason: "remote-newer" };
  }
}
```

### Scenarios

| Scenario | Resolution | Why |
|----------|-----------|-----|
| Local (5min ago) vs Remote (2min ago) | Use **Remote** | Newer |
| Local (online now) vs Remote (old) | Use **Local** | Just saved |
| Local = Remote | Use **Local** | Identical |
| Offline 2 hours, then online | Use **Remote** | Server is source of truth if online |

---

## 💾 Database Schema (Supabase)

```sql
-- Profiles (accounts)
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'fr',
  email TEXT UNIQUE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP
);

-- Saves (full game state)
CREATE TABLE saves (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id),
  version INTEGER NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Certificates (verifiable, public)
CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  title_key TEXT NOT NULL,
  level TEXT NOT NULL,
  skills JSONB NOT NULL,
  score INTEGER NOT NULL,
  issued_at TIMESTAMP DEFAULT NOW()
);

-- Mission runs (for analytics)
CREATE TABLE mission_runs (
  id SERIAL PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id),
  mission_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  status TEXT NOT NULL,
  score INTEGER,
  errors INTEGER DEFAULT 0,
  hints_used INTEGER DEFAULT 0,
  completed_at TIMESTAMP
);

-- Game events (audit log, optional)
CREATE TABLE game_events (
  id SERIAL PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id),
  mission_id TEXT,
  type TEXT NOT NULL,
  host_id TEXT,
  command TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📊 Querying Analytics (SQL)

### Top players by chapter

```sql
SELECT name, chapter, xp, reputation
FROM profiles p
JOIN saves s ON p.id = s.profile_id
ORDER BY (s.state->>'chapter')::int DESC
LIMIT 10;
```

### Mission completion stats

```sql
SELECT
  mission_id,
  COUNT(*) as attempts,
  AVG((score)::float) as avg_score,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completions
FROM mission_runs
GROUP BY mission_id
ORDER BY attempts DESC;
```

### Average hints used per mission

```sql
SELECT
  mission_id,
  AVG(hints_used) as avg_hints
FROM mission_runs
WHERE status = 'completed'
GROUP BY mission_id
ORDER BY avg_hints DESC;
```

---

## 🚀 Performance Tips

1. **Debounce saves** (3s default) → Reduces writes
2. **Compress state** before POST → Smaller payloads
3. **Index `profile_id`** in all tables → Faster queries
4. **Cache pulls** (1 min TTL) → Avoid hammering DB
5. **Monitor Vercel logs** → Watch for errors

---

## 🔗 Related Docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — How to deploy to Vercel + Supabase
- [README.md](./README.md) — Project overview
- API Docs: [/src/app/api](./src/app/api/) — Endpoint implementations

---

**Next:** [Deploy to Vercel](./DEPLOYMENT.md) in 5 minutes. 🚀
