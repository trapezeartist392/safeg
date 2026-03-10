/**
 * CUSTOMER ROUTES  —  /api/v1/customers
 */
const router = require('express').Router();
const { body, param, query } = require('express-validator');
const ctrl     = require('../controllers/customer.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

// GET    /customers              — list (superadmin sees all, customer_admin sees own)
router.get('/', ctrl.list);

// POST   /customers              — create (superadmin or onboarding)
router.post('/', authorize('superadmin','customer_admin'), [
  body('companyName').trim().notEmpty(),
  body('contactEmail').isEmail().normalizeEmail(),
], validate, ctrl.create);

// GET    /customers/:id
router.get('/:id', param('id').isUUID(), validate, ctrl.getOne);

// PUT    /customers/:id
router.put('/:id', authorize('superadmin','customer_admin'), [
  param('id').isUUID(),
], validate, ctrl.update);

// DELETE /customers/:id
router.delete('/:id', authorize('superadmin'), param('id').isUUID(), validate, ctrl.remove);

// GET    /customers/:id/stats    — aggregated stats for this customer
router.get('/:id/stats', param('id').isUUID(), validate, ctrl.stats);

module.exports = router;
