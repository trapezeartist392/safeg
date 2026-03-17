import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const CSS = `

*{margin:0;padding:0;box-sizing:border-box}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes gridMove{from{transform:translateY(0)}to{transform:translateY(60px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes checkPop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
input:focus,select:focus,textarea:focus{outline:2px solid #FF5B18!important;border-color:#FF5B18!important}
`;

const T = {
  bg:"#05080F", bg2:"#080D18", card:"#0C1422", card2:"#101828",
  border:"#1A2540", border2:"#243452",
  orange:"#FF5B18", teal:"#00D4B4", blue:"#2D8EFF",
  white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

const STEPS = ["Company Details","Plant / Factory","Zones / Areas","Register Cameras","Activate"];

const inp = { width:"100%", background:"#06090F", border:`1px solid ${T.border}`, borderRadius:10, padding:"13px 14px", color:T.white, fontSize:13, fontFamily:"'Nunito'", outline:"none" };
const lbl = { fontSize:11, color:T.g1, letterSpacing:1.5, fontWeight:700, display:"block", marginBottom:6 };
const sel = { ...inp, cursor:"pointer" };

/* helper: add / remove item from array */
const toggle = (arr, val) => arr.includes(val) ? arr.filter(x=>x!==val) : [...arr, val];

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
          {k:"address",      l:"REGISTERED ADDRESS",   t:"text",     p:"123, MIDC, Pune", full:true},
          {k:"city",         l:"CITY",                  t:"text",     p:"Pune"},
          {k:"state",        l:"STATE",                 t:"text",     p:"Maharashtra"},
          {k:"pincode",      l:"PINCODE",               t:"text",     p:"411019"},
        ].map(({k,l,t,p,full})=>(
          <div key={k} style={{gridColumn:full?"span 2":"span 1"}}>
            <label style={lbl}>{l}</label>
            <input type={t} value={form[k]||""} onChange={e=>F(k,e.target.value)} placeholder={p}
              autoComplete={t==="password"?"new-password":"off"} style={inp}/>
          </div>
        ))}
      </div>
      <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:12}}>
        {[
          {k:"agreeTerms",    l:"I agree to the Terms of Service and Privacy Policy *"},
          {k:"agreeWhatsapp", l:"Receive violation alerts via WhatsApp (recommended)"},
        ].map(({k,l})=>(
          <label key={k} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
            <div onClick={()=>F(k,!form[k])} style={{width:20,height:20,borderRadius:6,border:`2px solid ${form[k]?T.orange:T.border}`,background:form[k]?T.orange:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
              {form[k]&&<span style={{color:"#fff",fontSize:12,fontWeight:900}}>✓</span>}
            </div>
            <span style={{fontSize:13,color:T.g1}}>{l}</span>
          </label>
        ))}
      </div>
      <button onClick={()=>{
        if(!form.companyName||!form.email||!form.password||!form.phone){setError("Please fill all required fields");return;}
        if(form.password!==form.confirmPass){setError("Passwords do not match");return;}
        if(form.password.length<8){setError("Password must be at least 8 characters");return;}
        if(!form.agreeTerms){setError("Please agree to the Terms of Service");return;}
        setError("");onNext();
      }} style={{width:"100%",marginTop:24,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"15px",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
        Continue → Plant Details
      </button>
    </div>
  );
}

/* ── STEP 2 — Plant / Factory ── */
function StepPlant({ plants, setPlants, onNext, onBack, setError }) {
  const [draft, setDraft] = useState({name:"",type:"",address:"",city:"",state:"",workers:"",shifts:"1"});
  const D = (k,v) => setDraft(d=>({...d,[k]:v}));
  const addPlant = () => {
    if(!draft.name||!draft.city){setError("Plant name and city are required");return;}
    setPlants(p=>[...p,{...draft,id:Date.now()}]);
    setDraft({name:"",type:"",address:"",city:"",state:"",workers:"",shifts:"1"});
    setError("");
  };
  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>PLANT / FACTORY SETUP</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Add your manufacturing plants or factory locations</div>
      </div>

      {/* Added plants */}
      {plants.length>0 && (
        <div style={{marginBottom:20,display:"flex",flexDirection:"column",gap:10}}>
          {plants.map((p,i)=>(
            <div key={p.id} style={{background:T.card2,border:`1px solid ${T.green}40`,borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>🏭</span>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:T.white}}>{p.name}</div>
                <div style={{fontSize:11,color:T.g1}}>{p.type} · {p.city}, {p.state} · {p.workers||"?"} workers · {p.shifts} shift(s)</div>
              </div>
              <span style={{color:T.green,fontSize:18}}>✓</span>
              <button onClick={()=>setPlants(pl=>pl.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:16}}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add plant form */}
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:14,padding:20,marginBottom:20}}>
        <div style={{fontSize:12,color:T.orange,fontWeight:800,letterSpacing:1.5,marginBottom:16}}>
          {plants.length===0?"ADD FIRST PLANT":"ADD ANOTHER PLANT"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[
            {k:"name",    l:"PLANT NAME *",     t:"text", p:"Unit 1 — Forging Shop",    full:true},
            {k:"address", l:"ADDRESS",          t:"text", p:"Plot 45, MIDC Bhosari",    full:true},
            {k:"city",    l:"CITY *",           t:"text", p:"Pune"},
            {k:"state",   l:"STATE",            t:"text", p:"Maharashtra"},
            {k:"workers", l:"NO. OF WORKERS",   t:"number", p:"120"},
          ].map(({k,l,t,p,full})=>(
            <div key={k} style={{gridColumn:full?"span 2":"span 1"}}>
              <label style={lbl}>{l}</label>
              <input type={t} value={draft[k]} onChange={e=>D(k,e.target.value)} placeholder={p} style={inp}/>
            </div>
          ))}
          <div>
            <label style={lbl}>FACTORY TYPE</label>
            <select value={draft.type} onChange={e=>D("type",e.target.value)} style={sel}>
              <option value="">Select type</option>
              {["Auto / Engineering","Chemicals","Textiles","Food Processing","Pharmaceuticals","Steel / Metal","Plastics","Electronics","Other"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>NUMBER OF SHIFTS</label>
            <select value={draft.shifts} onChange={e=>D("shifts",e.target.value)} style={sel}>
              {["1","2","3"].map(o=><option key={o} value={o}>{o} Shift{o!=="1"?"s":""}</option>)}
            </select>
          </div>
        </div>
        <button onClick={addPlant} style={{marginTop:14,background:T.card,border:`1px solid ${T.orange}`,borderRadius:10,padding:"10px 20px",color:T.orange,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>
          + Add Plant
        </button>
      </div>

      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={()=>{
          if(plants.length===0){setError("Please add at least one plant");return;}
          setError("");onNext();
        }} style={{flex:2,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
          Continue → Zones / Areas
        </button>
      </div>
    </div>
  );
}

/* ── STEP 3 — Zones / Areas ── */
function StepZones({ plants, zones, setZones, onNext, onBack, setError }) {
  const [selPlant, setSelPlant] = useState(plants[0]?.id||null);
  const [draft, setDraft] = useState({name:"",type:"",riskLevel:"medium"});
  const D = (k,v) => setDraft(d=>({...d,[k]:v}));
  const plantZones = zones.filter(z=>z.plantId===selPlant);
  const addZone = () => {
    if(!draft.name){setError("Zone name is required");return;}
    setZones(z=>[...z,{...draft,id:Date.now(),plantId:selPlant}]);
    setDraft({name:"",type:"",riskLevel:"medium"});
    setError("");
  };
  const riskColor = r => r==="high"?T.red:r==="medium"?T.amber:T.green;
  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>ZONES / AREAS</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Define safety monitoring zones within each plant</div>
      </div>

      {/* Plant selector */}
      {plants.length>1 && (
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          {plants.map(p=>(
            <button key={p.id} onClick={()=>setSelPlant(p.id)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${selPlant===p.id?T.orange:T.border}`,background:selPlant===p.id?`${T.orange}20`:T.card2,color:selPlant===p.id?T.orange:T.g1,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>
              🏭 {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Existing zones */}
      {plantZones.length>0 && (
        <div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>
          {plantZones.map((z,i)=>(
            <div key={z.id} style={{background:T.card2,border:`1px solid ${riskColor(z.riskLevel)}40`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:16}}>📍</span>
              <div style={{flex:1}}>
                <span style={{fontSize:13,fontWeight:700,color:T.white}}>{z.name}</span>
                {z.type&&<span style={{fontSize:11,color:T.g1,marginLeft:8}}>· {z.type}</span>}
              </div>
              <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,background:`${riskColor(z.riskLevel)}20`,color:riskColor(z.riskLevel),border:`1px solid ${riskColor(z.riskLevel)}40`}}>
                {z.riskLevel.toUpperCase()} RISK
              </span>
              <button onClick={()=>setZones(zs=>zs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14}}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add zone form */}
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:14,padding:18,marginBottom:20}}>
        <div style={{fontSize:12,color:T.teal,fontWeight:800,letterSpacing:1.5,marginBottom:14}}>ADD ZONE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"span 2"}}>
            <label style={lbl}>ZONE NAME *</label>
            <input value={draft.name} onChange={e=>D("name",e.target.value)} placeholder="e.g. Press Shop, Welding Bay, Paint Booth" style={inp}/>
          </div>
          <div>
            <label style={lbl}>ZONE TYPE</label>
            <select value={draft.type} onChange={e=>D("type",e.target.value)} style={sel}>
              <option value="">Select type</option>
              {["Production Floor","Welding Area","Press Shop","Paint Booth","Loading Dock","Electrical Room","Chemical Storage","Assembly Line","Packaging","Warehouse","Other"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>RISK LEVEL</label>
            <select value={draft.riskLevel} onChange={e=>D("riskLevel",e.target.value)} style={sel}>
              <option value="low">🟢 Low Risk</option>
              <option value="medium">🟡 Medium Risk</option>
              <option value="high">🔴 High Risk</option>
            </select>
          </div>
        </div>
        <button onClick={addZone} style={{marginTop:14,background:T.card,border:`1px solid ${T.teal}`,borderRadius:10,padding:"10px 20px",color:T.teal,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>
          + Add Zone
        </button>
      </div>

      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={()=>{
          if(zones.length===0){setError("Please add at least one zone");return;}
          setError("");onNext();
        }} style={{flex:2,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
          Continue → Register Cameras
        </button>
      </div>
    </div>
  );
}

/* ── STEP 4 — Register Cameras ── */
const PPE_TYPES = ["Helmet","Safety Vest","Gloves","Safety Boots","Goggles","Face Mask"];

function StepCameras({ plants, zones, cameras, setCameras, onNext, onBack, setError }) {
  const [selPlant, setSelPlant] = useState(plants[0]?.id||null);
  const [draft, setDraft] = useState({name:"",brand:"",rtspUrl:"",zoneId:"",resolution:"1080p",ppeTypes:["Helmet","Safety Vest"]});
  const D = (k,v) => setDraft(d=>({...d,[k]:v}));
  const plantCams = cameras.filter(c=>c.plantId===selPlant);
  const plantZones = zones.filter(z=>z.plantId===selPlant);

  const addCamera = () => {
    if(!draft.name||!draft.zoneId){setError("Camera name and zone are required");return;}
    setCameras(c=>[...c,{...draft,id:Date.now(),plantId:selPlant}]);
    setDraft({name:"",brand:"",rtspUrl:"",zoneId:"",resolution:"1080p",ppeTypes:["Helmet","Safety Vest"]});
    setError("");
  };

  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>REGISTER CAMERAS</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Connect your existing IP cameras to Safeguards IQ</div>
      </div>

      {plants.length>1 && (
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          {plants.map(p=>(
            <button key={p.id} onClick={()=>setSelPlant(p.id)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${selPlant===p.id?T.orange:T.border}`,background:selPlant===p.id?`${T.orange}20`:T.card2,color:selPlant===p.id?T.orange:T.g1,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>
              🏭 {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Camera list */}
      {plantCams.length>0 && (
        <div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>
          {plantCams.map((c,i)=>{
            const zone = zones.find(z=>z.id===c.zoneId);
            return (
              <div key={c.id} style={{background:T.card2,border:`1px solid ${T.blue}40`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16}}>📹</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.white}}>{c.name}</div>
                  <div style={{fontSize:11,color:T.g1}}>{c.brand||"IP Camera"} · {zone?.name||"Unknown zone"} · {c.resolution} · PPE: {c.ppeTypes.join(", ")}</div>
                  {c.rtspUrl&&<div style={{fontSize:10,color:T.g2,fontFamily:"'DM Mono'",marginTop:2}}>{c.rtspUrl}</div>}
                </div>
                <span style={{color:T.green,fontSize:16}}>✓</span>
                <button onClick={()=>setCameras(cs=>cs.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14}}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add camera form */}
      <div style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:14,padding:18,marginBottom:20}}>
        <div style={{fontSize:12,color:T.blue,fontWeight:800,letterSpacing:1.5,marginBottom:14}}>ADD CAMERA</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <label style={lbl}>CAMERA NAME *</label>
            <input value={draft.name} onChange={e=>D("name",e.target.value)} placeholder="e.g. CAM-01 Press Entry" style={inp}/>
          </div>
          <div>
            <label style={lbl}>CAMERA BRAND</label>
            <select value={draft.brand} onChange={e=>D("brand",e.target.value)} style={sel}>
              <option value="">Select brand</option>
              {["Hikvision","Dahua","CP Plus","Godrej","Bosch","Axis","Honeywell","Other ONVIF"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>ZONE *</label>
            <select value={draft.zoneId} onChange={e=>D("zoneId",e.target.value?parseInt(e.target.value):"")} style={sel}>
              <option value="">Select zone</option>
              {plantZones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>RESOLUTION</label>
            <select value={draft.resolution} onChange={e=>D("resolution",e.target.value)} style={sel}>
              {["720p","1080p","2MP","4MP","8MP / 4K"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"span 2"}}>
            <label style={lbl}>RTSP URL (optional — can add later)</label>
            <input value={draft.rtspUrl} onChange={e=>D("rtspUrl",e.target.value)} placeholder="rtsp://admin:password@192.168.1.100:554/stream1" style={{...inp,fontFamily:"'DM Mono'",fontSize:12}}/>
          </div>
          <div style={{gridColumn:"span 2"}}>
            <label style={lbl}>PPE TYPES TO DETECT</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
              {PPE_TYPES.map(p=>{
                const on = draft.ppeTypes.includes(p);
                return (
                  <button key={p} onClick={()=>D("ppeTypes",toggle(draft.ppeTypes,p))} style={{padding:"6px 14px",borderRadius:20,border:`1px solid ${on?T.orange:T.border}`,background:on?`${T.orange}20`:T.card,color:on?T.orange:T.g1,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'",transition:"all .2s"}}>
                    {on?"✓ ":""}{p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <button onClick={addCamera} style={{marginTop:14,background:T.card,border:`1px solid ${T.blue}`,borderRadius:10,padding:"10px 20px",color:T.blue,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>
          + Add Camera
        </button>
      </div>

      <div style={{background:`${T.teal}0A`,border:`1px solid ${T.teal}30`,borderRadius:10,padding:"12px 16px",marginBottom:20,fontSize:12,color:T.g1}}>
        💡 <strong style={{color:T.teal}}>No RTSP URL yet?</strong> You can skip this and add camera streams from the dashboard after setup. Our team will also assist you during onboarding.
      </div>

      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={()=>{
          if(cameras.length===0){setError("Please add at least one camera");return;}
          setError("");onNext();
        }} style={{flex:2,background:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"'Nunito'"}}>
          Continue → Activate Trial
        </button>
      </div>
    </div>
  );
}

/* ── STEP 5 — Activate ── */
function StepActivate({ form, plants, zones, cameras, loading, success, onBack, onActivate }) {
  if(success) return (
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div style={{width:72,height:72,borderRadius:"50%",background:`${T.green}20`,border:`2px solid ${T.green}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px",animation:"checkPop .5s ease both"}}>✓</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:34,color:T.green,letterSpacing:2}}>ACCOUNT ACTIVATED!</div>
      <div style={{color:T.g1,marginTop:8,fontSize:14}}>Setting up your workspace... Redirecting to dashboard.</div>
    </div>
  );
  return (
    <div style={{animation:"fadeUp .5s ease both"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:T.white,letterSpacing:2}}>ACTIVATE FREE TRIAL</div>
        <div style={{color:T.g1,fontSize:13,marginTop:4}}>Review your setup and start your 7-day trial</div>
      </div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        {[
          {icon:"🏢",label:"Company",value:form.companyName,sub:form.email},
          {icon:"🏭",label:"Plants",value:`${plants.length} plant${plants.length!==1?"s":""}`,sub:plants.map(p=>p.name).join(", ")},
          {icon:"📍",label:"Zones",value:`${zones.length} zone${zones.length!==1?"s":""}`,sub:zones.map(z=>z.name).join(", ")},
          {icon:"📹",label:"Cameras",value:`${cameras.length} camera${cameras.length!==1?"s":""}`,sub:cameras.map(c=>c.name).join(", ")},
        ].map(({icon,label,value,sub})=>(
          <div key={label} style={{background:T.card2,border:`1px solid ${T.border}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:18}}>{icon}</span>
              <span style={{fontSize:11,color:T.g1,fontWeight:700,letterSpacing:1.5}}>{label.toUpperCase()}</span>
            </div>
            <div style={{fontSize:15,fontWeight:800,color:T.white}}>{value}</div>
            <div style={{fontSize:11,color:T.g2,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Trial includes */}
      <div style={{background:"rgba(0,212,180,.06)",border:`1px solid rgba(0,212,180,.2)`,borderRadius:12,padding:16,marginBottom:20}}>
        <div style={{fontSize:12,color:T.teal,fontWeight:800,letterSpacing:1.5,marginBottom:10}}>7-DAY FREE TRIAL INCLUDES</div>
        {[
          "Full platform access — all features unlocked",
          `${cameras.length} camera${cameras.length!==1?"s":""} connected and monitored`,
          "Real-time PPE violation detection — 6 categories",
          "WhatsApp + Email alerts to supervisors",
          "Factories Act compliance dashboard",
          "No credit card required · Cancel anytime",
        ].map(f=>(
          <div key={f} style={{display:"flex",gap:8,fontSize:13,color:T.g1,marginBottom:6}}>
            <span style={{color:T.teal}}>✓</span>{f}
          </div>
        ))}
      </div>

      <div style={{fontSize:12,color:T.g2,textAlign:"center",marginBottom:20}}>
        After your trial, a Razorpay payment link will be sent to{" "}
        <strong style={{color:T.g1}}>{form.email}</strong> on Day 7.
      </div>

      <div style={{display:"flex",gap:12}}>
        <button onClick={onBack} style={{flex:1,background:"transparent",border:`1px solid ${T.border}`,borderRadius:12,padding:"14px",color:T.g1,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Nunito'"}}>← Back</button>
        <button onClick={onActivate} disabled={loading} style={{flex:2,background:loading?T.g2:`linear-gradient(135deg,${T.orange},#FF8C52)`,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:15,fontWeight:800,cursor:loading?"not-allowed":"pointer",fontFamily:"'Nunito'",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {loading?<><div style={{width:18,height:18,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Activating...</>:"🚀 Activate Free Trial"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   MAIN SIGNUP PAGE
══════════════════════════════════════ */
export default function SignupPage({ onLogin }) {
  const [step,    setStep]    = useState(0);
  const [form,    setForm]    = useState({
    companyName:"",email:"",password:"",confirmPass:"",
    phone:"",gstin:"",address:"",city:"",state:"",pincode:"",
    agreeTerms:false,agreeWhatsapp:false,
  });
  const [plants,  setPlants]  = useState([]);
  const [zones,   setZones]   = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleActivate = async () => {
    setLoading(true); setError("");
    try {
      const res = await axios.post("/api/v1/auth/register", {
        companyName: form.companyName,
        email:       form.email,
        password:    form.password,
        fullName:    form.companyName + " Admin",
        phone:       form.phone,
        gstin:       form.gstin,
        city:        form.city,
        state:       form.state,
        trialDays:   7,
        plants, zones, cameras,
      });
      const { accessToken, refreshToken, user, tenantId } = res.data.data;
      localStorage.setItem("safeg_token",   accessToken);
      localStorage.setItem("safeg_refresh", refreshToken);
      localStorage.setItem("safeg_user",    JSON.stringify(user));
      localStorage.setItem("safeg_tenant",  tenantId);
      setSuccess(true);
      setTimeout(() => { onLogin?.(user); navigate("/dashboard"); }, 2500);
    } catch(err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => { setError(""); setStep(s=>s+1); };
  const back = () => { setError(""); setStep(s=>s-1); };

  /* card width: step 0 wider for company form, step 4 medium */
  const maxW = step===2||step===3 ? 680 : 600;

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
                <div style={{width:26,height:26,borderRadius:"50%",background:i<step?T.green:i===step?T.orange:T.card2,border:`2px solid ${i<step?T.green:i===step?T.orange:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i<=step?"#fff":T.g2,transition:"all .3s",flexShrink:0}}>
                  {i<step?"✓":i+1}
                </div>
                <span style={{fontSize:11,color:i===step?T.white:i<step?T.green:T.g2,fontWeight:i===step?700:400,whiteSpace:"nowrap"}}>{s}</span>
              </div>
              {i<STEPS.length-1&&<div style={{width:28,height:2,background:i<step?T.green:T.border,margin:"0 8px",transition:"all .3s",flexShrink:0}}/>}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div style={{width:"100%",maxWidth:maxW,background:T.card,border:`1px solid ${T.border}`,borderRadius:20,padding:32,zIndex:1}}>
          {error&&(
            <div style={{background:"rgba(255,61,61,.1)",border:`1px solid rgba(255,61,61,.3)`,borderRadius:10,padding:"12px 16px",color:T.red,fontSize:13,marginBottom:20}}>
              ⚠ {error}
            </div>
          )}
          {step===0&&<StepCompany  form={form}    setForm={setForm}   onNext={next}            setError={setError}/>}
          {step===1&&<StepPlant    plants={plants} setPlants={setPlants} onNext={next} onBack={back} setError={setError}/>}
          {step===2&&<StepZones    plants={plants} zones={zones}   setZones={setZones}   onNext={next} onBack={back} setError={setError}/>}
          {step===3&&<StepCameras  plants={plants} zones={zones}   cameras={cameras} setCameras={setCameras} onNext={next} onBack={back} setError={setError}/>}
          {step===4&&<StepActivate form={form} plants={plants} zones={zones} cameras={cameras} loading={loading} success={success} onBack={back} onActivate={handleActivate}/>}
        </div>

        <div style={{marginTop:20,fontSize:13,color:T.g2,zIndex:1}}>
          Already have an account?{" "}
          <Link to="/login" style={{color:T.orange,fontWeight:700,textDecoration:"none"}}>Sign in →</Link>
        </div>
      </div>
    </>
  );
}


