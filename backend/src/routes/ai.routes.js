/**
 * ai.routes.js — FIXED
 * Changes in POST /detect:
 *  1. INSERT now saves camera_id, area_id, plant_id (were all null before)
 *  2. Looks up camera row from DB using cameraId to get area_id + plant_id
 *  3. WhatsApp zone now uses real area_name from DB instead of hardcoded 'Factory Floor'
 *  4. violation_cam saved correctly as the label/id string
 */

'use strict';

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { authenticate } = require('../middleware/auth');
const logger  = require('../utils/logger');
const { sendWhatsAppAlert } = require('../services/whatsapp.service');

const AI_URL = process.env.AI_ENGINE_URL || 'http://localhost:5001';

async function proxyToAI(method, path, data = null) {
  const res = await axios({
    method,
    url: `${AI_URL}${path}`,
    data,
    timeout: 30000,
    proxy: false,
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}

// GET /health
router.get('/health', async (req, res) => {
  try {
    const data = await proxyToAI('GET', '/health');
    res.json({ success: true, data });
  } catch {
    res.status(503).json({ success: false, message: 'AI service not reachable. Start ai_service.py' });
  }
});

// POST /stream/start
router.post('/stream/start', authenticate, async (req, res) => {
  try {
    const { cameraId, rtspUrl, ppeTypes, confidence } = req.body;
    if (!cameraId || !rtspUrl) {
      return res.status(400).json({ success: false, message: 'cameraId and rtspUrl required' });
    }

    const data = await proxyToAI('POST', '/stream/start', {
      camera_id:  cameraId,
      rtsp_url:   rtspUrl,
      tenant_id:  req.user.tenantId,
      plant_id:   req.body.plantId || null,
      area_id:    req.body.areaId  || null,
      ppe_types:  ppeTypes   || ['Helmet', 'Safety Vest'],
      confidence: confidence || 0.5,
      token:      req.headers.authorization?.split(' ')[1],
    });

    logger.info(`AI stream started: camera ${cameraId} by user ${req.user.id}`);
    res.json({ success: true, data });
  } catch (err) {
    logger.error(`AI stream start error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to start AI stream. Is ai_service.py running?' });
  }
});

// POST /stream/stop
router.post('/stream/stop', authenticate, async (req, res) => {
  try {
    const { cameraId } = req.body;
    const data = await proxyToAI('POST', '/stream/stop', { camera_id: cameraId });
    res.json({ success: true, data });
  } catch (err) {
    logger.error('AI stream stop error: ' + err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /stream/status
router.get('/stream/status', authenticate, async (req, res) => {
  try {
    const data = await proxyToAI('GET', '/stream/status');
    res.json({ success: true, data });
  } catch {
    res.status(503).json({ success: false, message: 'AI service not reachable' });
  }
});

// POST /detect — single frame detection
router.post('/detect', authenticate, async (req, res) => {
  try {
    if (!req.body.imageBase64 || req.body.imageBase64.length < 100) {
      return res.json({
        success: true,
        data: { violations: [], persons_detected: 0, risk_level: 'safe', compliant: true },
      });
    }

    const data = await proxyToAI('POST', '/detect', {
      image_base64: req.body.imageBase64,
      camera_id:    req.body.cameraId,
      tenant_id:    req.user.tenantId,
      ppe_types:    req.body.ppeTypes || ['Helmet', 'Safety Vest'],
      confidence:   req.body.confidence || 0.5,
    });

    try {
      if (data.violations && data.violations.length > 0) {
        const db = require('../config/database').getDB();

        // ── FIX: Look up camera row to get area_id, plant_id, area_name ──
        // cameraId from frontend is the cam_label string (e.g. "CAM-01") or UUID
        let cameraRow = null;
        const camIdParam = req.body.cameraId;
        if (camIdParam && camIdParam !== 'browser-webcam' && camIdParam !== 'laptop-webcam') {
          try {
            // Try UUID match first, then cam_label match
            const camRes = await db.query(
              `SELECT c.id, c.cam_label, c.area_id, c.plant_id,
                      a.area_name, a.zone_type
               FROM cameras c
               LEFT JOIN areas a ON a.id = c.area_id
               WHERE c.tenant_id = $1
                 AND (c.id::text = $2 OR c.cam_label ILIKE $2 OR c.cam_code ILIKE $2)
               LIMIT 1`,
              [req.user.tenantId, camIdParam]
            );
            cameraRow = camRes.rows[0] || null;
          } catch (camErr) {
            logger.warn('Camera lookup error: ' + camErr.message);
          }
        }

        const resolvedCameraId = cameraRow?.id        || null;
        const resolvedAreaId   = cameraRow?.area_id   || null;
        const resolvedPlantId  = cameraRow?.plant_id  || null;
        const resolvedAreaName = cameraRow?.area_name || 'Factory Floor';
        const violationCamLabel = cameraRow?.cam_label || camIdParam || 'browser-webcam';

        for (const v of data.violations) {
          try {
            await db.query(`
              INSERT INTO violations
                (violation_no, tenant_id,
                 camera_id, violation_cam,
                 area_id, plant_id,
                 violation_type, category, severity,
                 confidence, description, status, occurred_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open',NOW())
              ON CONFLICT (violation_no) DO NOTHING
            `, [
              v.violation_no   || null,
              req.user.tenantId,
              resolvedCameraId,           // FIX: real UUID from cameras table
              violationCamLabel,          // human-readable label
              resolvedAreaId,             // FIX: real area UUID
              resolvedPlantId,            // FIX: real plant UUID
              v.type || v.ppe_type || 'Unknown',
              v.category || 'ppe',
              v.severity || 'medium',
              v.confidence || 80,
              v.description || '',
            ]);

            // WhatsApp alert
            const DEMO_TENANT = 'ca5b55f4-bcac-4744-b07a-370503414ff1';
            const tenantRow = await db.query(
              'SELECT whatsapp_number, whatsapp_alerts FROM tenants WHERE id=$1',
              [req.user.tenantId]
            );
            const tenant = tenantRow.rows[0];
            if (
              req.user.tenantId !== DEMO_TENANT &&
              tenant?.whatsapp_alerts &&
              tenant?.whatsapp_number
            ) {
              const now = new Date().toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              });
              sendWhatsAppAlert({
                violation:  v.type || 'Unknown Violation',
                camera:     violationCamLabel,
                zone:       resolvedAreaName,   // FIX: real area name, not hardcoded
                time:       now,
                confidence: v.confidence || 80,
                numbers:    [tenant.whatsapp_number],
              }).catch(() => {});
            }
          } catch (dbErr) {
            logger.warn('Violation save error: ' + dbErr.message);
          }
        }
      }
    } catch (saveErr) {
      logger.warn('Violation save block error: ' + saveErr.message);
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('AI detect error: ' + err.message + ' | ' + err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
