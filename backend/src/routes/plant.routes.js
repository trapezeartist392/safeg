/**  PLANT ROUTES  — /api/v1/plants  **/
const router = require('express').Router();
const { body, param } = require('express-validator');
const ctrl   = require('../controllers/plant.controller');
const { authenticate, authorize, tenantGuard } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);

router.get('/',                                                      ctrl.list);
router.post('/', authorize('superadmin','customer_admin','plant_manager'), [
  body('plantName').trim().notEmpty(),
  body('customerId').isUUID(),
], validate, ctrl.create);
router.get('/:id',  param('id').isUUID(), validate,                 ctrl.getOne);
router.put('/:id',  authorize('superadmin','customer_admin','plant_manager'), validate, ctrl.update);
router.delete('/:id', authorize('superadmin','customer_admin'),     ctrl.remove);
router.get('/:id/dashboard', param('id').isUUID(), validate,        ctrl.dashboard);
router.get('/:id/areas',     param('id').isUUID(), validate,        ctrl.listAreas);
router.get('/:id/cameras',   param('id').isUUID(), validate,        ctrl.listCameras);

module.exports = router;
