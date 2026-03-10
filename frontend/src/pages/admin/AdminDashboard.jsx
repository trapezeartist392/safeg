import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

/* ─── FONTS & ANIMATIONS ───────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideLeft{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.2);opacity:0}}
@keyframes flow{0%{stroke-dashoffset:60}100%{stroke-dashoffset:0}}
@keyframes glow{0%,100%{opacity:.6}50%{opacity:1}}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:#05070E}
::-webkit-scrollbar-thumb{background:#1E2A40;border-radius:4px}
input,button{font-family:'Syne',sans-serif}
`;

const T = {
  bg:"#05070E",   bg2:"#07090F",  bg3:"#0A0D18",
  card:"#0D1120", card2:"#101520",
  border:"#141E32", border2:"#1C2A45",
  orange:"#FF5B18", orng2:"#FF8040",
  teal:"#00D4B4",  green:"#22D468",
  red:"#FF3D3D",   amber:"#FFB400", blue:"#3D8AFF",
  white:"#EEF2FF", g1:"#7B90B8",   g2:"#344A6E",   g3:"#0D1528",
};

const mono  = { fontFamily:"'Share Tech Mono',monospace" };
const syne  = { fontFamily:"'Syne',sans-serif" };
const dm    = { fontFamily:"'DM Mono',monospace" };

/* ─── SHARED ATOMS ─────────────────────────────────── */
function Pill({ color=T.orange, children, size=10 }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, fontSize:size, fontWeight:700, background:`${color}18`, color, border:`1px solid ${color}35`, ...mono }}>
      {children}
    </span>
  );
}

function Dot({ color, animate=false }) {
  return (
    <span style={{ position:"relative", display:"inline-flex", width:10, height:10 }}>
      {animate && <span style={{ position:"absolute", inset:0, borderRadius:"50%", background:color, animation:"ping 1.5s infinite" }} />}
      <span style={{ width:10, height:10, borderRadius:"50%", background:color, display:"block", position:"relative" }} />
    </span>
  );
}

function KPI({ label, value, sub, color=T.orange, icon, i=0 }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:"20px 22px", animation:`fadeUp .5s ease ${i*.07}s both` }}>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <div style={{ fontSize:10, color:T.g1, letterSpacing:2, marginBottom:10, ...mono }}>{label}</div>
        <span style={{ fontSize:20 }}>{icon}</span>
      </div>
      <div style={{ ...syne, fontSize:30, fontWeight:800, color, lineHeight:1, marginBottom:5 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:T.g2 }}>{sub}</div>}
    </div>
  );
}

function Spinner() {
  return <div style={{ width:28, height:28, border:`2px solid ${T.border}`, borderTopColor:T.orange, borderRadius:"50%", animation:"spin .7s linear infinite" }} />;
}

/* ══════════════════════════════════════════════════════
   ARCHITECTURE SECTION
══════════════════════════════════════════════════════ */
function ArchSection({ sysInfo }) {
  const [tab, setTab]   = useState("stack");
  const [open, setOpen] = useState(null);

  const STACK = [
    { id:"camera",   icon:"📷", label:"CAMERA LAYER",    color:T.blue,
      chips:["Hikvision IP","Dahua PTZ","CP Plus","ONVIF Generic","RTSP Feed"],
      detail:"16–32 cameras per plant. RTSP/ONVIF protocol. 1080p @ 4–8 FPS. PoE powered over CAT6. Offline buffering up to 4 hours." },
    { id:"edge",     icon:"⚡", label:"EDGE AI LAYER",   color:T.orange,
      chips:["Frame Capture 4 FPS","YOLOv8 PPE Model","Confidence ≥ 85%","Violation Trigger","Alert Queue"],
      detail:"Local edge server processes streams — no cloud dependency. < 3s detection latency. Works fully offline. GPU optional (Jetson Nano / x86 with CUDA)." },
    { id:"backend",  icon:"⚙️", label:"BACKEND API",     color:T.teal,
      chips:["Node.js 22","Express 4","PostgreSQL 16","Redis 7","WebSocket"],
      detail:"50+ REST endpoints under /api/v1. JWT + Refresh token auth. Rate limiting. Real-time events over WebSocket. Razorpay payment integration." },
    { id:"notify",   icon:"🔔", label:"NOTIFICATION",    color:T.amber,
      chips:["WhatsApp MSG91","SMTP Email","SMS","Dashboard Push","Form 18 Auto"],
      detail:"< 28s alert delivery from camera to WhatsApp. Multi-channel simultaneous. Factories Act 1948 Form 18 auto-filled and emailed to HSE officer." },
    { id:"frontend", icon:"🖥️", label:"FRONTEND",        color:T.green,
      chips:["React 18","Vite 5","Tailwind CSS","Recharts","Lucide Icons"],
      detail:"Single-page React 18 app. Real-time WebSocket dashboard. Mobile-responsive. Login/signup with 7-day trial flow. Admin portal (this screen)." },
  ];

  const FLOWS = [
    { n:"01", from:"IP Camera",     to:"Edge Server",    proto:"RTSP / TCP",    lat:"< 200 ms", c:T.blue   },
    { n:"02", from:"Edge Server",   to:"AI Engine",      proto:"HTTP / gRPC",   lat:"< 500 ms", c:T.orange },
    { n:"03", from:"AI Engine",     to:"Backend API",    proto:"HTTP POST",     lat:"< 100 ms", c:T.teal   },
    { n:"04", from:"Backend API",   to:"PostgreSQL",     proto:"TCP / SQL",     lat:"< 20 ms",  c:T.green  },
    { n:"05", from:"Backend API",   to:"Redis",          proto:"TCP",           lat:"< 5 ms",   c:T.amber  },
    { n:"06", from:"Backend API",   to:"WhatsApp/Email", proto:"HTTPS API",     lat:"< 2 s",    c:T.orange },
    { n:"07", from:"Backend API",   to:"WebSocket",      proto:"WS Events",     lat:"< 50 ms",  c:T.teal   },
    { n:"08", from:"WebSocket",     to:"React UI",       proto:"WS / Push",     lat:"< 100 ms", c:T.blue   },
  ];

  const SERVICES = [
    { name:"safeg-backend",   tech:"Node.js 22 + Express",  port:4000, status:"online",  icon:"⚙️",  c:T.green  },
    { name:"safeg-websocket", tech:"WS Server",             port:4000, status:"online",  icon:"🔌",  c:T.green  },
    { name:"postgres",        tech:"PostgreSQL 16 Alpine",  port:5432, status:"online",  icon:"🗄️",  c:T.green  },
    { name:"redis",           tech:"Redis 7 Alpine",        port:6379, status:"online",  icon:"⚡",  c:T.green  },
    { name:"ai-engine",       tech:"Python 3.11 FastAPI",   port:5001, status:"standby", icon:"🤖",  c:T.amber  },
    { name:"nginx",           tech:"Nginx 1.25 Alpine",     port:80,   status:"online",  icon:"🌐",  c:T.green  },
    { name:"safeg-frontend",  tech:"Vite 5 + React 18",     port:5173, status:"online",  icon:"🖥️",  c:T.green  },
    { name:"admin-portal",    tech:"React — this screen",   port:5173, status:"active",  icon:"🔐",  c:T.teal   },
  ];

  const tabs = [
    { id:"stack",    label:"STACK LAYERS"  },
    { id:"dataflow", label:"DATA FLOW"     },
    { id:"services", label:"SERVICES"      },
    { id:"sysinfo",  label:"SYSTEM INFO"   },
  ];

  return (
    <div style={{ padding:28, animation:"fadeUp .45s ease both" }}>
      {/* Header */}
      <div style={{ marginBottom:26 }}>
        <div style={{ ...syne, fontSize:22, fontWeight:800, color:T.white }}>System Architecture</div>
        <div style={{ fontSize:13, color:T.g1, marginTop:4 }}>Full stack diagram, data flows and live service registry</div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:26 }}>
        <KPI label="DETECTION LATENCY" value="< 3s"   sub="cam → alert"         color={T.teal}   icon="⚡" i={0} />
        <KPI label="AI ACCURACY"       value="98.7%"  sub="PPE detection rate"  color={T.green}  icon="🎯" i={1} />
        <KPI label="ALERT DELIVERY"    value="< 28s"  sub="cam → WhatsApp"      color={T.orange} icon="🔔" i={2} />
        <KPI label="UPTIME SLA"        value="99.9%"  sub="guaranteed"          color={T.blue}   icon="☁️" i={3} />
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:6, marginBottom:20, borderBottom:`1px solid ${T.border}`, paddingBottom:0 }}>
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"10px 18px", border:"none", borderBottom:`2px solid ${tab===id?T.orange:"transparent"}`, background:"transparent", color:tab===id?T.orange:T.g1, fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:1.5, ...mono, transition:"color .2s" }}>
            {label}
          </button>
        ))}
      </div>

      {/* STACK */}
      {tab === "stack" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {STACK.map((layer, i) => (
            <div key={layer.id} onClick={() => setOpen(open===i?null:i)}
              style={{ background:open===i?`${layer.color}0A`:T.card, border:`1px solid ${open===i?layer.color:T.border}`, borderRadius:14, padding:"16px 20px", cursor:"pointer", transition:"all .2s", animation:`fadeUp .4s ease ${i*.06}s both` }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:22 }}>{layer.icon}</span>
                <span style={{ ...syne, fontSize:13, fontWeight:700, color:layer.color, letterSpacing:1 }}>{layer.label}</span>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", flex:1 }}>
                  {layer.chips.map(c => <Pill key={c} color={layer.color} size={10}>{c}</Pill>)}
                </div>
                <span style={{ color:T.g2, fontSize:12 }}>{open===i?"▲":"▼"}</span>
              </div>
              {open === i && (
                <div style={{ borderTop:`1px solid ${T.border}`, marginTop:14, paddingTop:14, fontSize:13, color:T.g1, lineHeight:1.8, animation:"fadeUp .3s ease both" }}>
                  {layer.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DATA FLOW */}
      {tab === "dataflow" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {FLOWS.map((f, i) => (
            <div key={f.n} style={{ display:"grid", gridTemplateColumns:"36px 180px 28px 1fr 120px 100px", alignItems:"center", gap:14, background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:"14px 18px", animation:`fadeUp .35s ease ${i*.04}s both` }}>
              <span style={{ fontSize:11, color:T.g2, ...mono }}>{f.n}</span>
              <span style={{ fontSize:13, color:T.white, fontWeight:600 }}>{f.from}</span>
              <span style={{ textAlign:"center", fontSize:18, color:f.c }}>→</span>
              <span style={{ fontSize:13, color:T.white, fontWeight:600 }}>{f.to}</span>
              <Pill color={f.c} size={10}>{f.proto}</Pill>
              <span style={{ fontSize:12, color:T.g1, textAlign:"right", ...mono }}>{f.lat}</span>
            </div>
          ))}
        </div>
      )}

      {/* SERVICES */}
      {tab === "services" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {SERVICES.map((s, i) => (
            <div key={s.name} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 20px", display:"flex", alignItems:"center", gap:14, animation:`fadeUp .4s ease ${i*.05}s both` }}>
              <span style={{ fontSize:26 }}>{s.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ ...mono, fontSize:13, color:T.white, fontWeight:600 }}>{s.name}</div>
                <div style={{ fontSize:11, color:T.g1, marginTop:3 }}>{s.tech} · :{s.port}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Dot color={s.c} animate={s.status==="online"||s.status==="active"} />
                <Pill color={s.c}>{s.status}</Pill>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SYSTEM INFO */}
      {tab === "sysinfo" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {/* Server */}
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:22 }}>
            <div style={{ ...syne, fontSize:14, fontWeight:700, color:T.white, marginBottom:18 }}>🖥️ Server Runtime</div>
            {sysInfo ? (
              Object.entries(sysInfo.server).map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                  <span style={{ color:T.g1 }}>{k}</span>
                  <span style={{ color:T.white, ...mono }}>{String(v)}</span>
                </div>
              ))
            ) : (
              <div style={{ color:T.g1, fontSize:13 }}>Loading...</div>
            )}
          </div>
          {/* App */}
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:22 }}>
            <div style={{ ...syne, fontSize:14, fontWeight:700, color:T.white, marginBottom:18 }}>📊 Application Stats</div>
            {sysInfo ? (
              Object.entries(sysInfo.app).map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                  <span style={{ color:T.g1 }}>{k}</span>
                  <span style={{ color:T.teal, ...mono }}>{String(v)}</span>
                </div>
              ))
            ) : (
              <div style={{ color:T.g1, fontSize:13 }}>Loading...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PAYMENT SECTION
══════════════════════════════════════════════════════ */
function PaySection({ token }) {
  const [tab,      setTab]      = useState("overview");
  const [stats,    setStats]    = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);   // refund modal
  const [refunding,setRefunding]= useState(false);
  const [msg,      setMsg]      = useState(null);   // { text, ok }

  const headers = { Authorization:`Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        axios.get("/api/admin/payments/stats",  { headers }),
        axios.get("/api/admin/payments?limit=30",{ headers }),
      ]);
      setStats(s.data.data);
      setPayments(p.data.data || []);
    } catch {
      setStats(MOCK_STATS);
      setPayments(MOCK_PAYMENTS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const doRefund = async () => {
    if (!modal) return;
    setRefunding(true);
    try {
      await axios.post("/api/admin/payments/refund", { paymentId: modal.id, amount: modal.total_amount }, { headers });
      setMsg({ text:"Refund processed successfully", ok:true });
      setModal(null);
      load();
    } catch (err) {
      setMsg({ text: err.response?.data?.message || "Refund failed", ok:false });
    } finally {
      setRefunding(false);
    }
  };

  const STATUS_C = { captured:T.green, created:T.amber, failed:T.red, refunded:T.blue, refund_pending:T.amber };
  const fmt      = (paise) => `₹${((paise||0)/100).toLocaleString("en-IN")}`;

  const tabs = [
    { id:"overview",       label:"OVERVIEW"       },
    { id:"transactions",   label:"TRANSACTIONS"   },
    { id:"subscriptions",  label:"SUBSCRIPTIONS"  },
    { id:"customers",      label:"CUSTOMERS"      },
  ];

  return (
    <div style={{ padding:28, animation:"fadeUp .45s ease both" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:26 }}>
        <div>
          <div style={{ ...syne, fontSize:22, fontWeight:800, color:T.white }}>Payment Management</div>
          <div style={{ fontSize:13, color:T.g1, marginTop:4 }}>Razorpay transactions, MRR, subscriptions and refunds</div>
        </div>
        <button onClick={load} style={{ ...mono, background:`${T.teal}12`, border:`1px solid ${T.teal}35`, borderRadius:10, padding:"8px 16px", color:T.teal, fontSize:11, cursor:"pointer", fontWeight:700 }}>↻ REFRESH</button>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{ background:msg.ok?`${T.green}12`:`${T.red}12`, border:`1px solid ${msg.ok?T.green:T.red}35`, borderRadius:10, padding:"11px 16px", color:msg.ok?T.green:T.red, fontSize:13, marginBottom:20, display:"flex", justifyContent:"space-between" }}>
          {msg.ok?"✅":"⚠"} {msg.text}
          <button onClick={()=>setMsg(null)} style={{ background:"none",border:"none",color:"inherit",cursor:"pointer",fontSize:14 }}>✕</button>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:26 }}>
        <KPI label="TOTAL REVENUE"   value={stats?fmt(stats.totalRevenue):"—"}   sub="all time (excl. GST)"  color={T.green}  icon="💰" i={0} />
        <KPI label="THIS MONTH"      value={stats?fmt(stats.monthRevenue):"—"}   sub="month to date"         color={T.teal}   icon="📈" i={1} />
        <KPI label="ACTIVE PLANS"    value={stats?.activePlans   ?? "—"}          sub="paying customers"      color={T.orange} icon="✅" i={2} />
        <KPI label="PENDING REFUNDS" value={stats?.pendingRefunds ?? "—"}         sub="action required"       color={T.red}    icon="↩️" i={3} />
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:20, borderBottom:`1px solid ${T.border}` }}>
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"10px 18px", border:"none", borderBottom:`2px solid ${tab===id?T.orange:"transparent"}`, background:"transparent", color:tab===id?T.orange:T.g1, fontSize:11, fontWeight:700, cursor:"pointer", letterSpacing:1.5, ...mono, transition:"color .2s" }}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:200, gap:14, color:T.g1 }}><Spinner/>Loading payment data...</div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              {/* Revenue by plan */}
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:22 }}>
                <div style={{ ...syne, fontSize:14, fontWeight:700, color:T.white, marginBottom:18 }}>Revenue by Plan</div>
                {[
                  { key:"enterprise",    label:"Enterprise",    color:T.teal   },
                  { key:"professional",  label:"Professional",  color:T.orange },
                  { key:"starter",       label:"Starter",       color:T.blue   },
                ].map(({ key, label, color }) => {
                  const val = stats?.byPlan?.[key] || 0;
                  const pct = stats?.totalRevenue ? Math.round(val/stats.totalRevenue*100) : 0;
                  return (
                    <div key={key} style={{ marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                        <span style={{ color:T.g1 }}>{label}</span>
                        <span style={{ color:T.white, ...mono }}>{fmt(val)} · {pct}%</span>
                      </div>
                      <div style={{ height:5, background:T.border, borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent */}
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:22 }}>
                <div style={{ ...syne, fontSize:14, fontWeight:700, color:T.white, marginBottom:18 }}>Recent Transactions</div>
                {payments.slice(0,7).map((p, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:`1px solid ${T.border}` }}>
                    <div>
                      <div style={{ fontSize:13, color:T.white, fontWeight:600 }}>{p.customer_name || "—"}</div>
                      <div style={{ fontSize:11, color:T.g1, ...mono }}>{p.plan_id} · {p.invoice_no}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, color:T.green, fontWeight:700, ...mono }}>{fmt(p.total_amount)}</div>
                      <Pill color={STATUS_C[p.status]||T.g2}>{p.status}</Pill>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TRANSACTIONS ── */}
          {tab === "transactions" && (
            <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:800 }}>
                  <thead>
                    <tr style={{ background:T.card2 }}>
                      {["Invoice","Customer","Plan","Cams","Amount","GST","Status","Date",""].map(h => (
                        <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:9, color:T.g1, letterSpacing:2, fontWeight:700, ...mono, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={i} style={{ borderTop:`1px solid ${T.border}` }}>
                        <td style={{ padding:"12px 14px", fontSize:11, color:T.teal, ...mono, whiteSpace:"nowrap" }}>{p.invoice_no||`INV-${i+1}`}</td>
                        <td style={{ padding:"12px 14px", fontSize:13, color:T.white, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.customer_name||"—"}</td>
                        <td style={{ padding:"12px 14px" }}><Pill color={T.orange}>{p.plan_id||"—"}</Pill></td>
                        <td style={{ padding:"12px 14px", fontSize:13, color:T.g1, textAlign:"center" }}>{p.camera_count||"—"}</td>
                        <td style={{ padding:"12px 14px", fontSize:13, color:T.green, fontWeight:700, ...mono }}>{fmt(p.total_amount)}</td>
                        <td style={{ padding:"12px 14px", fontSize:12, color:T.g2, ...mono }}>{fmt(p.gst_amount)}</td>
                        <td style={{ padding:"12px 14px" }}><Pill color={STATUS_C[p.status]||T.g2}>{p.status||"—"}</Pill></td>
                        <td style={{ padding:"12px 14px", fontSize:11, color:T.g1, ...mono, whiteSpace:"nowrap" }}>{p.created_at?new Date(p.created_at).toLocaleDateString("en-IN"):"—"}</td>
                        <td style={{ padding:"12px 14px" }}>
                          {p.status === "captured" && (
                            <button onClick={() => setModal(p)} style={{ background:`${T.red}15`, border:`1px solid ${T.red}35`, borderRadius:6, padding:"4px 10px", color:T.red, fontSize:10, cursor:"pointer", ...mono, fontWeight:700 }}>REFUND</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SUBSCRIPTIONS ── */}
          {tab === "subscriptions" && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
              {[
                { key:"starter",      label:"STARTER",      color:T.blue,   price:"₹2,500/cam/mo"   },
                { key:"professional", label:"PROFESSIONAL",  color:T.orange, price:"₹2,000/cam/mo"   },
                { key:"enterprise",   label:"ENTERPRISE",    color:T.teal,   price:"₹1,600/cam/mo"   },
              ].map(({ key, label, color, price }) => (
                <div key={key} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:24 }}>
                  <div style={{ ...syne, fontSize:16, fontWeight:800, color, marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:11, color:T.g1, ...mono, marginBottom:20 }}>{price}</div>
                  <div style={{ ...syne, fontSize:44, fontWeight:800, color:T.white, lineHeight:1, marginBottom:4 }}>
                    {stats?.subs?.[key] ?? "0"}
                  </div>
                  <div style={{ fontSize:12, color:T.g1, marginBottom:16 }}>active customers</div>
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:14 }}>
                    <div style={{ fontSize:10, color:T.g1, letterSpacing:2, ...mono, marginBottom:6 }}>MONTHLY RECURRING</div>
                    <div style={{ ...syne, fontSize:22, fontWeight:700, color }}>{fmt((stats?.mrr?.[key]||0)*100)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CUSTOMERS ── */}
          {tab === "customers" && (
            <CustomerTable token={token} />
          )}
        </>
      )}

      {/* ── REFUND MODAL ── */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:18, padding:34, width:420, animation:"fadeUp .3s ease both" }}>
            <div style={{ ...syne, fontSize:20, fontWeight:800, color:T.white, marginBottom:6 }}>Process Refund</div>
            <div style={{ fontSize:13, color:T.g1, marginBottom:22 }}>
              Customer: <strong style={{ color:T.white }}>{modal.customer_name}</strong><br />
              Invoice: <span style={{ color:T.teal, ...mono }}>{modal.invoice_no}</span>
            </div>
            <div style={{ background:T.card2, borderRadius:12, padding:16, marginBottom:22 }}>
              {[
                ["Amount", fmt(modal.total_amount)],
                ["GST",    fmt(modal.gst_amount)],
                ["Plan",   modal.plan_id],
                ["Cameras",modal.camera_count],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>
                  <span style={{ color:T.g1 }}>{k}</span>
                  <span style={{ color:T.white, ...mono }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background:`${T.amber}10`, border:`1px solid ${T.amber}30`, borderRadius:10, padding:"10px 14px", fontSize:12, color:T.amber, marginBottom:22 }}>
              ⚠ This will initiate a full refund via Razorpay. Action cannot be undone.
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <button onClick={() => setModal(null)} style={{ flex:1, background:"transparent", border:`1px solid ${T.border}`, borderRadius:10, padding:"12px", color:T.g1, fontSize:13, fontWeight:700, cursor:"pointer" }}>Cancel</button>
              <button onClick={doRefund} disabled={refunding} style={{ flex:1, background:`linear-gradient(135deg,${T.red},#FF5A5A)`, border:"none", borderRadius:10, padding:"12px", color:"#fff", fontSize:13, fontWeight:800, cursor:refunding?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                {refunding?<><Spinner/>Processing...</>:"Confirm Refund ₹"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CUSTOMER TABLE (sub-component of PaySection) ─── */
function CustomerTable({ token }) {
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    axios.get("/api/admin/customers?limit=20", { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => setCustomers(r.data.data || []))
      .catch(() => setCustomers(MOCK_CUSTOMERS))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ display:"flex", justifyContent:"center", padding:40 }}><Spinner /></div>;

  const STATUS_C = { active:T.green, trial:T.amber, expired:T.red, cancelled:T.g2 };

  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ background:T.card2 }}>
            {["Company","Plan","Cameras","Status","Trial Ends","Since","Plants"].map(h => (
              <th key={h} style={{ padding:"12px 14px", textAlign:"left", fontSize:9, color:T.g1, letterSpacing:2, fontWeight:700, ...mono }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map((c, i) => (
            <tr key={i} style={{ borderTop:`1px solid ${T.border}` }}>
              <td style={{ padding:"12px 14px", fontSize:13, color:T.white, fontWeight:600, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.company_name}</td>
              <td style={{ padding:"12px 14px" }}><Pill color={T.orange}>{c.plan_id||"—"}</Pill></td>
              <td style={{ padding:"12px 14px", fontSize:13, color:T.g1, textAlign:"center" }}>{c.camera_count||"—"}</td>
              <td style={{ padding:"12px 14px" }}><Pill color={STATUS_C[c.subscription_status]||T.g2}>{c.subscription_status||"—"}</Pill></td>
              <td style={{ padding:"12px 14px", fontSize:11, color:T.amber, ...mono }}>{c.trial_ends_at?new Date(c.trial_ends_at).toLocaleDateString("en-IN"):"—"}</td>
              <td style={{ padding:"12px 14px", fontSize:11, color:T.g1, ...mono }}>{c.created_at?new Date(c.created_at).toLocaleDateString("en-IN"):"—"}</td>
              <td style={{ padding:"12px 14px", fontSize:13, color:T.teal, textAlign:"center" }}>{c.plant_count||0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── MOCK DATA (fallback when API not ready) ─────── */
const MOCK_STATS = {
  totalRevenue:4850000, monthRevenue:960000, activePlans:12, pendingRefunds:2,
  byPlan:{ enterprise:2400000, professional:1800000, starter:650000 },
  subs:{ starter:4, professional:6, enterprise:2 },
  mrr:{ starter:40, professional:120, enterprise:320 },
};
const MOCK_PAYMENTS = Array.from({ length:10 }, (_, i) => ({
  id:`pay_${i}`, invoice_no:`INV-2026-${String(i+1).padStart(3,"0")}`,
  customer_name:["Pune Auto Pvt Ltd","Mumbai Steel Works","Chennai Forge","Delhi Plastics","Bangalore Mfg","Hyderabad Auto","Kolkata Steel","Ahmedabad Parts","Nagpur Chem","Surat Textile"][i],
  plan_id:["starter","professional","enterprise","professional","starter","enterprise","professional","starter","professional","enterprise"][i],
  camera_count:[4,8,20,12,4,24,16,4,10,18][i],
  total_amount:[96000,192000,480000,288000,96000,576000,384000,96000,240000,432000][i],
  gst_amount:  [17280,34560,86400,51840,17280,103680,69120,17280,43200,77760][i],
  status:["captured","captured","captured","captured","refunded","captured","created","captured","captured","captured"][i],
  created_at: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
}));
const MOCK_CUSTOMERS = Array.from({ length:6 }, (_, i) => ({
  company_name:["Pune Auto Pvt Ltd","Mumbai Steel Works","Chennai Forge","Delhi Plastics","Bangalore Mfg","Hyderabad Auto"][i],
  plan_id:["professional","enterprise","starter","professional","enterprise","starter"][i],
  camera_count:[8,20,4,12,24,4][i],
  subscription_status:["active","active","trial","active","active","expired"][i],
  trial_ends_at: i===2 ? new Date(Date.now()+3*24*60*60*1000).toISOString() : null,
  created_at: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000).toISOString(),
  plant_count:[2,3,1,2,4,1][i],
}));

/* ══════════════════════════════════════════════════════
   ADMIN LOGIN SCREEN
══════════════════════════════════════════════════════ */
function AdminLogin({ onLogin }) {
  const [form, setForm]   = useState({ email:"", password:"" });
  const [err,  setErr]    = useState("");
  const [load, setLoad]   = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoad(true); setErr("");
    try {
      const res = await axios.post("/api/v1/auth/login", form);
      const { user, accessToken } = res.data.data;
      if (!["superadmin","customer_admin"].includes(user.role)) {
        setErr("Admin access only — contact your system administrator"); return;
      }
      localStorage.setItem("safeg_admin_token", accessToken);
      localStorage.setItem("safeg_admin",       JSON.stringify(user));
      onLogin(user, accessToken);
    } catch (ex) {
      setErr(ex.response?.data?.message || "Invalid credentials");
    } finally {
      setLoad(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
      {/* Grid */}
      <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`, backgroundSize:"60px 60px", opacity:.25 }} />
      {/* Corner accent */}
      <div style={{ position:"absolute", top:0, right:0, width:400, height:400, background:`radial-gradient(circle at top right,${T.orange}18,transparent 70%)`, pointerEvents:"none" }} />

      <div style={{ width:400, background:T.card, border:`1px solid ${T.border}`, borderRadius:22, padding:42, position:"relative", zIndex:1, animation:"fadeUp .55s ease both" }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <div style={{ width:42, height:42, borderRadius:11, background:"linear-gradient(135deg,#FF5B18,#FF8040)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⚙️</div>
          <div>
            <div style={{ ...syne, fontSize:16, fontWeight:800, color:T.white, letterSpacing:1.5 }}>ADMIN PORTAL</div>
            <div style={{ fontSize:9, color:T.g1, letterSpacing:2.5, ...mono }}>SYYAIM SAFEG AI · INTERNAL</div>
          </div>
        </div>

        {/* Warning strip */}
        <div style={{ background:`${T.red}0E`, border:`1px solid ${T.red}25`, borderRadius:10, padding:"9px 14px", fontSize:11, color:`${T.red}CC`, marginBottom:28, marginTop:22, display:"flex", gap:8, alignItems:"center", ...mono }}>
          🔒 RESTRICTED · AUTHORISED PERSONNEL ONLY
        </div>

        {err && (
          <div style={{ background:`${T.red}10`, border:`1px solid ${T.red}30`, borderRadius:10, padding:"10px 14px", color:T.red, fontSize:13, marginBottom:18 }}>⚠ {err}</div>
        )}

        <form onSubmit={submit}>
          {[
            { key:"email",    label:"ADMIN EMAIL",  type:"email",    ph:"admin@syyaimsafeg.ai" },
            { key:"password", label:"PASSWORD",     type:"password", ph:"••••••••••••" },
          ].map(({ key, label, type, ph }) => (
            <div key={key} style={{ marginBottom:16 }}>
              <label style={{ fontSize:9, color:T.g1, letterSpacing:2.5, display:"block", marginBottom:7, fontWeight:700, ...mono }}>{label}</label>
              <input type={type} required value={form[key]} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                style={{ width:"100%", background:"#040608", border:`1px solid ${T.border}`, borderRadius:10, padding:"13px 14px", color:T.white, fontSize:13, outline:"none" }} />
            </div>
          ))}

          <button type="submit" disabled={load} style={{ width:"100%", marginTop:8, background:load?T.g2:`linear-gradient(135deg,${T.orange},${T.orng2})`, border:"none", borderRadius:11, padding:"14px", color:"#fff", fontSize:14, fontWeight:800, cursor:load?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {load ? <><Spinner />Authenticating...</> : "Access Admin Portal →"}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{ background:`${T.teal}0A`, border:`1px solid ${T.teal}25`, borderRadius:12, padding:"14px 16px", marginTop:20 }}>
          <div style={{ fontSize:9, color:T.teal, letterSpacing:2.5, fontWeight:700, marginBottom:10, ...mono }}>DEMO CREDENTIALS</div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:11, color:T.g1 }}>Email</span>
            <span style={{ fontSize:12, color:T.white, ...dm }}>suresh@puneauto.com</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontSize:11, color:T.g1 }}>Password</span>
            <span style={{ fontSize:12, color:T.white, ...dm }}>Demo@SafeG2024!</span>
          </div>
          <button onClick={() => setForm({ email:"suresh@puneauto.com", password:"Demo@SafeG2024!" })}
            style={{ width:"100%", background:`${T.teal}18`, border:`1px solid ${T.teal}35`, borderRadius:8, padding:"8px", color:T.teal, fontSize:11, fontWeight:700, cursor:"pointer", ...mono, letterSpacing:1 }}>
            ⚡ AUTOFILL DEMO CREDENTIALS
          </button>
        </div>

        <div style={{ textAlign:"center", marginTop:16 }}>
          <button onClick={() => navigate("/login")} style={{ background:"none", border:"none", color:T.g2, fontSize:12, cursor:"pointer" }}>← Back to main app</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROOT ADMIN DASHBOARD
══════════════════════════════════════════════════════ */
const NAV = [
  { id:"architecture", label:"Architecture", icon:"🗺️" },
  { id:"payments",     label:"Payments",     icon:"💳" },
];

export default function AdminDashboard() {
  const [admin,   setAdmin]   = useState(() => { try { return JSON.parse(localStorage.getItem("safeg_admin")); } catch { return null; } });
  const [token,   setToken]   = useState(() => localStorage.getItem("safeg_admin_token") || "");
  const [section, setSection] = useState("architecture");
  const [sysInfo, setSysInfo] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get("/api/admin/system", { headers:{ Authorization:`Bearer ${token}` } })
      .then(r => setSysInfo(r.data.data))
      .catch(() => {});
  }, [token]);

  const handleLogin = (user, tok) => { setAdmin(user); setToken(tok); };
  const handleLogout = () => {
    ["safeg_admin_token","safeg_admin"].forEach(k => localStorage.removeItem(k));
    setAdmin(null); setToken("");
  };

  if (!admin) return <><style>{CSS}</style><AdminLogin onLogin={handleLogin} /></>;

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display:"flex", minHeight:"100vh", background:T.bg }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width:220, background:T.bg2, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", flexShrink:0 }}>
          {/* Logo */}
          <div style={{ padding:"22px 20px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,#FF5B18,#FF8040)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>⚙️</div>
              <div>
                <div style={{ ...syne, fontSize:13, fontWeight:800, color:T.white, letterSpacing:1.5 }}>ADMIN</div>
                <div style={{ fontSize:9, color:T.g2, letterSpacing:2.5, ...mono }}>INTERNAL PORTAL</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding:"18px 10px", flex:1 }}>
            <div style={{ fontSize:9, color:T.g2, letterSpacing:2.5, padding:"0 10px", marginBottom:12, ...mono }}>SECTIONS</div>
            {NAV.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setSection(id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"11px 12px", borderRadius:10, border:"none", background:section===id?`${T.orange}14`:"transparent", color:section===id?T.orange:T.g1, cursor:"pointer", marginBottom:4, fontSize:13, fontWeight:section===id?700:500, textAlign:"left", transition:"all .2s" }}>
                <span style={{ fontSize:18 }}>{icon}</span>
                {label}
                {section===id && <div style={{ marginLeft:"auto", width:5, height:5, borderRadius:"50%", background:T.orange }} />}
              </button>
            ))}
          </nav>

          {/* System status */}
          <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontSize:9, color:T.g2, letterSpacing:2, ...mono, marginBottom:10 }}>SYSTEM STATUS</div>
            {[
              { label:"API Server",  ok:true  },
              { label:"Database",    ok:true  },
              { label:"Redis Cache", ok:true  },
              { label:"AI Engine",   ok:false },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                <span style={{ fontSize:11, color:T.g1 }}>{label}</span>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <Dot color={ok?T.green:T.amber} animate={ok} />
                  <span style={{ fontSize:10, color:ok?T.green:T.amber, ...mono }}>{ok?"online":"standby"}</span>
                </div>
              </div>
            ))}
          </div>

          {/* User */}
          <div style={{ padding:"16px 20px" }}>
            <div style={{ fontSize:12, color:T.white, fontWeight:700, marginBottom:2 }}>{admin.fullName||admin.email}</div>
            <div style={{ fontSize:10, color:T.g2, marginBottom:12, ...mono }}>{admin.role?.replace("_"," ").toUpperCase()}</div>
            <button onClick={handleLogout} style={{ width:"100%", background:"transparent", border:`1px solid ${T.border}`, borderRadius:8, padding:"8px", color:T.g1, fontSize:11, fontWeight:700, cursor:"pointer" }}>Sign Out</button>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex:1, overflowY:"auto" }}>
          {/* Topbar */}
          <div style={{ padding:"14px 28px", borderBottom:`1px solid ${T.border}`, background:T.bg2, position:"sticky", top:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ ...syne, fontSize:15, fontWeight:700, color:T.white }}>
              {NAV.find(n=>n.id===section)?.icon} {NAV.find(n=>n.id===section)?.label}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              {sysInfo && <span style={{ fontSize:11, color:T.g1, ...mono }}>Node {sysInfo.server.nodeVersion} · {sysInfo.server.memUsedMB}MB</span>}
              <Dot color={T.green} animate />
              <span style={{ fontSize:10, color:T.green, ...mono }}>SYSTEM ONLINE</span>
              <Pill color={T.orange}>ADMIN</Pill>
            </div>
          </div>

          {section === "architecture" && <ArchSection sysInfo={sysInfo} />}
          {section === "payments"     && <PaySection token={token} />}
        </div>
      </div>
    </>
  );
}
