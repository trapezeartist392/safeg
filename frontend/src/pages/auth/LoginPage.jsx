import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes gridMove{from{transform:translateY(0)}to{transform:translateY(60px)}}
@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}
@keyframes spin{to{transform:rotate(360deg)}}
`;

const T = {
  bg: "#05080F", bg2: "#080D18", card: "#0C1422",
  border: "#1A2540", orange: "#FF5B18", teal: "#00D4B4",
  white: "#EDF2FF", g1: "#8899BB", g2: "#3A4E72", green: "#22D468", red: "#FF3D3D",
};

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/api/v1/auth/login", form);
      const { accessToken, refreshToken, user, tenantId } = res.data.data;
      localStorage.setItem("safeg_token", accessToken);
      localStorage.setItem("safeg_refresh", refreshToken);
      localStorage.setItem("safeg_user", JSON.stringify(user));
      localStorage.setItem("safeg_tenant", tenantId);
      onLogin?.(user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", fontFamily: "'Nunito',sans-serif", position: "relative", overflow: "hidden" }}>

        {/* Animated grid background */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`, backgroundSize: "60px 60px", animation: "gridMove 4s linear infinite", opacity: 0.4 }} />

        {/* Left panel â€” branding */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 64px", position: "relative", zIndex: 1 }}>
          <div style={{ animation: "fadeUp .6s ease both" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 56 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${T.orange},#FF8C52)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'Bebas Neue'" }}>S</div>
              <div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 3, color: T.white }}>Safeguards IQ</div>
                <div style={{ fontSize: 11, color: T.g1, letterSpacing: 2 }}>FACTORY SAFETY INTELLIGENCE</div>
              </div>
            </div>

            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 56, lineHeight: 1, color: T.white, marginBottom: 16 }}>
              PROTECTING<br /><span style={{ color: T.orange }}>INDIA'S</span><br />WORKERS
            </div>
            <p style={{ color: T.g1, fontSize: 15, lineHeight: 1.7, maxWidth: 420, marginBottom: 48 }}>
              AI-powered PPE compliance monitoring for factories. Real-time alerts, Factories Act Form 18 automation, and 98.7% detection accuracy.
            </p>

            {/* Stats */}
            <div style={{ display: "flex", gap: 32 }}>
              {[["98.7%","AI Accuracy"],["<3s","Detection"],["363K+","Factories"]].map(([v,l])=>(
                <div key={l}>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: T.orange, letterSpacing: 1 }}>{v}</div>
                  <div style={{ fontSize: 11, color: T.g1, letterSpacing: 1.5 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel â€” login form */}
        <div style={{ width: "50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, position: "relative", zIndex: 1 }}>
          <div style={{ width: "100%", maxWidth: 420, background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, padding: 40, animation: "fadeUp .7s ease both" }}>

            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: T.white, letterSpacing: 2, marginBottom: 6 }}>WELCOME BACK</div>
              <div style={{ color: T.g1, fontSize: 14 }}>Sign in to your Safeguards IQ dashboard</div>
            </div>

            {error && (
              <div style={{ background: "rgba(255,61,61,.1)", border: `1px solid rgba(255,61,61,.3)`, borderRadius: 10, padding: "12px 16px", color: T.red, fontSize: 13, marginBottom: 20 }}>
                âš  {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: T.g1, letterSpacing: 1.5, display: "block", marginBottom: 8, fontWeight: 600 }}>EMAIL ADDRESS</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  style={{ width: "100%", background: "#08101E", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", color: T.white, fontSize: 14, fontFamily: "'Nunito'", outline: "none" }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: T.g1, letterSpacing: 1.5, fontWeight: 600 }}>PASSWORD</label>
                  <Link to="/forgot-password" style={{ fontSize: 12, color: T.orange, textDecoration: "none" }}>Forgot password?</Link>
                </div>
                <input
                  type="password" required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  style={{ width: "100%", background: "#08101E", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px", color: T.white, fontSize: 14, fontFamily: "'Nunito'", outline: "none" }}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{ width: "100%", background: loading ? T.g2 : `linear-gradient(135deg,${T.orange},#FF8C52)`, border: "none", borderRadius: 10, padding: "15px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Nunito'", letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
              >
                {loading ? (
                  <>
                    <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                    Signing in...
                  </>
                ) : "Sign In â†’"}
              </button>
            </form>

            {/* Demo credentials */}
            <div style={{ marginTop: 20, background: "rgba(0,212,180,.06)", border: `1px solid rgba(0,212,180,.2)`, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: T.teal, letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>DEMO CREDENTIALS</div>
              <div style={{ fontSize: 12, color: T.g1, fontFamily: "'DM Mono'" }}>suresh@puneauto.com</div>
              <div style={{ fontSize: 12, color: T.g1, fontFamily: "'DM Mono'" }}>Demo@SafeG2024!</div>
            </div>

            <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.g1 }}>
              Don't have an account?{" "}
              <Link to="/signup" style={{ color: T.orange, fontWeight: 700, textDecoration: "none" }}>Start free trial â†’</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


