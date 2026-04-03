/**
 * camera.discovery.service.js
 * SafeguardsIQ — Camera Discovery Service
 *
 * Methods:
 *  1. ONVIF WS-Discovery broadcast (port 3702)
 *  2. Port scan for RTSP (port 554) across subnet
 *  3. RTSP stream validation
 *
 * Install deps:
 *   npm install node-onvif dgram net axios
 */

'use strict';

const dgram   = require('dgram');
const net     = require('net');
const os      = require('os');
const { exec } = require('child_process');
const logger = require('../utils/logger');

/* ── ONVIF WS-Discovery probe message ── */
const ONVIF_PROBE = `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
  xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>uuid:${generateUUID()}</w:MessageID>
    <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>`;

const ONVIF_MULTICAST = '239.255.255.250';
const ONVIF_PORT      = 3702;
const RTSP_PORT       = 554;
const SCAN_TIMEOUT_MS = 5000;
const PORT_SCAN_TIMEOUT_MS = 800;

/* ── Common RTSP URL patterns by brand ── */
const RTSP_PATTERNS = {
  hikvision: [
    'rtsp://{user}:{pass}@{ip}:554/Streaming/Channels/101',
    'rtsp://{user}:{pass}@{ip}:554/Streaming/Channels/1',
  ],
  dahua: [
    'rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=0',
    'rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=1',
  ],
  cpplus: [
    'rtsp://{user}:{pass}@{ip}:554/stream0',
    'rtsp://{user}:{pass}@{ip}:554/stream1',
  ],
  axis: [
    'rtsp://{user}:{pass}@{ip}:554/axis-media/media.amp',
  ],
  bosch: [
    'rtsp://{user}:{pass}@{ip}:554/rtsp_tunnel',
  ],
  generic: [
    'rtsp://{user}:{pass}@{ip}:554/stream1',
    'rtsp://{user}:{pass}@{ip}:554/live',
    'rtsp://{user}:{pass}@{ip}:554/h264',
    'rtsp://{user}:{pass}@{ip}:554/1',
  ],
};

/* ── Utility: generate UUID ── */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Utility: get local subnet ── */
function getLocalSubnets() {
  const interfaces = os.networkInterfaces();
  const subnets = [];
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const parts = addr.address.split('.');
        subnets.push(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
  }
  return [...new Set(subnets)];
}

/* ── Parse ONVIF XML response ── */
function parseOnvifResponse(xml, remoteIp) {
  const camera = {
    ip:        remoteIp,
    protocol:  'onvif',
    brand:     'Unknown',
    model:     '',
    onvifUrl:  '',
    rtspUrls:  [],
    discovered: new Date().toISOString(),
  };

  try {
    const xAddrsMatch = xml.match(/<[^>]*XAddrs[^>]*>([^<]+)<\/[^>]*XAddrs>/i);
    if (xAddrsMatch) {
      const xAddrs = xAddrsMatch[1].trim().split(' ');
      camera.onvifUrl = xAddrs[0];
      const ipMatch = xAddrs[0].match(/(\d+\.\d+\.\d+\.\d+)/);
      if (ipMatch) camera.ip = ipMatch[1];
    }

    const scopesMatch = xml.match(/<[^>]*Scopes[^>]*>([^<]+)<\/[^>]*Scopes>/i);
    if (scopesMatch) {
      const scopes = scopesMatch[1];
      const nameMatch = scopes.match(/onvif:\/\/www\.onvif\.org\/name\/([^\s]+)/i);
      const hwMatch   = scopes.match(/onvif:\/\/www\.onvif\.org\/hardware\/([^\s]+)/i);
      if (nameMatch) camera.brand = decodeURIComponent(nameMatch[1]);
      if (hwMatch)   camera.model = decodeURIComponent(hwMatch[1]);
    }

    /* Detect brand from manufacturer string */
    const brandLower = camera.brand.toLowerCase();
    if (brandLower.includes('hikvision') || brandLower.includes('hikvision')) camera.detectedBrand = 'hikvision';
    else if (brandLower.includes('dahua'))    camera.detectedBrand = 'dahua';
    else if (brandLower.includes('cp') || brandLower.includes('cpplus')) camera.detectedBrand = 'cpplus';
    else if (brandLower.includes('axis'))     camera.detectedBrand = 'axis';
    else if (brandLower.includes('bosch'))    camera.detectedBrand = 'bosch';
    else camera.detectedBrand = 'generic';

  } catch (e) {
    logger.warn(`Failed to parse ONVIF response from ${remoteIp}: ${e.message}`);
  }

  return camera;
}

/* ── Method 1: ONVIF WS-Discovery ── */
function discoverOnvif(timeoutMs = SCAN_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const cameras   = new Map();
    const socket    = dgram.createSocket('udp4');
    const probe     = Buffer.from(ONVIF_PROBE);

    socket.on('error', (err) => {
      logger.warn(`ONVIF discovery socket error: ${err.message}`);
      resolve([...cameras.values()]);
    });

    socket.on('message', (msg, rinfo) => {
      const xml    = msg.toString('utf8');
      const camera = parseOnvifResponse(xml, rinfo.address);
      if (!cameras.has(camera.ip)) {
        cameras.set(camera.ip, camera);
        logger.info(`ONVIF camera found: ${camera.ip} — ${camera.brand} ${camera.model}`);
      }
    });

    socket.bind(() => {
      try {
        socket.setBroadcast(true);
        socket.setMulticastTTL(128);
        socket.addMembership(ONVIF_MULTICAST);
        socket.send(probe, 0, probe.length, ONVIF_PORT, ONVIF_MULTICAST);
        /* Also send to broadcast */
        socket.send(probe, 0, probe.length, ONVIF_PORT, '255.255.255.255');
      } catch (e) {
        logger.warn(`ONVIF send error: ${e.message}`);
      }
    });

    setTimeout(() => {
      try { socket.close(); } catch (_) {}
      resolve([...cameras.values()]);
    }, timeoutMs);
  });
}

/* ── Method 2: Port scan for RTSP port 554 ── */
function scanPortOnHost(ip, port = RTSP_PORT, timeoutMs = PORT_SCAN_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const done = (open) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ ip, port, open });
      }
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error',   () => done(false));
    socket.connect(port, ip);
  });
}

async function portScanSubnet(subnet, onProgress) {
  const cameras  = [];
  const promises = [];
  const BATCH    = 20; /* scan 20 hosts concurrently */

  for (let i = 1; i <= 254; i++) {
    promises.push({ ip: `${subnet}.${i}`, idx: i });
  }

  for (let i = 0; i < promises.length; i += BATCH) {
    const batch   = promises.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(({ ip }) => scanPortOnHost(ip)));

    for (const r of results) {
      if (r.open) {
        cameras.push({
          ip:           r.ip,
          protocol:     'rtsp',
          brand:        'Unknown',
          model:        '',
          onvifUrl:     '',
          rtspUrls:     [],
          detectedBrand: 'generic',
          discovered:   new Date().toISOString(),
        });
        logger.info(`RTSP port open: ${r.ip}:${r.port}`);
      }
    }

    if (onProgress) {
      onProgress(Math.min(100, Math.round(((i + BATCH) / 254) * 100)));
    }
  }

  return cameras;
}

/* ── Build RTSP URLs for a camera ── */
function buildRtspUrls(camera, username = 'admin', password = '') {
  const patterns = RTSP_PATTERNS[camera.detectedBrand] || RTSP_PATTERNS.generic;
  return patterns.map(p =>
    p.replace('{user}', encodeURIComponent(username))
     .replace('{pass}', encodeURIComponent(password))
     .replace('{ip}',   camera.ip)
  );
}

/* ── Test if RTSP URL is reachable (TCP connect to port 554) ── */
function testRtspUrl(ip) {
  return scanPortOnHost(ip, RTSP_PORT, 2000);
}

/* ── Main discovery function ── */
async function discoverCameras({ subnet, method = 'all', username = 'admin', password = '', onProgress } = {}) {
  const found = new Map();

  try {
    /* ONVIF discovery */
    if (method === 'all' || method === 'onvif') {
      logger.info('Starting ONVIF WS-Discovery...');
      const onvifCams = await discoverOnvif();
      for (const cam of onvifCams) {
        cam.rtspUrls = buildRtspUrls(cam, username, password);
        found.set(cam.ip, cam);
      }
      logger.info(`ONVIF discovery complete: ${onvifCams.length} cameras found`);
    }

    /* Port scan */
    if (method === 'all' || method === 'portscan') {
      const subnets = subnet ? [subnet] : getLocalSubnets();
      logger.info(`Starting port scan on subnets: ${subnets.join(', ')}`);

      for (const sn of subnets) {
        const portCams = await portScanSubnet(sn, onProgress);
        for (const cam of portCams) {
          if (!found.has(cam.ip)) {
            cam.rtspUrls = buildRtspUrls(cam, username, password);
            found.set(cam.ip, cam);
          }
        }
      }
    }

  } catch (err) {
    logger.error(`Camera discovery error: ${err.message}`);
  }

  return [...found.values()];
}

module.exports = {
  discoverCameras,
  discoverOnvif,
  portScanSubnet,
  buildRtspUrls,
  testRtspUrl,
  getLocalSubnets,
};
