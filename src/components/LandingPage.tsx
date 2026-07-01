import React from 'react';
import { motion } from 'motion/react';
import { SecureFinLogo } from './SecureFinLogo';
import { Shield, ArrowRight, TrendingUp, Key, Cpu, Users, Layers, ExternalLink } from 'lucide-react';
import { playClickSound } from '../utils/audio';

interface LandingPageProps {
  onStartLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartLogin }) => {
  const handleAction = () => {
    playClickSound();
    onStartLogin();
  };

  const stats = [
    { label: 'Active Liquidity Under Management', value: '$12.4B+' },
    { label: 'Multi-Signature Secure Vaults', value: '45,000+' },
    { label: 'Average Settlement Time', value: '< 2.4s' },
    { label: 'System Uptime Agreement', value: '99.999%' }
  ];

  const features = [
    {
      icon: <Shield className="h-6 w-6 text-brand-primary" />,
      title: 'Military-Grade Shield Vaults',
      description: 'Your assets are protected by advanced cryptographic key fragmentation, distributed consensus gates, and zero-knowledge verification frameworks.'
    },
    {
      icon: <Cpu className="h-6 w-6 text-emerald-600" />,
      title: 'Autonomous Security Agent',
      description: 'Real-time AI behavioral analysis tracks transactions to block zero-day financial engineering vulnerabilities and flash loan attacks.'
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-blue-600" />,
      title: 'Adaptive Yield Algorithms',
      description: 'Institutional-grade asset routing that dynamically shifts operations between top-tier treasury notes and high-grade liquidity pools.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-brand-primary selection:text-white" id="landing-page-root">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-100" id="landing-header">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <SecureFinLogo size="md" />
          <div className="flex items-center gap-6" id="landing-header-actions">
            <span className="text-slate-500 hover:text-slate-900 text-sm font-medium cursor-pointer transition hidden md:inline">
              Institutional Solutions
            </span>
            <span className="text-slate-500 hover:text-slate-900 text-sm font-medium cursor-pointer transition hidden md:inline">
              Vault Protocols
            </span>
            <button
              onClick={handleAction}
              className="px-5 py-2.5 rounded-full text-slate-700 hover:text-slate-900 text-sm font-semibold transition border border-slate-200 hover:bg-slate-50 active:scale-95"
              id="landing-btn-login"
            >
              Access Vault
            </button>
            <button
              onClick={handleAction}
              className="px-5 py-2.5 rounded-full bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary-container shadow-md shadow-brand-primary/10 transition active:scale-95"
              id="landing-btn-start"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1" id="landing-main">
        <section className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" id="landing-hero">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-8" id="landing-hero-text">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full" id="landing-hero-badge">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-mono font-semibold text-slate-600 tracking-wider">SECUREFIN v4.2 LIVE</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.1]" id="landing-hero-heading">
              Elite Asset & <br />
              <span className="bg-gradient-to-r from-brand-primary to-brand-primary-container bg-clip-text text-transparent">
                Security Engineering
              </span><br />
              for Wealth Management.
            </h1>

            <p className="text-lg text-slate-600 max-w-xl leading-relaxed" id="landing-hero-description">
              The choice for sophisticated trusts, quantitative asset managers, and high-growth technology corporations seeking unparalleled security and real-time settle-grade transaction layers.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4" id="landing-hero-buttons">
              <button
                onClick={handleAction}
                className="group flex items-center justify-center gap-2 px-8 py-4 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary-container transition shadow-lg shadow-brand-primary/20 active:scale-95"
                id="landing-hero-getstarted"
              >
                Launch SecureFin Portal
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={handleAction}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl font-bold transition active:scale-95"
                id="landing-hero-learnmore"
              >
                Download Security Whitepaper
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Micro Compliance indicators */}
            <div className="pt-6 border-t border-slate-150 flex flex-wrap gap-x-8 gap-y-4 text-xs font-semibold text-slate-400" id="landing-hero-compliance">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span> SOC2 TYPE II COMPLIANT
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span> FDIC INSURED UP TO $250M
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span> PCI-DSS LEVEL 1
              </div>
            </div>
          </div>

          {/* Right Image/Dashboard Column */}
          <div className="lg:col-span-5 relative" id="landing-hero-visual">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-primary/20 to-blue-500/10 rounded-3xl blur-3xl -z-10 transform scale-95"></div>
            
            {/* Main Interactive Collage Card */}
            <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl p-6 relative overflow-hidden" id="landing-hero-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              
              {/* Card Header showing stylized Vault metrics */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-100" id="landing-card-header">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-brand-primary"></span>
                  <span className="font-mono text-xs font-bold text-slate-500">SECUREFIN SYSTEM PREVIEW</span>
                </div>
                <div className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-mono font-bold">
                  AUTOLINK ACTIVE
                </div>
              </div>

              {/* Collaged High-Quality Financial Center Graphic */}
              <div className="my-6 rounded-xl overflow-hidden border border-slate-100 relative group" id="landing-hero-image-wrapper">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOLLxcPjzSHgbV_hrvel6UvEWhxcsf_1kJtAybOMHdQbrQoqHep4rolkhLgp51tNJ7GpAIL4q32nw2aKeKWBtCoENp3Mpq6N_MztwjxGHksNUdK8fknp7FsWfTxAd7de-C0_K5X-gYIM9vn8VPaYawWj6mXSS0fydqAnUjTPKFAegtZvtNI3IQSFyV4g5TcOaVU1B2IMCBp18Pk-4CpNMIf8na-HqZ-RCa4ePp5-XtTo8dNi54EYSdXkQyqAqYf4eB2LdZRTpn8r8h"
                  alt="Futuristic glass financial center"
                  referrerPolicy="no-referrer"
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-700"
                  id="landing-hero-hotlink-img"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-4">
                  <span className="text-[10px] font-mono text-brand-primary-container font-bold tracking-widest">QUANTUM VAULT CO-LOCATION</span>
                  <h3 className="text-white font-bold text-sm">Zurich Core Server Facility</h3>
                </div>
              </div>

              {/* Dynamic Interactive Mini-Transfer demo */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100" id="landing-demo-transfer">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>TRANSFER LEDGER</span>
                  <span>PENDING SIGS: 0</span>
                </div>
                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-150 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded bg-brand-primary/10 flex items-center justify-center">
                      <Key className="h-3.5 w-3.5 text-brand-primary" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Operational Vault-A</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: TRX-94821</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-red-500">-$1,420.00</div>
                    <div className="text-[10px] text-emerald-600 font-bold font-mono">VERIFIED</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-center">
                <button
                  onClick={handleAction}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-slate-900/10"
                  id="landing-demo-btn"
                >
                  Enter Secured Demo Environment
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid - Executive Bento Layout */}
        <section className="bg-white border-y border-slate-150 py-16" id="landing-stats">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12" id="landing-stats-grid">
              {stats.map((stat, i) => (
                <div key={i} className="space-y-2 text-center lg:text-left" id={`landing-stat-${i}`}>
                  <div className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight font-mono">
                    {stat.value}
                  </div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-normal">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Technical Value Proposition */}
        <section className="max-w-7xl mx-auto px-6 py-20 lg:py-28 space-y-16" id="landing-features">
          <div className="max-w-3xl space-y-4" id="landing-features-intro">
            <span className="font-mono text-xs font-bold text-brand-primary uppercase tracking-widest">ARCHITECTURE</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              A paradigm shift in corporate asset storage.
            </h2>
            <p className="text-slate-600">
              Unlike traditional corporate banking platforms that rely on outdated database replication and legacy ACH settlement gates, SecureFin is built on secure multi-node architectures and real-time execution kernels.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8" id="landing-features-grid">
            {features.map((feat, i) => (
              <div
                key={i}
                className="bg-white border border-slate-150 p-8 rounded-2xl shadow-sm hover:shadow-md transition space-y-6"
                id={`landing-feat-${i}`}
              >
                <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {feat.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="font-extrabold text-slate-900 text-lg">{feat.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{feat.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Micro Embedded Vault Banner */}
          <div className="bg-slate-900 text-white rounded-3xl p-8 lg:p-12 relative overflow-hidden flex flex-col md:flex-row gap-8 items-center justify-between" id="landing-bottom-cta">
            {/* Background vault graphic */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF1mt1E7KrhguhoLRFvVo7sjt9X3qqrR8wbWkoaLk8bdxo3HhBqKs6_mjSZWMKBqDum_CQpYAzQyAaWpqZc5As8494XOmkcHMLhBZ10LAedUqZ09xp0prhp2KGEvhTourjmO2SHpSFw3OHjm3sHJuLnTO8Tb1MB7WBHwleDv7_qzkqGLeLhAy-B8UrwYCUqfgdQbvhfOOWRHnv_CCbRAf7o4r1WCfAH-6w0NO3PEppN5kC1PGDtlr3Z4YZuFpDsIz8IOkB590HMo7j"
                alt="Vault handle background"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-3 z-10" id="landing-bottom-cta-text">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-primary-container text-white text-[10px] font-mono font-bold rounded">
                SECURED COMPLIANCE
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Ready to fortify your organization's reserves?</h3>
              <p className="text-slate-400 max-w-xl text-sm">
                Open a business or trust asset account in minutes. Instant onboarding, full API capability, and dedicated strategic coverage.
              </p>
            </div>
            <button
              onClick={handleAction}
              className="px-8 py-4 bg-white text-slate-950 hover:bg-slate-100 font-bold text-base rounded-xl transition shadow-lg shrink-0 z-10 active:scale-95"
              id="landing-bottom-cta-btn"
            >
              Open Secured Account
            </button>
          </div>
        </section>
      </main>

      {/* Corporate Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-12 text-slate-500 text-xs" id="landing-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <SecureFinLogo showText={false} size="sm" />
            <span className="font-mono font-bold text-slate-700">&copy; 2026 SecureFin Technologies Inc.</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 font-medium" id="landing-footer-links">
            <span className="hover:text-slate-900 cursor-pointer">Security Protocol v4.2</span>
            <span className="hover:text-slate-900 cursor-pointer">Service Level Agreement</span>
            <span className="hover:text-slate-900 cursor-pointer">Regulatory Disclosures</span>
            <span className="hover:text-slate-900 cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
