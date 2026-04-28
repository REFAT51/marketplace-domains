import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtErr } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Check, ArrowRight, Lightning } from "@phosphor-icons/react";
import { toast } from "sonner";

const PRICING_BG = "https://images.unsplash.com/photo-1775660922989-f0c624413269";

export default function Pricing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [plans, setPlans] = React.useState(null);

  React.useEffect(() => {
    api.get("/pricing/plans").then(({ data }) => setPlans(data));
  }, []);

  const subscribe = async (planKey) => {
    if (!user || !user.id) { nav("/login"); return; }
    if (planKey === "free") { toast.success("You're on the Free plan"); return; }
    try {
      const { data } = await api.post("/payments/checkout", {
        kind: "subscription", plan: planKey, origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) {
      toast.error(fmtErr(e.response?.data?.detail));
    }
  };

  if (!plans) return <div className="min-h-[60vh] flex items-center justify-center text-[#8F95A3]">Loading...</div>;

  return (
    <div>
      <section className="relative border-b border-[#22252A] overflow-hidden">
        <div className="absolute inset-0">
          <img src={PRICING_BG} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08090A]/70 to-[#08090A]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28 text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">/ Pricing</div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter mb-6">Simple, transparent.</h1>
          <p className="text-lg text-[#8F95A3] max-w-xl mx-auto">Start free. Upgrade when you're ready to scale your domain trading business.</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#22252A] border border-[#22252A]">
          <PlanCard
            planKey="free"
            plan={plans.plans.free}
            features={["Up to 5 domain listings", "Basic AI valuation", "Standard listing visibility", "Email support"]}
            onSubscribe={subscribe}
            user={user}
            current={user?.subscription === "free"}
          />
          <PlanCard
            planKey="pro"
            plan={plans.plans.pro}
            features={["Unlimited listings", "Premium AI valuation", "10 featured listings/mo", "Priority placement", "Lower commission tier", "Priority support"]}
            featured
            onSubscribe={subscribe}
            user={user}
            current={user?.subscription === "pro"}
          />
        </div>
        <div className="mt-12 border border-[#22252A] bg-[#121417] p-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-grid">
          <Info label="Commission" value={`${(plans.commission_rate * 100).toFixed(0)}%`} desc="Per domain sale (industry-leading)" />
          <Info label="Featured Boost" value={`$${plans.featured_fee_usd}`} desc="Per listing, 30-day priority placement" />
          <Info label="Escrow" value="Free" desc="Built-in for every transaction" />
        </div>
      </div>
    </div>
  );
}

const PlanCard = ({ planKey, plan, features, featured, onSubscribe, user, current }) => (
  <div className={`bg-[#08090A] p-10 md:p-12 ${featured ? "tracing-border" : ""}`} data-testid={`plan-${planKey}`}>
    <div className="relative">
      {featured && <span className="score-pill bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/40 mb-6 inline-flex items-center gap-1"><Lightning size={10} weight="fill" /> RECOMMENDED</span>}
      <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">{plan.name}</div>
      <div className="font-display text-6xl font-bold mb-2 tracking-tighter">${plan.price_usd}<span className="text-2xl text-[#8F95A3]">/mo</span></div>
      <div className="text-sm text-[#8F95A3] mb-8">{planKey === "free" ? "Forever free." : "Cancel anytime."}</div>
      <button
        onClick={() => onSubscribe(planKey)}
        disabled={current}
        className={featured ? "btn-primary w-full mb-8" : "btn-ghost w-full mb-8"}
        data-testid={`subscribe-${planKey}`}
      >
        {current ? "Current Plan" : (planKey === "free" ? "Get Started" : "Upgrade to Pro")} {!current && <ArrowRight size={14} weight="bold" />}
      </button>
      <ul className="space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm">
            <Check size={16} color="#00E676" weight="bold" className="flex-shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const Info = ({ label, value, desc }) => (
  <div className="bg-[#121417] p-6">
    <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2">{label}</div>
    <div className="font-display text-3xl font-bold mb-1">{value}</div>
    <div className="text-xs text-[#8F95A3]">{desc}</div>
  </div>
);
