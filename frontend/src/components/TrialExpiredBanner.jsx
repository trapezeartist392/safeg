import { useState, useEffect } from 'react';
import axios from 'axios';

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
    let token = localStorage.getItem('safeg_token') || '';
    try {
      const refreshToken = localStorage.getItem('safeg_refresh') || '';
      const refreshRes = await axios.post('/api/v1/auth/refresh-token', { refreshToken });
      token = refreshRes.data.data.accessToken;
      localStorage.setItem('safeg_token', token);
    } catch(e) {
      token = localStorage.getItem('safeg_token') || '';
    }
    try {
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve; script.onerror = reject;
          document.body.appendChild(script);
        });
      }
      const res = await axios.post('/api/v1/payments/create-order', {
        planId: 'growth', billing: 'monthly', addOns: [],
      }, { headers: { Authorization: `Bearer ${token}` }});
      const d = res.data.data;
      if (!d) throw new Error('Order creation failed');
      const user = JSON.parse(localStorage.getItem('safeg_user') || '{}');
      const rzp = new window.Razorpay({
        key: d.key || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: d.amount, currency: d.currency, order_id: d.orderId,
        name: 'SafeguardsIQ', description: 'Professional Plan — Monthly',
        image: 'https://safeguardsiq.com/logo.png',
        prefill: { name: user.fullName||'', email: user.email||'', contact: user.phone||'' },
        theme: { color: '#FF5B18' },
        handler: async (response) => {
          try {
            await axios.post('/api/v1/payments/verify', {
              ...response, planId: 'growth', billing: 'monthly',
            }, { headers: { Authorization: `Bearer ${token}` }});
            alert('🎉 Payment successful! Your plan is now active.');
            window.location.reload();
          } catch(e) { alert('Payment verification failed. Please contact support.'); }
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

  if (status === 'expired') {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6,
          background:"rgba(255,61,61,.15)", border:"1px solid rgba(255,61,61,.3)",
          borderRadius:8, padding:"5px 10px" }}>
          <span style={{ fontSize:11 }}>🔒</span>
          <span style={{ fontSize:11, color:"#FF3D3D", fontWeight:700 }}>Trial Expired</span>
        </div>
        <button onClick={openRazorpay} disabled={paying} style={{
          background:"linear-gradient(135deg,#FF5B18,#FF8C52)",
          border:"none", borderRadius:8, padding:"6px 14px",
          color:"#fff", fontSize:11, fontWeight:800, cursor:paying?"not-allowed":"pointer",
          whiteSpace:"nowrap",
        }}>
          {paying ? "⏳..." : "🔓 Subscribe →"}
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
        <button onClick={openRazorpay} disabled={paying} style={{
          background:`linear-gradient(135deg,#FF5B18,#FF8C52)`,
          border:"none", borderRadius:8, padding:"6px 14px",
          color:"#fff", fontSize:11, fontWeight:800,
          cursor:paying?"not-allowed":"pointer",
          whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:4,
        }}>
          {paying
            ? <><div style={{ width:10, height:10, border:"2px solid rgba(255,255,255,.3)",
                borderTopColor:"#fff", borderRadius:"50%",
                animation:"spin .8s linear infinite" }}/> ...</>
            : "💳 Subscribe →"
          }
        </button>
      </div>
    );
  }

  return null;
}
