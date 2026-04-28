import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtPrice, fmtErr } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Brain, Lightning, ShieldCheck, ArrowRight, Star, Coin, BitcoinLogo } from "@phosphor-icons/react";
import { SiTether } from "react-icons/si";

export default function DomainDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, currency, rates } = useAuth();
  const [d, setD] = React.useState(null);
  const [offerAmount, setOfferAmount] = React.useState("");
  const [showOffer, setShowOffer] = React.useState(false);
  const [showCrypto, setShowCrypto] = React.useState(false);
  const [cryptoCharge, setCryptoCharge] = React.useState(null);
  const [cryptoCurrency, setCryptoCurrency] = React.useState("USDT");
  const [aiAnalysis, setAiAnalysis] = React.useState(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  React.useEffect(() => {
    api.get(`/domains/${id}`).then(({ data }) => setD(data)).catch(() => nav("/marketplace"));
  }, [id, nav]);

  const buyWithStripe = async () => {
    if (!user || !user.id) {
      toast.error("Please sign in to purchase");
      nav("/login");
      return;
    }
    try {
      const { data } = await api.post("/payments/checkout", {
        kind: "domain", domain_id: id, origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(fmtErr(e.response?.data?.detail));
    }
  };

  const buyWithCrypto = async () => {
    if (!user || !user.id) { nav("/login"); return; }
    try {
      const { data } = await api.post("/crypto/checkout", {
        kind: "domain", domain_id: id, currency: cryptoCurrency,
      });
      setCryptoCharge(data);
    } catch (e) {
      toast.error(fmtErr(e.response?.data?.detail));
    }
  };

  const confirmCrypto = async () => {
    try {
      await api.post(`/crypto/confirm/${cryptoCharge.charge_id}`);
      toast.success("Crypto payment confirmed (mocked). Domain in escrow.");
      setShowCrypto(false);
      setCryptoCharge(null);
      nav("/dashboard");
    } catch (e) {
      toast.error(fmtErr(e.response?.data?.detail));
    }
  };

  const submitOffer = async () => {
    if (!user || !user.id) { nav("/login"); return; }
    if (!offerAmount || Number(offerAmount) <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      await api.post("/offers", { domain_id: id, amount_usd: Number(offerAmount) });
      toast.success("Offer submitted");
      setShowOffer(false);
      setOfferAmount("");
    } catch (e) {
      toast.error(fmtErr(e.response?.data?.detail));
    }
  };

  const runAi = async () => {
    setLoadingAi(true);
    try {
      const { data } = await api.post("/ai/valuation", { domain: d.name });
      setAiAnalysis(data);
    } catch {
      toast.error("AI valuation failed");
    } finally {
      setLoadingAi(false);
    }
  };

  if (!d) return <div className="min-h-[60vh] flex items-center justify-center text-[#8F95A3] font-mono text-xs uppercase tracking-widest">Loading...</div>;

  const sold = d.status === "sold" || d.status === "in_escrow";

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-[#22252A] border border-[#22252A] mb-10">
        <div className="lg:col-span-2 bg-[#08090A] p-10 md:p-16">
          <div className="flex items-center gap-2 mb-6">
            <span className="tld-badge">{d.tld}</span>
            <span className="tld-badge">{d.category}</span>
            {d.featured && (
              <span className="score-pill bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 flex items-center gap-1">
                <Star size={10} weight="fill" /> FEATURED
              </span>
            )}
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tighter break-all leading-[0.95] mb-6" data-testid="domain-name-heading">
            <span className="text-white">{d.name.split(".")[0]}</span>
            <span className="text-[#8F95A3] text-3xl md:text-5xl">.{d.name.split(".").slice(1).join(".")}</span>
          </h1>
          <p className="text-base md:text-lg text-[#8F95A3] leading-relaxed max-w-2xl mb-10">
            {d.description || "Premium domain with strong commercial value, suitable for tech startups, AI brands, and innovative ventures."}
          </p>

          <div className="grid grid-cols-3 gap-px bg-[#22252A] border border-[#22252A]">
            <Stat label="AI Score" value={`${d.ai_score}/100`} />
            <Stat label="Length" value={`${d.name.split(".")[0].length}`} />
            <Stat label="AI Demand" value={d.ai_demand || "Medium"} color={d.ai_demand === "High" ? "#00E676" : "#FFD700"} />
          </div>
        </div>
        <div className="bg-[#121417] p-10 flex flex-col">
          <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] mb-2">Asking Price</div>
          <div className="font-display text-5xl font-bold mb-1" data-testid="detail-price">{fmtPrice(d.price_usd, currency, rates)}</div>
          <div className="text-sm text-[#8F95A3] font-mono mb-8">≈ ${Number(d.price_usd).toLocaleString()} USD</div>

          {sold ? (
            <div className="border border-[#FF3B30]/40 bg-[#FF3B30]/10 p-4 text-sm text-[#FF3B30] font-mono uppercase tracking-widest">
              {d.status === "in_escrow" ? "In Escrow — Pending Transfer" : "Sold"}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button onClick={buyWithStripe} className="btn-primary w-full" data-testid="buy-now-btn">
                <Lightning size={14} weight="fill" /> Buy Now (Stripe)
              </button>
              <button onClick={() => setShowCrypto(true)} className="btn-ghost w-full" data-testid="buy-crypto-btn">
                <BitcoinLogo size={14} /> Pay with Crypto
              </button>
              <button onClick={() => setShowOffer(true)} className="btn-ghost w-full" data-testid="make-offer-btn">
                <Coin size={14} /> Make an Offer
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-[#22252A] flex items-start gap-3 text-xs font-mono uppercase tracking-widest text-[#8F95A3]">
            <ShieldCheck size={20} color="#00E676" weight="duotone" className="flex-shrink-0" />
            <span>Escrow protected. Funds held until secure transfer is confirmed.</span>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="border border-[#22252A] bg-[#121417] p-8 md:p-12 mb-10" data-testid="ai-analysis-section">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Brain size={28} weight="duotone" color="#FFD700" />
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">AI Insight</h2>
          </div>
          <button onClick={runAi} disabled={loadingAi} className="btn-ghost h-10" data-testid="run-ai-btn">
            {loadingAi ? "Analyzing..." : "Run Deep Analysis"} <ArrowRight size={12} />
          </button>
        </div>
        {aiAnalysis ? (
          <div>
            <p className="text-base text-white/90 leading-relaxed mb-6">{aiAnalysis.ai_analysis}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#22252A] border border-[#22252A]">
              <Stat label="AI Estimate" value={fmtPrice(aiAnalysis.estimated_price_usd, currency, rates)} />
              <Stat label="Score" value={`${aiAnalysis.score}/100`} />
              <Stat label="Demand" value={aiAnalysis.demand} />
              <Stat label="Brandable" value={aiAnalysis.is_brandable ? "Yes" : "No"} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#8F95A3]">Run AI analysis to get a deep market evaluation, comparable sales, and brandability score.</p>
        )}
      </div>

      {/* Offer Modal */}
      {showOffer && (
        <Modal title="Make an Offer" onClose={() => setShowOffer(false)}>
          <input value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} type="number" placeholder="Amount in USD" className="input-field mb-4" data-testid="offer-amount-input" />
          <div className="flex gap-3">
            <button onClick={() => setShowOffer(false)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={submitOffer} className="btn-primary flex-1" data-testid="submit-offer-btn">Submit Offer</button>
          </div>
        </Modal>
      )}

      {/* Crypto Modal */}
      {showCrypto && (
        <Modal title="Pay with Crypto" onClose={() => { setShowCrypto(false); setCryptoCharge(null); }}>
          {!cryptoCharge ? (
            <>
              <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] mb-3">Select Currency</div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button onClick={() => setCryptoCurrency("USDT")} className={`h-12 border ${cryptoCurrency === "USDT" ? "border-[#0052FF] bg-[#0052FF]/10" : "border-[#22252A]"} flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest`}>
                  <SiTether color="#26A17B" /> USDT
                </button>
                <button onClick={() => setCryptoCurrency("BTC")} className={`h-12 border ${cryptoCurrency === "BTC" ? "border-[#0052FF] bg-[#0052FF]/10" : "border-[#22252A]"} flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest`}>
                  <BitcoinLogo color="#F7931A" weight="fill" /> BTC
                </button>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#FFD700] mb-3">⚠ MOCKED — Coinbase Commerce key required for real crypto</div>
              <button onClick={buyWithCrypto} className="btn-primary w-full" data-testid="generate-crypto-charge-btn">Generate Payment Address</button>
            </>
          ) : (
            <>
              <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] mb-2">Send {cryptoCharge.crypto_amount} {cryptoCharge.currency} to:</div>
              <div className="bg-[#08090A] border border-[#22252A] p-4 font-mono text-xs break-all mb-6">{cryptoCharge.address}</div>
              <button onClick={confirmCrypto} className="btn-primary w-full" data-testid="confirm-crypto-btn">I've Sent Payment (Mock Confirm)</button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

const Stat = ({ label, value, color = "white" }) => (
  <div className="bg-[#08090A] p-4">
    <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2">{label}</div>
    <div className="font-display text-xl font-semibold" style={{ color }}>{value}</div>
  </div>
);

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={onClose}>
    <div className="bg-[#121417] border border-[#22252A] p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
      <h3 className="font-display text-2xl font-bold mb-6">{title}</h3>
      {children}
    </div>
  </div>
);
