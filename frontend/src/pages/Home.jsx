import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import DomainCard from "../components/DomainCard";
import { MagnifyingGlass, ArrowRight, TrendUp, Brain, ShieldCheck, Lightning, Globe, Coin } from "@phosphor-icons/react";

const HERO_BG = "https://images.pexels.com/photos/30547584/pexels-photo-30547584.jpeg";

export default function Home() {
  const [q, setQ] = React.useState("");
  const [featured, setFeatured] = React.useState([]);
  const [trends, setTrends] = React.useState([]);
  const nav = useNavigate();

  React.useEffect(() => {
    api.get("/domains/featured?limit=6").then(({ data }) => setFeatured(data));
    api.get("/ai/trends").then(({ data }) => setTrends(data.trends));
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    if (q.trim()) nav(`/marketplace?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#22252A]" data-testid="hero-section">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090A]/80 via-[#08090A]/90 to-[#08090A]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-24 md:pt-36 pb-20 md:pb-28">
          <div className="flex items-center gap-2 mb-6 fade-up">
            <span className="h-1.5 w-1.5 bg-[#00E676] rounded-full animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#8F95A3]">AI Engine Online · 12,847 domains analyzed</span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[0.95] mb-6 max-w-4xl tracking-tighter fade-up" style={{ animationDelay: "100ms" }}>
            The intelligent <span className="text-[#0052FF]">domain</span><br />
            marketplace.
          </h1>
          <p className="text-lg md:text-xl text-[#8F95A3] max-w-2xl mb-12 leading-relaxed fade-up" style={{ animationDelay: "200ms" }}>
            Buy, sell, and value premium domains with AI-powered insights. Multi-currency support. Escrow protected. Built for serious domain investors.
          </p>

          <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3 max-w-2xl mb-12 fade-up" style={{ animationDelay: "300ms" }} data-testid="hero-search-form">
            <div className="relative flex-grow">
              <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8F95A3]" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search 'ai', 'crypto', 'nexpay.com'..."
                className="input-field pl-11 h-14 text-base"
                data-testid="hero-search-input"
              />
            </div>
            <button type="submit" className="btn-primary h-14" data-testid="hero-search-btn">
              Search <ArrowRight size={14} weight="bold" />
            </button>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#22252A] border border-[#22252A] fade-up" style={{ animationDelay: "400ms" }}>
            {[
              { v: "12,847", k: "Domains Listed" },
              { v: "$4.2M", k: "Volume Traded" },
              { v: "5", k: "Currencies" },
              { v: "99.9%", k: "Escrow Success" },
            ].map((s) => (
              <div key={s.k} className="bg-[#08090A] p-6">
                <div className="font-display text-3xl md:text-4xl font-bold mb-1">{s.v}</div>
                <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3]">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32" data-testid="featured-section">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">/ Premium Listings</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tighter">Featured domains</h2>
          </div>
          <Link to="/marketplace" className="btn-ghost" data-testid="view-all-btn">View All <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((d, i) => <DomainCard key={d.id} d={d} index={i} />)}
        </div>
      </section>

      {/* Trends */}
      <section className="border-y border-[#22252A] bg-[#0A0B0D] bg-grid">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-28">
          <div className="text-xs font-mono uppercase tracking-widest text-[#FFD700] mb-3">/ AI Trend Detection</div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tighter mb-12">Trending niches.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-px bg-[#22252A] border border-[#22252A]">
            {trends.map((t, i) => (
              <div key={t.niche} className="bg-[#08090A] p-6 fade-up" style={{ animationDelay: `${i * 80}ms` }} data-testid={`trend-${t.niche}`}>
                <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] mb-2">{t.niche}</div>
                <div className="font-display text-3xl font-bold mb-3">{t.score}<span className="text-[#8F95A3] text-xl">/100</span></div>
                <div className="flex items-center gap-1.5 text-[#00E676] text-sm font-mono mb-4">
                  <TrendUp size={14} weight="fill" /> {t.growth}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.keywords.map((k) => <span key={k} className="tld-badge">{k}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-24 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">/ Why DOMAIN.AI</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tighter">A platform built for serious traders.</h2>
          </div>
          <p className="text-base text-[#8F95A3] leading-relaxed self-end">
            From AI-powered valuations to global currency support and battle-tested escrow — every feature is designed to give you the unfair advantage in domain trading.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#22252A] border border-[#22252A]">
          <Feat icon={Brain} label="AI Valuation" desc="Score, estimate, and analyze any domain instantly with GPT-powered intelligence." />
          <Feat icon={Globe} label="GoDaddy Sync" desc="Search, suggest, and import domains directly from the world's largest registrar." />
          <Feat icon={ShieldCheck} label="Secure Escrow" desc="Funds locked safely until domain transfer is confirmed by the buyer." />
          <Feat icon={Coin} label="Multi-Currency" desc="USD, EUR, EGP, USDT, and BTC. Buy and sell in your local currency." />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">
        <div className="border border-[#22252A] bg-[#121417] p-12 md:p-20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-20" style={{ background: "radial-gradient(circle at top right, #0052FF, transparent 70%)" }} />
          <div className="relative max-w-2xl">
            <Lightning size={32} weight="fill" color="#FFD700" className="mb-6" />
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tighter mb-6">
              Ready to flip your first domain?
            </h2>
            <p className="text-base text-[#8F95A3] mb-10 leading-relaxed">
              Join the AI-powered marketplace. Start free, upgrade to Pro for unlimited listings and priority featured placement.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary" data-testid="cta-register">Get Started Free <ArrowRight size={14} weight="bold" /></Link>
              <Link to="/pricing" className="btn-ghost" data-testid="cta-pricing">View Pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const Feat = ({ icon: Icon, label, desc }) => (
  <div className="bg-[#08090A] p-8">
    <Icon size={24} weight="duotone" color="#0052FF" className="mb-4" />
    <h3 className="font-display text-lg font-semibold mb-2">{label}</h3>
    <p className="text-sm text-[#8F95A3] leading-relaxed">{desc}</p>
  </div>
);
