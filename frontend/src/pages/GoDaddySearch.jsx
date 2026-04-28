import React from "react";
import { api, fmtErr } from "../lib/api";
import { useAuth } from "../lib/auth";
import { MagnifyingGlass, Lightning, Check, X } from "@phosphor-icons/react";
import { SiGodaddy } from "react-icons/si";
import { toast } from "sonner";

export default function GoDaddySearch() {
  const { currency, rates } = useAuth();
  const [domain, setDomain] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [suggestions, setSuggestions] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  const check = async (e) => {
    e?.preventDefault();
    if (!domain.trim()) return;
    setBusy(true);
    try {
      const [r1, r2] = await Promise.all([
        api.post("/godaddy/check", { domain: domain.trim() }),
        api.get(`/godaddy/suggest?q=${encodeURIComponent(domain.trim().split(".")[0])}&count=6`),
      ]);
      setResult(r1.data);
      setSuggestions(r2.data.suggestions);
    } catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3 flex items-center gap-2">
        <SiGodaddy size={14} /> / GoDaddy Integration
      </div>
      <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tighter mb-2">Domain availability search.</h1>
      <p className="text-[#8F95A3] mb-10">Check any domain across registrars. AI suggests brandable alternatives.</p>

      <div className="border border-[#FFD700]/30 bg-[#FFD700]/5 p-3 mb-8 text-[10px] font-mono uppercase tracking-widest text-[#FFD700]">
        ⚠ MOCKED — Live GoDaddy API requires API_KEY & API_SECRET (provide in admin panel later)
      </div>

      <form onSubmit={check} className="flex flex-col sm:flex-row gap-3 mb-10" data-testid="godaddy-form">
        <div className="relative flex-grow">
          <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8F95A3]" />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="input-field pl-11 h-14 text-base" data-testid="godaddy-input" />
        </div>
        <button type="submit" disabled={busy} className="btn-primary h-14" data-testid="godaddy-check-btn">
          {busy ? "Searching..." : "Check Availability"} <Lightning size={14} weight="fill" />
        </button>
      </form>

      {result && (
        <div className={`border ${result.available ? "border-[#00E676]/40 bg-[#00E676]/5" : "border-[#FF3B30]/40 bg-[#FF3B30]/5"} p-8 mb-12 fade-up`} data-testid="godaddy-result">
          <div className="flex items-center gap-4 mb-4">
            {result.available ? <Check size={28} weight="bold" color="#00E676" /> : <X size={28} weight="bold" color="#FF3B30" />}
            <div>
              <div className="font-display text-2xl font-bold">{result.domain}</div>
              <div className="text-xs font-mono uppercase tracking-widest" style={{ color: result.available ? "#00E676" : "#FF3B30" }}>
                {result.available ? "Available" : "Taken"}
              </div>
            </div>
          </div>
          {result.available && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#22252A] border border-[#22252A]">
              <Cell label="Registrar Price" value={`$${result.price_usd}`} />
              <Cell label="AI Estimated Resale" value={`$${result.ai_estimate_usd}`} accent="#FFD700" />
              <Cell label="Profit Potential" value={`$${(result.ai_estimate_usd - result.price_usd).toFixed(0)}`} accent="#00E676" />
            </div>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-bold mb-6 tracking-tight">AI-Powered Alternatives</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#22252A] border border-[#22252A]">
            {suggestions.map((s, i) => (
              <div key={i} className="bg-[#08090A] p-6">
                <div className="font-display text-lg font-semibold mb-1 break-all">{s.domain}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-4">Score {s.score} · {s.demand}</div>
                <div className="font-mono text-sm text-[#0052FF]">~ ${s.estimated_price_usd}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const Cell = ({ label, value, accent = "white" }) => (
  <div className="bg-[#08090A] p-5">
    <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2">{label}</div>
    <div className="font-display text-2xl font-bold" style={{ color: accent }}>{value}</div>
  </div>
);
