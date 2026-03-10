/**
 * SafeG AI — Frontend API Service
 * ─────────────────────────────────
 * Drop this file into your React app as src/services/api.js
 *
 * Usage in the onboarding wizard:
 *   import api from './services/api';
 *   const result = await api.onboarding.activate({ customer, plant, areas, cameras, password });
 */

const BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000/api/v1';
const WS_URL   = import.meta.env?.VITE_WS_URL  || 'ws://localhost:4000/ws';

// ── Token management (localStorage in real app, memory for Claude artifact)
let _accessToken  = null;
let _refreshToken = null;

export const tokenStore = {
  get:         () => _accessToken,
  getRefresh:  () => _refreshToken,
  set:         (a, r) => { _accessToken = a; if (r) _refreshToken = r; },
  clear:       () => { _accessToken = null; _refreshToken = null; },
};

// ── Base fetch wrapper with auto-refresh
async function request(method, path, body = null, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401
  if (res.status === 401 && _refreshToken && !opts._retry) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });
      const data = await refreshRes.json();
      if (data.success) {
        tokenStore.set(data.data.accessToken, data.data.refreshToken);
        return request(method, path, body, { ...opts, _retry: true });
      }
    } catch { /* fall through */ }
    tokenStore.clear();
    window.location.href = '/login';
    return;
  }

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.message || 'Request failed');
    err.status = res.status;
    err.errors = json.errors;
    throw err;
  }
  return json;
}

const get    = (path, q)    => request('GET',    path + (q ? '?' + new URLSearchParams(q) : ''));
const post   = (path, body) => request('POST',   path, body);
const put    = (path, body) => request('PUT',    path, body);
const del    = (path)       => request('DELETE', path);

// ════════════════════════════════════════════════════════
// API MODULES
// ════════════════════════════════════════════════════════

const api = {

  // ── AUTH
  auth: {
    login:         ({ email, password }) => post('/auth/login', { email, password }).then(r => {
      tokenStore.set(r.data.accessToken, r.data.refreshToken);
      return r;
    }),
    logout:        ()            => post('/auth/logout').then(r => { tokenStore.clear(); return r; }),
    me:            ()            => get('/auth/me'),
    forgotPassword: (email)      => post('/auth/forgot-password', { email }),
    resetPassword: (token, password) => post('/auth/reset-password', { token, password }),
    checkEmail:    (email)       => get('/onboarding/check-email', { email }),
  },

  // ── ONBOARDING (main wizard endpoint)
  onboarding: {
    /**
     * Called when user clicks "Activate SafeG AI" in wizard.
     * Sends all 4 steps in a single request.
     *
     * @param {Object} param
     * @param {Object} param.customer   - Step 1 state
     * @param {Object} param.plant      - Step 2 state
     * @param {Array}  param.areas      - Step 3 areas array
     * @param {Array}  param.cameras    - Step 4 cameras array
     * @param {string} param.password   - Admin password
     */
    activate: ({ customer, plant, areas, cameras, password }) =>
      post('/onboarding/activate', { customer, plant, areas, cameras, password }).then(r => {
        tokenStore.set(r.data.accessToken, r.data.refreshToken);
        return r;
      }),

    saveDraft: (payload) => post('/onboarding/save-draft', payload),
  },

  // ── CUSTOMERS
  customers: {
    list:   (q)       => get('/customers', q),
    create: (data)    => post('/customers', data),
    get:    (id)      => get(`/customers/${id}`),
    update: (id, d)   => put(`/customers/${id}`, d),
    remove: (id)      => del(`/customers/${id}`),
    stats:  (id)      => get(`/customers/${id}/stats`),
  },

  // ── PLANTS
  plants: {
    list:       (q)     => get('/plants', q),
    create:     (data)  => post('/plants', data),
    get:        (id)    => get(`/plants/${id}`),
    update:     (id,d)  => put(`/plants/${id}`, d),
    remove:     (id)    => del(`/plants/${id}`),
    dashboard:  (id)    => get(`/plants/${id}/dashboard`),
    areas:      (id)    => get(`/plants/${id}/areas`),
    cameras:    (id)    => get(`/plants/${id}/cameras`),
  },

  // ── AREAS
  areas: {
    list:        (q)    => get('/areas', q),
    create:      (data) => post('/areas', data),
    get:         (id)   => get(`/areas/${id}`),
    update:      (id,d) => put(`/areas/${id}`, d),
    remove:      (id)   => del(`/areas/${id}`),
    cameras:     (id)   => get(`/areas/${id}/cameras`),
    violations:  (id,q) => get(`/areas/${id}/violations`, q),
    ppeStats:    (id,q) => get(`/areas/${id}/ppe-stats`, q),
  },

  // ── CAMERAS
  cameras: {
    list:         (q)    => get('/cameras', q),
    create:       (data) => post('/cameras', data),
    get:          (id)   => get(`/cameras/${id}`),
    update:       (id,d) => put(`/cameras/${id}`, d),
    remove:       (id)   => del(`/cameras/${id}`),
    testConnection: (id) => post(`/cameras/${id}/test-connection`),
    restart:       (id)  => post(`/cameras/${id}/restart`),
    health:        (id)  => get(`/cameras/${id}/health`),
    liveFrame:     (id)  => `${BASE_URL}/cameras/${id}/live-frame?token=${_accessToken}`,
    updateAiConfig: (id, cfg) => put(`/cameras/${id}/ai-config`, cfg),
  },

  // ── VIOLATIONS
  violations: {
    list:        (q)        => get('/violations', q),
    get:         (id)       => get(`/violations/${id}`),
    stats:       (q)        => get('/violations/stats', q),
    acknowledge: (id)       => put(`/violations/${id}/acknowledge`),
    resolve:     (id, action) => put(`/violations/${id}/resolve`, { correctiveAction: action }),
    assign:      (id, uid)  => put(`/violations/${id}/assign`, { assignTo: uid }),
    escalate:    (id)       => post(`/violations/${id}/escalate`),
    form18Data:  (id)       => get(`/violations/${id}/form18`),
  },

  // ── FORM 18
  form18: {
    list:   (q)     => get('/form18', q),
    create: (data)  => post('/form18', data),
    get:    (id)    => get(`/form18/${id}`),
    update: (id,d)  => put(`/form18/${id}`, d),
    submit: (id)    => post(`/form18/${id}/submit`),
  },

  // ── DASHBOARD
  dashboard: {
    overview: (q) => get('/dashboard/overview', q),
    kpis:     (q) => get('/dashboard/kpis', q),
    timeline: (q) => get('/dashboard/timeline', q),
    ppeTrend: (q) => get('/dashboard/ppe-trend', q),
  },

  // ── INSPECTIONS
  inspections: {
    list:    (q)      => get('/inspections', q),
    create:  (data)   => post('/inspections', data),
    signOff: (id)     => put(`/inspections/${id}/sign-off`),
  },

  // ── REPORTS
  reports: {
    list:     (q)     => get('/reports', q),
    generate: (data)  => post('/reports/generate', data),
  },

  // ── ALERTS
  alerts: {
    list: (q) => get('/alerts', q),
  },

  // ── USERS
  users: {
    list:   (q)     => get('/users', q),
    create: (data)  => post('/users', data),
    update: (id,d)  => put(`/users/${id}`, d),
  },
};

export default api;

// ════════════════════════════════════════════════════════
// WEBSOCKET CLIENT
// Connects to backend WS server for real-time updates
// ════════════════════════════════════════════════════════

export class SafeGWebSocket {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 2000;
  }

  connect() {
    const token = tokenStore.get();
    if (!token) return;

    this.ws = new WebSocket(`${WS_URL}?token=${token}`);

    this.ws.onopen = () => {
      console.log('[SafeG WS] Connected');
      this.reconnectDelay = 2000;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      console.log('[SafeG WS] Disconnected — reconnecting in', this.reconnectDelay, 'ms');
      this.reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
        this.connect();
      }, this.reconnectDelay);
    };

    this.ws.onerror = (err) => console.error('[SafeG WS] Error:', err);
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

// ════════════════════════════════════════════════════════
// REACT HOOK — useSafeGWebSocket
// ════════════════════════════════════════════════════════
export function useSafeGWebSocket(handlers = {}) {
  // Only works in React context — include in your app with:
  // const { violations, cameras, kpis } = useSafeGWebSocket({ onViolation: handleNew });
  //
  // handlers:
  //   onViolation(violation)      — new violation detected
  //   onCameraHealth(data)        — camera status change
  //   onKpiUpdate(data)           — dashboard KPI changed
  //   onAlert(data)               — alert sent confirmation

  const handler = (msg) => {
    switch (msg.type) {
      case 'violations':     handlers.onViolation?.(msg.data);    break;
      case 'camera_health':  handlers.onCameraHealth?.(msg.data); break;
      case 'ppe_events':     handlers.onKpiUpdate?.(msg.data);    break;
      case 'alerts':         handlers.onAlert?.(msg.data);        break;
      case 'onboarding_complete': handlers.onActivated?.(msg.data); break;
      default: handlers.onAny?.(msg);
    }
  };

  return new SafeGWebSocket(handler);
}
