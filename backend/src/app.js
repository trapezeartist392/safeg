/**
 * SafeG AI — Express Application
 * Registers all middleware, routes, and error handlers
 */
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const YAML        = require('yamljs');
const swaggerUi   = require('swagger-ui-express');
const path        = require('path');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { requestId }              = require('./middleware/requestId');
const logger                     = require('./utils/logger');

// ── Route imports
const authRoutes        = require('./routes/auth.routes');
const customerRoutes    = require('./routes/customer.routes');
const plantRoutes       = require('./routes/plant.routes');
const areaRoutes        = require('./routes/area.routes');
const cameraRoutes      = require('./routes/camera.routes');
const violationRoutes   = require('./routes/violation.routes');
const form18Routes      = require('./routes/form18.routes');
const alertRoutes       = require('./routes/alert.routes');
const inspectionRoutes  = require('./routes/inspection.routes');
const reportRoutes      = require('./routes/report.routes');
const dashboardRoutes   = require('./routes/dashboard.routes');
const userRoutes        = require('./routes/user.routes');
const webhookRoutes     = require('./routes/webhook.routes');
const onboardingRoutes  = require('./routes/onboarding.routes');
const healthRoutes      = require('./routes/health.routes');
const paymentRoutes     = require('./routes/payment.routes');
const adminRoutes       = require('./routes/admin.routes');
const discoveryRoutes = require('./routes/camera.discovery.routes');
const aiRoutes = require('./routes/ai.routes');
const app = express();

// ── Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000','http://localhost:5173'],
  credentials: true,
}));

//camera discovery endpoint needs to be public (for on-prem deployments), so we mount it before auth middleware
app.use('/api/v1/cameras', discoveryRoutes);

// ── Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX) || 200,
  message:  { success: false, message: 'Too many requests — please slow down' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/', limiter);

// ── Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/api/health',
}));

// ── Request ID (every request gets a traceable ID)
app.use(requestId);

// Mount in backend app.js
app.use('/api/v1/ai', aiRoutes);

// ── Swagger Docs
try {
  const swaggerDoc = YAML.load(path.join(__dirname, '../docs/swagger.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
    customSiteTitle: 'SafeG AI — API Docs',
  }));
} catch { /* swagger file optional in dev */ }

// ── API Routes (all versioned under /api/v1)
const v1 = '/api/v1';
app.use('/api/health',           healthRoutes);
app.use(`${v1}/auth`,            authRoutes);
app.use(`${v1}/users`,           userRoutes);
app.use(`${v1}/customers`,       customerRoutes);
app.use(`${v1}/plants`,          plantRoutes);
app.use(`${v1}/areas`,           areaRoutes);
app.use(`${v1}/cameras`,         cameraRoutes);
app.use(`${v1}/violations`,      violationRoutes);
app.use(`${v1}/form18`,          form18Routes);
app.use(`${v1}/alerts`,          alertRoutes);
app.use(`${v1}/inspections`,     inspectionRoutes);
app.use(`${v1}/reports`,         reportRoutes);
app.use(`${v1}/dashboard`,       dashboardRoutes);
app.use(`${v1}/webhooks`,        webhookRoutes);
app.use(`${v1}/onboarding`,     onboardingRoutes);
app.use(`${v1}/payments`,        paymentRoutes);
app.use('/api/admin',            adminRoutes);

// ── 404 + Error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
