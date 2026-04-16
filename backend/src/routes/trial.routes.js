/**
 * trial.routes.js
 * SafeguardsIQ — Trial Status + Management Routes
 * Place in: backend/src/routes/trial.routes.js
 * Mount in app.js: app.use(`${v1}/trial`, trialRoutes);
 */
const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDB }        = require('../config/database');
const trialSvc         = require('../services/trial.service');
const logger           = require('../utils/logger');

// GET /api/v1/trial/status — get trial status for current tenant
router.get('/status', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const db       = getDB();

    const { rows } = await db.query(
      `SELECT subscription_status, trial_ends_at, plan_id, company_name
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (!rows.length) {
      return res.json({ success:true, data:{ status:'unknown' } });
    }

    const tenant  = rows[0];
    const status  = tenant.subscription_status;
    const now     = new Date();
    const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
    const daysLeft = trialEnd
      ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)))
      : null;

    // Auto-expire if past trial end
    if (status === 'trial' && trialEnd && now > trialEnd) {
      await db.query(
        `UPDATE tenants SET subscription_status = 'expired' WHERE id = $1`,
        [tenantId]
      );
      return res.json({
        success: true,
        data: {
          status:       'expired',
          daysLeft:     0,
          isTrialMode:  false,
          trialEndsAt:  trialEnd,
        }
      });
    }

    res.json({
      success: true,
      data: {
        status,
        daysLeft,
        isTrialMode: status === 'trial',
        trialEndsAt: trialEnd,
        plan:        tenant.plan_id,
        company:     tenant.company_name,
      }
    });
  } catch(e) {
    logger.error('Trial status error:', e);
    res.status(500).json({ success:false, message: e.message });
  }
});

// POST /api/v1/trial/process — manually trigger trial processing (admin/cron)
router.post('/process', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success:false, message:'Admin only' });
    }
    await trialSvc.processTrials();
    res.json({ success:true, message:'Trial processing complete' });
  } catch(e) {
    res.status(500).json({ success:false, message: e.message });
  }
});

module.exports = router;
