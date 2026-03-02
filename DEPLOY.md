# Deploy to Render (Free) — Step by Step

**Total cost: $0/month**
- Render free web service (750 hrs/month)
- Neon free PostgreSQL (512 MB, no expiry)
- Self-ping keep-alive to prevent Render sleep

---

## Step 1: Create Discord Bot

1. Go to https://discord.com/developers/applications
2. **New Application** → name it "Prediction Markets"
3. **Bot** tab → **Add Bot** → copy the **Bot Token**
4. Enable **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent
5. **OAuth2 > URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Use External Emojis`, `Read Message History`
6. Copy the invite URL → open it → add bot to your Discord server

Note your **Application ID** (General Information page) = `DISCORD_CLIENT_ID`

---

## Step 2: Create Neon PostgreSQL (Free)

1. Go to https://neon.tech → Sign up (free, no credit card)
2. **New Project** → name it `prediction-markets`
3. Copy the **connection string** — looks like:
   ```
   postgresql://username:password@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. That's it. Neon free tier gives you 512 MB, always-on, no expiry.

---

## Step 3: Push Code to GitHub

```bash
cd ~/discord-prediction-markets
git add -A
git commit -m "Initial commit"
```

Create a repo on GitHub, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/discord-prediction-markets.git
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy to Render (Free)

### Option A: Blueprint (Recommended)

1. Go to https://dashboard.render.com → **New** → **Blueprint**
2. Connect your GitHub repo
3. Render detects `render.yaml` and creates a **free web service**
4. Set these env vars when prompted:
   - `DISCORD_TOKEN` → your bot token from Step 1
   - `DISCORD_CLIENT_ID` → your application ID from Step 1
   - `DISCORD_CLIENT_SECRET` → from OAuth2 page
   - `DATABASE_URL` → your Neon connection string from Step 2
5. Click **Apply** — Render builds and deploys

### Option B: Manual

1. Render Dashboard → **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add these **Environment Variables:**
   ```
   NODE_ENV          = production
   DISCORD_TOKEN     = <bot token>
   DISCORD_CLIENT_ID = <app id>
   DATABASE_URL      = <neon connection string>
   ```
5. Deploy

---

## Step 5: Register Slash Commands (once)

After the first deploy succeeds, go to Render → your service → **Shell** tab:

```bash
node src/bot/commands/deploy.js
```

Or run locally:
```bash
DISCORD_TOKEN=xxx DISCORD_CLIENT_ID=yyy node src/bot/commands/deploy.js
```

---

## Step 6: Set RENDER_EXTERNAL_URL

1. Go to your Render service → **Settings** tab
2. Copy the URL at the top (e.g., `https://prediction-markets-xxxx.onrender.com`)
3. Go to **Environment** → add:
   ```
   RENDER_EXTERNAL_URL = https://prediction-markets-xxxx.onrender.com
   ```
4. This enables the self-ping keep-alive that prevents Render from sleeping

---

## Step 7: Test It

In your Discord server:

```
/predict deposit 100          → Get $100 demo balance
/predict create               → Create a prediction market
  → Fill in: question, category, duration
Click YES or NO button        → Opens trade sheet
Click amount + Place Order    → Executes trade
/predict portfolio            → See your positions
/predict leaderboard          → Server rankings
/predict resolve 1 YES        → Admin resolves market
```

---

## How It Stays Alive (Free)

```
Every 14 minutes:
  Node.js self-ping → GET /health → Render sees traffic → stays awake

Without this, Render sleeps after 15 min → Discord bot disconnects.
```

The keep-alive starts automatically when `RENDER_EXTERNAL_URL` is set.
Without it (local dev), keep-alive is disabled — no harm.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│       Render Free Web Service                   │
│  ┌───────────────────────────────────────────┐  │
│  │  Node.js                                  │  │
│  │  ├── Express API (:3000)                  │  │
│  │  ├── WebSocket price feed (/ws/prices)    │  │
│  │  ├── Discord.js bot (gateway)             │  │
│  │  ├── Market scheduler (60s cron)          │  │
│  │  └── Self-ping keep-alive (14 min)        │  │
│  └───────────────────────────────────────────┘  │
│                      │                          │
└──────────────────────┼──────────────────────────┘
                       │ SSL
                       ▼
┌─────────────────────────────────────────────────┐
│       Neon Free PostgreSQL                      │
│  512 MB · Always-on · No expiry                 │
└─────────────────────────────────────────────────┘
```

---

## Limits of Free Tier

| Resource | Limit | Impact |
|----------|-------|--------|
| Render CPU | Shared | Fine for <100 concurrent users |
| Render RAM | 512 MB | Fine for the bot + API |
| Render bandwidth | 100 GB/mo | More than enough |
| Neon storage | 512 MB | ~500K trades before hitting this |
| Neon compute | 0.25 vCPU | Fine for light queries |
| Cold start | ~30s (if ping fails) | Bot reconnects automatically |

For a demo/pitch, this is more than sufficient. When you need production
scale, upgrade Render to Starter ($7/mo) and Neon to Launch ($19/mo).
