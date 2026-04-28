import React from "react";
import { Link } from "react-router-dom";
import { api, fmtPrice, fmtErr } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Plus, Wallet, Trash, Star, ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";

const TABS = [
  { v: "listings", l: "My Listings" },
  { v: "wallet", l: "Wallet" },
  { v: "escrow", l: "Escrow" },
  { v: "offers", l: "Offers" },
  { v: "kyc", l: "KYC" },
];

export default function Dashboard() {
  const { user, currency, rates, refresh } = useAuth();
  const [tab, setTab] = React.useState("listings");
  const [domains, setDomains] = React.useState([]);
  const [walletData, setWalletData] = React.useState(null);
  const [escrow, setEscrow] = React.useState([]);
  const [offers, setOffers] = React.useState({ received: [], sent: [] });
  const [kyc, setKyc] = React.useState({ status: "none" });

  const loadAll = React.useCallback(async () => {
    try {
      const [d, w, e, o, k] = await Promise.all([
        api.get("/domains/mine/list"),
        api.get("/wallet"),
        api.get("/escrow/mine"),
        api.get("/offers/mine"),
        api.get("/kyc/status"),
      ]);
      setDomains(d.data);
      setWalletData(w.data);
      setEscrow(e.data);
      setOffers(o.data);
      setKyc(k.data);
    } catch (err) { /* ignore */ }
  }, []);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-[#0052FF] mb-3">/ Dashboard</div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tighter">{user.name || user.email}</h1>
          <div className="mt-2 flex items-center gap-3 text-xs font-mono uppercase tracking-widest">
            <span className="tld-badge">{user.role}</span>
            <span className="tld-badge">{user.subscription} plan</span>
            <span className="tld-badge" style={{ color: user.kyc_status === "approved" ? "#00E676" : "#8F95A3" }}>KYC: {user.kyc_status || "none"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3]">Wallet Balance</div>
            <div className="font-display text-2xl font-bold">{fmtPrice(user.wallet_balance_usd || 0, currency, rates)}</div>
          </div>
        </div>
      </div>

      <div className="border-b border-[#22252A] mb-8 flex gap-1 overflow-x-auto" data-testid="dashboard-tabs">
        {TABS.map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
                  className={`px-5 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
                    tab === t.v ? "border-[#0052FF] text-white" : "border-transparent text-[#8F95A3] hover:text-white"
                  }`}
                  data-testid={`tab-${t.v}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "listings" && <Listings domains={domains} reload={loadAll} currency={currency} rates={rates} canList={user.role === "seller" || user.role === "admin"} />}
      {tab === "wallet" && walletData && <WalletTab data={walletData} reload={() => { loadAll(); refresh(); }} currency={currency} rates={rates} />}
      {tab === "escrow" && <EscrowTab items={escrow} reload={loadAll} userId={user.id} />}
      {tab === "offers" && <OffersTab data={offers} />}
      {tab === "kyc" && <KYCTab data={kyc} reload={loadAll} />}
    </div>
  );
}

// === Listings ===
const Listings = ({ domains, reload, currency, rates, canList }) => {
  const [show, setShow] = React.useState(false);
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [cat, setCat] = React.useState("general");

  if (!canList) return <div className="text-[#8F95A3] text-sm">Sellers only. <Link to="/register" className="text-[#0052FF]">Become a seller →</Link></div>;

  const create = async () => {
    try {
      await api.post("/domains", { name: name.toLowerCase(), price_usd: Number(price), description: desc, category: cat });
      toast.success("Domain listed");
      setShow(false); setName(""); setPrice(""); setDesc("");
      reload();
    } catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this listing?")) return;
    try { await api.delete(`/domains/${id}`); toast.success("Deleted"); reload(); } catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };

  const feature = async (id) => {
    try {
      const { data } = await api.post("/payments/checkout", { kind: "featured", domain_id: id, origin_url: window.location.origin });
      window.location.href = data.url;
    } catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button onClick={() => setShow(true)} className="btn-primary" data-testid="add-domain-btn"><Plus size={14} weight="bold" /> List Domain</button>
      </div>
      {domains.length === 0 ? (
        <div className="text-[#8F95A3] py-16 text-center border border-dashed border-[#22252A]">No listings yet. Click "List Domain" above.</div>
      ) : (
        <div className="border border-[#22252A]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#22252A] text-xs font-mono uppercase tracking-widest text-[#8F95A3]">
                <th className="text-left p-4">Domain</th>
                <th className="text-left p-4">Price</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">AI Score</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id} className="border-b border-[#22252A] last:border-b-0 text-sm" data-testid={`my-listing-${d.name}`}>
                  <td className="p-4 font-display font-semibold">{d.name} {d.featured && <Star size={12} weight="fill" color="#FFD700" className="inline ml-1" />}</td>
                  <td className="p-4 font-mono">{fmtPrice(d.price_usd, currency, rates)}</td>
                  <td className="p-4"><span className="tld-badge">{d.status}</span></td>
                  <td className="p-4 font-mono">{d.ai_score}</td>
                  <td className="p-4 text-right">
                    {!d.featured && d.status !== "sold" && (
                      <button onClick={() => feature(d.id)} className="text-xs font-mono uppercase tracking-widest text-[#FFD700] hover:underline mr-4" data-testid={`feature-btn-${d.name}`}>Feature</button>
                    )}
                    <button onClick={() => remove(d.id)} className="text-[#FF3B30] hover:opacity-80" data-testid={`delete-btn-${d.name}`}><Trash size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setShow(false)}>
          <div className="bg-[#121417] border border-[#22252A] p-8 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-2xl font-bold mb-6">List Domain</h3>
            <div className="space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com" className="input-field" data-testid="new-domain-name" />
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price USD" className="input-field" data-testid="new-domain-price" />
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="input-field">
                {["general", "AI", "crypto", "fintech", "saas", "health", "climate"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="input-field" rows={3} style={{ height: "auto" }} />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShow(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={create} className="btn-primary flex-1" data-testid="submit-new-domain">Create Listing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// === Wallet ===
const WalletTab = ({ data, reload, currency, rates }) => {
  const [amount, setAmount] = React.useState("");

  const deposit = async () => {
    if (!amount || Number(amount) < 5) { toast.error("Min $5"); return; }
    try {
      const { data } = await api.post("/payments/checkout", {
        kind: "wallet_deposit", amount_usd: Number(amount), origin_url: window.location.origin,
      });
      window.location.href = data.url;
    } catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };

  const withdraw = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Invalid amount"); return; }
    try {
      await api.post("/wallet/withdraw", { amount_usd: Number(amount), method: "bank" });
      toast.success("Withdrawal request submitted");
      setAmount("");
      reload();
    } catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-[#22252A] border border-[#22252A]">
      <div className="bg-[#08090A] p-8 lg:col-span-1">
        <div className="text-xs font-mono uppercase tracking-widest text-[#8F95A3] mb-2">Balance</div>
        <div className="font-display text-5xl font-bold mb-8" data-testid="wallet-balance">{fmtPrice(data.balance_usd, currency, rates)}</div>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount USD" className="input-field mb-3" data-testid="wallet-amount" />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={deposit} className="btn-primary" data-testid="deposit-btn">Deposit</button>
          <button onClick={withdraw} className="btn-ghost" data-testid="withdraw-btn">Withdraw</button>
        </div>
      </div>
      <div className="bg-[#08090A] p-8 lg:col-span-2">
        <h3 className="font-display text-xl font-bold mb-6">Transaction History</h3>
        {data.transactions.length === 0 ? (
          <div className="text-sm text-[#8F95A3]">No transactions yet</div>
        ) : (
          <div className="space-y-2">
            {data.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-[#22252A] py-3" data-testid={`tx-${t.id}`}>
                <div>
                  <div className="font-display font-semibold text-sm">{t.description}</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3]">{t.type} · {new Date(t.created_at).toLocaleDateString()}</div>
                </div>
                <div className={`font-mono font-semibold ${t.amount_usd >= 0 ? "text-[#00E676]" : "text-[#FF3B30]"}`}>
                  {t.amount_usd >= 0 ? "+" : ""}{fmtPrice(Math.abs(t.amount_usd), currency, rates)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// === Escrow ===
const EscrowTab = ({ items, reload, userId }) => {
  const confirm = async (id) => {
    try { await api.post(`/escrow/${id}/confirm-transfer`); toast.success("Transfer confirmed"); reload(); }
    catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };
  if (items.length === 0) return <div className="text-[#8F95A3] py-16 text-center border border-dashed border-[#22252A]">No active escrow transactions</div>;
  return (
    <div className="space-y-3">
      {items.map((e) => (
        <div key={e.id} className="border border-[#22252A] bg-[#121417] p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center" data-testid={`escrow-${e.id}`}>
          <div>
            <div className="font-display text-lg font-semibold">{e.domain_name}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mt-1">{e.payment_method || "Stripe"} · {e.currency || "USD"}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3]">Amount</div>
            <div className="font-mono">${e.amount_usd}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3]">Status</div>
            <div className="text-xs font-mono uppercase tracking-widest" style={{ color: e.status === "completed" ? "#00E676" : "#FFD700" }}>{e.status}</div>
          </div>
          <div className="text-right">
            {e.status === "pending_transfer" && e.buyer_id === userId && (
              <button onClick={() => confirm(e.id)} className="btn-primary h-10" data-testid={`confirm-escrow-${e.id}`}>
                <ShieldCheck size={14} /> Confirm Transfer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// === Offers ===
const OffersTab = ({ data }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#22252A] border border-[#22252A]">
    <div className="bg-[#08090A] p-6">
      <h3 className="font-display text-xl font-bold mb-4">Received</h3>
      {data.received.length === 0 ? <div className="text-sm text-[#8F95A3]">No offers received</div> : (
        <div className="space-y-2">
          {data.received.map((o) => <OfferRow key={o.id} o={o} />)}
        </div>
      )}
    </div>
    <div className="bg-[#08090A] p-6">
      <h3 className="font-display text-xl font-bold mb-4">Sent</h3>
      {data.sent.length === 0 ? <div className="text-sm text-[#8F95A3]">No offers sent</div> : (
        <div className="space-y-2">
          {data.sent.map((o) => <OfferRow key={o.id} o={o} />)}
        </div>
      )}
    </div>
  </div>
);
const OfferRow = ({ o }) => (
  <div className="border border-[#22252A] p-4 flex justify-between items-center">
    <div>
      <div className="font-display font-semibold">{o.domain_name}</div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3]">{o.status}</div>
    </div>
    <div className="font-mono">${o.amount_usd}</div>
  </div>
);

// === KYC ===
const KYCTab = ({ data, reload }) => {
  const [name, setName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [idn, setIdn] = React.useState("");
  const [docType, setDocType] = React.useState("passport");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/kyc/submit", { full_name: name, country, id_number: idn, document_type: docType });
      toast.success("KYC submitted for review");
      reload();
    } catch (err) { toast.error(fmtErr(err.response?.data?.detail)); }
  };

  return (
    <div className="max-w-xl">
      <div className="border border-[#22252A] bg-[#121417] p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-bold">KYC Verification</h3>
          <span className="tld-badge" style={{ color: data.status === "approved" ? "#00E676" : "#FFD700" }}>{data.status}</span>
        </div>
        {data.status === "approved" ? (
          <div className="text-sm text-[#00E676] flex items-center gap-2"><ShieldCheck size={16} weight="fill" /> Your account is fully verified.</div>
        ) : data.status === "pending" ? (
          <div className="text-sm text-[#FFD700]">Submission pending admin review.</div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full Legal Name" className="input-field" data-testid="kyc-name" />
            <input value={country} onChange={(e) => setCountry(e.target.value)} required placeholder="Country" className="input-field" data-testid="kyc-country" />
            <input value={idn} onChange={(e) => setIdn(e.target.value)} required placeholder="ID Number" className="input-field" data-testid="kyc-id" />
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-field">
              <option value="passport">Passport</option>
              <option value="national_id">National ID</option>
              <option value="driver_license">Driver License</option>
            </select>
            <button type="submit" className="btn-primary w-full" data-testid="kyc-submit">Submit for Review <ArrowRight size={14} weight="bold" /></button>
          </form>
        )}
      </div>
    </div>
  );
};
