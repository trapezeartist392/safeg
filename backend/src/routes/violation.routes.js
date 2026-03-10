/** VIOLATION ROUTES — /api/v1/violations **/
const router = require('express').Router();
const { param, body, query } = require('express-validator');
const ctrl   = require('../controllers/violation.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.use(authenticate);
router.get('/',               ctrl.list);
router.post('/',              [body('plantId').isUUID(), body('violationType').notEmpty(),
                               body('severity').isIn(['low','medium','high','critical'])], validate, ctrl.create);
router.get('/stats',          ctrl.stats);
router.get('/:id',            param('id').isUUID(), validate, ctrl.getOne);
router.put('/:id/acknowledge',param('id').isUUID(), validate, ctrl.acknowledge);
router.put('/:id/resolve',    param('id').isUUID(), [
  body('correctiveAction').notEmpty().withMessage('Corrective action required to resolve'),
], validate, ctrl.resolve);
router.put('/:id/assign',     param('id').isUUID(), [body('assignTo').isUUID()], validate, ctrl.assign);
router.post('/:id/escalate',  param('id').isUUID(), validate, ctrl.escalate);
router.get('/:id/form18',     param('id').isUUID(), validate, ctrl.getForm18Data);

module.exports = router;
