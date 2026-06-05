import { useState, useEffect } from 'react';
import axios from 'axios';

export default function TrialExpiredBanner() {
  const [trialInfo,  setTrialInfo]  = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const token = localStorage.getItem('safeg_token') || '';
        const res = await axios.get('/api/v1/trial/status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTrialInfo(res.data.data);
      } catch(e) {}
    };
    check();
  }, []);

  const goToUpgrade = () => {
    window.location.href = "/upgrade";
  };

  if (!trialInfo) return null;
  if (trialInfo.status === 'active') return null;

  const { status, daysLeft, isTrialMode } = trialInfo;

  if (status === 'expired') {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6,
          background:"rgba(255,61,61,.15)", border:"1px solid rgba(255,61,61,.3)",
          borderRadius:8, padding:"5px 10px" }}>
          <span style={{ fontSize:11 }}>🔒</span>
          <span style={{ fontSize:11, color:"#FF3D3D", fontWeight:700 }}>Trial Expired</span>
        </div>
        <button onClick={goToUpgrade} style={{
          background:"linear-gradient(135deg,#FF5B18,#FF8C52)",
          border:"none", borderRadius:8, padding:"6px 14px",
          color:"#fff", fontSize:11, fontWeight:800, cursor:"pointer",
          whiteSpace:"nowrap",
        }}>
          🔓 Subscribe →
        </button>
      </div>
    );
  }

  if (isTrialMode && daysLeft !== undefined) {
    const color = daysLeft <= 3 ? '#FF3D3D' : daysLeft <= 7 ? '#FFB400' : '#22D468';
    const urgent = daysLeft <= 7;

    return (
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6,
          background:`${color}15`, border:`1px solid ${color}30`,
          borderRadius:8, padding:"5px 10px" }}>
          <span style={{ fontSize:11 }}>{urgent ? "⚠️" : "🎯"}</span>
          <span style={{ fontSize:11, color, fontWeight:700 }}>
            {daysLeft}d left
          </span>
          <span style={{ fontSize:10, color:"#8899BB" }}>trial</span>
        </div>
        <button onClick={goToUpgrade} style={{
          background:`linear-gradient(135deg,#FF5B18,#FF8C52)`,
          border:"none", borderRadius:8, padding:"6px 14px",
          color:"#fff", fontSize:11, fontWeight:800,
          cursor:"pointer",
          whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:4,
        }}>
          💳 Subscribe →
        </button>
      </div>
    );
  }

  return null;
}
