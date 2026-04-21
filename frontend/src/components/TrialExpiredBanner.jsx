/**
 * TrialExpiredBanner.jsx
 * SafeguardsIQ — Trial Status Banner with Razorpay Subscribe Now
 */
import { useState, useEffect } from 'react';
import axios from 'axios';

const T = {
  card:"#0C1422", border:"#1A2540", orange:"#FF5B18",
  white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
  green:"#22D468", red:"#FF3D3D", amber:"#FFB400",
};

export default function TrialExpiredBanner() {
  const [trialInfo,  setTrialInfo]  = useState(null);
  const [paying,     setPaying]     = useState(false);

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

  const openRazorpay = async () => {
    setPaying(true);
    // Refresh token if needed
    let token = localStorage.getItem('safeg_token') || '';
    try {
      const refreshToken = localStorage.getItem('safeg_refresh') || '';
      const refreshRes = await axios.post('/api/v1/auth/refresh-token', { refreshToken });
      token = refreshRes.data.data.accessToken;
      localStorage.setItem('safeg_token', token);
    } catch(e) {
      // Use existing token if refresh fails
      token = localStorage.getItem('safeg_token') || '';
    }
    try {
      // Load Razorpay script if needed
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      // Create order
      const res = await axios.post('/api/v1/payments/create-order', {
        planId: 'growth', billing: 'monthly', addOns: [],
      }, { headers: { Authorization: `Bearer ${token}` }});

      const d = res.data.data;
      if (!d) throw new Error('Order creation failed');
      const orderId  = d.orderId;
      const amount   = d.amount;
      const currency = d.currency;
      const key      = d.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      const user = JSON.parse(localStorage.getItem('safeg_user') || '{}');

      const rzp = new window.Razorpay({
        key, amount, currency,
        order_id:    orderId,
        name:        'SafeguardsIQ',
        description: 'Professional Plan — Monthly',
        image:       'https://safeguardsiq.com/logo.png',
        prefill: {
          name:    user.fullName || '',
          email:   user.email   || '',
          contact: user.phone   || '',
        },
        theme: { color: '#FF5B18' },
        handler: async (response) => {
          try {
            await axios.post('/api/v1/payments/verify', {
              ...response, planId: 'growth', billing: 'monthly',
            }, { headers: { Authorization: `Bearer ${token}` }});
            setTrialInfo(prev => ({ ...prev, status: 'active' }));
            alert('🎉 Payment successful! Your Professional plan is now active.');
            window.location.reload();
          } catch(e) {
            alert('Payment verification failed. Please contact support.');
          }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch(e) {
      alert('Payment failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setPaying(false);
    }
  };

  if (!trialInfo) return null;
  if (trialInfo.status === 'active') return null;

  const { status, daysLeft, isTrialMode } = trialInfo;

  // ── EXPIRED ──
  if (status === 'expired') {
    return (
      <div style={{ background:"#FF3D3D10", border:"2px solid #FF3D3D40",
        borderRadius:12, padding:"16px 20px", marginBottom:16,
        display:"flex", alignItems:"center", gap:16 }}>
        <span style={{ fontSize:28 }}>🔒</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:T.red, marginBottom:4 }}>
            Your SafeguardsIQ Trial Has Expired
          </div>
          <div style={{ fontSize:12, color:T.g1 }}>
            Your workers are no longer being monitored. Upgrade to continue protection.
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          <button onClick={openRazorpay} disabled={paying} style={{
            background:`linear-gradient(135deg,${T.orange},#FF8C52)`,
            border:"none", borderRadius:10, padding:"10px 20px",
            color:"#fff", fontSize:13, fontWeight:800, cursor:paying?"not-allowed":"pointer",
            whiteSpace:"nowrap",
          }}>
            {paying ? "⏳ Opening..." : "🔓 Subscribe Now →"}
          </button>
        </div>
      </div>
    );
  }

  // ── TRIAL ACTIVE ──
  if (isTrialMode && daysLeft !== undefined) {
    const color  = daysLeft <= 3 ? T.red : daysLeft <= 7 ? T.amber : T.green;
    const urgent = daysLeft <= 7;

    return (
      <div style={{ background:`${color}08`, border:`1px solid ${color}30`,
        borderRadius:10, padding:"12px 20px", marginBottom:12,
        display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>

        <span style={{ fontSize:18 }}>{urgent ? "⚠️" : "🎯"}</span>

        <div style={{ flex:1, minWidth:200 }}>
          <span style={{ fontSize:12, color:T.g1 }}>Free trial · </span>
          <span style={{ fontSize:13, fontWeight:800, color }}>
            {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
          </span>
          {urgent && (
            <span style={{ fontSize:12, color:T.g1 }}> — Upgrade to avoid interruption</span>
          )}
        </div>

        {/* Subscribe Now button — always visible */}
        <button onClick={openRazorpay} disabled={paying} style={{
          background:`linear-gradient(135deg,${T.orange},#FF8C52)`,
          border:"none", borderRadius:8, padding:"8px 18px",
          color:"#fff", fontSize:12, fontWeight:800,
          cursor:paying?"not-allowed":"pointer",
          flexShrink:0, whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:6,
        }}>
          {paying
            ? <><div style={{ width:12, height:12, border:"2px solid rgba(255,255,255,.3)",
                borderTopColor:"#fff", borderRadius:"50%",
                animation:"spin .8s linear infinite" }}/> Opening...</>
            : "💳 Subscribe Now →"
          }
        </button>

        {/* Plan info on hover */}
        <div style={{ width:"100%", fontSize:10, color:T.g2, marginTop:2 }}>
          Professional Plan · ₹2,000/camera/month · WhatsApp alerts + Form 18 + 90-day archive
        </div>
      </div>
    );
  }

  return null;
}
