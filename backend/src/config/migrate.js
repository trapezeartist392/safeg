/**
 * SafeG AI — Database Migration
 * Run: node src/config/migrate.js
 */
require('dotenv').config();
const { connectDB, getDB } = require('./database');
const logger = require('../utils/logger');

const SCHEMA = `

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DO $$ BEGIN
  CREATE TYPE plan_type      AS ENUM ('starter','growth','enterprise');
  CREATE TYPE user_role      AS ENUM ('superadmin','customer_admin','plant_manager','hse_officer','operator','viewer');
  CREATE TYPE hazard_level   AS ENUM ('low','medium','high','very_high');
  CREATE TYPE severity_level AS ENUM ('low','medium','high','critical');
  CREATE TYPE alert_status   AS ENUM ('open','acknowledged','resolved','escalated');
  CREATE TYPE cam_status     AS ENUM ('online','offline','error','pending_test');
  CREATE TYPE form18_status  AS ENUM ('draft','submitted','acknowledged','closed');
  CREATE TYPE report_type    AS ENUM ('iso_45001','esic','brsr','osh_code','accident_summary','monthly_ppe','weekly_violations');
  CREATE TYPE shift_type     AS ENUM ('single','double','triple','continuous');
EXCEPTION WHEN duplicate_object THEN NULL;
END \$\$;

CREATE TABLE IF NOT EXISTS tenants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         VARCHAR(100) UNIQUE NOT NULL,
  plan         plan_type DEFAULT 'starter',
  max_cameras  INT DEFAULT 8,
  max_plants   INT DEFAULT 1,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      VARCHAR(200),
  phone          VARCHAR(20),
  role           user_role DEFAULT 'operator',
  plant_id       UUID,
  is_active      BOOLEAN DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);

CREATE TABLE IF NOT EXISTS customers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  company_name      VARCHAR(300) NOT NULL,
  industry          VARCHAR(100),
  cin               VARCHAR(21),
  gstin             VARCHAR(15),
  pan               VARCHAR(10),
  address_line1     VARCHAR(300),
  address_line2     VARCHAR(300),
  city              VARCHAR(100),
  state             VARCHAR(100),
  pincode           VARCHAR(10),
  country           VARCHAR(100) DEFAULT 'India',
  primary_contact   VARCHAR(200),
  contact_email     VARCHAR(255),
  contact_phone     VARCHAR(20),
  plan              plan_type DEFAULT 'starter',
  plan_started_at   TIMESTAMPTZ,
  plan_expires_at   TIMESTAMPTZ,
  is_active         BOOLEAN DEFAULT TRUE,
  onboarded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant  ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_name);

CREATE TABLE IF NOT EXISTS plants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id       UUID REFERENCES customers(id) ON DELETE CASCADE,
  plant_name        VARCHAR(300) NOT NULL,
  factory_licence   VARCHAR(100),
  address_line1     VARCHAR(300),
  city              VARCHAR(100),
  state             VARCHAR(100),
  pincode           VARCHAR(10),
  latitude          DECIMAL(10,6),
  longitude         DECIMAL(10,6),
  total_workers     INT DEFAULT 0,
  shift_type        shift_type DEFAULT 'single',
  shift1_start      TIME,
  shift1_end        TIME,
  hse_officer_name  VARCHAR(200),
  hse_officer_phone VARCHAR(20),
  hse_officer_email VARCHAR(255),
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plants_tenant   ON plants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plants_customer ON plants(customer_id);

CREATE TABLE IF NOT EXISTS areas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plant_id        UUID REFERENCES plants(id) ON DELETE CASCADE,
  area_name       VARCHAR(200) NOT NULL,
  zone_type       VARCHAR(100),
  floor_level     VARCHAR(50),
  hazard_level    hazard_level DEFAULT 'medium',
  ppe_required    JSONB DEFAULT '[]',
  is_danger_zone  BOOLEAN DEFAULT FALSE,
  worker_capacity INT DEFAULT 0,
  description     TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_areas_plant  ON areas(plant_id);
CREATE INDEX IF NOT EXISTS idx_areas_tenant ON areas(tenant_id);

CREATE TABLE IF NOT EXISTS cameras (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plant_id           UUID REFERENCES plants(id) ON DELETE CASCADE,
  area_id            UUID REFERENCES areas(id) ON DELETE SET NULL,
  cam_label          VARCHAR(30) NOT NULL,
  cam_code           VARCHAR(50) UNIQUE,
  location_desc      VARCHAR(300),
  model              VARCHAR(200),
  resolution         VARCHAR(30),
  ip_address         INET,
  port               INT DEFAULT 554,
  stream_protocol    VARCHAR(20) DEFAULT 'rtsp',
  rtsp_url           TEXT,
  username           VARCHAR(100),
  password_enc       TEXT,
  mount_height_m     DECIMAL(4,1),
  view_angle_deg     INT,
  coverage_desc      VARCHAR(300),
  detect_helmet      BOOLEAN DEFAULT TRUE,
  detect_vest        BOOLEAN DEFAULT TRUE,
  detect_boots       BOOLEAN DEFAULT FALSE,
  detect_eye         BOOLEAN DEFAULT FALSE,
  detect_gloves      BOOLEAN DEFAULT FALSE,
  detect_ear         BOOLEAN DEFAULT FALSE,
  detect_danger_zone BOOLEAN DEFAULT FALSE,
  detect_motion      BOOLEAN DEFAULT TRUE,
  alert_sensitivity  VARCHAR(20) DEFAULT 'medium',
  status             cam_status DEFAULT 'pending_test',
  last_heartbeat     TIMESTAMPTZ,
  last_frame_at      TIMESTAMPTZ,
  uptime_percent     DECIMAL(5,2),
  firmware_version   VARCHAR(50),
  installation_date  DATE,
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cameras_plant  ON cameras(plant_id);
CREATE INDEX IF NOT EXISTS idx_cameras_area   ON cameras(area_id);
CREATE INDEX IF NOT EXISTS idx_cameras_tenant ON cameras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);

CREATE TABLE IF NOT EXISTS ppe_events (
  id           BIGSERIAL PRIMARY KEY,
  tenant_id    UUID NOT NULL,
  plant_id     UUID NOT NULL,
  area_id      UUID,
  camera_id    UUID,
  cam_label    VARCHAR(30),
  event_type   VARCHAR(50) NOT NULL,
  is_violation BOOLEAN DEFAULT FALSE,
  confidence   DECIMAL(5,2),
  worker_bbox  JSONB,
  frame_url    VARCHAR(500),
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shift        VARCHAR(20)
);
CREATE INDEX IF NOT EXISTS idx_ppe_tenant ON ppe_events(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppe_camera ON ppe_events(camera_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ppe_viol   ON ppe_events(is_violation, detected_at DESC) WHERE is_violation = TRUE;

CREATE TABLE IF NOT EXISTS violations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  violation_no      VARCHAR(20) UNIQUE,
  tenant_id         UUID REFERENCES tenants(id),
  plant_id          UUID REFERENCES plants(id),
  area_id           UUID REFERENCES areas(id),
  camera_id         UUID REFERENCES cameras(id),
  violation_cam     VARCHAR(30),
  ppe_event_id      BIGINT,
  violation_type    VARCHAR(100) NOT NULL,
  description       TEXT,
  severity          severity_level DEFAULT 'medium',
  worker_id         VARCHAR(50),
  confidence        DECIMAL(5,2),
  frame_url         VARCHAR(500),
  video_clip_url    VARCHAR(500),
  status            alert_status DEFAULT 'open',
  assigned_to       UUID REFERENCES users(id),
  corrective_action TEXT,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES users(id),
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_violations_tenant ON violations(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_plant  ON violations(plant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_sev    ON violations(severity, occurred_at DESC);

CREATE TABLE IF NOT EXISTS form18_reports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_no             VARCHAR(20) UNIQUE,
  tenant_id             UUID REFERENCES tenants(id),
  plant_id              UUID REFERENCES plants(id),
  status                form18_status DEFAULT 'draft',
  report_year           INT NOT NULL,
  report_month          INT,
  factory_name          VARCHAR(300),
  factory_address       TEXT,
  factory_licence       VARCHAR(100),
  total_workers         INT DEFAULT 0,
  male_workers          INT DEFAULT 0,
  female_workers        INT DEFAULT 0,
  accidents_fatal       INT DEFAULT 0,
  accidents_non_fatal   INT DEFAULT 0,
  dangerous_occurrences INT DEFAULT 0,
  man_days_lost         INT DEFAULT 0,
  ppe_violations        INT DEFAULT 0,
  inspections_done      INT DEFAULT 0,
  auto_filled_pct       DECIMAL(5,2) DEFAULT 0,
  submitted_at          TIMESTAMPTZ,
  submitted_by          UUID REFERENCES users(id),
  acknowledged_by       VARCHAR(200),
  raw_data              JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_form18_tenant ON form18_reports(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_form18_plant  ON form18_reports(plant_id);
CREATE INDEX IF NOT EXISTS idx_form18_status ON form18_reports(status);

CREATE TABLE IF NOT EXISTS inspection_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID REFERENCES tenants(id),
  plant_id     UUID REFERENCES plants(id),
  inspector_id UUID REFERENCES users(id),
  title        VARCHAR(300),
  scheduled_at TIMESTAMPTZ,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_items  INT DEFAULT 0,
  passed_items INT DEFAULT 0,
  failed_items INT DEFAULT 0,
  score_pct    DECIMAL(5,2),
  notes        TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  item_no     INT,
  description TEXT NOT NULL,
  category    VARCHAR(100),
  is_passed   BOOLEAN,
  notes       TEXT,
  checked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inspection_session ON inspection_items(session_id);

CREATE TABLE IF NOT EXISTS alert_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID REFERENCES tenants(id),
  violation_id UUID REFERENCES violations(id),
  channel      VARCHAR(50) NOT NULL,
  recipient    VARCHAR(255),
  message      TEXT,
  status       VARCHAR(20) DEFAULT 'sent',
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  error_msg    TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant    ON alert_logs(tenant_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_violation ON alert_logs(violation_id);

CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID REFERENCES tenants(id),
  plant_id     UUID REFERENCES plants(id),
  report_type  report_type NOT NULL,
  title        VARCHAR(300),
  period_start DATE,
  period_end   DATE,
  file_url     VARCHAR(500),
  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS camera_health_logs (
  id           BIGSERIAL PRIMARY KEY,
  camera_id    UUID REFERENCES cameras(id) ON DELETE CASCADE,
  status       cam_status,
  latency_ms   INT,
  fps          DECIMAL(5,2),
  bitrate_kbps INT,
  logged_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cam_health ON camera_health_logs(camera_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID,
  user_id     UUID,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   VARCHAR(100),
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID REFERENCES tenants(id),
  razorpay_order_id   VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100),
  razorpay_signature  TEXT,
  plan_id             VARCHAR(50),
  billing_cycle       VARCHAR(20),
  base_amount         BIGINT DEFAULT 0,
  discount_amount     BIGINT DEFAULT 0,
  gst_amount          BIGINT DEFAULT 0,
  total_amount        BIGINT DEFAULT 0,
  coupon_code         VARCHAR(50),
  status              VARCHAR(30) DEFAULT 'created',
  invoice_no          VARCHAR(30) UNIQUE,
  customer_name       VARCHAR(200),
  customer_email      VARCHAR(255),
  customer_gstin      VARCHAR(15),
  refund_id           VARCHAR(100),
  refund_amount       BIGINT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS \$\$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
\$\$ LANGUAGE plpgsql;

DO \$\$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','users','customers','plants','areas','cameras',
    'violations','form18_reports','inspection_sessions','reports','payments']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END \$\$;

CREATE OR REPLACE FUNCTION generate_violation_no()
RETURNS TRIGGER AS \$\$
DECLARE yr TEXT; seq INT;
BEGIN
  yr := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*)+1 INTO seq FROM violations WHERE violation_no LIKE 'VIO-'||yr||'-%';
  NEW.violation_no := 'VIO-' || yr || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_violation_no ON violations;
CREATE TRIGGER trg_violation_no BEFORE INSERT ON violations
  FOR EACH ROW WHEN (NEW.violation_no IS NULL)
  EXECUTE FUNCTION generate_violation_no();

CREATE OR REPLACE FUNCTION generate_form18_no()
RETURNS TRIGGER AS \$\$
DECLARE yr TEXT; seq INT;
BEGIN
  yr := TO_CHAR(NOW(), 'YYYY');
  SELECT COUNT(*)+1 INTO seq FROM form18_reports WHERE report_no LIKE 'F18-'||yr||'-%';
  NEW.report_no := 'F18-' || yr || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_form18_no ON form18_reports;
CREATE TRIGGER trg_form18_no BEFORE INSERT ON form18_reports
  FOR EACH ROW WHEN (NEW.report_no IS NULL)
  EXECUTE FUNCTION generate_form18_no();

CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  p.id          AS plant_id,
  p.tenant_id,
  p.plant_name,
  COUNT(DISTINCT c.id)                                      AS total_cameras,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'online')   AS cameras_online,
  COUNT(DISTINCT a.id)                                      AS total_areas,
  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'open')     AS open_violations,
  COUNT(DISTINCT v.id) FILTER (WHERE v.occurred_at >= NOW() - INTERVAL '24h') AS violations_today
FROM plants p
LEFT JOIN cameras c    ON c.plant_id = p.id AND c.is_active
LEFT JOIN areas a      ON a.plant_id = p.id AND a.is_active
LEFT JOIN violations v ON v.plant_id = p.id
WHERE p.is_active
GROUP BY p.id, p.tenant_id, p.plant_name;

CREATE OR REPLACE VIEW v_violation_detail AS
SELECT
  v.*,
  p.plant_name,
  p.city        AS plant_city,
  a.area_name,
  a.zone_type,
  cam.cam_label,
  cam.location_desc,
  u.full_name   AS assigned_to_name
FROM violations v
LEFT JOIN plants p    ON p.id = v.plant_id
LEFT JOIN areas a     ON a.id = v.area_id
LEFT JOIN cameras cam ON cam.id = v.camera_id
LEFT JOIN users u     ON u.id = v.assigned_to;

`;

async function migrate() {
  await connectDB();
  const db = getDB();
  logger.info('Running migrations...');
  try {
    await db.query(SCHEMA);
    logger.info('All tables, indexes, triggers and views created successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed:');
    logger.error('Message : ' + err.message);
    logger.error('Detail  : ' + (err.detail  || 'none'));
    logger.error('Hint    : ' + (err.hint    || 'none'));
    logger.error('Position: ' + (err.position || 'none'));
    process.exit(1);
  }
}

migrate();
