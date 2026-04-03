/**
 * ai.routes.js
 * SafeguardsIQ — AI Service Bridge
 * Connects Node.js backend to Python AI detection service
 *
 * Mount in app.js:
 *   const aiRoutes = require('./routes/ai.routes');
 *   app.use('/api/v1/ai', aiRoutes);
 */

'use strict';

const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const { authenticate } = require('../middleware/auth');
const logger  = require('../utils/logger');

const AI_URL = process.env.AI_ENGINE_URL || 'http://localhost:5001';

/* ── Proxy helper ── */
async function proxyToAI(method, path, data = null) {
  const res = await axios({
    method,
    url: `${AI_URL}${path}`,
    data,
    timeout: 5000,
    proxy: false,
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}

/* ─────────────────────────────────────────────
   GET /api/v1/ai/health
   Check if AI service is running
───────────────────────────────────────────── */
router.get('/health', async (req, res) => {
  try {
    const data = await proxyToAI('GET', '/health');
    res.json({ success: true, data });
  } catch {
    res.status(503).json({ success: false, message: 'AI service not reachable. Start ai_service.py' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/v1/ai/stream/start
   Start AI monitoring on a camera
───────────────────────────────────────────── */
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
      ppe_types:  ppeTypes  || ['Helmet', 'Safety Vest'],
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

/* ─────────────────────────────────────────────
   POST /api/v1/ai/stream/stop
───────────────────────────────────────────── */
router.post('/stream/stop', authenticate, async (req, res) => {
  try {
    const { cameraId } = req.body;
    const data = await proxyToAI('POST', '/stream/stop', { camera_id: cameraId });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────
   GET /api/v1/ai/stream/status
───────────────────────────────────────────── */
router.get('/stream/status', authenticate, async (req, res) => {
  try {
    const data = await proxyToAI('GET', '/stream/status');
    res.json({ success: true, data });
  } catch {
    res.status(503).json({ success: false, message: 'AI service not reachable' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/v1/ai/detect
   Single frame detection
───────────────────────────────────────────── */
router.post('/detect', authenticate, async (req, res) => {
  try {
    const data = await proxyToAI('POST', '/detect', {
      image_base64: req.body.imageBase64,
      camera_id:    req.body.cameraId,
      tenant_id:    req.user.tenantId,
      ppe_types:    req.body.ppeTypes || ['Helmet', 'Safety Vest'],
      confidence:   req.body.confidence || 0.5,
    });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
