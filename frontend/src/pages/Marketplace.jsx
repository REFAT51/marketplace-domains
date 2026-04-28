import React from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import DomainCard from "../components/DomainCard";
import { MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";

const TLDS = ["", ".com", ".ai", ".io", ".co", ".net", ".app", ".xyz"];
const CATS = ["all", "AI", "crypto", "fintech", "saas", "health", "climate", "general"];
const SORTS = [
  { v: "newest", l: "Newest" },
  { v: "price_asc", l: "Price ↑" },
  { v: "price_desc", l: "Price ↓" },
  { v: "score_desc", l: "AI Score ↓" },
];

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState(params.get("q") || "");
  const [tld, setTld] = React.useState(params.get("tld") || "");
  const [cat, setCat] = React.useState(params.get("category") || "all");
  const [sort, setSort] = React.useState(params.get("sort") || "newest");
  const [maxPrice, setMaxPrice] = React.useState(params.get("max_price") || "");

  const load = React.useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tld) p.set("tld", tld);
    if (cat && cat !== "all") p.set("category", cat);
    if (sort) p.set("sort", sort);
    if (maxPrice) p.set("max_price", maxPrice);
    const { data } = await api.get(`/domains?${p.toString()}`);
    setItems(data);
    setLoading(false);
  }, [q, tld, cat, sort, maxPrice]);

  React.useEffect(() => { load(); }, [load]);

  const onSubmit = (e) => {
    e.preventDefault();
    const newP = {};
    if (q) newP.q = q;
    if (tld) newP.tld = tld;
    if (cat !== "all") newP.category = cat;
    if (sort) newP.sort = sort;
    if (maxPrice) newP.max_price = maxPrice;
    setParams(newP);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="mb-10">
        <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">/ Marketplace</div>
        <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tighter mb-2">Browse domains.</h1>
        <p className="text-[#8F95A3] text-base">Filter by TLD, category, and price. AI-scored listings updated in real time.</p>
      </div>

      <form onSubmit={onSubmit} className="border border-[#22252A] bg-[#121417] p-6 mb-8" data-testid="marketplace-filters">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8F95A3]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search domains..." className="input-field pl-10" data-testid="filter-query" />
          </div>
          <select value={tld} onChange={(e) => setTld(e.target.value)} className="input-field md:col-span-2" data-testid="filter-tld">
            {TLDS.map((t) => <option key={t} value={t}>{t || "All TLDs"}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input-field md:col-span-2" data-testid="filter-category">
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max $" type="number" className="input-field md:col-span-2" data-testid="filter-max-price" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field md:col-span-2" data-testid="filter-sort">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
        <div className="mt-4 flex justify-between items-center">
          <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] flex items-center gap-2">
            <FunnelSimple size={14} /> {items.length} results
          </div>
          <button type="submit" className="btn-primary h-10" data-testid="apply-filters">Apply</button>
        </div>
      </form>

      {loading ? (
        <div className="text-center text-[#8F95A3] font-mono text-xs uppercase tracking-widest py-20">Loading domains...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-[#8F95A3] py-20">No domains match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="marketplace-grid">
          {items.map((d, i) => <DomainCard key={d.id} d={d} index={i} />)}
        </div>
      )}
    </div>
  );
}
