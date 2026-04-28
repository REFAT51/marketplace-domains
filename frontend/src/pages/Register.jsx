import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Globe, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Register() {
  const { register, user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("buyer");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (user && user.id) nav("/dashboard"); }, [user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await register(email, password, name, role);
    setBusy(false);
    if (!r.ok) { setErr(r.error); toast.error(r.error); }
    else { toast.success("Account created"); nav("/dashboard"); }
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
          <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">/ Create Account</div>
          <h1 className="font-display text-3xl font-bold mb-8 tracking-tight">Start trading.</h1>
          <form onSubmit={submit} data-testid="register-form" className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2 block">Full Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" data-testid="register-name" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2 block">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" data-testid="register-email" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2 block">Password (min 8)</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" data-testid="register-password" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2 block">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setRole("buyer")} className={`h-12 border ${role === "buyer" ? "border-[#0052FF] bg-[#0052FF]/10" : "border-[#22252A]"} font-mono text-xs uppercase tracking-widest`} data-testid="register-role-buyer">Buyer</button>
                <button type="button" onClick={() => setRole("seller")} className={`h-12 border ${role === "seller" ? "border-[#0052FF] bg-[#0052FF]/10" : "border-[#22252A]"} font-mono text-xs uppercase tracking-widest`} data-testid="register-role-seller">Seller</button>
              </div>
            </div>
            {err && <div className="text-xs text-[#FF3B30] font-mono uppercase tracking-widest" data-testid="register-error">{err}</div>}
            <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="register-submit">
              {busy ? "Creating..." : "Create Account"} <ArrowRight size={14} weight="bold" />
            </button>
          </form>
          <div className="mt-8 text-center text-sm text-[#8F95A3]">
            Already have an account? <Link to="/login" className="text-[#0052FF] hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
