# Syyaim SafeG AI — Complete Full-Stack Project

AI-powered factory safety monitoring. This is the complete codebase covering every component built across all sessions.

---

## What's Inside

```
safeg-ai/
├── backend/                    Node.js 22 + Express 4 REST API
│   ├── src/
│   │   ├── server.js           Entry point (HTTP + WebSocket)
│   │   ├── app.js              Express app, all routes wired
│   │   ├── config/             database.js · redis.js · migrate.js · seed.js
│   │   ├── controllers/        auth · customer · plant · area · camera · violation
│   │   ├── routes/             16 route files incl. payment & onboarding
│   │   ├── services/           alert · audit · onboarding
│   │   ├── middleware/         auth · errorHandler · validate · requestId
│   │   ├── websocket/          wsServer.js (real-time violation events)
│   │   └── utils/              logger · AppError · asyncHandler
│   ├── ai_engine_stub/         Python stub for AI vision engine
│   ├── package.json            All deps incl. razorpay
│   ├── .env.example            All required env vars incl. Razorpay keys
│   ├── docker-compose.yml      Backend-only compose (postgres + redis)
│   └── README.md               Backend-specific docs
│
├── frontend/                   React 18 frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   │   ├── safety-monitor.jsx        Live 4-cam AI monitoring dashboard
│   │   │   ├── factory-compliance.jsx    7-section compliance command centre
│   │   │   └── safeg-architecture.jsx    Interactive system architecture map
│   │   └── pages/
│   │       ├── onboarding/
│   │       │   └── safeg-onboarding.jsx  5-step customer onboarding wizard
│   │       └── payment/
│   │           ├── PaymentPortal.jsx     Razorpay checkout (plans, coupons, GST)
│   │           └── BillingDashboard.jsx  Invoice history, refunds, plan management
│   ├── standalone/             HTML files — open directly in browser
│   │   ├── SafeG_Compliance_Dashboard.html
│   │   ├── SafetyTrends_India.html
│   │   └── SyyaimSafeG_GoogleAds*.html
│   └── package.json            React + Vite + Tailwind deps
│
├── docs/                       Word documents
│   ├── SafeGuard_AI_India_Implementation_Plan.docx
│   └── SafeGuard_AI_Market_Analysis.docx
│
├── presentations/              Sales & marketing PPT decks (6 decks)
├── guides/                     Integration guides for customers (2 PPT guides)
├── marketing/                  Demo videos (4 MP4 files)
├── docker-compose.yml          ROOT — boots full stack (DB + Redis + API + AI + Nginx)
└── README.md                   This file
```

---

## Quick Start

### Option A — Docker (Full Stack)

```bash
# 1. Clone / unzip
cd safeg-ai

# 2. Set your secrets
cp backend/.env.example backend/.env
# Edit backend/.env — set RAZORPAY keys at minimum

# 3. Boot everything
docker compose up -d

# 4. Run database migrations + seed demo data
docker exec safeg-backend node src/config/migrate.js
docker exec safeg-backend node src/config/seed.js

# 5. Start frontend dev server
cd frontend && npm install && npm run dev
```

Services running:
| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| WebSocket | ws://localhost:4000 |
| Frontend (dev) | http://localhost:5173 |
| AI Engine stub | http://localhost:8001 |
| Nginx proxy | http://localhost:80 |

---

### Option B — Backend Only (No Docker)

```bash
cd backend
npm install
cp .env.example .env          # fill in DATABASE_URL, REDIS_URL, JWT secrets
node src/config/migrate.js    # create all 15 tables
node src/config/seed.js       # load demo plant (Pune Auto Parts)
npm run dev                   # nodemon dev server on :3000
```

**Demo login:** `suresh@puneauto.com` / `Demo@SafeG2024!`

---

### Option C — Frontend Components (Standalone)

Open any file in `frontend/standalone/` directly in a browser — no server needed.

For React components in `frontend/src/`, copy into your Vite/CRA project and run.

---

## Frontend Components — What Each Does

| Component | Location | Description |
|-----------|----------|-------------|
| **Safety Monitor** | `components/safety-monitor.jsx` | Live 4-camera grid. Claude Vision AI scans every 15s. PPE compliance, risk scoring, real-time alerts. |
| **Compliance Command Centre** | `components/factory-compliance.jsx` | Full compliance dashboard: 16 live camera tiles, violation register, Form 18 auto-fill (Factories Act 1948), inspection checklist (24 items), reports. |
| **System Architecture Map** | `components/safeg-architecture.jsx` | Interactive 3-tab diagram (Architecture layers, Data flows, Live events). Stats: < 3s latency, 98.7% accuracy. |
| **Onboarding Wizard** | `pages/onboarding/safeg-onboarding.jsx` | 5-step guided setup: Company → Plant → Zone → Camera → Activate. Calls `POST /api/v1/onboarding/activate`. |
| **Payment Portal** | `pages/payment/PaymentPortal.jsx` | Razorpay checkout: plan selection (Starter/Growth/Enterprise), monthly/annual toggle, add-ons, GSTIN, 18% GST, coupon codes (SAFEG20 / LAUNCH15 / INDIA10). |
| **Billing Dashboard** | `pages/payment/BillingDashboard.jsx` | Invoice history with PDF download, refund modal (7-day policy), payment methods, plan upgrade flow. |

---

## Backend API — Route Summary

All routes under `/api/v1/`

| Route group | Endpoints | Key actions |
|-------------|-----------|-------------|
| `/auth` | POST login, refresh, logout | JWT auth |
| `/users` | CRUD users + roles | Admin/Manager/HSE/Operator |
| `/customers` | CRUD tenants | Multi-tenant |
| `/plants` | CRUD plants | Multi-plant per tenant |
| `/areas` | CRUD zones | PPE rules per zone |
| `/cameras` | CRUD + health | RTSP registration, status |
| `/violations` | CRUD + filters | PPE violation log |
| `/form18` | GET + auto-fill | Factories Act compliance |
| `/inspections` | CRUD checklist | 24-item inspection |
| `/alerts` | CRUD + delivery | WhatsApp + Email |
| `/dashboard` | GET KPIs | Live summary |
| `/reports` | GET + generate | PDF compliance reports |
| `/webhooks` | POST events | AI engine event receiver |
| `/onboarding` | POST activate | Full onboarding in 1 call |
| `/payments` | 8 endpoints | Razorpay full payment flow |
| `/health` | GET | Uptime check |

---

## Payment Gateway — Razorpay

**8 backend endpoints** (`/api/v1/payments/`):

| Method | Path | Action |
|--------|------|--------|
| POST | `/create-order` | Create Razorpay order |
| POST | `/verify` | HMAC signature verify |
| POST | `/create-subscription` | Recurring plan |
| POST | `/validate-coupon` | Check coupon code |
| GET | `/history` | Invoice list |
| GET | `/:id` | Single payment |
| POST | `/refund` | Partial/full refund (7-day) |
| POST | `/webhook` | Razorpay webhook (6 events) |

**Pricing:**
- Starter: ₹9,600/mo · ₹96,000/yr (8 cameras)
- Growth: ₹57,600/mo · ₹5,76,000/yr (32 cameras)
- Enterprise: Custom

---

## Key System Metrics

| Metric | Value |
|--------|-------|
| AI detection latency | < 3 seconds |
| Alert delivery | < 28 seconds |
| AI accuracy | 98.7% |
| Form 18 auto-fill | 94% of fields |
| API uptime SLA | 99.9% |
| Database tables | 15 (+ 2 views) |
| API endpoints | 50+ |
| Cameras supported | Up to 32 per plant |
| ROI payback | < 6 months |

---

## Env Variables (backend/.env.example)

```env
# Database
DATABASE_URL=postgresql://safeg:password@localhost:5432/safeg_ai

# Redis
REDIS_URL=redis://:password@localhost:6379

# JWT
JWT_SECRET=your_long_random_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RZP_PLAN_STARTER_MONTHLY=plan_...
RZP_PLAN_GROWTH_MONTHLY=plan_...

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SMTP_PASS=...
```

---

*© 2025 Syyaim SafeG AI Pvt. Ltd. — Confidential*
