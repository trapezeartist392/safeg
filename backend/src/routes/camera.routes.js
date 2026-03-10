/** CAMERA ROUTES — /api/v1/cameras **/
const router = require("express").Router();
const { param, body } = require("express-validator");
const camCtrl  = require("../controllers/camera.controller");
const { authenticate, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");

router.use(authenticate);
router.get("/",                                                           camCtrl.list);
router.post("/", authorize("superadmin","customer_admin","plant_manager"), [
  body("areaId").isUUID(), body("plantId").isUUID(), body("camLabel").notEmpty(),
], validate, camCtrl.create);
router.get("/:id",      param("id").isUUID(), validate,                camCtrl.getOne);
router.put("/:id",      authorize("superadmin","customer_admin","plant_manager"), validate, camCtrl.update);
router.delete("/:id",   authorize("superadmin","customer_admin"),      camCtrl.remove);
router.post("/:id/test-connection", param("id").isUUID(), validate,    camCtrl.testConnection);
router.post("/:id/restart",         param("id").isUUID(), validate,    camCtrl.restart);
router.get("/:id/health",           param("id").isUUID(), validate,    camCtrl.health);
router.get("/:id/live-frame",       param("id").isUUID(), validate,    camCtrl.liveFrame);
router.put("/:id/ai-config",        param("id").isUUID(), validate,    camCtrl.updateAiConfig);

module.exports = router;
