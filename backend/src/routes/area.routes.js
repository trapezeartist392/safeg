/** AREA ROUTES — /api/v1/areas **/
const areaRouter   = require('express').Router();
const cameraRouter = require('express').Router();
const { param, body } = require('express-validator');
const areCtrl  = require('../controllers/area.controller');
const camCtrl  = require('../controllers/camera.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

// ── AREAS
areaRouter.use(authenticate);
areaRouter.get('/',                                                           areCtrl.list);
areaRouter.post('/', authorize('superadmin','customer_admin','plant_manager','hse_officer'), [
  body('plantId').isUUID(), body('areaName').trim().notEmpty(),
], validate, areCtrl.create);
areaRouter.get('/:id',    param('id').isUUID(), validate,                    areCtrl.getOne);
areaRouter.put('/:id',    authorize('superadmin','customer_admin','plant_manager','hse_officer'), validate, areCtrl.update);
areaRouter.delete('/:id', authorize('superadmin','customer_admin'),          areCtrl.remove);
areaRouter.get('/:id/cameras', param('id').isUUID(), validate,               areCtrl.listCameras);
areaRouter.get('/:id/violations', param('id').isUUID(), validate,            areCtrl.listViolations);

// ── CAMERAS
cameraRouter.use(authenticate);
cameraRouter.get('/',                                                         camCtrl.list);
cameraRouter.post('/', authorize('superadmin','customer_admin','plant_manager'), [
  body('areaId').isUUID(), body('plantId').isUUID(), body('camLabel').notEmpty(),
], validate, camCtrl.create);
cameraRouter.get('/:id',      param('id').isUUID(), validate,                camCtrl.getOne);
cameraRouter.put('/:id',      authorize('superadmin','customer_admin','plant_manager'), validate, camCtrl.update);
cameraRouter.delete('/:id',   authorize('superadmin','customer_admin'),      camCtrl.remove);
// Special actions
cameraRouter.post('/:id/test-connection', param('id').isUUID(), validate,    camCtrl.testConnection);
cameraRouter.post('/:id/restart',         param('id').isUUID(), validate,    camCtrl.restart);
cameraRouter.get('/:id/health',           param('id').isUUID(), validate,    camCtrl.health);
cameraRouter.get('/:id/live-frame',       param('id').isUUID(), validate,    camCtrl.liveFrame);
cameraRouter.put('/:id/ai-config',        param('id').isUUID(), validate,    camCtrl.updateAiConfig);

module.exports = areaRouter;
