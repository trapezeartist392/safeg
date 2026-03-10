const router = require('express').Router();
const { body } = require('express-validator');
const ctrl     = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

// POST /api/v1/auth/register  — onboarding activation creates tenant + admin user
router.post('/register', [
  body('companyName').trim().notEmpty().withMessage('Company name required'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 chars'),
  body('fullName').trim().notEmpty(),
], validate, ctrl.register);

// POST /api/v1/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, ctrl.login);

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', ctrl.refreshToken);

// POST /api/v1/auth/logout
router.post('/logout', authenticate, ctrl.logout);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
], validate, ctrl.forgotPassword);

// POST /api/v1/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
], validate, ctrl.resetPassword);

// GET  /api/v1/auth/me
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
