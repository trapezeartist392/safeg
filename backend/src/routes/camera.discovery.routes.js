/**
 * camera.discovery.routes.js
 * SafeguardsIQ — Camera Discovery API Routes
 *
 * POST /api/v1/cameras/discover        — start discovery
 * GET  /api/v1/cameras/discover/status — poll progress (SSE)
 * POST /api/v1/cameras/test-rtsp       — test a single RTSP URL
 * GET  /api/v1/cameras/subnets         — get local subnets
 */

'use strict';

const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth');
const { discoverCameras, testRtspUrl, getLocalSubnets, buildRtspUrls } = require('../services/camera.discovery.service');
const logger   = require('../utils/logger');

/* In-memory store for discovery sessions */
const sessions = new Map();

/* ─────────────────────────────────────────────────
   POST /api/v1/cameras/discover
   Start a camera discovery scan
───────────────────────────────────────────────── */
router.post('/discover', authenticate, async (req, res) => {
  try {
    const {
      method   = 'all',    /* 'onvif' | 'portscan' | 'all' */
      subnet   = null,     /* e.g. '192.168.1'  — optional */
      username = 'admin',
      password = '',
    } = req.body;

    const sessionId = `disc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    /* Store session state */
    sessions.set(sessionId, {
      status:   'running',
      progress: 0,
      cameras:  [],
      startedAt: new Date().toISOString(),
      error:    null,
    });

    /* Run discovery in background */
    discoverCameras({
      method,
      subnet,
      username,
      password,
      onProgress: (pct) => {
        const s = sessions.get(sessionId);
        if (s) s.progress = pct;
      },
    }).then(cameras => {
      const s = sessions.get(sessionId);
      if (s) {
        s.status   = 'complete';
        s.progress = 100;
        s.cameras  = cameras;
        s.completedAt = new Date().toISOString();
        logger.info(`Discovery session ${sessionId} complete: ${cameras.length} cameras found`);
      }
      /* Auto-cleanup after 10 minutes */
      setTimeout(() => sessions.delete(sessionId), 10 * 60 * 1000);
    }).catch(err => {
      const s = sessions.get(sessionId);
      if (s) {
        s.status = 'error';
        s.error  = err.message;
      }
      logger.error(`Discovery session ${sessionId} failed: ${err.message}`);
    });

    res.json({
      success:   true,
      sessionId,
      message:   'Discovery started. Poll /discover/status/:sessionId for results.',
    });

  } catch (err) {
    logger.error(`POST /discover error: ${err.message}`);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────────
   GET /api/v1/cameras/discover/status/:sessionId
   Poll discovery progress and results
───────────────────────────────────────────────── */
router.get('/discover/status/:sessionId', authenticate, (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Discovery session not found or expired' });
  }

  res.json({
    success:  true,
    data:     session,
  });
});

/* ─────────────────────────────────────────────────
   GET /api/v1/cameras/discover/stream/:sessionId
   Server-Sent Events for real-time progress
───────────────────────────────────────────────── */
router.get('/discover/stream/:sessionId', authenticate, (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(() => {
    const session = sessions.get(sessionId);
    if (!session) {
      res.write(`data: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
      clearInterval(interval);
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({
      status:   session.status,
      progress: session.progress,
      count:    session.cameras.length,
      cameras:  session.status === 'complete' ? session.cameras : [],
    })}\n\n`);

    if (session.status === 'complete' || session.status === 'error') {
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

/* ─────────────────────────────────────────────────
   POST /api/v1/cameras/test-rtsp
   Test if an RTSP URL / IP is reachable
───────────────────────────────────────────────── */
router.post('/test-rtsp', async (req, res) => {
  try {
    const { ip, rtspUrl } = req.body;

    if (!ip && !rtspUrl) {
      return res.status(400).json({ success: false, message: 'ip or rtspUrl required' });
    }

    /* Extract IP from RTSP URL if provided */
    let targetIp = ip;
    if (!targetIp && rtspUrl) {
      const match = rtspUrl.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) targetIp = match[1];
    }

    if (!targetIp) {
      return res.status(400).json({ success: false, message: 'Could not extract IP from rtspUrl' });
    }

    const result = await testRtspUrl(targetIp);

    res.json({
      success: true,
      data: {
        ip:          targetIp,
        rtspPort:    result.open,
        reachable:   result.open,
        message:     result.open ? 'Camera is reachable on port 554' : 'Camera not reachable on port 554',
      },
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────────
   GET /api/v1/cameras/subnets
   Return local network subnets for the server
───────────────────────────────────────────────── */
router.get('/subnets', authenticate, (req, res) => {
  try {
    const subnets = getLocalSubnets();
    res.json({ success: true, data: { subnets } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─────────────────────────────────────────────────
   POST /api/v1/cameras/build-rtsp
   Build RTSP URL patterns for a given brand + IP
───────────────────────────────────────────────── */
router.post('/build-rtsp', authenticate, (req, res) => {
  try {
    const { ip, brand = 'generic', username = 'admin', password = '' } = req.body;

    if (!ip) return res.status(400).json({ success: false, message: 'ip is required' });

    const urls = buildRtspUrls({ ip, detectedBrand: brand.toLowerCase() }, username, password);
    res.json({ success: true, data: { ip, brand, urls } });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
