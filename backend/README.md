# SafeG AI — Backend API

Complete Node.js backend for the SafeG AI factory compliance monitoring system.

## Stack
- **Runtime**: Node.js 22 + Express 4
- **Database**: PostgreSQL 16 (multi-tenant, partitioned)
- **Cache / PubSub**: Redis 7
- **Real-time**: WebSocket (ws library)
- **AI Engine**: Python FastAPI stub (replace with YOLOv8 in production)
- **Auth**: JWT (access + refresh tokens)
- **Alerts**: Nodemailer (email) + Twilio / Meta Cloud API (WhatsApp)

---

## Quick Start

### 1. Prerequisites
```bash
node >= 18, PostgreSQL 16, Redis 7
# OR just Docker Desktop
```

### 2. Install
```bash
cd safeg-backend
npm install
cp .env.example .env
# Edit .env with your DB credentials
```

### 3. Run migrations + seed
```bash
npm run migrate    # Creates all tables, triggers, views
npm run seed       # Loads demo data (Pune Auto Components)
```

### 4. Start
```bash
npm run dev        # Development (nodemon)
npm start          # Production
```

### 5. Docker (full stack)
```bash
docker compose up -d              # All services
docker compose --profile dev up   # + pgAdmin on :5050
docker compose logs -f api        # Watch logs
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/onboarding/activate` | **Main wizard endpoint** — creates everything in one call |
| POST | `/api/v1/auth/login` | Login |
| GET  | `/api/v1/auth/me` | Current user |
| GET  | `/api/v1/customers` | List customers |
| CRUD | `/api/v1/plants` | Plants |
| CRUD | `/api/v1/areas` | Areas/zones |
| CRUD | `/api/v1/cameras` | Cameras |
| POST | `/api/v1/cameras/:id/test-connection` | Test RTSP stream |
| PUT  | `/api/v1/cameras/:id/ai-config` | Update AI detection rules |
| GET  | `/api/v1/violations` | List violations |
| PUT  | `/api/v1/violations/:id/resolve` | Resolve violation |
| GET  | `/api/v1/violations/:id/form18` | Pre-populate Form 18 |
| CRUD | `/api/v1/form18` | Form 18 reports |
| POST | `/api/v1/form18/:id/submit` | Submit to inspector portal |
| GET  | `/api/v1/dashboard/kpis` | Live dashboard KPIs |
| GET  | `/api/v1/dashboard/timeline` | 24h event timeline |
| GET  | `/api/v1/dashboard/ppe-trend` | 7-day PPE trend |
| CRUD | `/api/v1/inspections` | Daily inspection sessions |
| POST | `/api/v1/reports/generate` | Generate compliance report |
| POST | `/api/v1/webhooks/ai-detection` | AI engine → violation event |
| POST | `/api/v1/webhooks/camera-health` | Camera heartbeat |
| GET  | `/api/health` | Health check |
| GET  | `/api/docs` | Swagger UI |

### WebSocket
```
ws://localhost:4000/ws?token=<jwt>
```
Messages: `violations`, `camera_health`, `ppe_events`, `alerts`, `onboarding_complete`

---

## How Onboarding Connects

```
Wizard "Activate" button
        │
        ▼
POST /api/v1/onboarding/activate
  { customer, plant, areas[], cameras[], password }
        │
        ▼  (single DB transaction)
  1. CREATE tenant (multi-tenant isolation)
  2. CREATE customer record
  3. CREATE admin user (hashed password)
  4. CREATE plant (factory licence, GPS, compliance data)
  5. CREATE HSE officer user
  6. CREATE areas[] with PPE rules per zone
  7. CREATE cameras[] with RTSP URLs + AI config
  8. SEED inspection checklist (24 items)
        │
        ▼  (post-transaction)
  9.  Notify AI Engine → register each camera
  10. Send welcome email to admin
  11. WebSocket broadcast → dashboard goes live
  12. Audit log entry
  13. Return JWT tokens → user is logged in immediately
```

---

## Security
- JWT access tokens (24h) + refresh tokens (30d)
- bcrypt password hashing (12 rounds)
- Multi-tenant row isolation (`tenant_id` on every table)
- Role-based access: `superadmin`, `customer_admin`, `plant_manager`, `hse_officer`, `operator`, `viewer`
- Rate limiting: 200 req/15min per IP
- Helmet.js headers
- Audit log on every create/update

---

## Demo Credentials (after seed)
```
Email:    suresh@puneauto.com
Password: Demo@SafeG2024!
```

---

## Tests
```bash
npm test
```
Covers: auth, onboarding, plants, areas, cameras, violations, form18, dashboard.
