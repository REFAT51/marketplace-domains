import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Globe, Wallet, CaretDown, SignOut, UserCircle, Shield, Lightning } from "@phosphor-icons/react";

const CURRENCIES = ["USD", "EUR", "EGP", "USDT", "BTC"];

export default function Header() {
  const { user, logout, currency, changeCurrency } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [curOpen, setCurOpen] = React.useState(false);

  const navLinkCls = ({ isActive }) =>
    `text-xs uppercase tracking-widest font-mono px-3 py-2 transition-colors duration-200 ${
      isActive ? "text-white" : "text-[#8F95A3] hover:text-white"
    }`;

  return (
    <header
      className="sticky top-0 z-50 border-b border-[#22252A]"
      style={{ background: "rgba(8,9,10,0.85)", backdropFilter: "blur(20px)" }}
      data-testid="site-header"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5" data-testid="logo-link">
          <div className="w-8 h-8 bg-[#0052FF] flex items-center justify-center" style={{ boxShadow: "0 0 20px rgba(0,82,255,0.5)" }}>
            <Globe size={18} weight="bold" color="white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">DOMAIN.<span className="text-[#0052FF]">AI</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/marketplace" className={navLinkCls} data-testid="nav-marketplace">Marketplace</NavLink>
          <NavLink to="/ai-valuation" className={navLinkCls} data-testid="nav-valuation">AI Valuation</NavLink>
          <NavLink to="/pricing" className={navLinkCls} data-testid="nav-pricing">Pricing</NavLink>
          <NavLink to="/godaddy" className={navLinkCls} data-testid="nav-godaddy">Domain Search</NavLink>
        </nav>

        <div className="flex items-center gap-3">
          {/* Currency selector */}
          <div className="relative">
            <button
              onClick={() => setCurOpen(!curOpen)}
              className="font-mono text-xs uppercase tracking-widest px-3 h-9 border border-[#22252A] hover:border-[#404552] flex items-center gap-2"
              data-testid="currency-selector"
            >
              {currency} <CaretDown size={12} />
            </button>
            {curOpen && (
              <div className="absolute right-0 top-11 w-32 bg-[#121417] border border-[#22252A] z-50">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { changeCurrency(c); setCurOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-mono uppercase tracking-widest hover:bg-[#1A1C20] ${currency === c ? "text-white" : "text-[#8F95A3]"}`}
                    data-testid={`currency-option-${c}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user && user.id ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="h-9 px-3 border border-[#22252A] hover:border-[#404552] flex items-center gap-2"
                data-testid="user-menu-button"
              >
                <div className="w-6 h-6 bg-[#0052FF]/20 border border-[#0052FF]/40 flex items-center justify-center">
                  <UserCircle size={14} color="#0052FF" weight="bold" />
                </div>
                <span className="font-mono text-xs uppercase tracking-widest hidden sm:block">{user.name?.split(" ")[0] || user.email.split("@")[0]}</span>
                <CaretDown size={12} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 w-56 bg-[#121417] border border-[#22252A] z-50" onMouseLeave={() => setMenuOpen(false)}>
                  <div className="px-4 py-3 border-b border-[#22252A]">
                    <div className="text-xs text-[#8F95A3] font-mono uppercase tracking-wider">{user.role}</div>
                    <div className="text-sm truncate">{user.email}</div>
                  </div>
                  <Link to="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1A1C20]" data-testid="menu-dashboard">
                    <Wallet size={16} /> Dashboard
                  </Link>
                  {user.role === "admin" && (
                    <Link to="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1A1C20]" data-testid="menu-admin">
                      <Shield size={16} /> Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={async () => { await logout(); setMenuOpen(false); nav("/"); }}
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#1A1C20] text-[#FF3B30]"
                    data-testid="menu-logout"
                  >
                    <SignOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : user === false ? (
            <>
              <Link to="/login" className="btn-ghost h-9 hidden sm:flex" data-testid="login-link">Sign In</Link>
              <Link to="/register" className="btn-primary h-9" data-testid="register-link">
                <Lightning size={14} weight="fill" /> Start Free
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
