/**
 * ComplianceReportGenerator.jsx
 * SafeguardsIQ — Monthly Compliance Report PDF Downloader
 * Place in: frontend/src/components/ComplianceReportGenerator.jsx
 */
import { useState } from 'react';
import axios from 'axios';

const T = {
  bg:"#05080F", card:"#0C1422", card2:"#101828",
  border:"#1A2540", orange:"#FF5B18", teal:"#00D4B4",
  white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const iStyle = {
  width:"100%", background:"#06090F", border:`1px solid ${T.border}`,
  borderRadius:8, padding:"9px 12px", color:T.white, fontSize:12,
  fontFamily:"'Nunito',sans-serif", outline:"none", boxSizing:"border-box",
};

export default function ComplianceReportGenerator() {
  const now = new Date();
  const [form, setForm] = useState({
    month:            now.getMonth() + 1,
    year:             now.getFullYear(),
    ehs_officer:      '',
    manager_name:     '',
    director:         '',
    corrective_actions: '',
  });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [expanded, setExpanded] = useState(true);

  const token = localStorage.getItem('safeg_token') || '';
  const set   = (k, v) => setForm(p => ({...p,[k]:v}));

  const generate = async () => {
    setLoading(true); setError(''); setSuccess(false);
    try {
      const payload = {
        ...form,
        corrective_actions: form.corrective_actions
          ? form.corrective_actions.split('\n').filter(Boolean)
          : undefined,
      };
      const res = await axios.post('/api/v1/compliance/report', payload, {
        headers:      { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url    = URL.createObjectURL(new Blob([res.data], { type:'application/pdf' }));
      const link   = document.createElement('a');
      const name   = `CR-${form.year}-${String(form.month).padStart(2,'0')}.pdf`;
      link.href    = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch(e) {
      const msg = e.response?.data;
      if (msg instanceof Blob) {
        const text = await msg.text();
        try { setError(JSON.parse(text).message); } catch { setError(text); }
      } else {
        setError(e.message || 'Failed to generate report');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily:"'Nunito',sans-serif", marginBottom:20 }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden" }}>

        {/* Header */}
        <div style={{ background:T.bg, padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
          onClick={() => setExpanded(e => !e)}>
          <span style={{ fontSize:20 }}>📊</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.white }}>
              Monthly Compliance Report
            </div>
            <div style={{ fontSize:11, color:T.g1 }}>
              ISO 45001:2018 · Factories Act 1948 · SEBI BRSR · Auto-populated from AI detection data
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {['ISO 45001','Factories Act','BRSR'].map(tag => (
              <div key={tag} style={{ fontSize:9, fontWeight:700, color:T.teal,
                background:`${T.teal}15`, border:`1px solid ${T.teal}30`,
                padding:"2px 8px", borderRadius:4 }}>{tag}</div>
            ))}
            <span style={{ color:T.g1, fontSize:14 }}>{expanded?"▲":"▼"}</span>
          </div>
        </div>

        {expanded && (
          <div style={{ padding:20 }}>

            {/* Info banner */}
            <div style={{ marginBottom:16, padding:"10px 14px",
              background:`${T.teal}10`, border:`1px solid ${T.teal}30`,
              borderRadius:10, fontSize:12, color:T.teal }}>
              📋 This report is auto-populated from AI violation data for the selected month.
              KPIs, PPE breakdown, camera compliance and incident data are pulled from the database automatically.
            </div>

            {/* Month/Year selector */}
            <div style={{ fontSize:11, color:T.orange, fontWeight:800,
              letterSpacing:1.5, marginBottom:12,
              borderBottom:`1px solid ${T.border}`, paddingBottom:6 }}>
              REPORT PERIOD
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
              <div>
                <label style={{ fontSize:10, color:T.g1, display:"block",
                  marginBottom:5, letterSpacing:1, fontWeight:700 }}>MONTH</label>
                <select value={form.month} onChange={e => set('month', parseInt(e.target.value))}
                  style={iStyle}>
                  {MONTHS.map((m,i) => (
                    <option key={i} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize:10, color:T.g1, display:"block",
                  marginBottom:5, letterSpacing:1, fontWeight:700 }}>YEAR</label>
                <select value={form.year} onChange={e => set('year', parseInt(e.target.value))}
                  style={iStyle}>
                  {[2024,2025,2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Signing officers */}
            <div style={{ fontSize:11, color:T.orange, fontWeight:800,
              letterSpacing:1.5, marginBottom:12,
              borderBottom:`1px solid ${T.border}`, paddingBottom:6 }}>
              SIGNING OFFICERS
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
              {[
                { key:"ehs_officer",  label:"EHS OFFICER NAME" },
                { key:"manager_name", label:"PLANT MANAGER NAME" },
                { key:"director",     label:"OCCUPIER / DIRECTOR" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:10, color:T.g1, display:"block",
                    marginBottom:5, letterSpacing:1, fontWeight:700 }}>{f.label}</label>
                  <input value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                    style={iStyle}/>
                </div>
              ))}
            </div>

            {/* Corrective actions */}
            <div style={{ fontSize:11, color:T.orange, fontWeight:800,
              letterSpacing:1.5, marginBottom:12,
              borderBottom:`1px solid ${T.border}`, paddingBottom:6 }}>
              CORRECTIVE ACTIONS (optional — one per line)
            </div>
            <textarea
              value={form.corrective_actions}
              onChange={e => set('corrective_actions', e.target.value)}
              rows={4} placeholder={"Reinforce helmet compliance at Assembly Line A\nInstall PPE dispensers at entry points\nConduct monthly safety training"}
              style={{ ...iStyle, resize:"vertical", marginBottom:20 }}/>

            {/* Error / Success */}
            {error && (
              <div style={{ marginBottom:12, padding:"10px 14px",
                background:`${T.red}10`, border:`1px solid ${T.red}30`,
                borderRadius:8, fontSize:12, color:T.red }}>⚠ {error}</div>
            )}
            {success && (
              <div style={{ marginBottom:12, padding:"10px 14px",
                background:`${T.green}10`, border:`1px solid ${T.green}30`,
                borderRadius:8, fontSize:12, color:T.green }}>
                ✅ Compliance report downloaded. Ready for regulatory submission.
              </div>
            )}

            {/* Generate button */}
            <button onClick={generate} disabled={loading} style={{
              width:"100%", border:"none", borderRadius:10, padding:"14px",
              color:"#fff", fontSize:14, fontWeight:800, fontFamily:"'Nunito',sans-serif",
              background:loading ? T.g2 : `linear-gradient(135deg,${T.orange},#FF8C52)`,
              cursor:loading?"not-allowed":"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            }}>
              {loading ? (
                <><div style={{ width:18, height:18, border:"2px solid rgba(255,255,255,.3)",
                  borderTopColor:"#fff", borderRadius:"50%",
                  animation:"spin .8s linear infinite" }}/>Generating PDF...</>
              ) : (
                <><span style={{ fontSize:18 }}>📊</span>
                Generate {MONTHS[form.month-1]} {form.year} Compliance Report</>
              )}
            </button>

            <div style={{ marginTop:10, fontSize:10, color:T.g2, textAlign:"center" }}>
              Includes: KPI summary · PPE breakdown · Camera compliance · Unsafe acts ·
              Monthly trend · Corrective actions · Regulatory status (ISO 45001, Factories Act, BRSR)
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
