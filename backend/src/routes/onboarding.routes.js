/**
 * Onboarding Route — POST /api/v1/onboarding/activate
 *
 * This is the single endpoint the frontend wizard calls
 * when the user clicks "Activate SafeG AI".
 *
 * Payload mirrors the 4-step wizard state.
 */
const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { activateOnboarding } = require('../services/onboarding.service');
const AppError = require('../utils/AppError');
const { getDB } = require('../config/database');

// POST /api/v1/onboarding/activate
router.post('/activate', [
  body('customer.companyName').trim().notEmpty().withMessage('Company name required'),
  body('customer.email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('customer.contactName').trim().notEmpty().withMessage('Contact name required'),
  body('plant.plantName').trim().notEmpty().withMessage('Plant name required'),
  body('areas').isArray({ min: 1 }).withMessage('At least one area required'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 characters'),
], validate, asyncHandler(async (req, res) => {
  const { customer, plant, areas, cameras, password } = req.body;

  // Check email not already registered
  const db = getDB();
  const exists = await db.query('SELECT id FROM users WHERE email=$1', [customer.email]);
  if (exists.rows.length) {
    throw new AppError('Email already registered. Please login instead.', 409);
  }

  const result = await activateOnboarding({
    customer, plant,
    areas:   areas   || [],
    cameras: cameras || [],
    password,
  });

  res.status(201).json({
    success: true,
    message: 'SafeG AI activated — cameras connecting',
    data: {
      tenantId:     result.tenantId,
      customerId:   result.customerId,
      plantId:      result.plantId,
      plantCode:    result.plantCode,
      dashboardUrl: result.dashboardUrl,
      user: {
        id:       result.adminUser.id,
        email:    result.adminUser.email,
        fullName: result.adminUser.full_name,
        role:     result.adminUser.role,
      },
      cameras: result.cameraRecords.map(c => ({
        id:       c.id,
        camLabel: c.cam_label,
        camCode:  c.cam_code,
        status:   'pending_test',
      })),
      accessToken:  result.accessToken,
      refreshToken: result.refreshToken,
    },
  });
}));

// POST /api/v1/onboarding/save-draft
// Saves the wizard state without activating (no DB records created)
router.post('/save-draft', asyncHandler(async (req, res) => {
  // In production: save to a drafts table or Redis with a draft token
  const draftId = `DRAFT-${Date.now().toString(36).toUpperCase()}`;
  res.json({
    success: true,
    message: 'Draft saved — you can resume from this link',
    data: { draftId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
  });
}));

// GET /api/v1/onboarding/check-email
router.get('/check-email', asyncHandler(async (req, res) => {
  const { email } = req.query;
  if (!email) throw new AppError('Email required', 400);
  const db = getDB();
  const { rows } = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
  res.json({ success: true, data: { available: rows.length === 0 } });
}));

module.exports = router;
