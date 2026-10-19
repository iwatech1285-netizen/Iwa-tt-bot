# IWA BOT 🚀 — Telegram Mini App + Bot Production Suite

A complete, high-performance Telegram Mini App, Telegram Bot, REST API, and Administrator Dashboard for **IWA BOT**, featuring an authoritative server-calculated tap-to-earn game, daily check-in streaks, verified task rewards, referral mechanics, global leaderboard, and points wallet connected to Firebase Cloud Firestore.

---

## 🏗 Architecture Overview

```
                          ┌───────────────────────────┐
                          │    Telegram Mobile/Web    │
                          └─────────────┬─────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
     ┌───────────────────────┐                     ┌───────────────────────┐
     │ Telegram Mini App     │                     │ grammY Telegram Bot   │
     │ React 19 + TypeScript │                     │ /start, /app, /wallet │
     └───────────┬───────────┘                     └───────────┬───────────┘
                 │ HTTP (JWT Bearer)                           │ Direct / API
                 └──────────────────────┬──────────────────────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │   Node.js / Express API     │
                         │ - HMAC-SHA256 Auth Validator│
                         │ - Authoritative Tap Engine  │
                         │ - Anti-Cheat Rate Limiter   │
                         └──────────────┬──────────────┘
                                        ▼
                         ┌─────────────────────────────┐
                         │   Firebase Cloud Firestore  │
                         │ - Users, Balances, Ledgers  │
                         │ - Hardened Zero-Trust Rules │
                         └─────────────────────────────┘
```

---

## ⚡ Core Features

- **Authoritative Tap-to-Earn Engine**:
  - Batched taps with server-side validation against available energy.
  - Automatic time-based energy recovery calculated using server timestamps.
  - 7 progressive user tiers (`Beginner`, `Starter`, `Explorer`, `Pro`, `Expert`, `Master`, `Legend`) with tap multipliers up to 8x and coin bonuses.
- **7-Day Streak Rewards Calendar**:
  - Escalating rewards from 100 IWA (Day 1) to 2,500 IWA (Day 7).
  - UTC boundary tracking with automatic streak continuity and reset rules.
- **Verified Missions & Tasks**:
  - Telegram channel and group membership checks.
  - Verified action URLs with anti-duplicate claim prevention.
- **Referral System**:
  - Unique deep-linking `https://t.me/YOUR_BOT?start=ref_USERID`.
  - Referrer earns 1,000 IWA; invited friend receives 500 IWA starter bonus.
- **Global Top 100 Leaderboards**:
  - Podium display for top 3 with rank badges and persistent user position indicator.
- **Points Wallet & Redemption Workflow**:
  - Points ledger recording every tap, bonus, and adjustment.
  - Withdrawal reservation workflow (atomic balance holds and refund on rejection).
  - Regulatory notice indicating IWA Coin is an in-app reward unit.
- **Administrator Dashboard**:
  - Platform overview KPIs (users, coins issued, pending requests).
  - User management (search, balance adjustment with mandatory audit logs, account suspension).
  - Task publisher and global game parameter tuning.

---

## 🛠 Prerequisites

- **Node.js**: v18.0.0 or higher
- **Firebase Project**: With Cloud Firestore enabled
- **Telegram Account**: To create your bot via [@BotFather](https://t.me/BotFather)

---

## 🚀 Step-by-Step Deployment Guide

### Step 1: Clone and Install Dependencies

```bash
git clone <your-repository-url>
cd iwa-bot
npm install
```

### Step 2: Configure Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```ini
# Server & Port
NODE_ENV=production
PORT=3000

# Public Mini App URL (e.g. your Cloud Run or Hosting domain)
MINIAPP_URL=https://your-domain.com
APP_URL=https://your-domain.com

# Telegram Bot Token from @BotFather
TELEGRAM_BOT_TOKEN="7123456789:AAF_YOUR_ACTUAL_TOKEN_HERE"
TELEGRAM_BOT_USERNAME="your_iwa_bot"

# Security
JWT_SECRET="generate_a_secure_random_string_here"
ADMIN_SETUP_SECRET="your_strong_admin_password_here"

# Firebase Cloud Firestore
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_FIRESTORE_DATABASE_ID="your-database-id"
```

### Step 3: Configure Telegram Bot with @BotFather

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Create a new bot using `/newbot` and follow the prompts.
3. Save the HTTP API token into `TELEGRAM_BOT_TOKEN`.
4. Configure the Mini App Web App URL:
   - Send `/newapp` to `@BotFather`.
   - Select your bot.
   - Enter title: `IWA BOT`.
   - Provide your hosted URL (`https://your-domain.com`).
   - Choose a short name (e.g. `app`).
5. Set bot menu button:
   - Send `/setmenubutton` -> Choose your bot -> Enter your Web App URL.

### Step 4: Run Locally in Development

Start the full-stack server (Express API + Vite Dev Server + grammY bot):

```bash
npm run dev
```

The application is accessible at `http://localhost:3000`.

### Step 5: Run Automated Tests

Execute Vitest test suite verifying the tap engine, auth verification, and input schemas:

```bash
npx vitest run
```

### Step 6: Bootstrap First Administrator

Run the included bootstrapping script to configure your email as superadmin:

```bash
npx tsx scripts/create-admin.ts your_email@gmail.com superadmin
```

### Step 7: Build & Production Deployment

To build the optimized client bundle:

```bash
npm run build
```

To run in production:

```bash
npm run start
```

---

## 🔒 Security Best Practices

1. **Telegram Signature Verification**: Every API request is verified using HMAC-SHA256 with the bot secret key. Expired signatures (>24 hours) are rejected.
2. **Authoritative Engine**: Energy regeneration and coin multipliers are calculated strictly on the backend. Client-reported coins or energy are ignored.
3. **Audit Ledger**: Administrative balance adjustments require an explicit reason string and write immutable audit records to `/audit_logs`.
4. **Idempotent Rewards**: Daily claims and tasks use composite document keys (`claim_{userId}_{date}`, `comp_{userId}_{taskId}`) to prevent duplicate redemptions.

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Invalid or expired Telegram signature"** | Running outside Telegram or mismatched bot token | Open the app from Telegram or use demo preview mode in browser. Check `TELEGRAM_BOT_TOKEN`. |
| **"Insufficient energy"** | Taps sent faster than energy regeneration | Wait for energy to recharge (+1 per second) before tapping. |
| **"Missing or insufficient permissions"** | Direct client write to Firestore attempted | Ensure all mutations go through the server `/api` endpoints. |
| **Bot not responding** | Long polling skipped | Ensure `TELEGRAM_BOT_TOKEN` is set in `.env` or set up webhook. |
