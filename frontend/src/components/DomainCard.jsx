import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { fmtPrice } from "../lib/api";
import { TrendUp, Lightning, Star } from "@phosphor-icons/react";

export default function DomainCard({ d, index = 0 }) {
  const { currency, rates } = useAuth();
  const score = d.ai_score || 0;
  const scoreColor = score >= 75 ? "#00E676" : score >= 50 ? "#FFD700" : "#8F95A3";

  return (
    <Link
      to={`/domain/${d.id}`}
      className="block group fade-up"
      style={{ animationDelay: `${(index % 6) * 60}ms` }}
      data-testid={`domain-card-${d.name}`}
    >
      <div className="bg-[#121417] border border-[#22252A] hover:border-[#0052FF]/60 transition-all duration-300 p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <span className="tld-badge" data-testid={`domain-tld-${d.name}`}>{d.tld}</span>
          <div className="flex items-center gap-1.5">
            {d.featured && (
              <span className="score-pill bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 flex items-center gap-1">
                <Star size={10} weight="fill" /> FEATURED
              </span>
            )}
            <span className="score-pill flex items-center gap-1" style={{ color: scoreColor, borderLeft: `2px solid ${scoreColor}` }}>
              <Lightning size={10} weight="fill" /> {score}
            </span>
          </div>
        </div>

        <div className="font-display text-xl md:text-2xl font-semibold mb-1 break-all leading-tight">
          <span className="text-white">{d.name.split(".")[0]}</span>
          <span className="text-[#8F95A3] text-base">.{d.name.split(".").slice(1).join(".")}</span>
        </div>

        <p className="text-sm text-[#8F95A3] mb-6 line-clamp-2 flex-grow">{d.description || "Premium domain available for instant transfer."}</p>

        <div className="border-t border-[#22252A] pt-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] mb-1">Price</div>
            <div className="font-display text-xl font-bold text-white" data-testid={`domain-price-${d.name}`}>
              {fmtPrice(d.price_usd, currency, rates)}
            </div>
          </div>
          {d.ai_demand && (
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-1 flex items-center gap-1 justify-end">
                <TrendUp size={10} /> Demand
              </div>
              <div className="text-xs font-mono uppercase tracking-widest font-semibold" style={{ color: d.ai_demand === "High" ? "#00E676" : d.ai_demand === "Medium" ? "#FFD700" : "#8F95A3" }}>
                {d.ai_demand}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
