import React from "react";
import { api, fmtPrice, fmtErr } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Brain, ArrowRight, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";

const AI_BG = "https://images.unsplash.com/photo-1762278804941-27ff5cba5a2e";

export default function AIValuation() {
  const { currency, rates } = useAuth();
  const [domain, setDomain] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  // brandable
  const [keywords, setKeywords] = React.useState("");
  const [brands, setBrands] = React.useState([]);
  const [bbusy, setBbusy] = React.useState(false);

  const valuate = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post("/ai/valuation", { domain: domain.trim() });
      setResult(data);
    } catch (e) {
      toast.error(fmtErr(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const generate = async (e) => {
    e.preventDefault();
    if (!keywords.trim()) return;
    setBbusy(true);
    try {
      const { data } = await api.post("/ai/brandable", { keywords: keywords.trim(), count: 8 });
      setBrands(data.suggestions);
    } catch (e) {
      toast.error(fmtErr(e.response?.data?.detail));
    } finally { setBbusy(false); }
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative border-b border-[#22252A] overflow-hidden">
        <div className="absolute inset-0">
          <img src={AI_BG} alt="" className="w-full h-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090A]/70 to-[#08090A]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="text-xs font-mono uppercase tracking-widest text-[#FFD700] mb-3 flex items-center gap-2">
            <Brain size={14} weight="fill" /> / GPT-5.2 Powered
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter mb-6 max-w-3xl">AI Domain Valuation Tool</h1>
          <p className="text-lg text-[#8F95A3] max-w-2xl">Get an AI-generated score, estimated value, and market analysis for any domain in seconds.</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#22252A] border border-[#22252A]">
        {/* Valuation */}
        <div className="bg-[#08090A] p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <Lightning size={24} weight="fill" color="#0052FF" />
            <h2 className="font-display text-2xl font-bold tracking-tight">Domain Valuation</h2>
          </div>
          <form onSubmit={valuate} className="space-y-4 mb-8" data-testid="valuation-form">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. nexpay.com" className="input-field" data-testid="valuation-input" />
            <button type="submit" disabled={busy} className="btn-primary w-full" data-testid="valuation-submit">
              {busy ? "Analyzing with GPT..." : "Valuate Domain"} <ArrowRight size={14} weight="bold" />
            </button>
          </form>
          {result && (
            <div className="border border-[#22252A] bg-[#121417] p-6 fade-up" data-testid="valuation-result">
              <div className="font-display text-2xl font-bold mb-1 break-all">{result.domain}</div>
              <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] mb-6">AI Analysis</div>
              <div className="grid grid-cols-2 gap-px bg-[#22252A] border border-[#22252A] mb-6">
                <Cell label="Score" value={`${result.score}/100`} accent="#0052FF" />
                <Cell label="Estimate" value={fmtPrice(result.estimated_price_usd, currency, rates)} accent="#FFD700" />
                <Cell label="Demand" value={result.demand} />
                <Cell label="Brandable" value={result.is_brandable ? "Yes" : "No"} />
              </div>
              <p className="text-sm text-white/90 leading-relaxed">{result.ai_analysis}</p>
            </div>
          )}
        </div>

        {/* Brandable Generator */}
        <div className="bg-[#08090A] p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <Brain size={24} weight="duotone" color="#FFD700" />
            <h2 className="font-display text-2xl font-bold tracking-tight">Brandable Name Generator</h2>
          </div>
          <form onSubmit={generate} className="space-y-4 mb-8" data-testid="brandable-form">
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ai, fintech, crypto..." className="input-field" data-testid="brandable-input" />
            <button type="submit" disabled={bbusy} className="btn-primary w-full" data-testid="brandable-submit">
              {bbusy ? "Generating..." : "Generate Brandable Domains"} <ArrowRight size={14} weight="bold" />
            </button>
          </form>
          {brands.length > 0 && (
            <div className="space-y-2 fade-up" data-testid="brandable-results">
              {brands.map((b, i) => (
                <div key={i} className="border border-[#22252A] bg-[#121417] p-4 flex items-center justify-between hover:border-[#0052FF]/40 transition-colors">
                  <div>
                    <div className="font-display font-semibold text-base break-all">{b.domain}</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mt-1">Score {b.score} · {b.demand}</div>
                  </div>
                  <div className="font-mono text-sm text-[#0052FF]">{fmtPrice(b.estimated_price_usd, currency, rates)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Cell = ({ label, value, accent = "white" }) => (
  <div className="bg-[#08090A] p-4">
    <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2">{label}</div>
    <div className="font-display text-xl font-semibold" style={{ color: accent }}>{value}</div>
  </div>
);
