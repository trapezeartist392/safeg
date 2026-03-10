/**
 * SafeG AI — API Tests
 * Run: npm test
 * Requires: TEST_DB_URL env var pointing to a test PostgreSQL database
 */
const request = require('supertest');
const app     = require('../src/app');

// ── Test fixtures
const DEMO_CUSTOMER = {
  companyName:  'Test Factory Ltd',
  email:        `test-${Date.now()}@factory.com`,
  contactName:  'Test User',
  contactDesig: 'HSE Manager',
  city:         'Pune',
  state:        'Maharashtra',
  plan:         'growth',
};

const DEMO_PLANT = {
  plantName: 'Test Plant Unit 1',
  licNo:     'MH/TEST/F/2024/00001',
  factoryType: 'Manufacturing',
  plantCity: 'Pune',
  plantState: 'Maharashtra',
  hseName:   'Test HSE Officer',
  hseEmail:  `hse-${Date.now()}@factory.com`,
  hseMobile: '+919999999999',
};

const DEMO_AREAS = [
  { id: 1, name: 'Assembly Zone A', type: 'Assembly Line', riskLevel: 'Medium',
    ppeRequired: ['Hard Hat', 'Safety Vest'] },
];

const DEMO_CAMERAS = [
  { id: 1, areaId: 1, areaName: 'Assembly Zone A',
    camId: 'CAM-01', location: 'North wall', ipAddress: '192.168.1.101',
    detectHelmet: true, detectVest: true },
];

let accessToken = '';
let tenantId    = '';
let plantId     = '';
let violationId = '';

// ════════════════════════════════════════════════════
describe('🔐 Auth', () => {

  test('POST /api/v1/onboarding/activate — creates account', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/activate')
      .send({
        customer: DEMO_CUSTOMER,
        plant:    DEMO_PLANT,
        areas:    DEMO_AREAS,
        cameras:  DEMO_CAMERAS,
        password: 'TestPass@2024!',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('tenantId');
    expect(res.body.data).toHaveProperty('plantId');

    accessToken = res.body.data.accessToken;
    tenantId    = res.body.data.tenantId;
    plantId     = res.body.data.plantId;
  });

  test('POST /api/v1/onboarding/activate — rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/activate')
      .send({
        customer: DEMO_CUSTOMER,
        plant:    DEMO_PLANT,
        areas:    DEMO_AREAS,
        cameras:  [],
        password: 'TestPass@2024!',
      });
    expect(res.statusCode).toBe(409);
  });

  test('POST /api/v1/auth/login — success', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: DEMO_CUSTOMER.email, password: 'TestPass@2024!' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    accessToken = res.body.data.accessToken;
  });

  test('POST /api/v1/auth/login — wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: DEMO_CUSTOMER.email, password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/v1/auth/me — returns user', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(DEMO_CUSTOMER.email);
    expect(res.body.data.role).toBe('customer_admin');
  });
});

// ════════════════════════════════════════════════════
describe('🏭 Plants', () => {

  test('GET /api/v1/plants — lists plants', async () => {
    const res = await request(app)
      .get('/api/v1/plants')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].plant_name).toBe(DEMO_PLANT.plantName);
  });

  test('GET /api/v1/plants/:id/dashboard — returns KPIs', async () => {
    const res = await request(app)
      .get(`/api/v1/plants/${plantId}/dashboard`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
  });
});

// ════════════════════════════════════════════════════
describe('📍 Areas', () => {

  test('GET /api/v1/areas — lists areas for plant', async () => {
    const res = await request(app)
      .get('/api/v1/areas')
      .query({ plantId })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════
describe('📹 Cameras', () => {

  test('GET /api/v1/cameras — lists cameras', async () => {
    const res = await request(app)
      .get('/api/v1/cameras')
      .query({ plantId })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════
describe('⚠️ Violations', () => {

  test('POST /api/v1/violations — creates violation', async () => {
    // First get a camera
    const camRes = await request(app)
      .get('/api/v1/cameras')
      .query({ plantId })
      .set('Authorization', `Bearer ${accessToken}`);
    const camera = camRes.body.data[0];

    const res = await request(app)
      .post('/api/v1/violations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        plantId,
        areaId:        camera.area_id,
        cameraId:      camera.id,
        camLabel:      camera.cam_label,
        violationType: 'no_helmet',
        severity:      'high',
        confidence:    97.3,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('violation_no');
    violationId = res.body.data.id;
  });

  test('GET /api/v1/violations — lists violations', async () => {
    const res = await request(app)
      .get('/api/v1/violations')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
  });

  test('PUT /api/v1/violations/:id/acknowledge', async () => {
    const res = await request(app)
      .put(`/api/v1/violations/${violationId}/acknowledge`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('acknowledged');
  });

  test('PUT /api/v1/violations/:id/resolve', async () => {
    const res = await request(app)
      .put(`/api/v1/violations/${violationId}/resolve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ correctiveAction: 'Worker warned and re-trained on PPE policy' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('resolved');
  });
});

// ════════════════════════════════════════════════════
describe('📋 Form 18', () => {

  test('GET /api/v1/violations/:id/form18 — pre-populates form', async () => {
    const res = await request(app)
      .get(`/api/v1/violations/${violationId}/form18`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.form18Prefill).toHaveProperty('factoryName');
  });
});

// ════════════════════════════════════════════════════
describe('📊 Dashboard', () => {

  test('GET /api/v1/dashboard/kpis — returns KPIs', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/kpis')
      .query({ plantId })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('violations');
    expect(res.body.data).toHaveProperty('cameras');
  });

  test('GET /api/v1/dashboard/timeline — returns events', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/timeline')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
  });
});

// ════════════════════════════════════════════════════
describe('🔒 Auth Guards', () => {

  test('Returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/plants');
    expect(res.statusCode).toBe(401);
  });

  test('Returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/plants')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/health — public endpoint', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
