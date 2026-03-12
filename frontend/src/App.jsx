import { useState } from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";

import LoginPage         from "./pages/auth/LoginPage.jsx";
import SignupPage        from "./pages/auth/SignupPage.jsx";
import AdminDashboard    from "./pages/admin/AdminDashboard.jsx";
import SafetyMonitor     from "./components/safety-monitor.jsx";
import FactoryCompliance from "./components/factory-compliance.jsx";
import BillingDashboard  from "./pages/payment/BillingDashboard.jsx";

const T = {
  bg:"#05080F", nav:"#080D18", border:"#1A2540",
  orange:"#FF5B18", white:"#EDF2FF", g1:"#8899BB", g2:"#3A4E72",
};

function PrivateRoute({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

function AppNav({ user, onLogout }) {
  const navItems = [
    { to: "/dashboard",  label: "ðŸ“¹ Safety Monitor" },
    { to: "/compliance", label: "ðŸ›¡ï¸ Compliance"     },
    { to: "/billing",    label: "ðŸ§¾ Billing"        },
  ];
  return (
    <nav style={{ background:T.nav, borderBottom:`1px solid ${T.border}`, padding:"0 24px", display:"flex", alignItems:"center", gap:4, overflowX:"auto", position:"sticky", top:0, zIndex:100 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginRight:24, paddingRight:24, borderRight:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#FF5B18,#FF8C52)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:16, color:"#fff" }}>S</div>
        <div>
          <div style={{ color:T.white, fontWeight:800, fontSize:13, letterSpacing:1.5 }}>Safeguards IQ</div>
          <div style={{ color:T.g1, fontSize:9, letterSpacing:2 }}>FACTORY SAFETY</div>
        </div>
      </div>
      {navItems.map(({ to, label }) => (
        <NavLink key={to} to={to} style={({ isActive }) => ({
          padding:"15px 14px", fontSize:13, fontWeight:600,
          color: isActive ? T.orange : T.g1, textDecoration:"none",
          borderBottom: isActive ? `2px solid ${T.orange}` : "2px solid transparent",
          whiteSpace:"nowrap", transition:"color .2s",
        })}>{label}</NavLink>
      ))}
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        {user && <>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:12, color:T.white, fontWeight:700 }}>{user.fullName || user.email}</div>
            <div style={{ fontSize:10, color:T.g2, letterSpacing:1 }}>{user.role?.replace("_"," ").toUpperCase()}</div>
          </div>
          <button onClick={onLogout} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:8, padding:"7px 14px", color:T.g1, fontSize:12, fontWeight:600, cursor:"pointer" }}>Sign Out</button>
        </>}
      </div>
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("safeg_user")); } catch { return null; }
  });
  const handleLogin  = (u) => setUser(u);
  const handleLogout = () => {
    ["safeg_token","safeg_refresh","safeg_user","safeg_tenant"].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg }}>
      {/* Only show main nav when NOT on admin route */}
      {user && !window.location.pathname.startsWith("/admin") && <AppNav user={user} onLogout={handleLogout} />}
      <Routes>
        {/* Public */}
        <Route path="/login"  element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignupPage onLogin={handleLogin} />} />
        <Route path="/"       element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />

        {/* Main app â€” protected */}
        <Route path="/dashboard"  element={<PrivateRoute user={user}><SafetyMonitor /></PrivateRoute>} />
        <Route path="/compliance" element={<PrivateRoute user={user}><FactoryCompliance /></PrivateRoute>} />
        <Route path="/billing"    element={<PrivateRoute user={user}><BillingDashboard /></PrivateRoute>} />

        {/* Admin portal â€” completely separate, has its own auth */}
        <Route path="/admin/*" element={<AdminDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

