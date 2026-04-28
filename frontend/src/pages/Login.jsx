import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Globe, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (user && user.id) nav(loc.state?.from || "/dashboard");
  }, [user, nav, loc.state]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const r = await login(email, password);
    setBusy(false);
    if (!r.ok) { setErr(r.error); toast.error(r.error); }
    else { toast.success("Welcome back"); nav("/dashboard"); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-12 justify-center">
          <div className="w-8 h-8 bg-[#0052FF] flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(0,82,255,0.5)" }}>
            <Globe size={18} weight="bold" color="white" />
          </div>
          <span className="font-display font-bold text-lg">DOMAIN.<span className="text-[#0052FF]">AI</span></span>
        </Link>
        <div className="border border-[#22252A] bg-[#121417] p-10">
          <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">/ Sign In</div>
          <h1 className="font-display text-3xl font-bold mb-8 tracking-tight">Welcome back.</h1>
          <form onSubmit={submit} data-testid="login-form" className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2 block">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" data-testid="login-email" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2 block">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" data-testid="login-password" />
            </div>
            {err && <div className="text-xs text-[#FF3B30] font-mono uppercase tracking-widest" data-testid="login-error">{err}</div>}
            <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="login-submit">
              {busy ? "Signing in..." : "Sign In"} <ArrowRight size={14} weight="bold" />
            </button>
          </form>
          <div className="mt-8 text-center text-sm text-[#8F95A3]">
            New to DOMAIN.AI? <Link to="/register" className="text-[#0052FF] hover:underline">Create account</Link>
          </div>
        </div>
        <div className="mt-6 text-center text-[10px] font-mono uppercase tracking-widest text-[#8F95A3]">
          Demo: admin@domainai.com / Admin@12345
        </div>
      </div>
    </div>
  );
}
