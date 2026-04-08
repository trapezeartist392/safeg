/**
 * AIMonitorPanel.jsx
 * SafeguardsIQ — AI Monitoring Panel
 * Production: Browser captures webcam frames and sends to server Claude AI
 * Local: Python AI service handles webcam directly
 */

import { useState, useEffect, useRef } from 'react';

const AI_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://safeguardsiq.com/ai'
  : 'http://localhost:5050';

const IS_PRODUCTION = typeof window !== 'undefined' && window.location.hostname !== 'localhost';

const T = {
  bg:"#05080F", card:"#0C1422", card2:"#101828",
  border:"#1A2540", orange:"#FF5B18", teal:"#00D4B4",
  blue:"#2D8EFF", white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

const PPE_OPTIONS = [
  "Helmet","Safety Vest","Gloves","Safety Boots","Goggles","Face Mask",
  "Fire & Smoke","Chemical Hazard","Machinery Safety","Vehicle Safety","Working at Height","Housekeeping",
];
const PPE_ICONS = {
  "Helmet":"⛑️","Safety Vest":"🦺","Gloves":"🧤",
  "Safety Boots":"👢","Goggles":"🥽","Face Mask":"😷",
  "Fire & Smoke":"🔥","Chemical Hazard":"🧪","Machinery Safety":"⚙️",
  "Vehicle Safety":"🚗","Working at Height":"🏗️","Housekeeping":"🚧",
  "Pathway Violation":"🚧","Zone Violation":"⛔","Exit Blocked":"🚪",
};

export default function AIMonitorPanel() {
  const [aiOnline,  setAiOnline]  = useState(false);
  const [streams,   setStreams]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [expanded,  setExpanded]  = useState(false);
  const [camId,     setCamId]     = useState('laptop-webcam');
  const [rtspUrl,   setRtspUrl]   = useState('webcam:0');
  const [ppeTypes,  setPpeTypes]  = useState(['Helmet','Safety Vest','Gloves']);
  const [violLog,   setViolLog]   = useState([]);
  const [capturing, setCapturing] = useState(false);

  // Refs for browser webcam capture (production mode)
  const mediaStreamRef = useRef(null);
  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const intervalRef    = useRef(null);
  const ppeTypesRef    = useRef(ppeTypes);
  const camIdRef       = useRef(camId);

  // Keep refs in sync with state
  useEffect(() => { ppeTypesRef.current = ppeTypes; }, [ppeTypes]);
  useEffect(() => { camIdRef.current = camId; }, [camId]);

  const tenantId = localStorage.getItem('safeg_tenant') || 'ca5b55f4-bcac-4744-b07a-370503414ff1';

  /* ── AI health check ── */
  useEffect(() => {
    const init = async () => {
      try {
        const r = await fetch(`${AI_URL}/health`);
        if (!r.ok) { setAiOnline(false); return; }
        setAiOnline(true);

        if (IS_PRODUCTION) {
          // Production: no server-side streams, open form for user
          setExpanded(true);
          return;
        }

        // Local: check server streams
        const sr   = await fetch(`${AI_URL}/stream/status`);
        const sd   = await sr.json();
        const busy = Object.values(sd.streams || {}).some(s =>
          s.status === 'running' || s.status === 'analysing' || s.status === 'connecting'
        );
        if (!busy) setExpanded(true);
      } catch { setAiOnline(false); }
    };
    init();
    const t = setInterval(async () => {
      try { const r = await fetch(`${AI_URL}/health`); setAiOnline(r.ok); }
      catch { setAiOnline(false); }
    }, 10000);
    return () => clearInterval(t);
  }, [tenantId]);

  /* ── Poll stream status (local only) ── */
  useEffect(() => {
    if (IS_PRODUCTION) return; // production uses browser capture, no server streams
    const poll = async () => {
      try {
        const r    = await fetch(`${AI_URL}/stream/status`);
        const data = await r.json();
        const s    = data.streams || {};
        setStreams(s);

        Object.entries(s).forEach(([id, info]) => {
          if ((info.violations_today || 0) > 0 && info.last_violations_list?.length > 0) {
            setViolLog(prev => {
              const newEntries = info.last_violations_list.map((v, i) => ({
                id:       `${id}-${info.violations_today}-${i}`,
                camera:   id,
                type:     v.type,
                category: v.category || 'ppe',
                persons:  info.persons_detected || 0,
                total:    info.violations_today  || 0,
                time:     new Date().toLocaleTimeString(),
                desc:     v.description || '',
              }));
              const combined = [...newEntries, ...prev];
              const unique   = combined.filter((v, i, arr) =>
                arr.findIndex(x => x.id === v.id) === i
              );
              return unique.slice(0, 20);
            });
          }
        });
      } catch {}
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, []);

  /* ── Browser webcam capture (production) ── */
  const analyseBrowserFrame = async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    try {
      canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);
      const b64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      const res  = await fetch(`${AI_URL}/detect`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: b64,
          camera_id:    camIdRef.current,
          ppe_types:    ppeTypesRef.current,
        }),
      });
      const data = await res.json();
      const id   = camIdRef.current;

      setStreams(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          status:              'running',
          rtsp_url:            'browser-webcam',
          last_detection:      new Date().toISOString(),
          persons_detected:    data.persons_detected || 0,
          risk_level:          data.risk_level || 'safe',
          violations_today:    (prev[id]?.violations_today || 0) + (data.violations?.length || 0),
          ppe_violations:      data.ppe_violations || 0,
          pathway_violations:  data.pathway_violations || 0,
          unsafe_violations:   data.unsafe_violations || 0,
          accident_violations: data.accident_violations || 0,
          nearmiss_violations: data.nearmiss_violations || 0,
          current_violations:  (data.violations || []).map(v => v.type),
          current_categories:  (data.violations || []).map(v => v.category),
          last_violations_list: data.violations || [],
          last_violation:      data.violations?.[0]?.type || prev[id]?.last_violation,
          last_category:       data.violations?.[0]?.category || prev[id]?.last_category,
          last_summary:        data.summary || '',
          compliant:           data.compliant ?? true,
          ppe_types:           ppeTypesRef.current,
        }
      }));

      if (data.violations?.length > 0) {
        setViolLog(prev => {
          const now = Date.now();
          const newEntries = data.violations.map((v, i) => ({
            id:       `${id}-${now}-${i}`,
            camera:   id,
            type:     v.type,
            category: v.category || 'ppe',
            persons:  data.persons_detected || 0,
            total:    (streams[id]?.violations_today || 0) + data.violations.length,
            time:     new Date().toLocaleTimeString(),
            desc:     v.description || '',
          }));
          return [...newEntries, ...prev].slice(0, 20);
        });
      }
    } catch (e) {
      console.error('Analysis error:', e);
    }
  };

  /* ── Start monitoring ── */
  const startStream = async () => {
    setLoading(true); setError('');

    if (IS_PRODUCTION) {
      // Production: capture from browser webcam
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        mediaStreamRef.current = media;

        // Setup hidden video
        const video       = document.createElement('video');
        video.srcObject   = media;
        video.muted       = true;
        video.playsInline = true;
        videoRef.current  = video;
        await video.play();

        // Setup canvas
        const canvas      = document.createElement('canvas');
        canvas.width      = 640;
        canvas.height     = 480;
        canvasRef.current = canvas;

        setCapturing(true);
        setExpanded(false);

        // Init stream state
        setStreams(prev => ({
          ...prev,
          [camId]: {
            status:              'running',
            rtsp_url:            'browser-webcam',
            ppe_types:           ppeTypes,
            started_at:          new Date().toISOString(),
            violations_today:    0,
            persons_detected:    0,
            risk_level:          'safe',
            ppe_violations:      0,
            pathway_violations:  0,
            unsafe_violations:   0,
            accident_violations: 0,
            nearmiss_violations: 0,
            current_violations:  [],
            current_categories:  [],
            last_violations_list:[],
            last_violation:      null,
            last_summary:        '',
            compliant:           true,
          }
        }));

        // Analyse immediately then every 15s
        await analyseBrowserFrame();
        intervalRef.current = setInterval(analyseBrowserFrame, 15000);

      } catch (e) {
        setError('Camera error: ' + e.message);
      }
    } else {
      // Local: use Python AI service stream
      try {
        const r = await fetch(`${AI_URL}/stream/start`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            camera_id:  camId,
            rtsp_url:   rtspUrl,
            tenant_id:  tenantId,
            ppe_types:  ppeTypes,
            confidence: 0.1,
          }),
        });
        const d = await r.json();
        if (d.success) setExpanded(false);
        else setError(d.message || 'Failed to start');
      } catch (e) {
        setError(e.message);
      }
    }

    setLoading(false);
  };

  /* ── Stop monitoring ── */
  const stopStream = async (id) => {
    if (IS_PRODUCTION) {
      // Stop browser capture
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(t => t.stop()); mediaStreamRef.current = null; }
      if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current = null; }
      setCapturing(false);
      setStreams(prev => ({ ...prev, [id]: { ...prev[id], status: 'stopped' } }));
    } else {
      await fetch(`${AI_URL}/stream/stop`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera_id: id }),
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const togglePpe = p => setPpeTypes(prev =>
    prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
  );

  const allStreams       = Object.entries(streams);
  const activeStreams    = allStreams.filter(([, s]) => s.status === 'running' || s.status === 'analysing');
  const totalViolations = allStreams.reduce((n, [, s]) => n + (s.violations_today || 0), 0);
  const totalPersons    = allStreams.reduce((n, [, s]) => n + (s.persons_detected  || 0), 0);

  return (
    <div style={{ fontFamily:"'Nunito',sans-serif", marginBottom:20 }}>

      {/* ── AI STATUS CARD ── */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:20, marginBottom:16 }}>

        {/* Header row */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:(expanded||allStreams.length>0)?16:0 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:aiOnline?T.green:T.red, flexShrink:0,
            boxShadow:aiOnline?`0 0 8px ${T.green}`:undefined }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:T.white }}>AI Detection Engine</div>
            <div style={{ fontSize:11, color:T.g1 }}>
              {aiOnline
                ? IS_PRODUCTION
                  ? "Online — Claude Vision (browser capture)"
                  : "Online — monitoring active"
                : "Offline — AI service not running"}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"flex", gap:20, marginRight:8 }}>
            {[
              { label:"ACTIVE",     val:activeStreams.length, color:T.green },
              { label:"PERSONS",    val:totalPersons,          color:T.blue  },
              { label:"VIOLATIONS", val:totalViolations,       color:totalViolations>0?T.red:T.g1 },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:26, fontWeight:800, color, fontFamily:"'Bebas Neue'", lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:9, color:T.g2, letterSpacing:1 }}>{label}</div>
              </div>
            ))}
          </div>

          <button onClick={() => setExpanded(e => !e)} style={{
            background:"none", border:`1px solid ${T.border}`, borderRadius:8,
            padding:"7px 16px", color:T.g1, fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"'Nunito'",
          }}>
            {expanded ? "▲ Close" : "▼ Add Camera"}
          </button>
        </div>

        {/* Add camera form */}
        {expanded && (
          <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:11, color:T.orange, fontWeight:800, letterSpacing:1.5, marginBottom:14 }}>
              {IS_PRODUCTION ? "CONNECT BROWSER CAMERA" : "CONNECT CAMERA"}
            </div>

            {!IS_PRODUCTION && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:10, color:T.g1, display:"block", marginBottom:5, letterSpacing:1, fontWeight:700 }}>CAMERA NAME</label>
                  <input value={camId} onChange={e=>setCamId(e.target.value)}
                    style={{ width:"100%", background:"#06090F", border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", color:T.white, fontSize:13, fontFamily:"'Nunito'", outline:"none", boxSizing:"border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize:10, color:T.g1, display:"block", marginBottom:5, letterSpacing:1, fontWeight:700 }}>STREAM URL</label>
                  <input value={rtspUrl} onChange={e=>setRtspUrl(e.target.value)} placeholder="webcam:0"
                    style={{ width:"100%", background:"#06090F", border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 12px", color:T.white, fontSize:12, fontFamily:"'DM Mono'", outline:"none", boxSizing:"border-box" }}/>
                </div>
              </div>
            )}

            {!IS_PRODUCTION && (
              <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                {[
                  { label:"💻 Laptop Webcam", url:"webcam:0" },
                  { label:"📷 External Cam",  url:"webcam:1" },
                  { label:"📹 CP Plus",       url:"rtsp://admin:password@192.168.1.9:554/stream0" },
                ].map(({ label, url }) => (
                  <button key={url} onClick={() => setRtspUrl(url)} style={{
                    padding:"6px 14px", borderRadius:8,
                    border:`1px solid ${rtspUrl===url?T.teal:T.border}`,
                    background:rtspUrl===url?`${T.teal}20`:T.card,
                    color:rtspUrl===url?T.teal:T.g1,
                    fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'Nunito'",
                  }}>{label}</button>
                ))}
              </div>
            )}

            {IS_PRODUCTION && (
              <div style={{ marginBottom:14, padding:"10px 14px", background:`${T.teal}10`, border:`1px solid ${T.teal}30`, borderRadius:8, fontSize:11, color:T.teal }}>
                📷 Your browser camera will be used. Allow camera access when prompted.
                Frames are sent to Claude AI every 15 seconds for analysis.
              </div>
            )}

            {/* PPE selector */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, color:T.g1, display:"block", marginBottom:8, letterSpacing:1, fontWeight:700 }}>PPE TYPES TO DETECT</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {PPE_OPTIONS.map(p => {
                  const on = ppeTypes.includes(p);
                  return (
                    <button key={p} onClick={() => togglePpe(p)} style={{
                      padding:"6px 14px", borderRadius:20,
                      border:`1px solid ${on?T.orange:T.border}`,
                      background:on?`${T.orange}20`:T.card,
                      color:on?T.orange:T.g1,
                      fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Nunito'",
                    }}>{PPE_ICONS[p]} {on?"✓ ":""}{p}</button>
                  );
                })}
              </div>
            </div>

            {error && <div style={{ marginBottom:10, padding:"8px 12px", background:`${T.red}10`, border:`1px solid ${T.red}30`, borderRadius:8, fontSize:12, color:T.red }}>⚠ {error}</div>}

            <button onClick={startStream} disabled={loading||!aiOnline} style={{
              width:"100%", border:"none", borderRadius:10, padding:"13px",
              color:"#fff", fontSize:14, fontWeight:800, fontFamily:"'Nunito'",
              background:loading||!aiOnline?T.g2:`linear-gradient(135deg,${T.orange},#FF8C52)`,
              cursor:loading||!aiOnline?"not-allowed":"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            }}>
              {loading ? "Starting..." : !aiOnline ? "⚠ AI Service Offline" : "▶ Start AI Monitoring"}
            </button>
          </div>
        )}

        {/* Stream cards */}
        {allStreams.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {allStreams.map(([id, s]) => {
              const running = s.status === 'running' || s.status === 'analysing';
              const viols   = s.violations_today || 0;
              const persons = s.persons_detected  || 0;
              return (
                <div key={id} style={{
                  background:T.card2,
                  border:`1px solid ${running ? T.green+"50" : T.border}`,
                  borderRadius:12, padding:16,
                }}>
                  {/* Stream header */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:running?T.green:T.g2, flexShrink:0,
                      animation:running?"blink 1.5s infinite":undefined }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:T.white }}>{id}</div>
                      <div style={{ fontSize:10, color:T.g1, fontFamily:"'DM Mono'" }}>{s.rtsp_url} · {s.status}</div>
                    </div>
                    {running && (
                      <button onClick={() => stopStream(id)} style={{
                        background:"none", border:`1px solid ${T.red}40`, borderRadius:6,
                        padding:"5px 10px", color:T.red, fontSize:11, fontWeight:700, cursor:"pointer",
                      }}>■ Stop</button>
                    )}
                  </div>

                  {/* Stats row */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:8, marginBottom:viols>0?12:0 }}>
                    {[
                      { label:"PERSONS",   val:persons,                    color:persons>0?T.blue:T.g2 },
                      { label:"PPE",       val:s.ppe_violations||0,        color:(s.ppe_violations||0)>0?T.red:T.green },
                      { label:"PATHWAY",   val:s.pathway_violations||0,    color:(s.pathway_violations||0)>0?T.amber:T.g2 },
                      { label:"UNSAFE",    val:s.unsafe_violations||0,     color:(s.unsafe_violations||0)>0?T.amber:T.g2 },
                      { label:"ACCIDENTS", val:(s.accident_violations||0)+(s.nearmiss_violations||0), color:(s.accident_violations||0)>0?"#FF0000":T.g2 },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                        <div style={{ fontSize:20, fontWeight:800, color, fontFamily:"'Bebas Neue'", lineHeight:1, marginBottom:4 }}>{val||0}</div>
                        <div style={{ fontSize:9, color:T.g2, letterSpacing:1 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* PPE violation badges */}
                  {viols > 0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                      {[...new Set(s.current_violations?.length > 0 ? s.current_violations : s.last_violation ? [s.last_violation] : [])].map(ppe => (
                        <div key={ppe} style={{ display:"flex", alignItems:"center", gap:6,
                          background:`${T.red}12`, border:`1px solid ${T.red}35`, borderRadius:8, padding:"5px 12px" }}>
                          <span style={{ fontSize:14 }}>{PPE_ICONS[ppe]||"⚠"}</span>
                          <span style={{ fontSize:12, color:T.red, fontWeight:700 }}>No {ppe}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* All current violations detail */}
                  {s.last_violations_list?.length > 0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {s.last_violations_list.map((v, i) => {
                        const catColor = v.category==='accident'?"#FF0000":v.category==='nearmiss'?"#FF6B00":v.category==='unsafe'?T.amber:v.category==='pathway'?"#00BCD4":T.red;
                        const catLabel = v.category==='accident'?"🚨":v.category==='nearmiss'?"❗":v.category==='unsafe'?"⚠️":v.category==='pathway'?"🚧":"⛑️";
                        return (
                          <div key={i} style={{ padding:"8px 12px", background:`${catColor}10`,
                            border:`1px solid ${catColor}30`, borderRadius:8,
                            display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontSize:16 }}>{PPE_ICONS[v.type] || catLabel}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:800, color:catColor }}>No {v.type}</div>
                              {v.description && (
                                <div style={{ fontSize:9, color:T.g1, marginTop:1 }}>{v.description}</div>
                              )}
                            </div>
                            <div style={{ background:`${catColor}25`, border:`1px solid ${catColor}40`,
                              borderRadius:6, padding:"2px 8px", fontSize:9, fontWeight:800, color:catColor }}>
                              {v.category?.toUpperCase() || 'PPE'}
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ fontSize:9, color:T.g1, fontFamily:"'DM Mono'", textAlign:"right" }}>
                        Last detected: {s.last_detection ? new Date(s.last_detection).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true}) : ""}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {allStreams.length === 0 && !expanded && (
          <div style={{ textAlign:"center", padding:"14px 0", color:T.g2, fontSize:12 }}>
            {aiOnline ? "Click \"Add Camera\" to start monitoring" : "No cameras monitoring · AI service offline"}
          </div>
        )}
      </div>

      {/* ── VIOLATION LOG ── */}
      {violLog.length > 0 && (
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:11, color:T.red, fontWeight:800, letterSpacing:1.5 }}>LIVE VIOLATION LOG</div>
            <button onClick={()=>setViolLog([])} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"3px 10px", color:T.g1, fontSize:10, fontWeight:700, cursor:"pointer" }}>Clear</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {violLog.slice(0, 10).map((v, i) => {
              const catColor = v.category==='accident'?"#FF0000":v.category==='nearmiss'?"#FF6B00":v.category==='unsafe'?T.amber:v.category==='pathway'?"#00BCD4":T.red;
              const catLabel = v.category==='accident'?"🚨 ACCIDENT":v.category==='nearmiss'?"❗ NEAR MISS":v.category==='unsafe'?"⚠️ UNSAFE":v.category==='pathway'?"🚧 PATHWAY":"⛑️ PPE";
              return (
                <div key={v.id||i} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                  background:`${catColor}08`, border:`1px solid ${catColor}25`, borderRadius:10,
                }}>
                  <span style={{ fontSize:24, flexShrink:0 }}>{PPE_ICONS[v.type]||"⚠️"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:catColor, marginBottom:2 }}>{catLabel}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:T.white }}>No {v.type}</div>
                    {v.desc && <div style={{ fontSize:10, color:T.g1, marginTop:2 }}>{v.desc}</div>}
                    <div style={{ fontSize:10, color:T.g1, marginTop:2 }}>
                      {v.camera} · {v.persons} person{v.persons!==1?"s":""} · {v.time}
                    </div>
                  </div>
                  <div style={{ textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontSize:22, fontWeight:800, color:catColor, fontFamily:"'Bebas Neue'", lineHeight:1 }}>{v.total}</div>
                    <div style={{ fontSize:8, color:T.g2, letterSpacing:1 }}>TODAY</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}
