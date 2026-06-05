/**
 * SignupPage.jsx — Redesigned
 * SafeguardsIQ — Unified Signup + Free Trial Page
 * 
 * Step 1: Company Details → Two buttons:
 *   A) Free Trial → Login with demo credentials → Dashboard
 *   B) Sign Up → Choose Plan → Pay → Dashboard
 *   (Plant/Zone/Camera setup happens INSIDE dashboard after login)
 */
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes gridMove{from{transform:translateY(0)}to{transform:translateY(60px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes checkPop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
input:focus,select:focus,textarea:focus{outline:2px solid #FF5B18!important;border-color:#FF5B18!important}
`;

const T = {
  bg:"#05080F", bg2:"#080D18", card:"#0C1422", card2:"#101828",
  border:"#1A2540", border2:"#243452",
  orange:"#FF5B18", teal:"#00D4B4", blue:"#2D8EFF",
  white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

const inp = { width:"100%", background:"#06090F", border:`1px solid ${T.border}`, borderRadius:10, padding:"13px 14px", color:T.white, fontSize:13, fontFamily:"'Nunito'", outline:"none" };
const lbl = { fontSize:11, color:T.g1, letterSpacing:1.5, fontWeight:700, display:"block", marginBottom:6 };
const sel = { ...inp, cursor:"pointer" };

const PLANS = [
  {
    id:"starter", name:"STARTER", price:2500, cameras:"1–4",
    color:T.blue, badge:null,
    features:["Up to 4 cameras","30-day violation archive","Email alerts","Form 18 PDF","Basic compliance report"],
  },
  {
    id:"growth", name:"PROFESSIONAL", price:2000, cameras:"5–16",
    color:T.orange, badge:"⭐ MOST POPULAR",
    features:["5–16 cameras","90-day violation archive","WhatsApp + Email alerts","Form 18 PDF","Full compliance reports","ROI calculator","Multi-plant dashboard"],
  },
  {
    id:"enterprise", name:"ENTERPRISE", price:1600, cameras:"17–32",
    color:T.teal, badge:"🏆 BEST VALUE",
    features:["17–32 cameras","Unlimited archive","WhatsApp + SMS + Email","Dedicated CSM","Custom reports","99.5% SLA","On-site training"],
  },
];

/* ── STEP 1: Company Details ── */
function StepCompany({ form, setForm, onFreeTrial, onSignup, loading, error, setError }) {
  const F = (k,v) => setForm(f=>({...f,[k]:v}));

  const validate = () => {
    if(!form.companyName||!form.email||!form.password||!form.phone||!form.city||!form.state){
      setError("Please fill all required fields"); return false;
    }
    if(form.password !== form.confirmPass){ setError("Passwords do not match"); return false; }
    if(form.password.length < 8){ setError("Password must be at least 8 characters"); return false; }
    if(!form.agreeTerms){ setError("Please agree to the Terms of Service"); return false; }
    setError(""); return true;
  };

  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>COMPANY DETAILS</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Tell us about your organisation</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {[
          {k:"companyName", l:"COMPANY NAME *",           t:"text",     p:"Pune Auto Components Pvt Ltd", full:true},
          {k:"email",       l:"WORK EMAIL *",             t:"email",    p:"you@company.com"},
          {k:"password",    l:"PASSWORD *",               t:"password", p:"Min. 8 characters"},
          {k:"confirmPass", l:"CONFIRM PASSWORD *",       t:"password", p:"Re-enter password"},
          {k:"phone",       l:"PHONE / WHATSAPP *",       t:"tel",      p:"+91 98765 43210"},
          {k:"gstin",       l:"GSTIN (optional)",         t:"text",     p:"27AABCP2018R1ZV"},
          {k:"city",        l:"CITY *",                   t:"text",     p:"Pune"},
          {k:"state",       l:"STATE *",                  t:"text",     p:"Maharashtra"},
          {k:"address",     l:"REGISTERED ADDRESS",       t:"text",     p:"123, MIDC, Pune", full:true},
          {k:"whatsapp",    l:"WHATSAPP NUMBER FOR ALERTS", t:"tel",    p:"+91 98765 43210", full:true},
        ].map(f=>(
          <div key={f.k} style={{gridColumn:f.full?"1/-1":"auto"}}>
            <label style={lbl}>{f.l}</label>
            <input type={f.t} value={form[f.k]||""} onChange={e=>F(f.k,e.target.value)} placeholder={f.p} style={inp}/>
          </div>
        ))}
      </div>

      {/* Checkboxes */}
      <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <input type="checkbox" checked={form.agreeTerms||false} onChange={e=>F("agreeTerms",e.target.checked)}/>
          <span style={{fontSize:12,color:T.g1}}>I agree to the <a href="/terms" target="_blank" style={{color:T.orange}}>Terms of Service</a></span>
        </label>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
          background:`${T.green}08`, border:`1px solid ${T.green}25`, borderRadius:10, padding:"12px 14px"}}>
          <input type="checkbox" checked={form.agreeWhatsapp||false}
            onChange={e=>F("agreeWhatsapp",e.target.checked)}
            style={{width:16,height:16,accentColor:T.green}}/>
          <div>
            <div style={{fontSize:13,color:T.white,fontWeight:700}}>📱 Get violation alerts on WhatsApp</div>
            <div style={{fontSize:11,color:T.g1,marginTop:2}}>Receive instant alerts when AI detects PPE violations. Sent within 28 seconds.</div>
          </div>
        </label>
      </div>

      {/* Divider */}
      <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0 20px"}}>
        <div style={{flex:1,height:1,background:T.border}}/>
        <span style={{fontSize:11,color:T.g2,letterSpacing:2}}>CHOOSE HOW TO START</span>
        <div style={{flex:1,height:1,background:T.border}}/>
      </div>

      {/* Two action buttons */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

        {/* Free Trial */}
        <div style={{background:`${T.green}08`,border:`1px solid ${T.green}30`,borderRadius:14,padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>🎁</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:T.green,letterSpacing:2}}>FREE TRIAL</div>
            <div style={{fontSize:11,color:T.g1,marginTop:4}}>No credit card · No commitment</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {["14-day full access","Demo factory data","All Professional features","WhatsApp alerts included"].map(f=>(
              <div key={f} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{color:T.green,fontSize:11}}>✓</span>
                <span style={{fontSize:11,color:T.g1}}>{f}</span>
              </div>
            ))}
          </div>
          {/* Trial info */}
          <div style={{background:`${T.teal}08`,border:`1px solid ${T.teal}25`,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:T.teal,fontWeight:700,letterSpacing:1,marginBottom:6}}>WHAT YOU GET</div>
            <div style={{fontSize:11,color:T.g1}}>✓ 14 days full Professional access</div>
            <div style={{fontSize:11,color:T.g1,marginTop:2}}>✓ Your own dashboard with real data</div>
            <div style={{fontSize:11,color:T.g1,marginTop:2}}>✓ No credit card · Cancel anytime</div>
          </div>
          <button onClick={()=>{ if(validate()) onFreeTrial(); }}
            disabled={loading}
            style={{width:"100%",border:`1px solid ${T.green}`,borderRadius:10,padding:"12px",
              color:T.green,fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'",
              background:`${T.green}12`,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading==='trial' ? <><div style={{width:16,height:16,border:"2px solid rgba(34,212,104,.3)",borderTopColor:T.green,borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Starting...</> : "🚀 Start Free Trial →"}
          </button>
        </div>

        {/* Sign Up & Pay */}
        <div style={{background:`${T.orange}08`,border:`1px solid ${T.orange}30`,borderRadius:14,padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:6}}>💳</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:T.orange,letterSpacing:2}}>SIGN UP & PAY</div>
            <div style={{fontSize:11,color:T.g1,marginTop:4}}>Activate your plan instantly</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {["From ₹2,500/camera/month","Choose Starter/Pro/Enterprise","Annual = 15% discount","GST invoice included"].map(f=>(
              <div key={f} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{color:T.orange,fontSize:11}}>✓</span>
                <span style={{fontSize:11,color:T.g1}}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{background:`${T.orange}08`,border:`1px solid ${T.orange}25`,borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:T.orange,fontWeight:700,letterSpacing:1,marginBottom:4}}>AFTER PAYMENT</div>
            <div style={{fontSize:11,color:T.g1}}>Your account is activated instantly. Set up your plant, zones & cameras from the dashboard.</div>
          </div>
          <button onClick={()=>{ if(validate()) onSignup(); }}
            disabled={loading}
            style={{width:"100%",border:"none",borderRadius:10,padding:"12px",
              color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'",
              background:`linear-gradient(135deg,${T.orange},#FF8C52)`,
              display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading==='signup' ? <><div style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Processing...</> : "💳 Choose Plan & Pay →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SUCCESS SCREEN ── */
function StepSuccess({ billing, email }) {
  return (
    <div style={{textAlign:"center",padding:"40px 0",animation:"fadeUp .5s ease both"}}>
      <div style={{fontSize:64,marginBottom:16,animation:"checkPop .4s ease both"}}>✅</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.green,letterSpacing:2,marginBottom:8}}>
        ACCOUNT ACTIVATED!
      </div>
      <div style={{color:T.g1,fontSize:14,marginBottom:8}}>
        Payment successful! Redirecting to your dashboard...
      </div>
      <div style={{color:T.g2,fontSize:12,marginBottom:20}}>
        GST invoice will be emailed to <strong style={{color:T.white}}>{email}</strong>
      </div>
      <div style={{width:40,height:40,border:`3px solid ${T.border}`,borderTopColor:T.orange,
        borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto"}}/>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN SIGNUP PAGE
════════════════════════════════════════ */
/* ── STEP 2: Choose Plan (auto-selects based on camera count) ── */
function StepChoosePlanAuto({ form, setForm, selectedPlan, setSelectedPlan, billing, setBilling, onNext, onBack }) {
  const camCount = parseInt(form.cameraCount) || 1;

  // Auto-select plan based on camera count
  const getAutoplan = (n) => {
    if (n <= 4)  return 'starter';
    if (n <= 16) return 'growth';
    return 'enterprise';
  };

  useEffect(() => {
    setSelectedPlan(getAutoplan(camCount));
  }, [camCount]);

  useEffect(() => {
    if (billing !== 'monthly' && billing !== 'annual') setBilling('monthly');
  }, [billing]);

  const plan = PLANS.find(p => p.id === selectedPlan) || PLANS[1];
  const pricePerCam = billing === 'annual' ? Math.round(plan.price * 0.85) : plan.price;
  const totalMonthly = pricePerCam * camCount;
  const totalWithGST = Math.round(totalMonthly * 1.18);
  const totalAnnual = Math.round(totalMonthly * 12 * 1.18);
  const displayTotal = billing === 'annual' ? totalAnnual : totalWithGST;
  const displayLabel = billing === 'annual' ? 'TOTAL / YEAR' : 'TOTAL / MONTH';

  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>CHOOSE YOUR PLAN</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Enter number of cameras — plan auto-selected</div>
      </div>

      {/* Billing toggle */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
        <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:10,padding:4,display:"flex"}}>
          {[{id:"monthly",label:"Monthly"},{id:"annual",label:"Annual (Save 15%)"}].map(b=>(
            <button key={b.id} onClick={()=>setBilling(b.id)} style={{
              padding:"8px 24px",borderRadius:8,fontSize:12,fontWeight:700,
              border:"none",cursor:"pointer",fontFamily:"'Nunito'",
              background:billing===b.id?T.orange:"transparent",
              color:billing===b.id?"#fff":T.g1,transition:"all .2s",
            }}>{b.label}</button>
          ))}
        </div>
      </div>

      {/* Camera count slider */}
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:14,padding:24,marginBottom:20}}>
        <div style={{fontSize:12,color:T.g1,fontWeight:700,letterSpacing:1.5,marginBottom:16}}>HOW MANY CAMERAS DO YOU NEED?</div>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
          <button onClick={()=>setForm(f=>({...f,cameraCount:Math.max(1,camCount-1)}))}
            style={{width:36,height:36,borderRadius:8,border:`1px solid ${T.border}`,
              background:T.card,color:T.white,fontSize:18,cursor:"pointer",flexShrink:0}}>−</button>
          <div style={{flex:1}}>
            <input type="range" min={1} max={32} value={camCount}
              onChange={e=>setForm(f=>({...f,cameraCount:parseInt(e.target.value)}))}
              style={{width:"100%",accentColor:T.orange,cursor:"pointer"}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:T.g2,marginTop:4}}>
              <span>1</span><span>4</span><span>16</span><span>32</span>
            </div>
          </div>
          <button onClick={()=>setForm(f=>({...f,cameraCount:Math.min(32,camCount+1)}))}
            style={{width:36,height:36,borderRadius:8,border:`1px solid ${T.border}`,
              background:T.card,color:T.white,fontSize:18,cursor:"pointer",flexShrink:0}}>+</button>
          <div style={{background:T.card,border:`1px solid ${T.orange}`,borderRadius:10,
            padding:"8px 16px",minWidth:60,textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,color:T.orange,fontFamily:"'Bebas Neue'"}}>{camCount}</div>
            <div style={{fontSize:9,color:T.g2}}>CAMERAS</div>
          </div>
        </div>

        {/* Plan zones indicator */}
        <div style={{display:"grid",gridTemplateColumns:"4fr 12fr 16fr",gap:4,marginTop:8}}>
          {[
            {label:"STARTER",range:"1–4",color:T.blue,active:camCount<=4},
            {label:"PROFESSIONAL",range:"5–16",color:T.orange,active:camCount>4&&camCount<=16},
            {label:"ENTERPRISE",range:"17–32",color:T.teal,active:camCount>16},
          ].map(z=>(
            <div key={z.label} style={{
              padding:"6px 8px",borderRadius:6,textAlign:"center",
              background:z.active?`${z.color}20`:T.card,
              border:`1px solid ${z.active?z.color:T.border}`,
              transition:"all .3s",
            }}>
              <div style={{fontSize:9,fontWeight:800,color:z.active?z.color:T.g2,letterSpacing:1}}>{z.label}</div>
              <div style={{fontSize:9,color:z.active?z.color:T.g2}}>{z.range} cams</div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected plan card */}
      <div style={{background:`${plan.color}10`,border:`2px solid ${plan.color}`,
        borderRadius:14,padding:24,marginBottom:20,position:"relative"}}>
        {plan.badge && (
          <div style={{position:"absolute",top:-12,left:20,
            background:plan.color,color:"#fff",fontSize:10,fontWeight:800,
            padding:"3px 14px",borderRadius:20}}>{plan.badge}</div>
        )}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:20}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:plan.color,letterSpacing:2}}>{plan.name}</div>
              <div style={{background:`${plan.color}20`,border:`1px solid ${plan.color}40`,
                borderRadius:20,padding:"3px 12px",fontSize:10,color:plan.color,fontWeight:700}}>
                AUTO-SELECTED ✓
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {plan.features.map(f=>(
                <div key={f} style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                  <span style={{color:plan.color,fontSize:11,flexShrink:0,marginTop:1}}>✓</span>
                  <span style={{fontSize:11,color:T.g1}}>{f}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Price breakdown */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:12,
            padding:16,minWidth:200,textAlign:"center",flexShrink:0}}>
            <div style={{fontSize:10,color:T.g2,letterSpacing:1,marginBottom:8}}>PRICE BREAKDOWN</div>
            <div style={{fontSize:13,color:T.g1,marginBottom:4}}>
              {camCount} cams × ₹{pricePerCam.toLocaleString()}/cam
            </div>
            <div style={{fontSize:13,color:T.g1,marginBottom:4}}>
              = ₹{totalMonthly.toLocaleString()}/month
              {billing==='annual' && ` × 12`}
            </div>
            <div style={{fontSize:11,color:T.g2,marginBottom:8}}>+ 18% GST</div>
            <div style={{height:1,background:T.border,marginBottom:8}}/>
            <div style={{fontSize:11,color:T.g2,marginBottom:4}}>{displayLabel}</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white}}>
              ₹{displayTotal.toLocaleString()}
            </div>
            {billing==="annual" && (
              <div style={{fontSize:10,color:T.green,marginTop:4}}>
                ₹{totalMonthly.toLocaleString()}/month × 12 months incl. GST
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",
          border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",
          color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={onNext} style={{flex:2,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,
          border:"none",borderRadius:12,padding:"14px",color:"#fff",
          fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          💳 Pay ₹{displayTotal.toLocaleString()} {billing==='annual'?'/ year':'/ month'} →
        </button>
      </div>
    </div>
  );
}

export default function SignupPage({ onLogin }) {
  const [step,         setStep]         = useState(0); // 0=company, 1=plan, 2=success
  const [form,         setForm]         = useState({
    companyName:"", email:"", password:"", confirmPass:"",
    phone:"", gstin:"", address:"", city:"", state:"",
    whatsapp:"", agreeTerms:false, agreeWhatsapp:false, cameraCount:4,
  });
  const [loading,      setLoading]      = useState(false); // false | 'trial' | 'signup'
  const [error,        setError]        = useState("");
  const [billing,      setBilling]      = useState("monthly");
  const [selectedPlan, setSelectedPlan] = useState("growth");
  const navigate = useNavigate();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  // Free Trial — register customer's own account with 14-day trial
  const handleFreeTrial = async () => {
    setLoading('trial'); setError("");
    try {
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
        plants:        [],
        zones:         [],
        cameras:       [],
      });
      const { accessToken, refreshToken, user, tenantId } = regRes.data.data;
      localStorage.setItem("safeg_token",   accessToken);
      localStorage.setItem("safeg_refresh", refreshToken);
      localStorage.setItem("safeg_user",    JSON.stringify(user));
      localStorage.setItem("safeg_tenant",  tenantId);
      localStorage.setItem("safeg_plan",    "growth");
      onLogin?.(user);
      navigate("/dashboard");
    } catch(err) {
      setError(err.response?.data?.message || err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Sign Up — go to plan selection
  const handleSignup = () => {
    setStep(1);
  };

  // Payment & Account Creation
  const handlePayAndActivate = async () => {
    setLoading('signup'); setError("");
    try {
      // 1. Register account
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
        trialDays:     0,
        plants:        [],
        zones:         [],
        cameras:       [],
      });
      const { accessToken, refreshToken, user, tenantId } = regRes.data.data;
      localStorage.setItem("safeg_token",   accessToken);
      localStorage.setItem("safeg_refresh", refreshToken);
      localStorage.setItem("safeg_user",    JSON.stringify(user));
      localStorage.setItem("safeg_tenant",  tenantId);

      // 2. Create Razorpay order
      const orderRes = await axios.post("/api/v1/payments/create-order", {
        planId:      selectedPlan,
        billing,
        addOns:      [],
        cameraCount: parseInt(form.cameraCount) || 4,
        customer: { name: form.companyName, email: form.email, phone: form.phone },
      }, { headers: { Authorization: `Bearer ${accessToken}` }});

      const { orderId, amount, currency, keyId } = orderRes.data.data;

      // 3. Open Razorpay
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount, currency: currency || "INR", order_id: orderId,
          name:        "SafeguardsIQ",
          description: `${selectedPlan.toUpperCase()} Plan — ${billing}`,
          image:       "https://safeguardsiq.com/logo.png",
          prefill:     { name: form.companyName, email: form.email, contact: form.phone },
          theme:       { color: "#FF5B18" },
          handler: async (response) => {
            try {
              await axios.post("/api/v1/payments/verify", {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                planId: selectedPlan, billing,
              }, { headers: { Authorization: `Bearer ${accessToken}` }});
              resolve();
            } catch(e) { reject(e); }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        });
        rzp.open();
      });

      // 4. Success
      setStep(2);
      onLogin?.(user);
      setTimeout(() => navigate("/dashboard"), 2500);

    } catch(err) {
      if (err.message === "Payment cancelled") {
        setError("Payment cancelled. You can try again.");
      } else {
        setError(err.response?.data?.message || err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const maxW = step === 1 ? 820 : 640;

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"flex-start",fontFamily:"'Nunito',sans-serif",
        padding:"32px 20px",position:"relative",overflow:"hidden"}}>

        {/* Grid background */}
        <div style={{position:"fixed",inset:0,
          backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`,
          backgroundSize:"60px 60px",animation:"gridMove 4s linear infinite",opacity:.3,pointerEvents:"none"}}/>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:28,zIndex:1}}>
          <div style={{width:38,height:38,borderRadius:10,
            background:`linear-gradient(135deg,${T.orange},#FF8C52)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontFamily:"'Bebas Neue'",fontSize:20,color:"#fff"}}>S</div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:3,color:T.white}}>Safeguards IQ</div>
        </div>

        {/* Step indicator — only show for paid signup flow */}
        {step === 1 && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24,zIndex:1}}>
            {["Company Details","Choose Plan","Activate"].map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:24,height:24,borderRadius:"50%",
                    background:i<1?T.green:i===1?T.orange:T.card2,
                    border:`2px solid ${i<1?T.green:i===1?T.orange:T.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:10,fontWeight:800,color:i<=1?"#fff":T.g2}}>
                    {i<1?"✓":i+1}
                  </div>
                  <span style={{fontSize:11,color:i===1?T.white:i<1?T.green:T.g2,fontWeight:i===1?700:400}}>{s}</span>
                </div>
                {i<2 && <div style={{width:24,height:2,background:i<1?T.green:T.border,margin:"0 6px"}}/>}
              </div>
            ))}
          </div>
        )}

        {/* Form card */}
        <div style={{width:"100%",maxWidth:maxW,background:T.card,
          border:`1px solid ${T.border}`,borderRadius:20,padding:32,zIndex:1}}>

          {error && (
            <div style={{background:"rgba(255,61,61,.1)",border:`1px solid rgba(255,61,61,.3)`,
              borderRadius:10,padding:"12px 16px",color:T.red,fontSize:13,marginBottom:20}}>
              ⚠ {error}
            </div>
          )}

          {step === 0 && (
            <StepCompany
              form={form} setForm={setForm}
              onFreeTrial={handleFreeTrial}
              onSignup={handleSignup}
              loading={loading} error={error} setError={setError}
            />
          )}

          {step === 1 && (
<StepChoosePlanAuto
              form={form} setForm={setForm}
              selectedPlan={selectedPlan} setSelectedPlan={setSelectedPlan}
              billing={billing} setBilling={setBilling}
              onNext={handlePayAndActivate}
              onBack={() => setStep(0)}
            />
          )}

          {step === 2 && <StepSuccess email={form.email} />}
        </div>

        <div style={{marginTop:20,fontSize:13,color:T.g2,zIndex:1}}>
          Already have an account?{" "}
          <Link to="/login" style={{color:T.orange,fontWeight:700,textDecoration:"none"}}>Sign in →</Link>
        </div>
      </div>
    </>
  );
}
