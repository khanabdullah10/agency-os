# Hostinger Web App Production Deployment Guide
**MAD O MEDIA • Agency OS**

This guide provides step-by-step instructions to deploy Agency OS to **Hostinger Business Web Hosting** using Hostinger's native **Node.js Web App** runner with a **fresh, zero-demo database** and **high-concurrency connection pooling**.

---

## 📋 Overview & Prerequisites

- **Hostinger Plan**: Hostinger Business (Expires 2027)
- **Deployment Type**: Node.js Web App (`+ Create website` → `Web App`)
- **Runtime Version**: Node.js 20 LTS or Node.js 22 LTS
- **Database**: Hostinger MySQL 8.0
- **Target Subdomain**: `crm.mad0media.com` (or your chosen domain)
- **Database State**: 100% clean factory setup (zero mock data, zero dummy clients/campaigns)

---

## Step 1: Create Your Production MySQL Database in Hostinger

1. Log in to your **Hostinger hPanel**.
2. Navigate to **Databases** → **Management**.
3. Under **Create a New MySQL Database and Database User**:
   - **Database Name**: Enter a name (e.g. `agencyos`). Hostinger will prefix this with your account ID (e.g., `u123456789_agencyos`).
   - **Username**: Enter an admin username (e.g. `agency_admin` → `u123456789_agency_admin`).
   - **Password**: Click the generator or enter a strong password (at least 16 characters).
4. Click **Create**.
5. **Note down**:
   - Full Database Name: `u123456789_agencyos`
   - Full Username: `u123456789_agency_admin`
   - Password: `YourSecretPassword`
   - Hostname: In Hostinger, local database host is usually `localhost` or `127.0.0.1`.

---

## Step 2: Generate Cryptographic Production Secrets

On your local machine or in terminal, run:

```bash
npm run secrets:generate
```

This will print high-entropy 64-character production keys:
```text
JWT_SECRET=978f1e06ee6986a4210c17504b268da44f998c569ba45dfd1d54a65e12643f05
CRON_SECRET=e1596b554326b13e930faadc187e68deecaef99ee0389ab43c0f0569877e3344
```
Keep these ready for the environment setup.

---

## Step 3: Create the Web App in Hostinger hPanel

As shown in your hPanel dashboard screenshot:

1. In hPanel, go to **Websites**.
2. Click the purple button **`+ Create website`**.
3. From the dropdown menu, select **`[JS] Web App`** (*Deploy your app from GitHub or GitLab, or upload files*).
4. **Choose Domain / Subdomain**:
   - Select your existing domain or subdomain (e.g. `crm.mad0media.com`).
5. **Configure Node.js Settings**:
   - **Node.js version**: Select **Node.js 20.x** or **Node.js 22.x LTS**.
   - **Application Root**: `/` (root directory of the project).
   - **Application Startup File**: `server.js` (our production launcher).
6. **Deployment Method**:
   - **Option A (GitHub/GitLab)**: Connect your Git repository, select branch `main`.
   - **Option B (File Upload / ZIP)**: Upload the project files directly via Hostinger File Manager.

---

## Step 4: Configure Production Environment Variables in Hostinger

In Hostinger hPanel, open your new Web App dashboard → **Environment Variables** (or edit the `.env` file in File Manager):

```ini
# Core Production Settings
NODE_ENV=production
PORT=3100
APP_URL=https://crm.mad0media.com
TRUST_PROXY=1

# Hostinger MySQL Database (with high-traffic connection pooling)
DATABASE_URL=mysql://u123456789_agency_admin:YourSecretPassword@localhost:3306/u123456789_agencyos?connection_limit=15&pool_timeout=30

# Cryptographic Keys (generated in Step 2)
JWT_SECRET=978f1e06ee6986a4210c17504b268da44f998c569ba45dfd1d54a65e12643f05
CRON_SECRET=e1596b554326b13e930faadc187e68deecaef99ee0389ab43c0f0569877e3344

# Initial Super Admin (The first master account created)
SEED_ADMIN_EMAIL=rahil@mad0media.com
SEED_ADMIN_NAME=Rahil Lakhdawala
SEED_ADMIN_PASSWORD=A_Strong_Temporary_Password_12_Chars_Min

# CRITICAL: Ensures zero demo or mock data is created
SEED_DEMO=false

# High-Traffic Rate Limiting (Requests per minute per IP)
RATE_LIMIT_MAX=360
```

---

## Step 5: Build Application & Initialize Clean Database

Open the Hostinger **SSH Console** or **Terminal** (under hPanel → Advanced → SSH or inside Web App):

```bash
# 1. Install dependencies
npm ci

# 2. Build the production application
npm run build

# 3. Initialize the clean production database
npm run db:setup:prod
```

### What `npm run db:setup:prod` Does:
- Automatically deploys database tables to your Hostinger MySQL database.
- Registers the 16 core permission definitions and 9 standard agency roles.
- Creates **1 single Super Admin account** (`owner@mad0media.com`).
- Enforces `mustChangePassword: true` on the account.
- **Seeds ZERO mock data**: No fake clients, no sample posts, no mock tasks.

---

## Step 6: Run Pre-Flight Verification

Before launching the web app, run:

```bash
npm run preflight
```

This verifies that:
- Hostinger MySQL connects successfully.
- `APP_URL` starts with `https://`.
- `JWT_SECRET` and `CRON_SECRET` meet encryption standards.
- Build artifacts exist in `apps/api/dist` and `apps/web/.next`.
- `SEED_DEMO` is strictly disabled.

---

## Step 7: Start the Web App in Hostinger

1. In hPanel → **Web Apps** → your app dashboard.
2. Click **Start** (or **Restart**).
3. The server launches `server.js`, binding to Hostinger's internal proxy port with process resilience.

---

## Step 8: Set Up the Automated 1-Minute Cron Job

Agency OS requires a recurring 1-minute cron job to evaluate deadlines, trigger escalation alerts, and advance scheduled posts:

1. In Hostinger hPanel, go to **Advanced** → **Cron Jobs**.
2. Set **Frequency**: `* * * * *` (Every minute).
3. Set **Command**:
   ```bash
   cd /home/uXXXXX/public_html && node scripts/cron.mjs >> /home/uXXXXX/agency-cron.log 2>&1
   ```
   *(Replace `/home/uXXXXX/public_html` with your actual application directory path shown in hPanel).*
4. Click **Save**.

---

## Step 9: First Login as Super Admin

1. Open your live site: `https://crm.mad0media.com/login`
2. Sign in with:
   - **Email**: `owner@mad0media.com`
   - **Password**: The temporary password you specified in `SEED_ADMIN_PASSWORD`
3. You will immediately be prompted to set your personal permanent password.
4. Your agency dashboard will open: **clean, pristine, and ready for your real clients and campaigns**.

---

## 🛡️ High-Traffic & Concurrency Checklist

- **Prisma Connection Pooling**: `connection_limit=15&pool_timeout=30` prevents Hostinger MySQL connection drops during traffic spikes.
- **DDoS / Brute-force Shield**: `RATE_LIMIT_MAX=360` allows comfortable agency usage while blocking scrapers and brute-force attacks.
- **HTTPS & Secure Cookies**: `Secure; SameSite=Strict; HttpOnly` cookies ensure banking-grade CSRF protection.
- **Process Resilience**: `server.js` guards against uncaught rejections so client sessions are never interrupted.
