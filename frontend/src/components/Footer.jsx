import React from "react";
import { Link } from "react-router-dom";
import { Globe } from "@phosphor-icons/react";

export default function Footer() {
  return (
    <footer className="border-t border-[#22252A] mt-32" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 bg-[#0052FF] flex items-center justify-center">
              <Globe size={16} weight="bold" color="white" />
            </div>
            <span className="font-display font-bold text-lg">DOMAIN.<span className="text-[#0052FF]">AI</span></span>
          </div>
          <p className="text-sm text-[#8F95A3] max-w-sm leading-relaxed">
            The AI-powered domain marketplace. Buy, sell, and value premium domains with intelligent insights and global currency support.
          </p>
        </div>
        <Col title="Marketplace">
          <FLink to="/marketplace">Browse Domains</FLink>
          <FLink to="/godaddy">Domain Search</FLink>
          <FLink to="/ai-valuation">AI Valuation</FLink>
        </Col>
        <Col title="Sellers">
          <FLink to="/pricing">Pricing</FLink>
          <FLink to="/dashboard">Dashboard</FLink>
          <FLink to="/register">Become a Seller</FLink>
        </Col>
        <Col title="Trust">
          <span className="text-xs text-[#8F95A3]">Escrow Protected</span>
          <span className="text-xs text-[#8F95A3]">KYC Verified</span>
          <span className="text-xs text-[#8F95A3]">Multi-Currency</span>
        </Col>
      </div>
      <div className="border-t border-[#22252A]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex flex-col sm:flex-row gap-3 justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-[#8F95A3]">© 2026 DOMAIN.AI — ALL RIGHTS RESERVED</span>
          <span className="text-xs font-mono uppercase tracking-widest text-[#8F95A3]">Built for global domain trading</span>
        </div>
      </div>
    </footer>
  );
}

const Col = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    <h4 className="text-xs font-mono uppercase tracking-widest text-white">{title}</h4>
    {children}
  </div>
);

const FLink = ({ to, children }) => (
  <Link to={to} className="text-xs text-[#8F95A3] hover:text-white transition-colors">{children}</Link>
);
