import React from "react";
import { api, fmtErr } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Users, Shield, Coin, ChartBar, Check, X } from "@phosphor-icons/react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

const TABS = [
  { v: "stats", l: "Analytics" },
  { v: "users", l: "Users" },
  { v: "domains", l: "Domain Approvals" },
  { v: "kyc", l: "KYC" },
];

export default function Admin() {
  const [tab, setTab] = React.useState("stats");
  const [stats, setStats] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [pending, setPending] = React.useState([]);
  const [kycList, setKycList] = React.useState([]);

  const reload = React.useCallback(async () => {
    const [s, u, p, k] = await Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/users"),
      api.get("/admin/domains/pending"),
      api.get("/admin/kyc"),
    ]);
    setStats(s.data); setUsers(u.data); setPending(p.data); setKycList(k.data);
  }, []);

  React.useEffect(() => { reload(); }, [reload]);

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
      <div className="text-xs font-mono uppercase tracking-widest text-[#FFD700] mb-3 flex items-center gap-2"><Shield size={14} weight="fill" /> / Admin Panel</div>
      <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tighter mb-10">Command Center</h1>

      <div className="border-b border-[#22252A] mb-8 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
                  className={`px-5 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors ${
                    tab === t.v ? "border-[#0052FF] text-white" : "border-transparent text-[#8F95A3] hover:text-white"
                  }`}
                  data-testid={`admin-tab-${t.v}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "stats" && stats && <Stats data={stats} />}
      {tab === "users" && <UsersTab users={users} />}
      {tab === "domains" && <DomainsTab pending={pending} reload={reload} />}
      {tab === "kyc" && <KycTab list={kycList} reload={reload} />}
    </div>
  );
}

const Stats = ({ data }) => (
  <div className="space-y-8">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#22252A] border border-[#22252A]">
      <Stat icon={Users} label="Total Users" value={data.users} />
      <Stat icon={ChartBar} label="Total Domains" value={data.domains} />
      <Stat icon={Coin} label="Revenue" value={`$${data.total_revenue_usd}`} accent="#00E676" />
      <Stat icon={Shield} label="Commission" value={`$${data.total_commission_usd}`} accent="#FFD700" />
    </div>
    <div className="border border-[#22252A] bg-[#121417] p-6">
      <h3 className="font-display text-lg font-bold mb-6">Last 7 Days Revenue</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.daily_revenue}>
          <CartesianGrid stroke="#22252A" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" stroke="#8F95A3" fontSize={11} tickFormatter={(d) => d.slice(5)} />
          <YAxis stroke="#8F95A3" fontSize={11} />
          <Tooltip contentStyle={{ background: "#121417", border: "1px solid #22252A", color: "white" }} />
          <Line type="monotone" dataKey="revenue" stroke="#0052FF" strokeWidth={2} dot={{ fill: "#0052FF", r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#22252A] border border-[#22252A]">
      <Stat label="Sold Domains" value={data.sold} />
      <Stat label="In Escrow" value={data.in_escrow} />
      <Stat label="Pending KYC" value={data.pending_kyc} />
    </div>
  </div>
);

const Stat = ({ icon: Icon, label, value, accent = "white" }) => (
  <div className="bg-[#08090A] p-6">
    {Icon && <Icon size={20} weight="duotone" color="#0052FF" className="mb-3" />}
    <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3] mb-2">{label}</div>
    <div className="font-display text-3xl font-bold" style={{ color: accent }}>{value}</div>
  </div>
);

const UsersTab = ({ users }) => (
  <div className="border border-[#22252A] overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#22252A] text-xs font-mono uppercase tracking-widest text-[#8F95A3]">
          <th className="text-left p-4">Email</th>
          <th className="text-left p-4">Name</th>
          <th className="text-left p-4">Role</th>
          <th className="text-left p-4">Plan</th>
          <th className="text-left p-4">KYC</th>
          <th className="text-left p-4">Wallet</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-[#22252A] last:border-b-0">
            <td className="p-4 font-mono text-xs">{u.email}</td>
            <td className="p-4">{u.name}</td>
            <td className="p-4"><span className="tld-badge">{u.role}</span></td>
            <td className="p-4"><span className="tld-badge">{u.subscription || "free"}</span></td>
            <td className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: u.kyc_status === "approved" ? "#00E676" : "#8F95A3" }}>{u.kyc_status || "none"}</td>
            <td className="p-4 font-mono">${(u.wallet_balance_usd || 0).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DomainsTab = ({ pending, reload }) => {
  const act = async (domain_id, action) => {
    try { await api.post("/admin/domains/approve", { domain_id, action }); toast.success(`Domain ${action}d`); reload(); }
    catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };
  if (pending.length === 0) return <div className="text-[#8F95A3] py-16 text-center border border-dashed border-[#22252A]">No pending domains</div>;
  return (
    <div className="space-y-3">
      {pending.map((d) => (
        <div key={d.id} className="border border-[#22252A] bg-[#121417] p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div>
            <div className="font-display font-semibold">{d.name}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#8F95A3]">{d.seller_name}</div>
          </div>
          <div className="font-mono">${d.price_usd}</div>
          <div><span className="tld-badge">{d.category}</span> · score {d.ai_score}</div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => act(d.id, "approve")} className="h-9 px-4 bg-[#00E676] text-black font-mono text-xs uppercase tracking-widest flex items-center gap-1.5" data-testid={`approve-${d.name}`}>
              <Check size={14} weight="bold" /> Approve
            </button>
            <button onClick={() => act(d.id, "reject")} className="h-9 px-4 border border-[#FF3B30] text-[#FF3B30] font-mono text-xs uppercase tracking-widest flex items-center gap-1.5" data-testid={`reject-${d.name}`}>
              <X size={14} weight="bold" /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const KycTab = ({ list, reload }) => {
  const approve = async (id) => {
    try { await api.post(`/admin/kyc/${id}/approve`); toast.success("KYC approved"); reload(); }
    catch (e) { toast.error(fmtErr(e.response?.data?.detail)); }
  };
  if (list.length === 0) return <div className="text-[#8F95A3] py-16 text-center border border-dashed border-[#22252A]">No KYC submissions</div>;
  return (
    <div className="space-y-3">
      {list.map((k) => (
        <div key={k.id} className="border border-[#22252A] bg-[#121417] p-5 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <div><div className="font-display font-semibold">{k.full_name}</div><div className="text-[10px] font-mono text-[#8F95A3]">{k.country}</div></div>
          <div className="text-xs font-mono">{k.document_type}</div>
          <div className="font-mono text-xs">{k.id_number}</div>
          <div><span className="tld-badge" style={{ color: k.status === "approved" ? "#00E676" : "#FFD700" }}>{k.status}</span></div>
          <div className="text-right">
            {k.status === "pending" && (
              <button onClick={() => approve(k.id)} className="btn-primary h-9" data-testid={`kyc-approve-${k.id}`}><Check size={14} /> Approve</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
