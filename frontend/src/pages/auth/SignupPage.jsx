/**
 * SignupPage.jsx
 * SafeguardsIQ — 6-Step Signup with Razorpay Trial + Paid Plan Option
 * Step 0: Company Details
 * Step 1: Plant / Factory
 * Step 2: Zones / Areas
 * Step 3: Register Cameras
 * Step 4: Choose Plan (Free Trial OR Paid)
 * Step 5: Activate
 */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import CameraDiscovery from '../../components/CameraDiscovery';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes gridMove{from{transform:translateY(0)}to{transform:translateY(60px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes checkPop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
input:focus,select:focus,textarea:focus{outline:2px solid #FF5B18!important;border-color:#FF5B18!important}
`;

const T = {
  bg:"#05080F", bg2:"#080D18", card:"#0C1422", card2:"#101828",
  border:"#1A2540", border2:"#243452",
  orange:"#FF5B18", teal:"#00D4B4", blue:"#2D8EFF",
  white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

const STEPS = ["Company Details","Plant / Factory","Zones / Areas","Register Cameras","Choose Plan","Activate"];

const inp = { width:"100%", background:"#06090F", border:`1px solid ${T.border}`, borderRadius:10, padding:"13px 14px", color:T.white, fontSize:13, fontFamily:"'Nunito'", outline:"none" };
const lbl = { fontSize:11, color:T.g1, letterSpacing:1.5, fontWeight:700, display:"block", marginBottom:6 };
const sel = { ...inp, cursor:"pointer" };

const toggle = (arr, val) => arr.includes(val) ? arr.filter(x=>x!==val) : [...arr, val];

// Plans matching backend PLAN_PRICES
const PLANS = [
  {
    id:"starter", name:"STARTER", price:2500, cameras:"1–4",
    color:T.blue, features:[
      "Up to 4 cameras","30-day violation archive",
      "Email alerts","Form 18 PDF","Basic compliance report",
    ],
    badge:null,
  },
  {
    id:"growth", name:"PROFESSIONAL", price:2000, cameras:"5–16",
    color:T.orange, features:[
      "5–16 cameras","90-day violation archive",
      "WhatsApp + Email alerts","Form 18 PDF",
      "Full compliance reports","ROI calculator","Multi-plant dashboard",
    ],
    badge:"⭐ MOST POPULAR",
  },
  {
    id:"enterprise", name:"ENTERPRISE", price:1600, cameras:"17–32",
    color:T.teal, features:[
      "17–32 cameras","Unlimited archive",
      "WhatsApp + SMS + Email","Dedicated CSM",
      "Custom reports","99.5% SLA","On-site training",
    ],
    badge:"🏆 BEST VALUE",
  },
];

/* ── STEP 1 — Company Details ── */
function StepCompany({ form, setForm, onNext, setError }) {
  const F = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>COMPANY DETAILS</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Tell us about your organisation</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {[
          {k:"companyName",  l:"COMPANY NAME *",        t:"text",     p:"Pune Auto Components Pvt Ltd", full:true},
          {k:"email",        l:"WORK EMAIL *",          t:"email",    p:"you@company.com"},
          {k:"password",     l:"PASSWORD *",            t:"password", p:"Min. 8 characters"},
          {k:"confirmPass",  l:"CONFIRM PASSWORD *",    t:"password", p:"Re-enter password"},
          {k:"phone",        l:"PHONE / WHATSAPP *",    t:"tel",      p:"+91 98765 43210"},
          {k:"gstin",        l:"GSTIN (optional)",      t:"text",     p:"27AABCP2018R1ZV"},
          {k:"city",         l:"CITY *",                t:"text",     p:"Pune"},
          {k:"state",        l:"STATE *",               t:"text",     p:"Maharashtra"},
          {k:"address",      l:"REGISTERED ADDRESS",    t:"text",     p:"123, MIDC, Pune", full:true},
          {k:"whatsapp", l:"WHATSAPP NUMBER FOR ALERTS", t:"tel", p:"+91 98765 43210", full:true},
        ].map(f=>(
          <div key={f.k} style={{gridColumn:f.full?"1/-1":"auto"}}>
            <label style={lbl}>{f.l}</label>
            <input type={f.t} value={form[f.k]||""} onChange={e=>F(f.k,e.target.value)}
              placeholder={f.p} style={inp}/>
          </div>
        ))}
      </div>
      <div style={{marginTop:20,display:"flex",gap:10}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <input type="checkbox" checked={form.agreeTerms||false} onChange={e=>F("agreeTerms",e.target.checked)}/>
          <span style={{fontSize:12,color:T.g1}}>I agree to the <a href="#" style={{color:T.orange}}>Terms of Service</a></span>
        </label>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:10,
          background:`${T.green}08`, border:`1px solid ${T.green}25`,
          borderRadius:10, padding:"12px 14px"}}>
          <input type="checkbox" checked={form.agreeWhatsapp||false}
            onChange={e=>F("agreeWhatsapp",e.target.checked)}
            style={{width:16,height:16,accentColor:T.green}}/>
          <div>
            <div style={{fontSize:13,color:T.white,fontWeight:700}}>
              📱 Get violation alerts on WhatsApp
            </div>
            <div style={{fontSize:11,color:T.g1,marginTop:2}}>
              Receive instant alerts when AI detects PPE violations at your factory.
              Messages sent within 28 seconds of detection.
            </div>
          </div>
        </label>
      </div>
      <button onClick={()=>{
        if(!form.companyName||!form.email||!form.password||!form.phone||!form.city||!form.state){
          setError("Please fill all required fields"); return;
        }
        if(form.password!==form.confirmPass){ setError("Passwords do not match"); return; }
        if(form.password.length<8){ setError("Password must be at least 8 characters"); return; }
        if(!form.agreeTerms){ setError("Please agree to the Terms of Service"); return; }
        setError(""); onNext();
      }} style={{marginTop:24,width:"100%",background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"15px",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
        Continue → Plant Details
      </button>
    </div>
  );
}

/* ── STEP 2 — Plant ── */
function StepPlant({ plants, setPlants, onNext, onBack, setError }) {
  const addPlant = () => setPlants(p=>[...p,{name:"",city:"",state:"Maharashtra",type:"manufacturing"}]);
  const upd = (i,k,v) => setPlants(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x));
  const del = (i) => setPlants(p=>p.filter((_,j)=>j!==i));
  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>PLANT / FACTORY</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Add your factory locations</div>
      </div>
      {plants.map((pl,i)=>(
        <div key={i} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,color:T.orange,fontWeight:700}}>Plant {i+1}</span>
            <button onClick={()=>del(i)} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:12}}>✕ Remove</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {k:"name",l:"PLANT NAME *",p:"Pune Main Plant"},
              {k:"city",l:"CITY *",p:"Pune"},
              {k:"state",l:"STATE",p:"Maharashtra"},
              {k:"type",l:"TYPE",p:"manufacturing",type:"select",opts:["manufacturing","warehouse","chemical","food","pharma","auto"]},
            ].map(f=>(
              <div key={f.k}>
                <label style={lbl}>{f.l}</label>
                {f.type==="select"?(
                  <select value={pl[f.k]||""} onChange={e=>upd(i,f.k,e.target.value)} style={sel}>
                    {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                ):(
                  <input value={pl[f.k]||""} onChange={e=>upd(i,f.k,e.target.value)} placeholder={f.p} style={inp}/>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={addPlant} style={{width:"100%",background:"none",border:`1px dashed ${T.border2}`,borderRadius:10,padding:"12px",color:T.g1,fontSize:13,cursor:"pointer",marginBottom:20,fontFamily:"'Nunito'"}}>
        + Add Plant / Factory
      </button>
      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={()=>{
          if(plants.length===0){setError("Add at least one plant");return;}
          if(plants.some(p=>!p.name||!p.city)){setError("Fill plant name and city");return;}
          setError(""); onNext();
        }} style={{flex:2,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
          Continue → Zones
        </button>
      </div>
    </div>
  );
}

/* ── STEP 3 — Zones ── */
function StepZones({ plants, zones, setZones, onNext, onBack, setError }) {
  const addZone = () => setZones(z=>[...z,{name:"",type:"production",plantIndex:0,riskLevel:"medium"}]);
  const upd = (i,k,v) => setZones(z=>z.map((x,j)=>j===i?{...x,[k]:v}:x));
  const del = (i) => setZones(z=>z.filter((_,j)=>j!==i));
  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>ZONES / AREAS</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Define monitoring zones in each plant</div>
      </div>
      {zones.map((z,i)=>(
        <div key={i} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:16,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,color:T.teal,fontWeight:700}}>Zone {i+1}</span>
            <button onClick={()=>del(i)} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:12}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div>
              <label style={lbl}>ZONE NAME *</label>
              <input value={z.name||""} onChange={e=>upd(i,"name",e.target.value)} placeholder="Assembly Line A" style={inp}/>
            </div>
            <div>
              <label style={lbl}>PLANT</label>
              <select value={z.plantIndex||0} onChange={e=>upd(i,"plantIndex",parseInt(e.target.value))} style={sel}>
                {plants.map((p,pi)=><option key={pi} value={pi}>{p.name||`Plant ${pi+1}`}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>ZONE TYPE</label>
              <select value={z.type||"production"} onChange={e=>upd(i,"type",e.target.value)} style={sel}>
                {["production","welding","chemical","loading","electrical","warehouse","office"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addZone} style={{width:"100%",background:"none",border:`1px dashed ${T.border2}`,borderRadius:10,padding:"12px",color:T.g1,fontSize:13,cursor:"pointer",marginBottom:20,fontFamily:"'Nunito'"}}>
        + Add Zone / Area
      </button>
      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={()=>{
          if(zones.length===0){setError("Add at least one zone");return;}
          if(zones.some(z=>!z.name)){setError("Fill zone names");return;}
          setError(""); onNext();
        }} style={{flex:2,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
          Continue → Cameras
        </button>
      </div>
    </div>
  );
}

/* ── STEP 5 — Choose Plan ── */
function StepChoosePlan({ form, selectedPlan, setSelectedPlan, billing, setBilling, onNext, onBack }) {
  const cameraCount = parseInt(form.cameraCount) || 1;

  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>CHOOSE YOUR PLAN</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>
          Start with a free 28-day trial or subscribe immediately
        </div>
      </div>

      {/* Billing toggle */}
      <div style={{display:"flex",justifyContent:"center",gap:0,marginBottom:24,
        background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:4,width:"fit-content",margin:"0 auto 24px"}}>
        {[{id:"trial",label:"🎁 Free 28-Day Trial"},{id:"monthly",label:"Monthly"},{id:"annual",label:"Annual (Save 15%)"}].map(b=>(
          <button key={b.id} onClick={()=>setBilling(b.id)} style={{
            padding:"8px 20px",borderRadius:8,fontSize:12,fontWeight:700,
            border:"none",cursor:"pointer",fontFamily:"'Nunito'",
            background:billing===b.id?T.orange:"transparent",
            color:billing===b.id?"#fff":T.g1,
            transition:"all .2s",
          }}>{b.label}</button>
        ))}
      </div>

      {/* Trial banner */}
      {billing==="trial" && (
        <div style={{background:`${T.green}10`,border:`1px solid ${T.green}30`,
          borderRadius:12,padding:"14px 18px",marginBottom:20,
          display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:24}}>🎁</span>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:T.green}}>28-Day Free Trial — No Credit Card Required</div>
            <div style={{fontSize:12,color:T.g1,marginTop:2}}>
              Full access to all Professional features. Razorpay payment link sent on Day 25.
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
        {PLANS.map(plan=>{
          const isSelected = selectedPlan===plan.id;
          const price      = billing==="annual" ? Math.round(plan.price*0.85) : plan.price;
          const isDisabled = billing==="trial" && plan.id!=="growth"; // trial = professional only

          return (
            <div key={plan.id} onClick={()=>!isDisabled&&setSelectedPlan(plan.id)}
              style={{
                background:isSelected?`${plan.color}10`:T.card2,
                border:`2px solid ${isSelected?plan.color:isDisabled?T.border+"60":T.border}`,
                borderRadius:14,padding:20,cursor:isDisabled?"not-allowed":"pointer",
                opacity:isDisabled?0.5:1,
                transition:"all .2s",
                position:"relative",
              }}>
              {plan.badge && (
                <div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",
                  background:plan.color,color:"#fff",fontSize:9,fontWeight:800,
                  padding:"3px 12px",borderRadius:20,whiteSpace:"nowrap",letterSpacing:1}}>
                  {plan.badge}
                </div>
              )}
              <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:plan.color,letterSpacing:2,marginBottom:4}}>
                {plan.name}
              </div>
              <div style={{fontSize:11,color:T.g1,marginBottom:12}}>{plan.cameras} cameras</div>

              {billing==="trial" ? (
                <div style={{fontSize:18,fontWeight:800,color:T.green,marginBottom:12}}>FREE</div>
              ) : (
                <div style={{marginBottom:12}}>
                  <span style={{fontSize:22,fontWeight:800,color:T.white}}>₹{price.toLocaleString()}</span>
                  <span style={{fontSize:10,color:T.g1}}>/camera/month</span>
                  {billing==="annual" && (
                    <div style={{fontSize:10,color:T.green,marginTop:2}}>Save 15% annually</div>
                  )}
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {plan.features.map(f=>(
                  <div key={f} style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                    <span style={{color:plan.color,fontSize:10,flexShrink:0,marginTop:2}}>✓</span>
                    <span style={{fontSize:11,color:T.g1}}>{f}</span>
                  </div>
                ))}
              </div>

              {isSelected && (
                <div style={{marginTop:12,padding:"6px",background:plan.color,
                  borderRadius:6,textAlign:"center",fontSize:11,fontWeight:800,color:"#fff"}}>
                  ✓ SELECTED
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Camera count for paid plans */}
      {billing !== "trial" && (
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:16,marginBottom:20}}>
          <label style={lbl}>NUMBER OF CAMERAS</label>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <input type="number" min={1} max={32}
              value={form.cameraCount||4}
              onChange={e=>form.setCameraCount?.(e.target.value)}
              style={{...inp,width:100}}/>
            <div style={{fontSize:12,color:T.g1}}>
              Estimated monthly: <span style={{color:T.orange,fontWeight:800}}>
                ₹{((PLANS.find(p=>p.id===selectedPlan)?.price||2000) *
                  (billing==="annual"?0.85:1) *
                  (parseInt(form.cameraCount)||4)).toLocaleString()}
              </span> + 18% GST
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={onNext} style={{flex:2,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
          {billing==="trial" ? "🎁 Start Free Trial →" : `💳 Pay & Activate →`}
        </button>
      </div>
    </div>
  );
}

/* ── STEP 6 — Activate ── */
function StepActivate({ form, plants, zones, cameras, loading, success, onBack, onActivate, billing, selectedPlan }) {
  const plan = PLANS.find(p=>p.id===selectedPlan) || PLANS[1];

  if (success) {
    return (
      <div style={{textAlign:"center",padding:"40px 0",animation:"fadeUp .5s ease both"}}>
        <div style={{fontSize:64,marginBottom:16,animation:"checkPop .4s ease both"}}>✅</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.green,letterSpacing:2,marginBottom:8}}>
          {billing==="trial" ? "TRIAL ACTIVATED!" : "ACCOUNT ACTIVATED!"}
        </div>
        <div style={{color:T.g1,fontSize:14,marginBottom:20}}>
          {billing==="trial"
            ? "Your 28-day free trial has started. Redirecting to dashboard..."
            : "Payment successful! Your account is now active. Redirecting..."}
        </div>
        <div style={{width:40,height:40,border:`3px solid ${T.border}`,borderTopColor:T.orange,
          borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto"}}/>
      </div>
    );
  }

  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>
          {billing==="trial" ? "ACTIVATE FREE TRIAL" : "REVIEW & PAY"}
        </div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Review your setup before activating</div>
      </div>

      {/* Summary */}
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{fontSize:11,color:T.g2,letterSpacing:1.5,fontWeight:700,marginBottom:12}}>ACCOUNT SUMMARY</div>
        {[
          {l:"Company",    v:form.companyName},
          {l:"Email",      v:form.email},
          {l:"Phone",      v:form.phone},
          {l:"Plants",     v:`${plants.length} plant${plants.length!==1?"s":""}`},
          {l:"Zones",      v:`${zones.length} zone${zones.length!==1?"s":""}`},
          {l:"Cameras",    v:`${cameras.length} camera${cameras.length!==1?"s":""}`},
          {l:"Plan",       v:plan.name},
          {l:"Billing",    v:billing==="trial"?"28-Day Free Trial":billing==="annual"?"Annual (15% off)":"Monthly"},
        ].map(({l,v})=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",
            padding:"6px 0",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:12,color:T.g1}}>{l}</span>
            <span style={{fontSize:12,color:T.white,fontWeight:600}}>{v}</span>
          </div>
        ))}
      </div>

      {/* Payment info */}
      {billing==="trial" ? (
        <div style={{background:`${T.green}08`,border:`1px solid ${T.green}25`,
          borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:12,color:T.g1}}>
          🎁 No payment required. Razorpay payment link will be sent to{" "}
          <strong style={{color:T.white}}>{form.email}</strong> on Day 25.
        </div>
      ) : (
        <div style={{background:`${T.orange}08`,border:`1px solid ${T.orange}25`,
          borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:12,color:T.g1}}>
          💳 Secure payment via Razorpay. You'll be redirected to complete payment.
          GST invoice will be emailed to <strong style={{color:T.white}}>{form.email}</strong>.
        </div>
      )}

      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={onActivate} disabled={loading} style={{flex:2,background:loading?T.g2:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:15,fontWeight:800,cursor:loading?"not-allowed":"pointer",fontFamily:"'Nunito'",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {loading
            ? <><div style={{width:18,height:18,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Processing...</>
            : billing==="trial" ? "🚀 Activate Free Trial" : "💳 Pay with Razorpay"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN SIGNUP PAGE
════════════════════════════════════════ */
export default function SignupPage({ onLogin }) {
  const [step,         setStep]         = useState(0);
  const [form,         setForm]         = useState({
    companyName:"", email:"", password:"", confirmPass:"",
    phone:"", gstin:"", address:"", city:"", state:"", pincode:"",
    agreeTerms:false, agreeWhatsapp:false, cameraCount:4,
  });
  const [plants,       setPlants]       = useState([]);
  const [zones,        setZones]        = useState([]);
  const [cameras,      setCameras]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState(false);
  const [billing,      setBilling]      = useState("trial");
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const navigate = useNavigate();

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handleActivate = async () => {
    setLoading(true); setError("");
    try {
      // Step 1 — Register account
      const regRes = await axios.post("/api/v1/auth/register", {
        companyName:   form.companyName,
        email:         form.email,
        password:      form.password,
        fullName:      form.companyName + " Admin",
        phone:         form.phone,
        whatsapp:      form.whatsapp || form.phone,
        whatsappOptIn: form.agreeWhatsapp || false,
        gstin:         form.gstin,
        city:          form.city,
        state:         form.state,
        trialDays:     14,
        plants, zones, cameras,
      });

      const { accessToken, refreshToken, user, tenantId } = regRes.data.data;
      localStorage.setItem("safeg_token",   accessToken);
      localStorage.setItem("safeg_refresh", refreshToken);
      localStorage.setItem("safeg_user",    JSON.stringify(user));
      localStorage.setItem("safeg_tenant",  tenantId);

      // Step 2 — If paid plan, open Razorpay
      if (billing !== "trial") {
        const orderRes = await axios.post("/api/v1/payments/create-order", {
          planId:  selectedPlan,
          billing,
          addOns:  [],
          customer: {
            name:  form.companyName,
            email: form.email,
            phone: form.phone,
          },
        }, { headers: { Authorization: `Bearer ${accessToken}` }});

        const { orderId, amount, currency, keyId } = orderRes.data.data;

        // Open Razorpay checkout
        await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key:          keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount,
            currency:     currency || "INR",
            order_id:     orderId,
            name:         "SafeguardsIQ",
            description:  `${selectedPlan.toUpperCase()} Plan — ${billing}`,
            image:        "https://safeguardsiq.com/logo.png",
            prefill: {
              name:    form.companyName,
              email:   form.email,
              contact: form.phone,
            },
            theme: { color: "#FF5B18" },
            handler: async (response) => {
              try {
                // Verify payment
                await axios.post("/api/v1/payments/verify", {
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                  planId:              selectedPlan,
                  billing,
                }, { headers: { Authorization: `Bearer ${accessToken}` }});
                resolve();
              } catch(e) { reject(e); }
            },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          });
          rzp.open();
        });
      }

      setSuccess(true);
      onLogin?.(user);
      setTimeout(() => navigate("/dashboard"), 2500);

    } catch(err) {
      if (err.message === "Payment cancelled") {
        setError("Payment was cancelled. You can try again or start a free trial.");
      } else {
        setError(err.response?.data?.message || err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const next = () => { setError(""); setStep(s=>s+1); };
  const back = () => { setError(""); setStep(s=>s-1); };

  const maxW = step===2||step===3 ? 680 : step===4 ? 780 : 600;

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",fontFamily:"'Nunito',sans-serif",padding:"32px 20px",position:"relative",overflow:"hidden"}}>
        {/* Grid background */}
        <div style={{position:"fixed",inset:0,backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`,backgroundSize:"60px 60px",animation:"gridMove 4s linear infinite",opacity:.3,pointerEvents:"none"}}/>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28,zIndex:1}}>
          <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue'",fontSize:20,color:"#fff"}}>S</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:3,color:T.white}}>Safeguards IQ</div>
        </div>

        {/* Step indicator */}
        <div style={{display:"flex",alignItems:"center",marginBottom:28,zIndex:1,flexWrap:"wrap",justifyContent:"center",gap:0}}>
          {STEPS.map((s,i)=>(
            <div key={s} style={{display:"flex",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:26,height:26,borderRadius:"50%",
                  background:i<step?T.green:i===step?T.orange:T.card2,
                  border:`2px solid ${i<step?T.green:i===step?T.orange:T.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,fontWeight:800,color:i<=step?"#fff":T.g2,
                  transition:"all .3s",flexShrink:0}}>
                  {i<step?"✓":i+1}
                </div>
                <span style={{fontSize:11,color:i===step?T.white:i<step?T.green:T.g2,fontWeight:i===step?700:400,whiteSpace:"nowrap"}}>{s}</span>
              </div>
              {i<STEPS.length-1&&<div style={{width:24,height:2,background:i<step?T.green:T.border,margin:"0 6px",transition:"all .3s",flexShrink:0}}/>}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div style={{width:"100%",maxWidth:maxW,background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:32,zIndex:1}}>
          {error && (
            <div style={{background:"rgba(255,61,61,.1)",border:`1px solid rgba(255,61,61,.3)`,borderRadius:10,padding:"12px 16px",color:T.red,fontSize:13,marginBottom:20}}>
              ⚠ {error}
            </div>
          )}
          {step===0 && <StepCompany  form={form} setForm={setForm} onNext={next} setError={setError}/>}
          {step===1 && <StepPlant    plants={plants} setPlants={setPlants} onNext={next} onBack={back} setError={setError}/>}
          {step===2 && <StepZones    plants={plants} zones={zones} setZones={setZones} onNext={next} onBack={back} setError={setError}/>}
          {step===3 && <CameraDiscovery zones={zones} cameras={cameras} setCameras={setCameras} onNext={next} onBack={back} setError={setError}/>}
          {step===4 && <StepChoosePlan
            form={{...form, setCameraCount:(v)=>setForm(f=>({...f,cameraCount:v}))}}
            selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan}
            billing={billing} setBilling={setBilling}
            onNext={next} onBack={back}/>}
          {step===5 && <StepActivate
            form={form} plants={plants} zones={zones} cameras={cameras}
            loading={loading} success={success}
            billing={billing} selectedPlan={selectedPlan}
            onBack={back} onActivate={handleActivate}/>}
        </div>

        <div style={{marginTop:20,fontSize:13,color:T.g2,zIndex:1}}>
          Already have an account?{" "}
          <Link to="/login" style={{color:T.orange,fontWeight:700,textDecoration:"none"}}>Sign in →</Link>
        </div>
      </div>
    </>
  );
}
