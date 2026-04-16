/**
 * TrialExpiredBanner.jsx
 * SafeguardsIQ — Trial Status Banner
 * Shows trial days remaining or expired upgrade prompt
 * Place in: frontend/src/components/TrialExpiredBanner.jsx
 * Add at top of safety-monitor.jsx main content area
 */
import { useState, useEffect } from 'react';
import axios from 'axios';

const T = {
  card:"#0C1422", border:"#1A2540", orange:"#FF5B18",
  white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

export default function TrialExpiredBanner() {
  const [trialInfo, setTrialInfo] = useState(null);
  const token = localStorage.getItem('safeg_token') || '';

  useEffect(() => {
    const check = async () => {
      try {
        const res = await axios.get('/api/v1/trial/status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTrialInfo(res.data.data);
      } catch(e) {
        // Silently fail — don't block dashboard
      }
    };
    check();
  }, []);

  if (!trialInfo) return null;
  if (trialInfo.status === 'active') return null; // paying customer — no banner

  const { status, daysLeft, isTrialMode } = trialInfo;

  // Trial expired
  if (status === 'expired') {
    return (
      <div style={{ background:"#FF3D3D10", border:"2px solid #FF3D3D40",
        borderRadius:12, padding:"20px 24px", marginBottom:16,
        display:"flex", alignItems:"center", gap:16 }}>
        <span style={{ fontSize:32 }}>🔒</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, color:T.red, marginBottom:4 }}>
            Your SafeguardsIQ Trial Has Expired
          </div>
          <div style={{ fontSize:12, color:T.g1 }}>
            Your workers are no longer being monitored. Upgrade to continue protection.
            One prevented accident pays for 3 years of SafeguardsIQ.
          </div>
        </div>
        <button onClick={() => window.location.href='/billing'}
          style={{ background:`linear-gradient(135deg,${T.orange},#FF8C52)`,
            border:"none", borderRadius:10, padding:"12px 24px",
            color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer",
            flexShrink:0, whiteSpace:"nowrap" }}>
          🔓 Upgrade Now →
        </button>
      </div>
    );
  }

  // Trial active — show days remaining
  if (isTrialMode && daysLeft !== undefined) {
    const color  = daysLeft <= 3 ? T.red : daysLeft <= 7 ? T.amber : T.green;
    const urgent = daysLeft <= 3;

    return (
      <div style={{ background:`${color}08`, border:`1px solid ${color}30`,
        borderRadius:10, padding:"12px 20px", marginBottom:12,
        display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:20 }}>{urgent ? "⚠️" : "🎯"}</span>
        <div style={{ flex:1 }}>
          <span style={{ fontSize:12, color:T.g1 }}>
            Free trial · {" "}
          </span>
          <span style={{ fontSize:13, fontWeight:800, color }}>
            {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
          </span>
          {urgent && (
            <span style={{ fontSize:12, color:T.g1 }}>
              {" "} — Upgrade now to avoid interruption
            </span>
          )}
        </div>
        {daysLeft <= 7 && (
          <button onClick={() => window.location.href='/billing'}
            style={{ background:urgent?`linear-gradient(135deg,${T.red},${T.orange})`:`linear-gradient(135deg,${T.orange},#FF8C52)`,
              border:"none", borderRadius:8, padding:"8px 18px",
              color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer",
              flexShrink:0 }}>
            Upgrade →
          </button>
        )}
      </div>
    );
  }

  return null;
}
