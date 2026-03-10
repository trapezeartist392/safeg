import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes gridMove{from{transform:translateY(0)}to{transform:translateY(60px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes checkPop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
`;

const T = {
  bg:"#05080F", bg2:"#080D18", card:"#0C1422", card2:"#101828",
  border:"#1A2540", border2:"#243452",
  orange:"#FF5B18", teal:"#00D4B4", blue:"#2D8EFF",
  white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

const PLANS = [
  { id:"starter",      name:"STARTER",      cameras:"Up to 4 cameras", price:2500, color:T.blue,   features:["Real-time dashboard","Email alerts","30-day incident log","Basic safety reports"] },
  { id:"professional", name:"PROFESSIONAL", cameras:"5–16 cameras",    price:2000, color:T.orange, popular:true, features:["Everything in Starter","SMS alerts (MSG91)","90-day archive","Factories Act Form 18","Priority support"] },
  { id:"enterprise",   name:"ENTERPRISE",   cameras:"17–32 cameras",   price:1600, color:T.teal,   features:["Everything in Professional","Multi-plant dashboard","99.5% SLA","Dedicated CSM","Custom reports"] },
];

const STEPS = ["Choose Plan","Company Details","Activate Trial"];

/* ─────────────────────────────────────────────
   STEP COMPONENTS — defined OUTSIDE SignupPage
   so React never recreates them on re-render
───────────────────────────────────────────── */
function StepPlan({ plan, setPlan, billing, setBilling, onNext, error, setError }) {
  return (
    <div style={{ animation:"fadeUp .5s ease both" }}>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:38, color:T.white, letterSpacing:2 }}>CHOOSE YOUR PLAN</div>
        <div style={{ color:T.g1, fontSize:14, marginTop:6 }}>7-day free trial · No credit card required · Cancel anytime</div>
        <div style={{ display:"inline-flex", background:T.card2, border:`1px solid ${T.border}`, borderRadius:50, padding:4, marginTop:20, gap:4 }}>
          {["monthly","annual"].map(b => (
            <button key={b} onClick={() => setBilling(b)} style={{ padding:"8px 20px", borderRadius:50, border:"none", cursor:"pointer", fontFamily:"'Nunito'", fontWeight:700, fontSize:13, background:billing===b?T.orange:"transparent", color:billing===b?"#fff":T.g1 }}>
              {b==="monthly"?"Monthly":"Annual −15%"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:24 }}>
        {PLANS.map(p => (
          <div key={p.id} onClick={() => setPlan(p)} style={{ background:plan?.id===p.id?`${p.color}15`:T.card, border:`2px solid ${plan?.id===p.id?p.color:T.border}`, borderRadius:16, padding:24, cursor:"pointer", position:"relative", transition:"all .2s" }}>
            {p.popular && <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:T.orange, color:"#fff", fontSize:10, fontWeight:800, padding:"3px 14px", borderRadius:20, letterSpacing:1.5, whiteSpace:"nowrap" }}>MOST POPULAR</div>}
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:22, color:p.color, letterSpacing:2, marginBottom:4 }}>{p.name}</div>
            <div style={{ fontSize:12, color:T.g1, marginBottom:16 }}>{p.cameras}</div>
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:42, color:T.white }}>₹{billing==="annual"?Math.round(p.price*0.85).toLocaleString():p.price.toLocaleString()}</div>
            <div style={{ fontSize:11, color:T.g1, marginBottom:20 }}>per camera / month{billing==="annual"?" (annual)":""}</div>
            {billing==="annual" && <div style={{ fontSize:11, color:T.green, marginBottom:16, fontWeight:700 }}>Save ₹{Math.round(p.price*12*0.15).toLocaleString()}/cam/year</div>}
            <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:16, display:"flex", flexDirection:"column", gap:10 }}>
              {p.features.map(f => (
                <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:13, color:T.g1 }}>
                  <span style={{ color:p.color, fontWeight:900, flexShrink:0 }}>✓</span>{f}
                </div>
              ))}
            </div>
            {plan?.id===p.id && <div style={{ marginTop:16, background:p.color, borderRadius:8, padding:"8px", textAlign:"center", color:"#fff", fontSize:12, fontWeight:700 }}>✓ SELECTED</div>}
          </div>
        ))}
      </div>
      <div style={{ textAlign:"center", fontSize:12, color:T.g1, marginBottom:24 }}>
        Annual billing saves 15% · Free 4-week pilot available · All prices excl. GST · Custom pricing for 33+ cameras
      </div>
      <button onClick={() => { if (!plan) { setError("Please select a plan"); return; } setError(""); onNext(); }}
        style={{ width:"100%", background:`linear-gradient(135deg,${T.orange},#FF8C52)`, border:"none", borderRadius:12, padding:"16px", color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito'" }}>
        Start 7-Day Free Trial →
      </button>
    </div>
  );
}

function StepDetails({ form, setForm, plan, onNext, onBack, setError }) {
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fields = [
    { key:"companyName",      label:"COMPANY NAME",     type:"text",     placeholder:"Pune Auto Components Pvt Ltd", full:true },
    { key:"email",            label:"WORK EMAIL",       type:"email",    placeholder:"you@company.com" },
    { key:"password",         label:"PASSWORD",         type:"password", placeholder:"Min. 8 characters" },
    { key:"confirmPassword",  label:"CONFIRM PASSWORD", type:"password", placeholder:"Re-enter password" },
    { key:"phone",            label:"PHONE",            type:"tel",      placeholder:"+91 98765 43210" },
    { key:"gstin",            label:"GSTIN (optional)", type:"text",     placeholder:"27AABCP2018R1ZV" },
    { key:"city",             label:"CITY",             type:"text",     placeholder:"Pune" },
    { key:"state",            label:"STATE",            type:"text",     placeholder:"Maharashtra" },
  ];
  return (
    <div style={{ animation:"fadeUp .5s ease both" }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:32, color:T.white, letterSpacing:2 }}>COMPANY DETAILS</div>
        <div style={{ color:T.g1, fontSize:13, marginTop:4 }}>Plan: <span style={{ color:plan.color, fontWeight:700 }}>{plan.name}</span> · ₹{plan.price.toLocaleString()}/camera/month</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {fields.map(({ key, label, type, placeholder, full }) => (
          <div key={key} style={{ gridColumn:full?"span 2":"span 1" }}>
            <label style={{ fontSize:11, color:T.g1, letterSpacing:1.5, fontWeight:700, display:"block", marginBottom:6 }}>{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={e => F(key, e.target.value)}
              placeholder={placeholder}
              autoComplete={key==="password"||key==="confirmPassword"?"new-password":"off"}
              style={{ width:"100%", background:"#06090F", border:`1px solid ${T.border}`, borderRadius:10, padding:"13px 14px", color:T.white, fontSize:13, fontFamily:"'Nunito'", outline:"none" }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:12 }}>
        {[
          { key:"agreeTerms",    label:"I agree to the Terms of Service and Privacy Policy" },
          { key:"agreeWhatsapp", label:"Receive violation alerts via WhatsApp (recommended)" },
        ].map(({ key, label }) => (
          <label key={key} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
            <div onClick={() => F(key, !form[key])} style={{ width:20, height:20, borderRadius:6, border:`2px solid ${form[key]?T.orange:T.border}`, background:form[key]?T.orange:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .2s" }}>
              {form[key] && <span style={{ color:"#fff", fontSize:12, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ fontSize:13, color:T.g1 }}>{label}</span>
          </label>
        ))}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:24 }}>
        <button onClick={onBack} style={{ flex:1, background:"transparent", border:`1px solid ${T.border}`, borderRadius:12, padding:"14px", color:T.g1, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Nunito'" }}>← Back</button>
        <button onClick={() => {
          if (!form.companyName||!form.email||!form.password) { setError("Please fill all required fields"); return; }
          if (form.password!==form.confirmPassword) { setError("Passwords do not match"); return; }
          if (form.password.length<8) { setError("Password must be at least 8 characters"); return; }
          setError(""); onNext();
        }} style={{ flex:2, background:`linear-gradient(135deg,${T.orange},#FF8C52)`, border:"none", borderRadius:12, padding:"14px", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"'Nunito'" }}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function StepActivate({ form, plan, billing, loading, success, onBack, onActivate }) {
  if (success) return (
    <div style={{ textAlign:"center", padding:"40px 0" }}>
      <div style={{ width:72, height:72, borderRadius:"50%", background:`${T.green}20`, border:`2px solid ${T.green}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, margin:"0 auto 20px", animation:"checkPop .5s ease both" }}>✓</div>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:32, color:T.green, letterSpacing:2 }}>TRIAL ACTIVATED!</div>
      <div style={{ color:T.g1, marginTop:8, fontSize:14 }}>Redirecting to your dashboard...</div>
    </div>
  );
  return (
    <div style={{ animation:"fadeUp .5s ease both" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:32, color:T.white, letterSpacing:2 }}>ACTIVATE FREE TRIAL</div>
        <div style={{ color:T.g1, fontSize:13, marginTop:4 }}>Review your selection and start your 7-day trial</div>
      </div>
      <div style={{ background:T.card2, border:`1px solid ${T.border}`, borderRadius:14, padding:20, marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:22, color:plan.color, letterSpacing:2 }}>{plan.name} PLAN</div>
            <div style={{ fontSize:12, color:T.g1 }}>{plan.cameras}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:28, color:T.white }}>₹{plan.price.toLocaleString()}</div>
            <div style={{ fontSize:11, color:T.g1 }}>per camera / month</div>
          </div>
        </div>
        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:14, display:"flex", flexDirection:"column", gap:8 }}>
          {[["Company",form.companyName],["Email",form.email],["Billing",billing==="annual"?"Annual (−15%)":"Monthly"],["Trial Period","7 days FREE"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
              <span style={{ color:T.g1 }}>{k}</span>
              <span style={{ color:T.white, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"rgba(0,212,180,.06)", border:`1px solid rgba(0,212,180,.2)`, borderRadius:12, padding:16, marginBottom:20 }}>
        <div style={{ fontSize:12, color:T.teal, fontWeight:800, letterSpacing:1.5, marginBottom:8 }}>7-DAY FREE TRIAL INCLUDES</div>
        {["Full platform access — all features unlocked","Up to 4 cameras connected","Real-time PPE violation detection","WhatsApp + Email alerts","No credit card required to start","Cancel anytime — no questions asked"].map(f => (
          <div key={f} style={{ display:"flex", gap:8, fontSize:13, color:T.g1, marginBottom:6 }}>
            <span style={{ color:T.teal }}>✓</span>{f}
          </div>
        ))}
      </div>
      <div style={{ fontSize:12, color:T.g2, textAlign:"center", marginBottom:20 }}>
        After your trial, you'll be billed ₹{plan.price.toLocaleString()}/camera/month + 18% GST.<br/>
        A Razorpay payment link will be sent to <strong style={{ color:T.g1 }}>{form.email}</strong> on Day 7.
      </div>
      <div style={{ display:"flex", gap:12 }}>
        <button onClick={onBack} style={{ flex:1, background:"transparent", border:`1px solid ${T.border}`, borderRadius:12, padding:"14px", color:T.g1, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Nunito'" }}>← Back</button>
        <button onClick={onActivate} disabled={loading} style={{ flex:2, background:loading?T.g2:`linear-gradient(135deg,${T.orange},#FF8C52)`, border:"none", borderRadius:12, padding:"14px", color:"#fff", fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:"'Nunito'", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          {loading ? <><div style={{ width:18,height:18,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite" }}/>Activating...</> : "🚀 Start Free Trial"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN SIGNUP PAGE
───────────────────────────────────────────── */
export default function SignupPage({ onLogin }) {
  const [step,    setStep]    = useState(0);
  const [plan,    setPlan]    = useState(null);
  const [billing, setBilling] = useState("monthly");
  const [form,    setForm]    = useState({
    companyName:"", email:"", password:"", confirmPassword:"",
    phone:"", gstin:"", city:"", state:"",
    agreeTerms:false, agreeWhatsapp:false,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleActivate = async () => {
    if (!form.agreeTerms) { setError("Please agree to the Terms of Service"); return; }
    setLoading(true); setError("");
    try {
      const res = await axios.post("/api/v1/auth/register", {
        companyName: form.companyName, email: form.email, password: form.password,
        fullName: form.companyName + " Admin", plan: plan.id,
        phone: form.phone, gstin: form.gstin, city: form.city, state: form.state, trialDays: 7,
      });
      const { accessToken, refreshToken, user, tenantId } = res.data.data;
      localStorage.setItem("safeg_token",   accessToken);
      localStorage.setItem("safeg_refresh", refreshToken);
      localStorage.setItem("safeg_user",    JSON.stringify(user));
      localStorage.setItem("safeg_tenant",  tenantId);
      setSuccess(true);
      setTimeout(() => { onLogin?.(user); navigate("/dashboard"); }, 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", fontFamily:"'Nunito',sans-serif", padding:"40px 20px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"fixed", inset:0, backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`, backgroundSize:"60px 60px", animation:"gridMove 4s linear infinite", opacity:.3, pointerEvents:"none" }} />

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:36, zIndex:1, animation:"fadeUp .5s ease both" }}>
          <div style={{ width:40, height:40, borderRadius:10, background:`linear-gradient(135deg,${T.orange},#FF8C52)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue'", fontSize:20, color:"#fff" }}>S</div>
          <div style={{ fontFamily:"'Bebas Neue'", fontSize:20, letterSpacing:3, color:T.white }}>SYYAIM SAFEG AI</div>
        </div>

        {/* Step indicator */}
        <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:32, zIndex:1, animation:"fadeUp .5s ease both" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display:"flex", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:i<=step?T.orange:T.card2, border:`2px solid ${i<=step?T.orange:T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:i<=step?"#fff":T.g2, transition:"all .3s" }}>
                  {i<step?"✓":i+1}
                </div>
                <span style={{ fontSize:12, color:i===step?T.white:T.g2, fontWeight:i===step?700:400, whiteSpace:"nowrap" }}>{s}</span>
              </div>
              {i<STEPS.length-1 && <div style={{ width:40, height:2, background:i<step?T.orange:T.border, margin:"0 12px", transition:"all .3s" }} />}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div style={{ width:"100%", maxWidth:step===0?860:560, background:T.card, border:`1px solid ${T.border}`, borderRadius:20, padding:36, zIndex:1 }}>
          {error && (
            <div style={{ background:"rgba(255,61,61,.1)", border:`1px solid rgba(255,61,61,.3)`, borderRadius:10, padding:"12px 16px", color:T.red, fontSize:13, marginBottom:20 }}>
              ⚠ {error}
            </div>
          )}
          {step===0 && <StepPlan plan={plan} setPlan={setPlan} billing={billing} setBilling={setBilling} onNext={()=>setStep(1)} error={error} setError={setError} />}
          {step===1 && <StepDetails form={form} setForm={setForm} plan={plan} onNext={()=>setStep(2)} onBack={()=>setStep(0)} setError={setError} />}
          {step===2 && <StepActivate form={form} plan={plan} billing={billing} loading={loading} success={success} onBack={()=>setStep(1)} onActivate={handleActivate} />}
        </div>

        <div style={{ marginTop:24, fontSize:13, color:T.g2, zIndex:1 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color:T.orange, fontWeight:700, textDecoration:"none" }}>Sign in →</Link>
        </div>
      </div>
    </>
  );
}
