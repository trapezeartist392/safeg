import { useState, useEffect, useRef } from "react";
import { useComplianceData } from "../hooks/useComplianceData";

// ─── PALETTE ───────────────────────────────────────────────────
const C = {
  bg:      "#05060E",
  bg2:     "#090B18",
  bg3:     "#0D1020",
  card:    "#0F1221",
  card2:   "#141828",
  border:  "#1C2238",
  orange:  "#FF5C1A",
  orange2: "#FF8C50",
  teal:    "#00D4B8",
  green:   "#22D46A",
  red:     "#FF3B3B",
  amber:   "#FFB800",
  blue:    "#3D8BFF",
  purple:  "#A855F7",
  white:   "#EEF2FF",
  g1:      "#C0CDF0",
  g2:      "#5C6E9A",
  g3:      "#1A2240",
};

// ─── GLOBAL STYLES ──────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Syne:wght@400;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:${C.bg};color:${C.white};font-family:'Syne',sans-serif;overflow-x:hidden}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:${C.bg2}}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
  input,select,textarea{font-family:'Syne',sans-serif}
  input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.4)}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
  @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes barUp{from{transform:scaleY(0)}to{transform:scaleY(1)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,92,26,0)}50%{box-shadow:0 0 0 6px rgba(255,92,26,.15)}}
  @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
  @keyframes alertPulse{0%,100%{border-color:${C.red}}50%{border-color:rgba(255,59,59,.2)}}
  @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @keyframes toastIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes toastOut{from{opacity:1}to{opacity:0;transform:translateX(120%)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes ringFill{from{stroke-dashoffset:440}to{stroke-dashoffset:var(--target)}}
  @media(max-width:768px){
    .safeg-compliance-wrap{flex-direction:column!important}
    .safeg-compliance-nav{width:100%!important;flex-direction:row!important;overflow-x:auto!important;flex-wrap:wrap!important}
    .safeg-compliance-content{width:100%!important;min-width:0!important}
    .safeg-kpi-grid{grid-template-columns:1fr 1fr!important}
    .safeg-kpi-grid-5{grid-template-columns:1fr 1fr!important}
    .safeg-report-grid{grid-template-columns:1fr 1fr!important}
    table{min-width:500px!important}
    .safeg-table-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}
    .safeg-header-title{font-size:24px!important}
    .safeg-page-pad{padding:12px!important}
  }
  @media(max-width:480px){
    .safeg-kpi-grid{grid-template-columns:1fr!important}
    .safeg-report-grid{grid-template-columns:1fr!important}
  }
  @media(max-width:768px){
    body{overflow-x:hidden}
    #compliance-shell{flex-direction:column!important}
    #compliance-nav{width:100%!important;flex-direction:row!important;overflow-x:auto!important;padding:8px!important;gap:4px!important}
    #compliance-nav button{font-size:10px!important;padding:6px 10px!important;white-space:nowrap!important}
    #compliance-main{padding:10px!important}
    #compliance-content{width:100%!important}
    #compliance-topbar{flex-wrap:wrap!important;height:auto!important;padding:8px 12px!important;gap:8px!important}
    #compliance-topbar>div:nth-child(2){display:none!important}
    #compliance-topbar>div:nth-child(3){width:100%!important;overflow-x:auto!important;flex-wrap:nowrap!important;padding-bottom:4px!important}
    #compliance-topbar>div:nth-child(3) button{font-size:10px!important;padding:4px 8px!important;white-space:nowrap!important;flex-shrink:0!important}
  }
  @media(max-width:768px){
    #compliance-shell{flex-direction:column!important}
    #compliance-nav{width:100%!important;height:auto!important;position:relative!important;top:0!important;flex-direction:row!important;overflow-x:auto!important;overflow-y:hidden!important;display:flex!important;flex-wrap:nowrap!important;padding:8px 0!important;border-right:none!important;border-bottom:1px solid #1C2238!important}
    #compliance-nav>div{display:flex!important;flex-direction:row!important;align-items:center!important;padding:0 8px!important;flex-shrink:0!important}
    #compliance-nav>div>div:first-child{display:none!important}
    #compliance-main{padding:12px!important}
    #compliance-content [style]{max-width:100%!important}
    #compliance-content div[style*="fontSize:40"]{font-size:24px!important;line-height:1.2!important}
    #compliance-content div[style*="padding:\"18px 16px\""]{padding:12px 10px!important}
    #compliance-content div[style*="borderRadius:12"][style*="overflow:\"hidden\""]{overflow:visible!important}
    #compliance-content .kpi-val{font-size:24px!important}
    #compliance-content div[style*="gridTemplateColumns:repeat(4,1fr)"]{grid-template-columns:1fr 1fr!important}
    #compliance-content div[style*="gridTemplateColumns:repeat(3,1fr)"]{grid-template-columns:1fr 1fr!important}
    #compliance-content div[style*="gridTemplateColumns:repeat(5,1fr)"]{grid-template-columns:1fr 1fr!important}
    #compliance-content div[style*="gridTemplateColumns:repeat(2,1fr)"]{grid-template-columns:1fr!important}
    #compliance-content div[style*="fontSize:38"]{font-size:22px!important}
    #compliance-content div[style*="display:flex"][style*="justifyContent:space-between"]{flex-wrap:wrap!important;gap:10px!important}
    #compliance-content table{min-width:500px!important}
    #compliance-content div[style*="overflowX:auto"]{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}
  }
  @media(max-width:480px){
    #compliance-content div[style*="gridTemplateColumns:repeat(4,1fr)"]{grid-template-columns:1fr!important}
    #compliance-content div[style*="gridTemplateColumns:repeat(3,1fr)"]{grid-template-columns:1fr!important}
    #compliance-content div[style*="gridTemplateColumns:repeat(5,1fr)"]{grid-template-columns:1fr!important}
  }
`;

// ─── DATA ───────────────────────────────────────────────────────
const VIOLATIONS = [
  {id:"VIO-235",date:"Today 14:23",type:"PPE — No Helmet",zone:"Welding B",worker:"W-4821",sev:"High",action:"Supervisor notified, helmet issued",status:"Open"},
  {id:"VIO-234",date:"Today 14:19",type:"Danger Zone Breach",zone:"Forklift Area",worker:"W-2341",sev:"High",action:"Ops suspended pending review",status:"Pending"},
  {id:"VIO-233",date:"Today 13:15",type:"PPE — No Vest",zone:"Paint Shop",worker:"W-8823",sev:"Medium",action:"Vest issued, re-inducted",status:"Closed"},
  {id:"VIO-232",date:"Yesterday",type:"Machine Guard Missing",zone:"Press Room",worker:"–",sev:"High",action:"Guard reinstalled & inspected",status:"Closed"},
  {id:"VIO-231",date:"Yesterday",type:"Spill — Housekeeping",zone:"Welding B",worker:"–",sev:"Medium",action:"Spill cleaned, SOP revised",status:"Closed"},
  {id:"VIO-230",date:"2 days ago",type:"Fire Exit Blocked",zone:"Store Room",worker:"–",sev:"High",action:"Exit cleared, disciplinary action",status:"Closed"},
];

const PPE_TYPES = [
  {name:"Hard Hat",pct:98,icon:"⛑️",c:C.green},
  {name:"Safety Vest",pct:94,icon:"🦺",c:C.amber},
  {name:"Safety Boots",pct:99,icon:"👢",c:C.green},
  {name:"Eye Protection",pct:86,icon:"🥽",c:C.red},
  {name:"Gloves",pct:91,icon:"🧤",c:C.teal},
  {name:"Ear Protection",pct:88,icon:"🎧",c:C.orange},
];

const ZONES = [
  {name:"Assembly A",pct:98,icon:"🔩",c:C.green},
  {name:"Welding B",pct:89,icon:"⚡",c:C.amber},
  {name:"Paint Shop",pct:84,icon:"🎨",c:C.red},
  {name:"Forklift Area",pct:92,icon:"🚜",c:C.teal},
  {name:"Press Room",pct:96,icon:"🔧",c:C.green},
  {name:"Electrical",pct:99,icon:"⚙️",c:C.green},
];

const TIMELINE = [
  {icon:"🚨",color:C.red,title:"No Helmet — Zone B Welding",meta:"14:23:07 · CAM-04 · Auto-alerted"},
  {icon:"⚠️",color:C.amber,title:"Danger zone breach — Forklift",meta:"14:19:44 · CAM-11 · Pending"},
  {icon:"✅",color:C.green,title:"Morning inspection passed",meta:"08:00:00 · All 24 zones clear"},
  {icon:"📋",color:C.blue,title:"Form 18 filed — Incident #234",meta:"09:45:00 · Auto-generated"},
  {icon:"🚨",color:C.red,title:"Safety vest missing — Paint Shop",meta:"13:15:02 · CAM-07 · Resolved"},
];

const ZONE_BARS = [
  {label:"Weld B",val:12,c:C.red},
  {label:"Paint",val:8,c:C.orange},
  {label:"Assem.",val:5,c:C.amber},
  {label:"Forklift",val:9,c:C.red},
  {label:"Electric",val:3,c:C.teal},
  {label:"Press",val:6,c:C.orange},
  {label:"Store",val:2,c:C.green},
];

const CHECK_ITEMS = {
  "Safety Equipment":[
    "All PPE stations stocked and accessible",
    "Hard hat condition checked — no cracks",
    "Safety harnesses inspected and tagged",
    "Eye wash stations operational",
    "Emergency showers functional",
    "First aid boxes restocked",
  ],
  "Machinery & Electrical":[
    "Machine guards in place on all presses",
    "Electrical panel covers secured",
    "Earthing/grounding connections checked",
    "Lockout-Tagout (LOTO) tags current",
    "Conveyor belt guards intact",
    "Hydraulic pressure nominal",
  ],
  "Fire Safety":[
    "Fire extinguishers in correct locations",
    "Extinguishers within service date",
    "Sprinkler heads unobstructed",
    "Fire alarm test conducted",
    "Emergency exits clear — no blockage",
    "Evacuation route maps visible",
  ],
  "Housekeeping":[
    "Floors dry — no spills or puddles",
    "Chemical storage correctly labelled",
    "Waste bins not overflowing",
    "Walkways clear of obstacles",
    "Ventilation units operational",
    "Lighting functional in all zones",
  ],
};

// ─── TINY COMPONENTS ────────────────────────────────────────────

function Dot({color=C.orange,size=6,blink=false}) {
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,animation:blink?"blink 1.2s infinite":"none",flexShrink:0}} />;
}

function Badge({text,type="med"}) {
  const map={High:{bg:"rgba(255,59,59,.12)",color:C.red,border:"rgba(255,59,59,.3)"},Medium:{bg:"rgba(255,184,0,.12)",color:C.amber,border:"rgba(255,184,0,.3)"},Low:{bg:"rgba(34,212,106,.12)",color:C.green,border:"rgba(34,212,106,.3)"}};
  const Open={bg:"rgba(255,59,59,.1)",color:C.red,border:"rgba(255,59,59,.25)"};
  const Closed={bg:"rgba(34,212,106,.1)",color:C.green,border:"rgba(34,212,106,.25)"};
  const Pending={bg:"rgba(255,184,0,.1)",color:C.amber,border:"rgba(255,184,0,.25)"};
  const style=map[text]||({Open,Closed,Pending}[text])||{bg:C.card2,color:C.g1,border:C.border};
  return <span style={{display:"inline-block",padding:"2px 9px",borderRadius:10,fontSize:10,fontWeight:700,letterSpacing:.5,background:style.bg,color:style.color,border:`1px solid ${style.border}`}}>{text}</span>;
}

function Card({children,style={}}) {
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,...style}}>{children}</div>;
}

function CardTitle({children,color=C.orange}) {
  return <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,fontSize:10,color:C.g2,textTransform:"uppercase",letterSpacing:3,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>
    <div style={{width:6,height:6,borderRadius:"50%",background:color}} />{children}
  </div>;
}

function MiniBar({label,pct,color}) {
  return <div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.g1,marginBottom:5}}>
      <span>{label}</span><strong style={{color}}>{pct}%</strong>
    </div>
    <div style={{height:5,background:C.border,borderRadius:10,overflow:"hidden"}}>
      <div style={{height:"100%",width:pct+"%",background:color,borderRadius:10,transition:"width 1.2s cubic-bezier(.4,0,.2,1)"}} />
    </div>
  </div>;
}

function KpiCard({label,value,unit,trend,trendUp,color=C.orange}) {
  const trendColor = trendUp === true ? C.green : trendUp === false ? C.red : C.amber;
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"clamp(8px,2vw,18px) clamp(6px,1.5vw,16px)",position:"relative",overflow:"visible",transition:"transform .2s",minWidth:0}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:color}} />
    <div style={{fontSize:10,color:C.g2,textTransform:"uppercase",letterSpacing:2,marginBottom:8,fontFamily:"'Barlow Condensed',sans-serif"}}>{label}</div>
    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"clamp(20px,4vw,40px)",color:value===undefined?C.white:color===C.red?C.red:C.white,lineHeight:1,wordBreak:"break-word",overflowWrap:"break-word"}}>{value}</div>
    {unit && <div style={{fontSize:11,color:C.g2,marginTop:4}}>{unit}</div>}
    {trend && <div style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:8,padding:"2px 9px",borderRadius:20,background:`${trendColor}18`,color:trendColor,fontSize:11}}>{trend}</div>}
  </div>;
}

function Toast({msg,type,onDone}) {
  const [out,setOut]=useState(false);
  const icons={success:"✅",error:"🔴",warning:"⚠️",info:"ℹ️"};
  const colors={success:C.green,error:C.red,warning:C.amber,info:C.blue};
  useEffect(()=>{const t=setTimeout(()=>setOut(true),2700);const t2=setTimeout(onDone,3100);return()=>{clearTimeout(t);clearTimeout(t2)};},[]);
  return <div style={{display:"flex",alignItems:"center",gap:10,background:C.card,border:`1px solid ${colors[type]}44`,borderRadius:10,padding:"12px 18px",minWidth:280,boxShadow:"0 8px 30px rgba(0,0,0,.5)",animation:out?"toastOut .35s ease forwards":"toastIn .35s ease forwards",fontFamily:"'Syne',sans-serif",fontSize:13,color:C.white}}>
    <span>{icons[type]}</span><span>{msg}</span>
  </div>;
}

// ─── RING CHART ─────────────────────────────────────────────────
function Ring({pct,color=C.green,size=160,label="COMPLIANT"}) {
  const r=68, circ=2*Math.PI*r;
  const offset = circ*(1-pct/100);
  return <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={11}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={11}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{transition:"stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)"}}
      />
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,color:C.white,lineHeight:1}}>{pct}%</div>
      <div style={{fontSize:9,color:C.g2,letterSpacing:2,marginTop:2,fontFamily:"'Barlow Condensed',sans-serif"}}>{label}</div>
    </div>
  </div>;
}

// ─── CAMERA FEED (Canvas) ────────────────────────────────────────
function CamFeed({cam}) {
  const ref=useRef();
  const videoRef=useRef(null);
  const [monitorStream,setMonitorStream]=useState(null);
  const isMonitorCam = cam.id === "laptop-webcam" || cam.cam_label === "laptop-webcam";

  useEffect(() => {
    if (!isMonitorCam) {
      setMonitorStream(null);
      return;
    }

    const syncMonitorStream = () => {
      const video = document.querySelector('video[data-safeg="monitor"]');
      const nextStream = video?.srcObject || null;
      setMonitorStream(prev => prev === nextStream ? prev : nextStream);
    };

    syncMonitorStream();
    const intervalId = setInterval(syncMonitorStream, 1000);
    return () => clearInterval(intervalId);
  }, [isMonitorCam]);

  useEffect(()=>{
    if (videoRef.current && videoRef.current.srcObject !== monitorStream) {
      videoRef.current.srcObject = monitorStream || null;
      if (monitorStream) videoRef.current.play().catch(() => {});
    }
  }, [monitorStream]);

  useEffect(()=>{
    if (isMonitorCam && monitorStream) return;
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const w=canvas.width, h=canvas.height;
    const camNum = parseInt((cam.id || "").split("-")[1], 10);
    const hue=Number.isFinite(camNum)?(camNum*37)%360:200;
    function draw(){
      ctx.fillStyle=`hsl(${hue},15%,6%)`;
      ctx.fillRect(0,0,w,h);
      ctx.strokeStyle="rgba(255,255,255,.025)";
      ctx.lineWidth=1;
      for(let x=0;x<w;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=0;y<h;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      // floor
      ctx.fillStyle="rgba(255,255,255,.02)";
      ctx.fillRect(0,h*.62,w,h*.38);
      // machinery
      ctx.fillStyle="rgba(255,255,255,.05)";
      ctx.fillRect(w*.6,h*.28,w*.35,h*.52);
      ctx.fillRect(w*.65,h*.14,w*.06,h*.18);
      // workers
      const count=cam.alert?3:2;
      for(let i=0;i<count;i++){
        const wx=w*(.18+i*.3), wy=h*.52;
        ctx.fillStyle="rgba(190,210,255,.22)";
        ctx.beginPath();ctx.ellipse(wx,wy-18,9,12,0,0,Math.PI*2);ctx.fill();
        ctx.fillRect(wx-7,wy-10,14,26);
      }
      if(cam.alert){
        ctx.fillStyle=`rgba(255,59,59,${.025+Math.sin(Date.now()/400)*.015})`;
        ctx.fillRect(0,0,w,h);
      }
      // timestamp
      ctx.fillStyle="rgba(0,0,0,.6)";
      ctx.fillRect(0,h-18,w,18);
      ctx.fillStyle="rgba(255,255,255,.45)";
      ctx.font="8px monospace";
      ctx.textAlign="left";
      ctx.fillText(new Date().toTimeString().slice(0,8),5,h-5);
      ctx.textAlign="right";
      ctx.fillText("Safeguards IQ",w-5,h-5);
    }
    draw();
    const id=setInterval(draw,800);
    return ()=>clearInterval(id);
  },[cam,isMonitorCam,monitorStream]);

  if (isMonitorCam && monitorStream) {
    return <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
    />;
  }

  return <canvas ref={ref} width={320} height={180} style={{width:"100%",height:"100%",display:"block"}} />;
}

// ─── FORM 18 ─────────────────────────────────────────────────────
function Form18({toast, lastViolation}) {
  const today=new Date().toISOString().slice(0,10);
  const _user = (() => { try { return JSON.parse(localStorage.getItem('safeg_user')||'{}'); } catch { return {}; } })();
  const _plant = (() => { try { return JSON.parse(localStorage.getItem('safeg_plant')||'{}'); } catch { return {}; } })();
  const [f,setF]=useState({
    factoryName: localStorage.getItem('safeg_factory_name') || _user?.companyName || _plant?.plant_name || "",
    regNo: localStorage.getItem('safeg_factory_reg') || _plant?.factory_licence_no || "",
    industry: _user?.industry || _plant?.industry_type || "",
    address: _plant?.address || _user?.address || "",
    district: _user?.city || _plant?.city || "",
    state: _user?.state || _plant?.state || "",
    occupier:"", manager:"", contact:"",
    accDate:today, accTime:"14:23", department:"Welding Zone B — Bay 3",
    nature:"Fall from height",
    operation:"MIG Welding — Chassis subframe assembly",
    description:"Worker slipped on oil spill near welding bay. Safeguards IQ camera CAM-04 detected the incident at 14:23:07 IST and triggered immediate supervisor alert. Worker sustained minor abrasion on left knee. No loss of consciousness.",
    immCause:"Oil spill on floor not cleaned — housekeeping protocol violation",
    rootCause:"Inadequate housekeeping schedule and absence of spill kit in Welding Zone B",
    firstAid:"Yes — On-site", hospital:"No — Treated on-site",
    esic:"Yes — ESIC IP No. MH48920234",
    doctor:"Dr. Priya Mehta — On-site MBBS",
    medDate:today, declarant:"", designation:"", filingDate:today,
    inspector:"Office of Inspector of Factories, Pune District",
  });
  const [injured,setInjured]=useState([{name:"Ramesh Kumar Singh",sex:"Male",age:34,empType:"Permanent – Factory Worker",dept:"Welding",injuryType:"Minor Injury",bodyPart:"Left knee — abrasion",days:2}]);
  const [capa,setCapa]=useState([
    {action:"",resp:"",date:today,status:"Pending"},
  ]);

  const upd=(k,v)=>{
    setF(prev=>({...prev,[k]:v}));
    if(k==='regNo') localStorage.setItem('safeg_factory_reg', v);
    if(k==='factoryName') localStorage.setItem('safeg_factory_name', v);
  };
  const autoFill=()=>{
    setF(prev=>({...prev,occupier:"Rajiv Kapoor",manager:"Suresh Nair",contact:"+91 98765 43210",declarant:"Suresh Nair",designation:"Plant Manager"}));
    toast("AI auto-filled plant profile data","success");
  };
  const submit=()=>{
    if(!f.declarant){toast("Enter declarant name before filing","error");return;}
    toast("Form 18 #F18-2024-235 filed — Inspector notified","success");
    setTimeout(()=>toast("PDF saved to compliance folder","info"),900);
  };

  const inp=(k,type="text",style={})=><input type={type} value={f[k]} onChange={e=>upd(k,e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 13px",fontSize:13,color:C.white,fontFamily:"'Syne',sans-serif",outline:"none",width:"100%",...style}} />;
  const sel=(k,opts)=><select value={f[k]} onChange={e=>upd(k,e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 13px",fontSize:13,color:C.white,fontFamily:"'Syne',sans-serif",outline:"none",width:"100%",cursor:"pointer"}}>
    {opts.map(o=><option key={o}>{o}</option>)}
  </select>;
  const autoInp=(val,key)=><input readOnly value={val} style={{background:"rgba(0,212,184,.05)",border:`1px solid rgba(0,212,184,.3)`,borderRadius:8,padding:"9px 13px",fontSize:13,color:C.teal,fontFamily:"'Syne',sans-serif",outline:"none",width:"100%"}} />;
  const lbl=(text)=><div style={{fontSize:10,color:C.g2,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600,marginBottom:5}}>{text}</div>;
  const field=(label,children)=><div style={{display:"flex",flexDirection:"column"}}>{lbl(label)}{children}</div>;

  const secTitle=(t,badge)=><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,color:C.orange,letterSpacing:2,fontWeight:700,marginBottom:16,paddingBottom:10,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
    {t}{badge&&<span style={{fontSize:11,color:C.teal,letterSpacing:1}}>● {badge}</span>}
  </div>;

  const row=(...children)=><div style={{display:"grid",gridTemplateColumns:`repeat(${children.length},1fr)`,gap:14,marginBottom:14}}>{children}</div>;

  const thStyle={background:C.card2,padding:"10px 14px",textAlign:"left",fontSize:10,color:C.g2,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",border:`1px solid ${C.border}`,fontWeight:600};
  const tdStyle={padding:"10px 14px",fontSize:12,color:C.g1,border:`1px solid ${C.border}`,verticalAlign:"top"};
  const tdInp=(val,onChange,w="100%")=><input value={val} onChange={e=>onChange(e.target.value)} style={{background:"transparent",border:"none",color:C.white,fontSize:12,width:w,outline:"none",fontFamily:"'Syne',sans-serif"}} />;
  const tdSel=(val,onChange,opts)=><select value={val} onChange={e=>onChange(e.target.value)} style={{background:"transparent",border:"none",color:C.white,fontSize:12,width:"100%",outline:"none",fontFamily:"'Syne',sans-serif",cursor:"pointer"}}>{opts.map(o=><option key={o}>{o}</option>)}</select>;

  return (
    <div style={{animation:"slideIn .3s ease"}}>
      {/* Page Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:800,letterSpacing:3}}>FORM 18 — ACCIDENT REPORT</div>
          <div style={{fontSize:12,color:C.g2,marginTop:4,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>THE FACTORIES ACT, 1948 — SECTION 88 · AI-ASSISTED FILING</div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={autoFill} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",borderRadius:8,background:"rgba(0,212,184,.1)",color:C.teal,border:`1px solid rgba(0,212,184,.3)`,cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:600}}>🤖 AI Auto-Fill</button>
          <button onClick={()=>toast("Draft saved","success")} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",borderRadius:8,background:C.card2,color:C.g1,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif"}}>💾 Save Draft</button>
        </div>
      </div>

      {/* Form Container */}
      <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>

        {/* Header Banner */}
        <div style={{background:C.card,padding:"22px 32px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:800,letterSpacing:3}}>FORM NO. 18</div>
            <div style={{fontSize:13,color:C.g2,marginTop:2}}>Notice of Accident / Dangerous Occurrence under The Factories Act, 1948</div>
            <div style={{fontSize:11,color:C.g3,marginTop:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>Under Sections 88 & 88A | Rules 106 & 107</div>
          </div>
          <div style={{display:"flex",gap:12}}>
            <div style={{padding:"12px 20px",border:`2px solid ${C.orange}`,borderRadius:8,textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,color:C.orange,fontWeight:700}}>#F18-2024-235</div>
              <div style={{fontSize:9,color:C.g2,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif"}}>REPORT NUMBER</div>
            </div>
            <div style={{padding:"12px 20px",border:`2px solid ${C.teal}`,borderRadius:8,textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,color:C.teal,fontWeight:700}}>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase()}</div>
              <div style={{fontSize:9,color:C.g2,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif"}}>FILED DATE</div>
            </div>
          </div>
        </div>

        <div style={{padding:"28px 32px"}}>

          {/* PART A */}
          <div style={{marginBottom:28}}>
            {secTitle("PART A — FACTORY & REGISTRATION DETAILS")}
            {row(
              field("Name of Factory", autoInp(f.factoryName,"factoryName")),
              field("Factory Registration No.", inp("regNo")),
              field("Type of Industry", autoInp(f.industry,"industry")),
            )}
            {row(
              field("Factory Address", autoInp(f.address,"address")),
              field("District", autoInp(f.district,"district")),
              field("State", autoInp(f.state,"state")),
            )}
            {row(
              field("Occupier / Owner Name", inp("occupier")),
              field("Manager Name", inp("manager")),
              field("Contact Number", inp("contact")),
            )}
          </div>

          {/* PART B */}
          <div style={{marginBottom:28}}>
            {secTitle("PART B — ACCIDENT / DANGEROUS OCCURRENCE DETAILS")}
            {row(
              field("Date of Accident", inp("accDate","date")),
              field("Time of Accident", autoInp(f.accTime,"accTime")),
              field("Department / Section", autoInp(f.department,"department")),
            )}
            {row(
              field("Nature of Accident", sel("nature",["Fall from height","Struck by moving object","Caught in machinery","Burns/Scalds","Electrical shock","Chemical exposure","Dangerous occurrence"])),
              field("Operation / Process Being Performed", autoInp(f.operation,"operation")),
            )}
            <div style={{marginBottom:14}}>
              {field("Description of Accident / Occurrence",
                <textarea value={f.description} onChange={e=>upd("description",e.target.value)} rows={4} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 13px",fontSize:13,color:C.white,fontFamily:"'Syne',sans-serif",outline:"none",width:"100%",resize:"vertical"}} />
              )}
            </div>
            <div style={{marginBottom:14}}>{field("Immediate Cause of Accident", inp("immCause"))}</div>
            <div style={{marginBottom:0}}>{field("Root Cause / Underlying Factor", inp("rootCause"))}</div>
          </div>

          {/* PART C */}
          <div style={{marginBottom:28}}>
            {secTitle("PART C — INJURED PERSON(S) DETAILS")}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>{["Sr.","Name","Sex","Age","Employment Status","Dept.","Nature of Injury","Body Part","Days Absent"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {injured.map((row,i)=>(
                    <tr key={i}>
                      <td style={{...tdStyle,color:C.g2,textAlign:"center"}}>{i+1}</td>
                      <td style={tdStyle}>{tdInp(row.name,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],name:v};return n}))}</td>
                      <td style={tdStyle}>{tdSel(row.sex,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],sex:v};return n}),["Male","Female","Other"])}</td>
                      <td style={tdStyle}>{tdInp(row.age,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],age:v};return n}),"40px")}</td>
                      <td style={tdStyle}>{tdSel(row.empType,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],empType:v};return n}),["Permanent – Factory Worker","Contract Worker","Trainee","Apprentice"])}</td>
                      <td style={tdStyle}>{tdInp(row.dept,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],dept:v};return n}),"70px")}</td>
                      <td style={tdStyle}>{tdSel(row.injuryType,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],injuryType:v};return n}),["Minor Injury","Serious Injury","Fatal","Dangerous Occurrence"])}</td>
                      <td style={tdStyle}>{tdInp(row.bodyPart,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],bodyPart:v};return n}))}</td>
                      <td style={tdStyle}>{tdInp(row.days,v=>setInjured(p=>{const n=[...p];n[i]={...n[i],days:v};return n}),"40px")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={()=>setInjured(p=>[...p,{name:"",sex:"Male",age:"",empType:"Permanent – Factory Worker",dept:"",injuryType:"Minor Injury",bodyPart:"",days:""}])}
              style={{marginTop:10,padding:"6px 14px",borderRadius:7,background:C.card2,color:C.g1,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:12,fontFamily:"'Syne',sans-serif"}}>
              + Add Person
            </button>
          </div>

          {/* PART D */}
          <div style={{marginBottom:28}}>
            {secTitle("PART D — MEDICAL TREATMENT & FIRST AID")}
            {row(
              field("First Aid Given?", sel("firstAid",["Yes — On-site first aid","No"])),
              field("Referred to Hospital?", sel("hospital",["No — Treated on-site","Yes — Government Hospital","Yes — Private Hospital"])),
              field("ESIC Member?", sel("esic",["Yes — ESIC IP No. MH48920234","No — Not covered"])),
            )}
            {row(
              field("Medical Officer Name", inp("doctor")),
              field("Date of Medical Examination", inp("medDate","date")),
            )}
          </div>

          {/* PART E: Safeguards IQ Evidence */}
          <div style={{marginBottom:28}}>
            {secTitle("PART E — Safeguards IQ EVIDENCE LOG","Auto-captured")}
            <div style={{background:"rgba(0,212,184,.04)",border:`1px solid rgba(0,212,184,.2)`,borderRadius:10,padding:20}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:14}}>
                {(() => {
                  const lastViol = lastViolation;
                  return [
                    ["Camera ID", lastViol?.camera || "No recent detection"],
                    ["Detection Timestamp", lastViol?.time || "—"],
                    ["AI Confidence Score", lastViol?.confidence ? `${lastViol.confidence}%` : "—"],
                    ["Alert Sent To", "Zone Supervisor · Plant Manager"],
                    ["Response Time", "< 28 seconds"],
                    ["Violation Type", lastViol?.type || "—"],
                  ];
                })().map(([k,v])=><div key={k}>
                  <div style={{fontSize:10,color:C.teal,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:4}}>{k}</div>
                  <div style={{fontSize:13,fontFamily:k.includes("Timestamp")||k.includes("Score")?"'Barlow Condensed',sans-serif":"'Syne',sans-serif",cursor:k.includes("Video")?"pointer":"default",color:k.includes("Video")?C.teal:C.white}}>{v}</div>
                </div>)}
              </div>
              <div style={{background:"rgba(0,212,184,.06)",borderRadius:8,border:`1px solid rgba(0,212,184,.15)`,padding:"12px 16px",fontSize:12,color:C.g1,lineHeight:1.7}}>
                Safeguards IQ detected: <strong style={{color:C.white}}>Floor Hazard — Liquid spill (unattended 47 min)</strong> at 13:36:09. Alert sent to housekeeping at 13:36:15. No corrective action recorded within 30-min SLA. Subsequent fall recorded at 14:23:07.
                <br/><strong style={{color:C.teal}}>Preventability Assessment: HIGH — Corrective action available 47 minutes prior to incident.</strong>
              </div>
            </div>
          </div>

          {/* PART F: CAPA */}
          <div style={{marginBottom:28}}>
            {secTitle("PART F — CORRECTIVE & PREVENTIVE ACTIONS (CAPA)")}
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>{["No.","Corrective Action","Responsible Person","Target Date","Status"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {capa.map((r,i)=>(
                    <tr key={i}>
                      <td style={{...tdStyle,color:C.orange,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14}}>CA-0{i+1}</td>
                      <td style={tdStyle}>{tdInp(r.action,v=>setCapa(p=>{const n=[...p];n[i]={...n[i],action:v};return n}))}</td>
                      <td style={tdStyle}>{tdInp(r.resp,v=>setCapa(p=>{const n=[...p];n[i]={...n[i],resp:v};return n}))}</td>
                      <td style={tdStyle}><input type="date" value={r.date} onChange={e=>setCapa(p=>{const n=[...p];n[i]={...n[i],date:e.target.value};return n})} style={{background:"transparent",border:"none",color:C.white,fontSize:12,outline:"none",fontFamily:"'Syne',sans-serif"}} /></td>
                      <td style={tdStyle}>{tdSel(r.status,v=>setCapa(p=>{const n=[...p];n[i]={...n[i],status:v};return n}),["Completed","In Progress","Pending"])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={()=>setCapa(p=>[...p,{action:"",resp:"",date:today,status:"Pending"}])}
              style={{marginTop:10,padding:"6px 14px",borderRadius:7,background:C.card2,color:C.g1,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:12,fontFamily:"'Syne',sans-serif"}}>
              + Add Action
            </button>
          </div>

          {/* PART G: Declaration */}
          <div style={{marginBottom:0}}>
            {secTitle("PART G — DECLARATION BY MANAGER / OCCUPIER")}
            {row(
              field("Name of Declarant", inp("declarant")),
              field("Designation", inp("designation")),
            )}
            {row(
              field("Date of Filing", inp("filingDate","date")),
              field("Submitted To (Inspector of Factories)", inp("inspector")),
            )}
            <div style={{background:"rgba(255,184,0,.06)",border:`1px solid rgba(255,184,0,.2)`,borderRadius:8,padding:"12px 16px",fontSize:12,color:C.g1,lineHeight:1.6,marginTop:8}}>
              ⚠️ <strong style={{color:C.amber}}>Statutory Deadline:</strong> File with Inspector of Factories within <strong style={{color:C.white}}>24 hours</strong> of accident (Section 88, Factories Act 1948). For dangerous occurrences, report immediately by phone and follow up in writing within 12 hours.
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div style={{display:"flex",gap:12,justifyContent:"flex-end",padding:"18px 32px",borderTop:`1px solid ${C.border}`,background:C.card}}>
          <button onClick={()=>toast("Draft saved","success")} style={{padding:"10px 22px",borderRadius:8,background:C.card2,color:C.g1,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif"}}>💾 Save Draft</button>
          <button onClick={()=>toast("Form sent for print","info")} style={{padding:"10px 22px",borderRadius:8,background:C.card2,color:C.g1,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif"}}>🖨️ Print</button>
          <button onClick={()=>toast("Submitted to Shram Suvidha portal","success")} style={{padding:"10px 22px",borderRadius:8,background:"rgba(34,212,106,.12)",color:C.green,border:`1px solid rgba(34,212,106,.3)`,cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:600}}>📤 Submit to Portal</button>
          <button onClick={submit} style={{padding:"10px 22px",borderRadius:8,background:C.orange,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700}}>✅ File Report</button>
        </div>
      </div>
    </div>
  );
}

// ─── INSPECTION PAGE ─────────────────────────────────────────────
function InspectionPage({toast}) {
  const [checks, setChecks] = useState(() => {
    const init = {};
    Object.entries(CHECK_ITEMS).forEach(([cat, items]) => {
      init[cat] = items.map(() => null); // null=unchecked, true=pass, false=fail
    });
    return init;
  });
  const total = Object.values(checks).flat().length;
  const passed = Object.values(checks).flat().filter(v=>v===true).length;
  const failed = Object.values(checks).flat().filter(v=>v===false).length;

  const toggle = (cat, i) => setChecks(prev => {
    const n = {...prev,[cat]:[...prev[cat]]};
    n[cat][i] = n[cat][i]===true ? false : n[cat][i]===false ? null : true;
    return n;
  });

  const catColors = [C.orange, C.teal, C.red, C.green];

  return (
    <div style={{animation:"slideIn .3s ease"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:800,letterSpacing:3}}>DAILY INSPECTION</div>
          <div style={{fontSize:12,color:C.g2,marginTop:4,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>FACTORIES ACT COMPLIANCE CHECKLIST · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"}).toUpperCase()}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,color:C.green}}>{passed}<span style={{color:C.g2,fontSize:16}}>/{total}</span></div>
            <div style={{fontSize:11,color:C.g2}}>Passed · <span style={{color:C.red}}>{failed} Failed</span></div>
          </div>
          <button onClick={()=>{if(passed<8){toast("Complete at least 8 checks","warning");return;}toast(`Inspection signed off — ${passed} items passed`,"success");}} style={{padding:"10px 22px",borderRadius:8,background:C.orange,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700}}>Sign Off</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {Object.entries(CHECK_ITEMS).map(([cat,items],ci)=>(
          <Card key={cat}>
            <CardTitle color={catColors[ci]}>{cat}</CardTitle>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {items.map((item,i)=>{
                const state = checks[cat][i];
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:C.card2,border:`1px solid ${state===true?C.green:state===false?C.red:C.border}`,borderRadius:8,cursor:"pointer",transition:"all .15s"}} onClick={()=>toggle(cat,i)}>
                    <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${state===true?C.green:state===false?C.red:C.g3}`,background:state===true?"rgba(34,212,106,.2)":state===false?"rgba(255,59,59,.2)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11}}>
                      {state===true?"✓":state===false?"✗":""}
                    </div>
                    <div style={{fontSize:13,color:state===true?C.g2:C.g1,textDecoration:state===true?"line-through":"none",flex:1}}>{item}</div>
                    <div style={{fontSize:9,color:state===true?C.green:state===false?C.red:C.g3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{state===true?"PASS":state===false?"FAIL":"TAP"}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────
export default function App() {
  const { violations: realViols, ppeTypes: realPpe, zones: realZones,
          timeline: realTimeline, zoneBars: realZoneBars,
          lastViolation, stats } = useComplianceData();
  const [liveCameras, setLiveCameras] = useState([]);
  const [livePlants, setLivePlants] = useState([]);
  const [page, setPage] = useState("dashboard");
  const [toasts, setToasts] = useState([]);
  const displayViols = realViols?.length > 0 ? realViols : VIOLATIONS;
  const displayPpe = realPpe?.length > 0 ? realPpe : PPE_TYPES;
  const displayZones = realZones?.length > 0 ? realZones : ZONES;
  const displayTimeline = realTimeline?.length > 0 ? realTimeline : TIMELINE;
  const displayZoneBars = realZoneBars?.length > 0 ? realZoneBars : ZONE_BARS;
  const maxZ = Math.max(...displayZoneBars.map(d=>d.val));

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const token = localStorage.getItem("safeg_token") || "";
        const res = await fetch("/api/v1/cameras", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const cams = data.data || [];
        try {
          const AI_URL = window.location.hostname !== "localhost"
            ? "https://safeguardsiq.com/ai" : "http://localhost:5050";
          const sr = await fetch(`${AI_URL}/stream/status`);
          const sd = await sr.json();
          const streams = sd.streams || {};
          const merged = cams.map(c => ({
            ...c,
            alert: (streams[c.cam_label]?.violations_today || 0) > 0,
            violations_today: streams[c.cam_label]?.violations_today || 0,
            status: streams[c.cam_label]?.status === "running" ? "online" : c.status || "offline",
          }));
          setLiveCameras(merged);
          try {
            const pr = await fetch('/api/v1/plants', { headers: { Authorization: `Bearer ${token}` } });
            const pd = await pr.json();
            setLivePlants(pd.data || []);
          } catch {}
        } catch {
          setLiveCameras(cams);
          try {
            const pr = await fetch('/api/v1/plants', { headers: { Authorization: `Bearer ${token}` } });
            const pd = await pr.json();
            setLivePlants(pd.data || []);
          } catch {}
        }
      } catch (e) {
        console.error("Camera fetch error:", e);
      }
    };
    fetchCameras();
    const interval = setInterval(fetchCameras, 10000);
    return () => clearInterval(interval);
  }, []);

  const toast = (msg, type="success") => {
    const id = Date.now();
    setToasts(p=>[...p,{id,msg,type}]);
  };
  const removeToast = id => setToasts(p=>p.filter(t=>t.id!==id));

  const navItems = [
    {id:"dashboard",label:"Dashboard",icon:"📊"},
    {id:"cameras",label:"Live Cameras",icon:"📹"},
    {id:"ppe",label:"PPE Compliance",icon:"🦺"},
    {id:"violations",label:"Violations",icon:"⚠️",badge:stats.openCount||0},
    {id:"form18",label:"Form 18",icon:"📋",badge:stats.pendingCount||0},
    {id:"inspection",label:"Inspection",icon:"✅"},
    {id:"reports",label:"Reports",icon:"📄"},
  ];

  const sideNav = [
    {label:"Factory", items: livePlants.length > 0
      ? livePlants.map((p,i) => ({icon:"🏭", name:p.plant_name||p.name, pg:undefined, active:i===0}))
      : [{icon:"🏭", name:"Loading...", active:true}]
    },
    {label:"Compliance",items:[
      {icon:"📊",name:"Overview",pg:"dashboard"},
      {icon:"📹",name:"Camera Feeds",pg:"cameras"},
      {icon:"🦺",name:"PPE Tracking",pg:"ppe"},
      {icon:"⚠️",name:"Violations",pg:"violations",badge:stats.openCount||0},
      {icon:"📋",name:"Form 18",pg:"form18",badge:stats.pendingCount||0},
      {icon:"✅",name:"Inspection",pg:"inspection"},
    ]},
    {label:"Reports",items:[
      {icon:"📄",name:"ISO 45001",    pg:"reports"},
      {icon:"📄",name:"ESIC Returns", pg:"reports"},
      {icon:"📄",name:"BRSR Safety",  pg:"reports"},
      {icon:"📄",name:"OSH Code",     pg:"reports"},
    ]},
  ];

  return (
    <>
      <style>{globalCSS}</style>

      {/* TOPBAR */}
      <div id="compliance-topbar" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:56,background:C.bg2,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:34,height:34,background:C.orange,clipPath:"polygon(50% 0%,100% 20%,100% 60%,50% 100%,0% 60%,0% 20%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",animation:"pulse 3s infinite",flexShrink:0}}>✓</div>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,letterSpacing:3,fontWeight:700}}>Safeguards IQ</div>
            <div style={{fontSize:9,color:C.g2,letterSpacing:3,fontFamily:"'Barlow Condensed',sans-serif"}}>COMPLIANCE COMMAND CENTRE</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7,background:"rgba(34,212,106,.08)",border:`1px solid rgba(34,212,106,.25)`,borderRadius:20,padding:"5px 14px",fontSize:11,color:C.green,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>
          <Dot color={liveCameras.length>0?C.green:C.amber} blink={liveCameras.length>0} size={7}/>
          {liveCameras.length>0 ? `MONITORING ACTIVE · ${liveCameras.length} CAMERAS` : 'NO CAMERAS CONNECTED'}
        </div>
        <div style={{display:"flex",gap:4}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{position:"relative",padding:"5px 14px",borderRadius:7,fontSize:12,fontWeight:600,color:page===n.id?C.orange:C.g2,cursor:"pointer",border:`1px solid ${page===n.id?C.orange:"transparent"}`,background:page===n.id?"rgba(255,92,26,.08)":"transparent",fontFamily:"'Syne',sans-serif",transition:"all .2s"}}>
              {n.label}
              {n.badge && <span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif"}}>{n.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div id="compliance-shell" style={{display:"flex",minHeight:"calc(100vh - 56px)"}}>
        {/* SIDEBAR */}
        <div id="compliance-nav" style={{width:210,flexShrink:0,background:C.bg2,borderRight:`1px solid ${C.border}`,padding:"16px 0",position:"sticky",top:56,height:"calc(100vh - 56px)",overflowY:"auto"}}>
          {sideNav.map(sec=>(
            <div key={sec.label} style={{padding:"0 12px 8px"}}>
              <div style={{fontSize:9,color:C.g3,letterSpacing:3,fontFamily:"'Barlow Condensed',sans-serif",padding:"8px 4px 4px",textTransform:"uppercase"}}>
                {sec.label}
              </div>
              {sec.items.map(item=>(
                <div key={item.name} onClick={()=>item.pg&&setPage(item.pg)} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,cursor:item.pg?"pointer":"default",fontSize:12,color:item.active||page===item.pg?C.orange:C.g1,background:item.active||page===item.pg?"rgba(255,92,26,.08)":"transparent",border:`1px solid ${item.active||page===item.pg?"rgba(255,92,26,.2)":"transparent"}`,marginBottom:2,transition:"all .2s",position:"relative"}}>
                  <span style={{fontSize:14}}>{item.icon}</span>
                  <span style={{flex:1}}>{item.name}</span>
                  {item.badge && <span style={{background:C.red,color:"#fff",fontSize:9,padding:"1px 6px",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif"}}>{item.badge}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div id="compliance-main" style={{flex:1,overflowY:"auto",padding:24}}>
          <div id="compliance-content">

          {/* ── DASHBOARD ── */}
          {page==="dashboard" && (
            <div style={{animation:"slideIn .3s ease"}}>
              {/* Alert Ticker */}
              <div style={{overflow:"hidden",background:"rgba(255,59,59,.07)",border:`1px solid rgba(255,59,59,.18)`,borderRadius:8,padding:"7px 0",marginBottom:20}}>
                <div style={{display:"flex",gap:48,animation:"ticker 28s linear infinite",whiteSpace:"nowrap"}}>
                  {[...Array(2)].map((_,ri)=>
                    displayViols.slice(0,6).map((v,i)=>(
                      <span key={`${ri}-${i}`} style={{fontSize:11,
                        color: v.sev==="High"||v.status==="Open" ? C.red : C.green,
                        fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,
                        display:"inline-flex",alignItems:"center",gap:16}}>
                        {v.sev==="High"||v.status==="Open" ? "🔴" : "✅"} {v.type||v.violation_type} — {v.zone||v.camera_id||'Zone'} · {v.date||v.occurred_at?.slice(11,16)||'Now'}
                        <span style={{color:C.g3}}>///</span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:800,letterSpacing:3}}>COMPLIANCE COMMAND CENTRE</div>
                  <div style={{fontSize:12,color:C.g2,marginTop:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>{(livePlants[0]?.plant_name || 'YOUR PLANT')?.toUpperCase()} · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase()}</div>
                </div>
                <button onClick={()=>setPage("form18")} style={{padding:"9px 20px",borderRadius:8,background:C.orange,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700}}>📋 File Form 18</button>
              </div>

              {/* KPIs */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:20}}>
                <KpiCard label="PPE Compliance" value={`${stats.compliance||97}%`} unit="Today" trend="↑ vs last week" trendUp={true} color={C.green}/>
                <KpiCard label="Active Violations" value={stats.openCount||0} unit="Open cases" trend="↑ new today" trendUp={false} color={C.red}/>
                <KpiCard label="Cameras Online" value={`${liveCameras.filter(c=>c.status==='online').length||0}/${liveCameras.length||0}`} unit="All operational" trend="● systems normal" trendUp={true} color={C.teal}/>
                <KpiCard label="Near-Miss Events" value={stats.nearMissCount||0} unit="This month" trend="↓ vs last week" trendUp={true} color={C.amber}/>
                <KpiCard label="Compliance Score" value={stats.compliance||92} unit="/ 100 · Grade A" trend="↑ Factories Act" trendUp={true} color={C.blue}/>
              </div>

              {/* Row 2 */}
              <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr 1.1fr",gap:16,marginBottom:16}}>
                {/* Bar Chart */}
                <Card>
                  <CardTitle>Violations by Zone — This Week</CardTitle>
                  <div style={{display:"flex",alignItems:"flex-end",gap:8,height:130,padding:"0 4px"}}>
                    {displayZoneBars.map((d,i)=>(
                      <div key={d.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{flex:1,width:"100%",display:"flex",alignItems:"flex-end"}}>
                          <div style={{width:"100%",height:`${d.val/maxZ*100}%`,background:d.c,borderRadius:"4px 4px 0 0",minHeight:4,transition:"height 1s",animation:"barUp 1s ease",animationDelay:`${i*0.08}s`,transformOrigin:"bottom",cursor:"pointer",position:"relative"}}
                            title={`${d.val} violations`}/>
                        </div>
                        <div style={{fontSize:9,color:C.g2,fontFamily:"'Barlow Condensed',sans-serif",textAlign:"center"}}>{d.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>
                {/* Ring */}
                <Card style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <CardTitle color={C.green}>PPE Compliance Today</CardTitle>
                  <Ring pct={stats.compliance||97}/>
                  <div style={{display:"flex",gap:16,marginTop:10,fontSize:11,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>
                    <span style={{color:C.green}}>● Pass: {stats.totalMonth||0}</span>
                    <span style={{color:C.red}}>● Fail: {stats.openCount||0}</span>
                  </div>
                </Card>
                {/* Timeline */}
                <Card style={{overflowY:"auto",maxHeight:260}}>
                  <CardTitle color={C.teal}>Today's Events</CardTitle>
                  <div style={{display:"flex",flexDirection:"column",gap:0}}>
                    {displayTimeline.map((e,i)=>(
                      <div key={i} style={{display:"flex",gap:12,paddingBottom:14,position:"relative"}}>
                        {i<displayTimeline.length-1 && <div style={{position:"absolute",left:16,top:32,width:2,bottom:0,background:C.border}}/>}
                        <div style={{width:32,height:32,borderRadius:"50%",background:`${e.color}18`,border:`2px solid ${e.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{e.icon}</div>
                        <div>
                          <div style={{fontSize:12,color:C.white,fontWeight:600}}>{e.title}</div>
                          <div style={{fontSize:10,color:C.g2,marginTop:2,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.5}}>{e.meta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Row 3 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Card>
                  <CardTitle color={C.orange}>PPE Compliance by Type</CardTitle>
                  {displayPpe.map(p=><MiniBar key={p.name} label={`${p.icon} ${p.name}`} pct={p.pct} color={p.c}/>)}
                </Card>
                <Card>
                  <CardTitle color={C.purple}>Zone-wise PPE Status</CardTitle>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {displayZones.map(z=>(
                      <div key={z.name} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                        <div style={{fontSize:22}}>{z.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:C.g1,fontWeight:600,marginBottom:3}}>{z.name}</div>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,color:z.c}}>{z.pct}%</div>
                          <div style={{height:3,background:C.border,borderRadius:3,marginTop:4,overflow:"hidden"}}>
                            <div style={{height:"100%",width:z.pct+"%",background:z.c,borderRadius:3}}/>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ── CAMERAS ── */}
          {page==="cameras" && (
            <div style={{animation:"slideIn .3s ease"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:800,letterSpacing:3}}>LIVE CAMERA FEEDS</div>
                  <div style={{fontSize:12,color:C.g2,marginTop:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>
                    {liveCameras.length} CAMERAS · AI DETECTION ACTIVE
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {(liveCameras.length > 0 ? liveCameras : [
                  {id:"CAM-01",loc:"Assembly A — Gate",alert:false},
                  {id:"CAM-02",loc:"Assembly A — Mid",alert:false},
                  {id:"CAM-03",loc:"Welding B — Entry",alert:false},
                  {id:"CAM-04",loc:"Welding B — Bay 3",alert:true},
                ]).map(cam=>(
                  <div key={cam.id} style={{background:"#000",borderRadius:8,overflow:"hidden",
                    border:`1px solid ${cam.alert||cam.violations_today>0?C.red:C.border}`,
                    position:"relative",aspectRatio:"16/9",cursor:"pointer",
                    animation:cam.alert||cam.violations_today>0?"alertPulse 1.2s infinite":"none"}}>
                    <CamFeed cam={cam}/>
                    <div style={{position:"absolute",inset:0,padding:7,display:"flex",
                      flexDirection:"column",justifyContent:"space-between",pointerEvents:"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <div style={{background:"rgba(0,0,0,.7)",color:C.white,fontSize:9,
                          padding:"2px 6px",borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif"}}>
                          {cam.cam_label || cam.id}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4,
                          background:"rgba(0,0,0,.7)",padding:"2px 6px",borderRadius:4,
                          fontSize:9,color:cam.status==='online'?C.green:C.red,
                          fontFamily:"'Barlow Condensed',sans-serif"}}>
                          <Dot color={cam.status==='online'?C.green:C.red} blink={cam.status==='online'} size={5}/>
                          {cam.status==='online'?'LIVE':'OFFLINE'}
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                        <div style={{background:"rgba(0,0,0,.7)",color:C.g1,fontSize:9,
                          padding:"2px 6px",borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif"}}>
                          {cam.area_name || cam.loc || "Zone"}
                        </div>
                        {(cam.alert||cam.violations_today>0) && (
                          <div style={{background:"rgba(255,59,59,.85)",color:"#fff",fontSize:9,
                            padding:"3px 8px",borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif",
                            fontWeight:700,animation:"blink .7s infinite"}}>
                            ⚠ {cam.violations_today||""} VIOLATION{cam.violations_today>1?"S":""}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PPE ── */}
          {page==="ppe" && (
            <div style={{animation:"slideIn .3s ease"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:800,letterSpacing:3,marginBottom:4}}>PPE COMPLIANCE TRACKER</div>
              <div style={{fontSize:12,color:C.g2,marginBottom:20,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>REAL-TIME PERSONAL PROTECTIVE EQUIPMENT MONITORING — ALL ZONES</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
                {displayPpe.map(p=>(
                  <div key={p.name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:p.c}}/>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <div style={{fontSize:30}}>{p.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,color:C.g1,fontWeight:600,marginBottom:4}}>{p.name}</div>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,color:p.c}}>{p.pct}%</div>
                        <div style={{height:4,background:C.border,borderRadius:4,marginTop:6,overflow:"hidden"}}>
                          <div style={{height:"100%",width:p.pct+"%",background:p.c,borderRadius:4,transition:"width 1.2s"}}/>
                        </div>
                      </div>
                      <Badge text={p.pct>=95?"Low":p.pct>=90?"Medium":"High"}/>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Card>
                  <CardTitle>Zone-wise PPE Status</CardTitle>
                  {displayZones.map(z=><MiniBar key={z.name} label={`${z.icon} ${z.name}`} pct={z.pct} color={z.c}/>)}
                </Card>
                <Card>
                  <CardTitle color={C.red}>PPE Violation Log — Today</CardTitle>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>{["Time","Worker","Violation","Zone","Severity","Status"].map(h=><th key={h} style={{fontSize:9,color:C.g2,textTransform:"uppercase",letterSpacing:2,padding:"8px 10px",textAlign:"left",borderBottom:`1px solid ${C.border}`,fontFamily:"'Barlow Condensed',sans-serif"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {displayViols.slice(0,5).map((v,i)=>(
                        <tr key={i}>
                          <td style={{padding:"10px",fontSize:12,color:C.g1,borderBottom:`1px solid ${C.border}44`,fontFamily:"'Barlow Condensed',sans-serif"}}>{v.date}</td>
                          <td style={{padding:"10px",fontSize:11,color:C.g2,borderBottom:`1px solid ${C.border}44`,fontFamily:"'Barlow Condensed',sans-serif"}}>{v.worker||"—"}</td>
                          <td style={{padding:"10px",fontSize:12,color:C.g1,borderBottom:`1px solid ${C.border}44`}}>{v.type}</td>
                          <td style={{padding:"10px",fontSize:12,color:C.g2,borderBottom:`1px solid ${C.border}44`}}>{v.zone}</td>
                          <td style={{padding:"10px",borderBottom:`1px solid ${C.border}44`}}><Badge text={v.sev}/></td>
                          <td style={{padding:"10px",borderBottom:`1px solid ${C.border}44`}}><Badge text={v.status}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
          )}

          {/* ── VIOLATIONS ── */}
          {page==="violations" && (
            <div style={{animation:"slideIn .3s ease"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:800,letterSpacing:3}}>VIOLATION REGISTER</div>
                  <div style={{fontSize:12,color:C.g2,marginTop:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>ALL SAFETY INCIDENTS · FACTORIES ACT SECTION 7A COMPLIANT</div>
                </div>
                <button onClick={()=>toast("VIO-236 created and assigned","success")} style={{padding:"9px 20px",borderRadius:8,background:C.orange,color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:700}}>+ Log Violation</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
                <KpiCard label="Open" value={stats.openCount||0} unit="Require action" trend="↑ 2 new today" trendUp={false} color={C.red}/>
                <KpiCard label="Pending Review" value={stats.pendingCount||0} unit="Awaiting sign-off" trend="→ Same as yesterday" color={C.amber}/>
                <KpiCard label="Closed Today" value={stats.closedToday||0} unit="Resolved" trend="↑ +3 vs yesterday" trendUp={true} color={C.green}/>
                <KpiCard label="This Month" value={stats.totalMonth||0} unit="Total" trend="↓ −23% vs last month" trendUp={true} color={C.blue}/>
              </div>
              <Card>
                <CardTitle>All Violations</CardTitle>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>{["ID","Date/Time","Type","Zone","Worker","Severity","Corrective Action","Status",""].map(h=><th key={h} style={{fontSize:9,color:C.g2,textTransform:"uppercase",letterSpacing:2,padding:"8px 12px",textAlign:"left",borderBottom:`1px solid ${C.border}`,fontFamily:"'Barlow Condensed',sans-serif"}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {displayViols.map((v,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${C.border}44`}}>
                          <td style={{padding:"11px 12px",fontSize:12,color:C.orange,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:600}}>{v.id}</td>
                          <td style={{padding:"11px 12px",fontSize:12,color:C.g1}}>{v.date}</td>
                          <td style={{padding:"11px 12px",fontSize:12,color:C.white,fontWeight:600}}>{v.type}</td>
                          <td style={{padding:"11px 12px",fontSize:12,color:C.g1}}>{v.zone}</td>
                          <td style={{padding:"11px 12px",fontSize:11,color:C.g2,fontFamily:"'Barlow Condensed',sans-serif"}}>{v.worker}</td>
                          <td style={{padding:"11px 12px"}}><Badge text={v.sev}/></td>
                          <td style={{padding:"11px 12px",fontSize:11,color:C.g2,maxWidth:200}}>{v.action}</td>
                          <td style={{padding:"11px 12px"}}><Badge text={v.status}/></td>
                          <td style={{padding:"11px 12px"}}><button onClick={()=>toast(`${v.id} updated`,"success")} style={{padding:"4px 12px",borderRadius:6,background:C.card2,color:C.g1,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:11,fontFamily:"'Syne',sans-serif"}}>Update</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ── FORM 18 ── */}
          {page==="form18" && <Form18 toast={toast} lastViolation={lastViolation}/>}

          {/* ── INSPECTION ── */}
          {page==="inspection" && <InspectionPage toast={toast}/>}

          {/* ── REPORTS ── */}
          {page==="reports" && (
            <div style={{animation:"slideIn .3s ease"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:38,fontWeight:800,letterSpacing:3,marginBottom:4}}>COMPLIANCE REPORTS</div>
              <div style={{fontSize:12,color:C.g2,marginBottom:24,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>AUTO-GENERATED STATUTORY REPORTS — ISO 45001 · ESIC · BRSR · FACTORIES ACT</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
                {[
                  {icon:"📋",title:"ISO 45001 Monthly Report",desc:`OHS Management System — ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}`,status:"Closed",badge:"Ready to export"},
                  {icon:"🏥",title:"ESIC Half-Yearly Return",desc:`Employee State Insurance — H${new Date().getMonth()<6?1:2} ${new Date().getFullYear()}`,status:stats.totalMonth>0?"Closed":"Pending",badge:stats.totalMonth>0?"Ready to export":"No data yet"},
                  {icon:"📊",title:"SEBI BRSR Safety Data",desc:"Business Responsibility & Sustainability",status:"Closed",badge:"Ready to export"},
                  {icon:"⚠️",title:"Accident Summary Report",desc:`Form 18 & 19 Register — ${new Date().getFullYear()}`,status:stats.openCount>0?"Pending":"Closed",badge:`${stats.totalMonth||0} incidents filed`},
                  {icon:"🏛️",title:"Shram Suvidha Portal Sync",desc:"Labour compliance — Ministry of Labour",status:"Pending",badge:"Sync pending"},
                  {icon:"📜",title:"OSH Code 2020 Compliance",desc:"Occupational Safety Health — Quarterly",status:stats.compliance>=90?"Closed":"Pending",badge:stats.compliance>=90?"Compliant":`${stats.compliance||0}% — Review needed`},
                ].map((r,i)=>(
                  <Card key={i} style={{cursor:"pointer"}} onClick={()=>toast(`${r.title} — ${r.badge}`,"success")}>
                    <div style={{fontSize:32,marginBottom:12}}>{r.icon}</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.white,marginBottom:6}}>{r.title}</div>
                    <div style={{fontSize:12,color:C.g2,marginBottom:14}}>{r.desc}</div>
                    <Badge text={r.status}/><span style={{marginLeft:8,fontSize:11,color:C.g2}}>{r.badge}</span>
                  </Card>
                ))}
              </div>
              <Card>
                <CardTitle>Annual Compliance Summary — FY 2024</CardTitle>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14}}>
                  <KpiCard label="Total Violations" value={stats.totalMonth||0} trend="↓ vs last year" trendUp={true} color={C.green}/>
                  <KpiCard label="Near-Misses" value={stats.openCount||0} trend="↓ YoY" trendUp={true} color={C.green}/>
                  <KpiCard label="Lost Work Days" value={stats.pendingCount||0} trend="→ No change" color={C.amber}/>
                  <KpiCard label="Fatalities" value="0" trend="● Zero record maintained" trendUp={true} color={C.green}/>
                  <KpiCard label="Compliance Rate" value={`${stats.compliance||97}%`} trend="↑ YoY" trendUp={true} color={C.green}/>
                </div>
              </Card>
            </div>
          )}

          </div>
        </div>
      </div>

      {/* TOASTS */}
      <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
        {toasts.map(t=><Toast key={t.id} msg={t.msg} type={t.type} onDone={()=>removeToast(t.id)}/>)}
      </div>
    </>
  );
}
