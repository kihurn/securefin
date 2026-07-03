import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldCheck,
  LayoutDashboard,
  Receipt,
  CreditCard,
  Lightbulb,
  Settings,
  LogOut,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  Lock,
  Unlock,
  Globe,
  Calendar,
  DollarSign,
  CheckCircle2,
  Download,
  Send,
  RefreshCw,
  FileText,
  ChevronRight,
  Menu,
  X,
  Building,
  Fingerprint
} from 'lucide-react';

import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { SecureFinLogo } from './components/SecureFinLogo';
import { TransactionDetailsDrawer } from './components/TransactionDetailsDrawer';
import { NewTransferModal } from './components/NewTransferModal';
import { BiometricVerificationModal } from './components/BiometricVerificationModal';

import {
  initialUserProfile,
  initialSessions,
  initialTransactions,
  initialScheduledObligations,
  initialInsights
} from './data';
import { UserProfile, Transaction } from './types';
import { playClickSound, playSuccessSound, playTransitionSound } from './utils/audio';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  // Authentication & View Flow State
  const [pageState, setPageState] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger' | 'payments' | 'insights' | 'settings'>('dashboard');

  // Firebase auth client state
  const [authToken, setAuthToken] = useState<string | null>(null);

  const fetchUserData = async (token: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [profileRes, txRes, obligationsRes, sessionsRes, balancesRes] = await Promise.all([
        fetch('/api/user/profile', { headers }),
        fetch('/api/transactions', { headers }),
        fetch('/api/scheduled-obligations', { headers }),
        fetch('/api/sessions', { headers }),
        fetch('/api/balances', { headers }),
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUserProfile(profile);
      }
      if (txRes.ok) {
        const txs = await txRes.json();
        setTransactions(txs);
      }
      if (obligationsRes.ok) {
        const obs = await obligationsRes.json();
        setScheduledObligations(obs);
      }
      if (sessionsRes.ok) {
        const sess = await sessionsRes.json();
        setSessions(sess);
      }
      if (balancesRes.ok) {
        const bal = await balancesRes.json();
        setBalances(bal);
      }
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        setAuthToken(token);
        setPageState('dashboard');
        fetchUserData(token);
      } else {
        setAuthToken(null);
        setPageState('landing');
      }
    });
    return () => unsubscribe();
  }, []);

  // App Data State
  const [userProfile, setUserProfile] = useState<UserProfile>(initialUserProfile);
  const [sessions, setSessions] = useState(initialSessions);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [scheduledObligations, setScheduledObligations] = useState(initialScheduledObligations);
  const [insights] = useState(initialInsights);

  // Dynamic Cash Flow / Liquidity State — loaded from Supabase, zero until API responds
  const [balances, setBalances] = useState({
    operational: 0,
    vault: 0,
    reserve: 0,
  });

  // UI Interactive States
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [cardFrozen, setCardFrozen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search and Filter state in Ledger tab
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('All');

  // Selected Insight Article modal
  const [activeArticle, setActiveArticle] = useState<typeof initialInsights[0] | null>(null);

  // Calculate dynamic summary stats
  const totalBalance = useMemo(() => {
    return balances.operational + balances.vault + balances.reserve;
  }, [balances]);

  // Handle Toast notification trigger
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handle simulated card freeze toggle
  const handleToggleCardFreeze = () => {
    playSuccessSound();
    setCardFrozen(!cardFrozen);
    triggerToast(cardFrozen ? 'Master card block successfully lifted.' : 'Master card frozen. Authorizations restricted.');
  };

  // Export financial statement receipt trigger
  const handleExportStatements = () => {
    playSuccessSound();
    triggerToast('Institutional PDF ledger statement generated & queued.');
  };

  // Navigations
  const handlePageChange = (state: 'landing' | 'login' | 'register' | 'dashboard') => {
    playTransitionSound();
    setPageState(state);
    if (state === 'dashboard') {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    playTransitionSound();
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setPageState('landing');
  };

  // Handle successful registration of user node
  const handleRegisterSuccess = (profile: Partial<UserProfile>) => {
    setUserProfile((prev) => ({
      ...prev,
      ...profile,
    }));
    triggerToast('Institutional identity registered and keys deployed successfully.');
    handlePageChange('dashboard');
  };

  const handleTabChange = (tab: typeof activeTab) => {
    playClickSound();
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Handle newly executed transfer
  const handleNewTransfer = async (
    amount: number,
    recipientName: string,
    category: string,
    notes: string,
    accountName: string
  ) => {
    // 1. Synthesize request body
    const transactionData = {
      description: recipientName,
      merchant: recipientName,
      category: category as any,
      amount: -amount,
      notes: notes,
      status: 'Verified' as any,
      attachmentName: 'Transfer_Receipt_Auto.pdf',
      attachmentSize: '450 KB',
      iconName: 'payments' as any
    };

    try {
      // If we have an auth token, make a real API call!
      if (authToken) {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(transactionData)
        });
        
        if (response.ok) {
          const savedTx = await response.json();
          setTransactions((prev) => [savedTx, ...prev]);
        } else {
          throw new Error('Sovereign ledger failed to write block.');
        }
      } else {
        // Fallback for simulation
        const newTrx: Transaction = {
          id: `TRX-${Math.floor(10000 + Math.random() * 90000)}`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          ...transactionData
        };
        setTransactions((prev) => [newTrx, ...prev]);
      }

      // Deduct correct balance locally and persist to backend
      setBalances((prev) => {
        const next = (() => {
          if (accountName.includes('Operational')) return { ...prev, operational: prev.operational - amount };
          if (accountName.includes('Vault')) return { ...prev, vault: prev.vault - amount };
          return { ...prev, reserve: prev.reserve - amount };
        })();

        // Persist updated balances to Supabase
        if (authToken) {
          fetch('/api/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(next),
          }).catch((e) => console.error('Balance persist failed:', e));
        }

        return next;
      });

      setShowTransferModal(false);
      triggerToast(`Settle transfer of $${amount.toLocaleString()} committed instantly.`);
    } catch (err: any) {
      console.error('New transfer error:', err);
      triggerToast('Security transaction aborted: ' + err.message);
    }
  };

  // Settings form saving
  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    playSuccessSound();
    const formData = new FormData(e.currentTarget);
    const updatedProfile = {
      name: formData.get('name') as string || userProfile.name,
      jobTitle: formData.get('jobTitle') as string || userProfile.jobTitle,
      organization: formData.get('organization') as string || userProfile.organization,
      defaultCurrency: formData.get('defaultCurrency') as string || userProfile.defaultCurrency,
      language: formData.get('language') as string || userProfile.language,
      emailAlerts: formData.get('emailAlerts') === 'on',
      twoFactorEnabled: formData.get('twoFactorEnabled') === 'on',
    };

    try {
      if (authToken) {
        const response = await fetch('/api/user/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(updatedProfile)
        });

        if (response.ok) {
          const profile = await response.json();
          setUserProfile(profile);
        } else {
          throw new Error('Sovereign vault registry update rejected.');
        }
      } else {
        setUserProfile((prev) => ({
          ...prev,
          ...updatedProfile,
        }));
      }
      triggerToast('Secured profile modifications saved to vault registry.');
    } catch (err: any) {
      console.error('Profile update error:', err);
      triggerToast('Modification rejected: ' + err.message);
    }
  };

  // Session revocation
  const handleRevokeSession = (sessionId: string) => {
    playSuccessSound();
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    triggerToast('External security session token revoked.');
  };

  // Filtered transactions for the Ledger tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter((trx) => {
      const matchesSearch =
        trx.description.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        trx.id.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        trx.category.toLowerCase().includes(ledgerSearch.toLowerCase());
      const matchesCategory = ledgerCategoryFilter === 'All' || trx.category === ledgerCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [transactions, ledgerSearch, ledgerCategoryFilter]);

  // Landing page view
  if (pageState === 'landing') {
    return (
      <LandingPage
        onStartLogin={() => handlePageChange('login')}
        onStartRegister={() => handlePageChange('register')}
      />
    );
  }

  // Login view
  if (pageState === 'login') {
    return (
      <LoginPage
        onLoginSuccess={(profile) => {
          if (profile) setUserProfile(profile);
          handlePageChange('dashboard');
        }}
        onBackToHome={() => handlePageChange('landing')}
        onGoToRegister={() => handlePageChange('register')}
      />
    );
  }

  // Register view
  if (pageState === 'register') {
    return (
      <RegisterPage
        onRegisterSuccess={(profile) => {
          if (profile) setUserProfile(profile as any);
          triggerToast('Institutional identity registered and keys deployed successfully.');
          handlePageChange('dashboard');
        }}
        onBackToHome={() => handlePageChange('landing')}
        onGoToLogin={() => handlePageChange('login')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-brand-primary selection:text-white relative" id="portal-root">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3"
            id="portal-toast"
          >
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold tracking-tight">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 text-slate-600 hidden lg:flex flex-col fixed inset-y-0 left-0 z-30" id="portal-sidebar">
        {/* Sidebar Logo */}
        <div className="p-6 border-b border-slate-200" id="sidebar-logo-container">
          <SecureFinLogo size="md" light={false} />
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-4 space-y-1.5" id="sidebar-nav">
          <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3 font-mono">
            Vault Operations
          </span>
          
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${
              activeTab === 'dashboard'
                ? 'bg-brand-secondary-container text-brand-primary shadow-sm'
                : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            id="sidebar-tab-dashboard"
          >
            <LayoutDashboard className="h-4.5 w-4.5" />
            Core Dashboard
          </button>

          <button
            onClick={() => handleTabChange('ledger')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${
              activeTab === 'ledger'
                ? 'bg-brand-secondary-container text-brand-primary shadow-sm'
                : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            id="sidebar-tab-ledger"
          >
            <Receipt className="h-4.5 w-4.5" />
            Activity Ledger
          </button>

          <button
            onClick={() => handleTabChange('payments')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${
              activeTab === 'payments'
                ? 'bg-brand-secondary-container text-brand-primary shadow-sm'
                : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            id="sidebar-tab-payments"
          >
            <CreditCard className="h-4.5 w-4.5" />
            Treasury & Cards
          </button>

          <button
            onClick={() => handleTabChange('insights')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${
              activeTab === 'insights'
                ? 'bg-brand-secondary-container text-brand-primary shadow-sm'
                : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            id="sidebar-tab-insights"
          >
            <Lightbulb className="h-4.5 w-4.5" />
            Wealth Insights
          </button>

          <button
            onClick={() => handleTabChange('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${
              activeTab === 'settings'
                ? 'bg-brand-secondary-container text-brand-primary shadow-sm'
                : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            id="sidebar-tab-settings"
          >
            <Settings className="h-4.5 w-4.5" />
            Security Settings
          </button>
        </nav>

        {/* Quick transfer button inside sidebar */}
        <div className="p-4 border-t border-slate-200 space-y-4" id="sidebar-footer-controls">
          <button
            onClick={() => {
              playClickSound();
              setShowTransferModal(true);
            }}
            className="w-full py-3 bg-brand-primary text-white hover:bg-brand-primary-container rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-brand-primary/10 active:scale-95 cursor-pointer"
            id="sidebar-btn-quicktransfer"
          >
            <Plus className="h-3.5 w-3.5 text-white stroke-[3]" />
            New Vault Transfer
          </button>

          {/* User Profile Summary */}
          <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-150 rounded-xl" id="sidebar-profile-card">
            <img
              src={userProfile.avatarUrl}
              alt="Alexander Sterling avatar"
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-lg object-cover border border-slate-200"
              id="sidebar-avatar"
            />
            <div className="truncate flex-1">
              <div className="text-xs font-bold text-slate-800">{userProfile.name}</div>
              <div className="text-[10px] text-slate-500 font-medium truncate">{userProfile.jobTitle}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
              id="sidebar-btn-logout"
              title="Sign out of SecureFin Portal"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col" id="portal-content-container">
        
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 h-20 bg-white border-b border-slate-150 px-6 flex items-center justify-between" id="portal-header">
          {/* Left side brand on mobile / title on desktop */}
          <div className="flex items-center gap-3" id="portal-header-left">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden transition"
              id="mobile-hamburger"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div className="lg:hidden">
              <SecureFinLogo size="sm" />
            </div>
            <div className="hidden lg:block">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                Institutional Terminal
              </span>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight capitalize" id="portal-tab-header">
                {activeTab === 'dashboard' ? 'Core Portfolio' : activeTab === 'ledger' ? 'Immutable Activity Ledger' : activeTab === 'payments' ? 'Treasury Reserves' : activeTab === 'insights' ? 'Strategic Intelligence' : 'Security Registry'}
              </h2>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4" id="portal-header-right">
            {/* Quick stats indicators */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full" id="header-badge-operational">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 tracking-wider">SECURE LINK ESTABLISHED</span>
            </div>

            <div className="flex items-center gap-3" id="header-user-triggers">
              {/* Notification icon */}
              <button
                onClick={() => {
                  playClickSound();
                  triggerToast('Cryptographic activity logs clear. 0 outstanding alerts.');
                }}
                className="p-2.5 rounded-xl border border-slate-150 hover:bg-slate-50 transition relative text-slate-600 hover:text-slate-900"
                id="header-notification-btn"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-primary"></span>
              </button>

              {/* Fast transfer button */}
              <button
                onClick={() => {
                  playClickSound();
                  setShowTransferModal(true);
                }}
                className="py-2.5 px-4 bg-brand-primary text-white hover:bg-brand-primary-container text-xs font-bold rounded-xl shadow-md shadow-brand-primary/10 transition active:scale-95 hidden sm:flex items-center gap-1.5"
                id="header-quick-transfer-btn"
              >
                <Plus className="h-4 w-4" />
                Transfer
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <div className="fixed inset-0 bg-slate-950/40 z-30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 text-slate-600 z-40 lg:hidden p-6 flex flex-col justify-between"
                id="mobile-drawer"
              >
                <div className="space-y-8">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                    <SecureFinLogo size="sm" light={false} />
                    <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-800">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <nav className="space-y-2">
                    <button
                      onClick={() => handleTabChange('dashboard')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'dashboard' ? 'bg-brand-secondary-container text-brand-primary' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <LayoutDashboard className="h-4.5 w-4.5" />
                      Core Dashboard
                    </button>
                    <button
                      onClick={() => handleTabChange('ledger')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'ledger' ? 'bg-brand-secondary-container text-brand-primary' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <Receipt className="h-4.5 w-4.5" />
                      Activity Ledger
                    </button>
                    <button
                      onClick={() => handleTabChange('payments')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'payments' ? 'bg-brand-secondary-container text-brand-primary' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <CreditCard className="h-4.5 w-4.5" />
                      Treasury & Cards
                    </button>
                    <button
                      onClick={() => handleTabChange('insights')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'insights' ? 'bg-brand-secondary-container text-brand-primary' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <Lightbulb className="h-4.5 w-4.5" />
                      Wealth Insights
                    </button>
                    <button
                      onClick={() => handleTabChange('settings')}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'settings' ? 'bg-brand-secondary-container text-brand-primary' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <Settings className="h-4.5 w-4.5" />
                      Security Settings
                    </button>
                  </nav>
                </div>

                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowTransferModal(true);
                    }}
                    className="w-full py-3 bg-brand-primary text-white hover:bg-brand-primary-container font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-brand-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" />
                    New Vault Transfer
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100/50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Tab Switchboard Body */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6 overflow-x-hidden" id="portal-tab-content-root">
          
          {/* TAB 1: CORE PORTFOLIO DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="tab-dashboard">
              
              {/* Dynamic balances & stats - Bento cards (Left 8 cols on desktop) */}
              <div className="lg:col-span-8 space-y-6" id="dashboard-left">
                
                {/* Total Net Assets Summary */}
                <div className="bg-white border border-slate-150 rounded-2xl p-6 relative overflow-hidden" id="dashboard-total-assets">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="total-assets-header">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                        TOTAL PORTFOLIO VALUE (USD)
                      </span>
                      <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-950 font-mono tracking-tight mt-1">
                        {totalBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span>+14.2% QTD Growth ($1.4M accrued yield)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 sm:pt-0" id="total-assets-actions">
                      <button
                        onClick={handleExportStatements}
                        className="p-2.5 rounded-xl border border-slate-150 hover:bg-slate-50 transition text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                        title="Download standard ledger compliance report"
                        id="dashboard-btn-export"
                      >
                        <Download className="h-4 w-4" />
                        Export Ledger
                      </button>
                      <button
                        onClick={() => {
                          playClickSound();
                          setShowTransferModal(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary-container font-bold text-xs transition shadow-md shadow-brand-primary/10 active:scale-95 flex items-center gap-1.5"
                        id="dashboard-btn-new-transfer"
                      >
                        <Plus className="h-4 w-4" />
                        New Transfer
                      </button>
                    </div>
                  </div>

                  {/* High-fidelity responsive interactive SVG Chart showing asset growth history */}
                  <div className="mt-8 border-t border-slate-100 pt-6" id="dashboard-growth-chart-wrapper">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-4">
                      <span>SECUREFIN PORTFOLIO REVENUE & ACCRUAL GRAPH</span>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-brand-primary"></span>
                          Operational Assets
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                          Vault Storage
                        </span>
                      </div>
                    </div>

                    {/* Interactive Custom Line SVG Chart */}
                    <div className="h-48 w-full relative" id="growth-svg-chart">
                      <svg viewBox="0 0 500 150" className="w-full h-full" preserveAspectRatio="none" id="growth-chart-graphic">
                        {/* Gradients */}
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#165ca9" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#165ca9" stopOpacity="0.0" />
                          </linearGradient>
                          <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Chart gridlines */}
                        <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="75" x2="500" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeWidth="1" />

                        {/* Area backgrounds */}
                        <path
                          d="M 0 130 C 50 110, 100 115, 150 90 C 200 65, 250 85, 300 55 C 350 25, 400 45, 500 15 L 500 150 L 0 150 Z"
                          fill="url(#chartGradient)"
                        />
                        <path
                          d="M 0 145 C 50 135, 100 140, 150 120 C 200 110, 250 125, 300 100 C 350 85, 400 95, 500 70 L 500 150 L 0 150 Z"
                          fill="url(#cyanGradient)"
                        />

                        {/* Line charts */}
                        <path
                          d="M 0 130 C 50 110, 100 115, 150 90 C 200 65, 250 85, 300 55 C 350 25, 400 45, 500 15"
                          fill="none"
                          stroke="#165ca9"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 0 145 C 50 135, 100 140, 150 120 C 200 110, 250 125, 300 100 C 350 85, 400 95, 500 70"
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeDasharray="4 2"
                        />

                        {/* Interactive highlights nodes */}
                        <circle cx="150" cy="90" r="5" fill="#165ca9" stroke="#ffffff" strokeWidth="2" className="cursor-pointer" />
                        <circle cx="300" cy="55" r="5" fill="#165ca9" stroke="#ffffff" strokeWidth="2" className="cursor-pointer" />
                        <circle cx="500" cy="15" r="6" fill="#165ca9" stroke="#ffffff" strokeWidth="2.5" className="cursor-pointer animate-pulse" />
                      </svg>

                      {/* Floating tooltip simulation */}
                      <div className="absolute top-[35px] right-[10%] bg-slate-900 border border-slate-800 text-white p-2 rounded-lg shadow-xl text-[10px] font-mono" id="chart-tooltip">
                        <div className="font-bold">OCT 24 (PRESENT)</div>
                        <div className="text-emerald-400 font-extrabold">+14.2% YIELD ACCRUED</div>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest pt-3 border-t border-slate-100" id="growth-chart-timeline-labels">
                      <span>May 2026</span>
                      <span>Jun 2026</span>
                      <span>Jul 2026</span>
                      <span>Aug 2026</span>
                      <span>Sep 2026</span>
                      <span>Oct 2026 (Ledger Locked)</span>
                    </div>
                  </div>
                </div>

                {/* Sub-account vault grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="dashboard-subaccounts">
                  
                  {/* Sub-account 1: Operational */}
                  <div className="bg-white border border-slate-150 p-6 rounded-2xl space-y-4" id="subaccount-operational">
                    <div className="flex items-center justify-between" id="subaccount-operational-header">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
                        <ArrowUpRight className="h-4 w-4 text-brand-primary" />
                        Operational Vault
                      </div>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" title="Core liquidity active"></span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-extrabold font-mono text-slate-950">
                        ${balances.operational.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal font-medium">
                        Disbursals, salary payrolls, and operational computing settlements.
                      </p>
                    </div>
                  </div>

                  {/* Sub-account 2: Storage Vault */}
                  <div className="bg-white border border-slate-150 p-6 rounded-2xl space-y-4" id="subaccount-storage">
                    <div className="flex items-center justify-between" id="subaccount-storage-header">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
                        <Lock className="h-4 w-4 text-emerald-600" />
                        Storage Vault
                      </div>
                      <span className="h-2 w-2 rounded-full bg-blue-500" title="Consensus verification active"></span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-extrabold font-mono text-slate-950">
                        ${balances.vault.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal font-medium">
                        Distributed reserve vault restricted by multi-node authorization.
                      </p>
                    </div>
                  </div>

                  {/* Sub-account 3: Asset Reserve */}
                  <div className="bg-white border border-slate-150 p-6 rounded-2xl space-y-4" id="subaccount-reserve">
                    <div className="flex items-center justify-between" id="subaccount-reserve-header">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold uppercase tracking-wider font-mono">
                        <Building className="h-4 w-4 text-purple-600" />
                        Reserve Fund
                      </div>
                      <span className="h-2 w-2 rounded-full bg-purple-500" title="Long term assets"></span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-extrabold font-mono text-slate-950">
                        ${balances.reserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal font-medium">
                        Capital allocations and high-grade sovereign trust distributions.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Ledger Quick Entries List */}
                <div className="bg-white border border-slate-150 rounded-2xl p-6 space-y-4" id="dashboard-recent-transactions">
                  <div className="flex items-center justify-between" id="recent-transactions-header">
                    <div>
                      <h4 className="font-extrabold text-slate-950 text-base">Recent Ledger Operations</h4>
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
                        REAL-TIME CRYPTOGRAPHIC COMMIT TIMELINE
                      </p>
                    </div>
                    <button
                      onClick={() => handleTabChange('ledger')}
                      className="text-xs font-bold text-brand-primary hover:text-brand-primary-container flex items-center gap-1 cursor-pointer"
                      id="dashboard-btn-viewall"
                    >
                      View Full Ledger
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100" id="recent-transactions-list">
                    {transactions.slice(0, 4).map((trx) => (
                      <div
                        key={trx.id}
                        onClick={() => {
                          playClickSound();
                          setSelectedTransaction(trx);
                        }}
                        className="flex items-center justify-between py-4 hover:bg-slate-50/80 px-2 rounded-xl transition cursor-pointer"
                        id={`trx-row-${trx.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${trx.amount > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                            {trx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{trx.description}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {trx.date} • {trx.time} • ID: {trx.id}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-4">
                          <div>
                            <div className={`text-xs font-extrabold font-mono ${trx.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                              {trx.amount > 0 ? '+' : ''}
                              {trx.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                              {trx.category}
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sidebar Cards and Widgets (Right 4 cols on desktop) */}
              <div className="lg:col-span-4 space-y-6" id="dashboard-right">
                
                {/* Visual Debit Card Mock with premium SecureFin layout & hotlinked image */}
                <div
                  className="rounded-2xl shadow-xl overflow-hidden text-white relative h-56 p-6 flex flex-col justify-between group"
                  id="dashboard-visual-card"
                >
                  {/* Hotlinked Credit Card Mock Background with elegant Referrer Policy */}
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjLVd0iKiUp3NEie4MfPKZKRZkwaKlIOWXOhrTUpUFohHlsnbUY0B4OA6l6TqHeM_AFvFWhFBfPFezyFGfdditCIxPKlhmpDAowftR9vQHjtKwzNT_lkYpSLDOscn40ZB2Csj9ief0-uOeBgy4BmJuM5yoxC8hL9Z2OK9tCwTN5lCJ-3_rSvoWd9E81nKIDjahef-kQrwRARndxpfO2uNv4j_DcPvISpoL0mwofK-KZdf1YzUuZtdOCA9gRHlRjUxsJHzBXOrJGrH4"
                    alt="SecureFin Metal credit card design background"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 pointer-events-none"
                    id="metal-card-img"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none"></div>

                  {/* Card Front Content Overlay */}
                  <div className="flex justify-between items-start z-10" id="card-front-header">
                    <div>
                      <SecureFinLogo size="sm" showText={true} light={true} />
                      <span className="text-[8px] font-mono tracking-widest text-slate-400 block mt-0.5">SECURED INSTITUTIONAL</span>
                    </div>
                    {/* Chip illustration */}
                    <div className="h-8 w-11 rounded bg-gradient-to-tr from-amber-400 via-amber-200 to-amber-300 border border-amber-400 shadow-sm relative overflow-hidden" id="card-gold-chip">
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:4px_4px]"></div>
                    </div>
                  </div>

                  <div className="space-y-4 z-10" id="card-front-footer">
                    <div>
                      {cardFrozen ? (
                        <div className="text-xl font-bold font-mono tracking-widest text-slate-500 line-through">
                          •••• •••• •••• 9482
                        </div>
                      ) : (
                        <div className="text-xl font-extrabold font-mono tracking-widest text-white">
                          4920 8401 9283 9482
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
                        <span>{userProfile.name}</span>
                        <span>EXP 08/29</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Controls Widget */}
                <div className="bg-white border border-slate-150 p-6 rounded-2xl space-y-4" id="card-controls-widget">
                  <div className="flex items-center justify-between" id="card-controls-header">
                    <div>
                      <h4 className="font-extrabold text-slate-950 text-sm">Security & Lockouts</h4>
                      <p className="text-[10px] font-mono text-slate-400">HARDWARE AUTHORIZATIONS</p>
                    </div>
                    {cardFrozen ? (
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 text-[10px] font-bold font-mono rounded">
                        FROZEN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold font-mono rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="space-y-3" id="card-controls-actions">
                    <button
                      onClick={handleToggleCardFreeze}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
                        cardFrozen
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                      }`}
                      id="btn-toggle-freeze"
                    >
                      {cardFrozen ? (
                        <>
                          <Unlock className="h-4 w-4" />
                          Lift Card Restrictions
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          Temporarily Freeze Metal Card
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        playClickSound();
                        triggerToast('Dual-Factor OTP request sent to security cell.');
                      }}
                      className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95"
                      id="btn-trigger-otp"
                    >
                      Generate New Signer PIN
                    </button>
                  </div>
                </div>

                {/* Scheduled Liabilities / Obligations */}
                <div className="bg-white border border-slate-150 p-6 rounded-2xl space-y-4" id="dashboard-scheduled-liabilities">
                  <div id="scheduled-header">
                    <h4 className="font-extrabold text-slate-950 text-sm">Scheduled Reserve Outflows</h4>
                    <p className="text-[10px] font-mono text-slate-400">MUTABLE RECURRING INSTRUCTIONS</p>
                  </div>

                  <div className="space-y-3" id="scheduled-list">
                    {scheduledObligations.map((obligation) => (
                      <div
                        key={obligation.id}
                        className="flex items-center gap-3 p-3 border border-slate-100 bg-slate-50/50 rounded-xl"
                        id={`obligation-card-${obligation.id}`}
                      >
                        {/* Day indicator */}
                        <div className="h-10 w-10 bg-white border border-slate-150 rounded-lg flex flex-col items-center justify-center font-mono" id="obligation-date">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{obligation.month}</span>
                          <span className="text-sm font-extrabold text-slate-800 leading-none">{obligation.day}</span>
                        </div>

                        <div className="flex-1 truncate">
                          <div className="text-xs font-bold text-slate-800 truncate">{obligation.description}</div>
                          <div className="text-[10px] text-slate-400 truncate font-semibold mt-0.5">
                            {obligation.category}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-bold font-mono text-slate-900">
                            -${obligation.amount.toLocaleString()}
                          </div>
                          <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-amber-600">
                            {obligation.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      playClickSound();
                      triggerToast('Instruction scheduler locked. Contact compliance representative to modify.');
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold transition"
                    id="btn-add-scheduled"
                  >
                    Configure Scheduled outflow
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: IMMUTABLE ACTIVITY LEDGER */}
          {activeTab === 'ledger' && (
            <div className="bg-white border border-slate-150 rounded-2xl p-6 space-y-6" id="tab-ledger">
              
              {/* Filter controls */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-slate-150 pb-6" id="ledger-controls">
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-950 text-lg">Cryptographic Ledger Ledger</h3>
                  <p className="text-xs text-slate-500">
                    Showing {filteredTransactions.length} of {transactions.length} institutional entries matched.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto" id="ledger-filters">
                  {/* Search bar */}
                  <div className="relative flex-1 md:w-64" id="ledger-search-wrapper">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search recipient, hash, category..."
                      value={ledgerSearch}
                      onChange={(e) => setLedgerSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-slate-400"
                      id="ledger-search-input"
                    />
                  </div>

                  {/* Category filters dropdown */}
                  <div className="relative" id="ledger-category-dropdown">
                    <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      value={ledgerCategoryFilter}
                      onChange={(e) => {
                        playClickSound();
                        setLedgerCategoryFilter(e.target.value);
                      }}
                      className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary appearance-none cursor-pointer"
                      id="ledger-category-select"
                    >
                      <option value="All">All Categories</option>
                      <option value="Technology">Technology</option>
                      <option value="Financial Services">Financial Services</option>
                      <option value="Travel">Travel</option>
                      <option value="Dining">Dining</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Income">Income</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Ledger Entries Table */}
              <div className="overflow-x-auto" id="ledger-table-container">
                <table className="w-full text-left border-collapse" id="ledger-table">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold font-mono text-slate-400 uppercase tracking-widest">
                      <th className="py-4 px-4">Transaction Details</th>
                      <th className="py-4 px-4">Cryptographic Hash</th>
                      <th className="py-4 px-4">Asset Category</th>
                      <th className="py-4 px-4 text-right">Settled Amount</th>
                      <th className="py-4 px-4 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs" id="ledger-tbody">
                    {filteredTransactions.map((trx) => (
                      <tr
                        key={trx.id}
                        onClick={() => {
                          playClickSound();
                          setSelectedTransaction(trx);
                        }}
                        className="hover:bg-slate-50/70 cursor-pointer transition"
                        id={`ledger-tr-${trx.id}`}
                      >
                        {/* Detail / Description */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center border shrink-0 ${trx.amount > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                              {trx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{trx.description}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{trx.date} • {trx.time}</div>
                            </div>
                          </div>
                        </td>

                        {/* Hash Proof */}
                        <td className="py-4 px-4 font-mono text-[10px] text-sky-600 font-semibold">
                          0x7f39a1c{trx.id.split('-')[1] || '9482'}e4b5...
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-150 rounded text-[10px] font-mono font-bold uppercase tracking-wider">
                            {trx.category}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                          <div className={trx.amount > 0 ? 'text-emerald-600 font-extrabold' : 'text-slate-900 font-bold'}>
                            {trx.amount > 0 ? '+' : ''}
                            {trx.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </div>
                        </td>

                        {/* Verification badge */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end">
                            {trx.status === 'Verified' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-bold font-mono">
                                <ShieldCheck className="h-3 w-3" /> VERIFIED
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-bold font-mono animate-pulse">
                                <RefreshCw className="h-3 w-3 animate-spin" /> PENDING
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          No cryptographic entries match the specified search coordinates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 3: PAYMENTS & TREASURY */}
          {activeTab === 'payments' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="tab-payments">
              
              {/* Quick transfer card trigger */}
              <div className="lg:col-span-8 space-y-6" id="payments-left">
                
                {/* Outflow / Reserve distribution form card */}
                <div className="bg-white border border-slate-150 rounded-2xl p-6 space-y-6" id="payments-executor">
                  <div className="border-b border-slate-100 pb-4" id="payments-executor-header">
                    <h3 className="font-extrabold text-slate-950 text-base">Disburse Institutional Reserves</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Direct real-time settlement across authorized sovereign vaults, corporations, and real-estate trustees.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="payments-executor-grid">
                    {/* Visual metrics & info banner */}
                    <div className="bg-slate-950 text-slate-200 p-6 rounded-2xl border border-slate-900 relative overflow-hidden flex flex-col justify-between h-64" id="payments-info-banner">
                      {/* Neural net texture */}
                      <div className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-15 pointer-events-none" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAyk-W_-zXrFU1utK8Ap0NKCvaSGAmHXWpAdJh0tm4_WpBmNiXTl5iFMToSaj0BVOgFSkdyoFmRriswYF9TS3_dcDulomMF4z9cAQdKjXr3kveNPvYByMrEvM9dkQuKZ_iNuviiJnEguvgpo2F3RV7GegZJP23a5H9grV-94zXMztJKjAbW7j3tUMJvFgdxBKHQk0QyuUSlphw6AgP4AnzRCOp392M1Ktx4q7atGIInI1oYbtyuEEjkVqrcB0ZVrKscVEOiUZVh3h9D')` }}></div>

                      <div className="space-y-3 z-10" id="payments-info-top">
                        <span className="text-[9px] font-mono font-bold text-brand-primary-container uppercase tracking-widest block">
                          TREASURY COVERAGE LIMITS
                        </span>
                        <h4 className="text-lg font-bold tracking-tight">Multi-Node Reserve Settlement</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
                          Every disburse transaction requires fractional key signing. Limit per instruction: <span className="text-white font-mono font-bold">$2,500,000 USD</span>. Overages default to Zurich manual consensus pool.
                        </p>
                      </div>

                      <div className="z-10" id="payments-info-bottom">
                        <button
                          onClick={() => {
                            playClickSound();
                            setShowTransferModal(true);
                          }}
                          className="w-full py-3 bg-brand-primary hover:bg-brand-primary-container text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                          id="payments-btn-executor-modal"
                        >
                          <Send className="h-4 w-4" />
                          Launch Secured Transfer Panel
                        </button>
                      </div>
                    </div>

                    {/* Quick transfer details form shortcut */}
                    <div className="space-y-4" id="payments-shortcut-details">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">
                        Quick Liquidity Keys
                      </span>
                      
                      <div className="space-y-3" id="quick-liquidity-keys-list">
                        <div
                          onClick={() => {
                            playClickSound();
                            setShowTransferModal(true);
                          }}
                          className="p-3 border border-slate-150 bg-slate-50 hover:bg-slate-100/80 rounded-xl flex items-center justify-between cursor-pointer transition"
                          id="liquidity-key-reit"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
                            <span className="text-xs font-bold text-slate-800">Vanguard REIT Fund Disbursal</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>

                        <div
                          onClick={() => {
                            playClickSound();
                            setShowTransferModal(true);
                          }}
                          className="p-3 border border-slate-150 bg-slate-50 hover:bg-slate-100/80 rounded-xl flex items-center justify-between cursor-pointer transition"
                          id="liquidity-key-aws"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
                            <span className="text-xs font-bold text-slate-800">AWS Infrastructure Monthly</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>

                        <div
                          onClick={() => {
                            playClickSound();
                            setShowTransferModal(true);
                          }}
                          className="p-3 border border-slate-150 bg-slate-50 hover:bg-slate-100/80 rounded-xl flex items-center justify-between cursor-pointer transition"
                          id="liquidity-key-internal"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                            <span className="text-xs font-bold text-slate-800">Internal Treasury Rebalancing</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Debit metal card and details drawer placeholder */}
              <div className="lg:col-span-4 space-y-6" id="payments-right">
                
                {/* Security Vault hardware token status */}
                <div className="bg-white border border-slate-150 p-6 rounded-2xl space-y-4" id="payments-vault-compliance">
                  <h4 className="font-extrabold text-slate-950 text-sm">Regulatory Vault Escrow</h4>
                  <p className="text-xs text-slate-500 leading-normal font-medium">
                    Fully vetted under Basel IV liquidity regulations. Core custody maintains 1:1 real-time asset backing verified by Zurich decentral node.
                  </p>
                  
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex items-center gap-2.5 text-xs font-semibold" id="vault-compliance-box">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>FDIC Insured up to $250,000,000 via FinTrust Syndicate Partners.</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: WEALTH INSIGHTS & STRATEGIC INTEL */}
          {activeTab === 'insights' && (
            <div className="space-y-8" id="tab-insights">
              <div id="insights-header">
                <span className="text-[10px] font-mono font-bold text-brand-primary uppercase tracking-widest block">
                  CIO BRIEFINGS & WEALTH STRATEGICS
                </span>
                <h3 className="text-2xl font-extrabold text-slate-950 tracking-tight mt-1">
                  SecureFin Intelligence Dispatch
                </h3>
                <p className="text-slate-500 text-sm mt-0.5 max-w-2xl">
                  Strategic high-net-worth intelligence briefings curated for Alexander Sterling and the investment committee of Sterling Capital Partners.
                </p>
              </div>

              {/* Bento Grid layout for Insights Articles with beautiful hotlinked images */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="insights-grid">
                {insights.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => {
                      playClickSound();
                      setActiveArticle(article);
                    }}
                    className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition duration-300 flex flex-col justify-between h-96 group cursor-pointer"
                    id={`insight-article-card-${article.id}`}
                  >
                    {/* Header Image */}
                    <div className="h-44 overflow-hidden relative" id="insight-image-wrapper">
                      <img
                        src={article.imageUrl}
                        alt={article.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        id={`insight-img-${article.id}`}
                      />
                      <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur border border-slate-800 text-white px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase">
                        {article.category}
                      </div>
                    </div>

                    {/* Content body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4" id="insight-content">
                      <div className="space-y-2">
                        <h4 className="font-extrabold text-slate-900 group-hover:text-brand-primary transition-colors text-sm line-clamp-2 leading-snug">
                          {article.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                          {article.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 pt-3" id="insight-footer">
                        <span>LEDGER VERIFIED CERTIFICATE</span>
                        <span className="text-brand-primary group-hover:translate-x-1 transition-transform flex items-center gap-1 font-semibold">
                          Open Intelligence
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* TAB 5: SECURITY SETTINGS REGISTRY */}
          {activeTab === 'settings' && (
            <div className="bg-white border border-slate-150 rounded-2xl p-6 lg:p-8 space-y-8" id="tab-settings">
              
              {/* Form profile */}
              <form onSubmit={handleSaveSettings} className="space-y-6" id="settings-form">
                
                <div className="border-b border-slate-150 pb-5" id="settings-form-header">
                  <h3 className="font-extrabold text-slate-950 text-base">Master Identity & Preference Configuration</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modifying registry data requires instant cryptographic write-back to security ledger nodes.
                  </p>
                </div>

                {/* Profile Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="settings-profile-grid">
                  
                  {/* Photo avatar preview */}
                  <div className="md:col-span-2 flex items-center gap-5 bg-slate-50 p-4 rounded-xl border border-slate-100" id="settings-avatar-group">
                    <img
                      src={userProfile.avatarUrl}
                      alt="Alexander Sterling headshot"
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-xl object-cover border-2 border-brand-primary"
                      id="settings-avatar-img"
                    />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Alexander Sterling</h4>
                      <p className="text-xs text-slate-400">Chief Investment Officer • Authorized Core Vault Signer</p>
                    </div>
                  </div>

                  {/* Input 1: Full Name */}
                  <div className="space-y-1.5" id="settings-name-group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Full Certified Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={userProfile.name}
                      required
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition"
                      id="settings-name-input"
                    />
                  </div>

                  {/* Input 2: Job Title */}
                  <div className="space-y-1.5" id="settings-title-group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Authorized Job Title
                    </label>
                    <input
                      type="text"
                      name="jobTitle"
                      defaultValue={userProfile.jobTitle}
                      required
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition"
                      id="settings-title-input"
                    />
                  </div>

                  {/* Input 3: Corporate Trust Org */}
                  <div className="space-y-1.5" id="settings-org-group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Institutional Trust Entity
                    </label>
                    <input
                      type="text"
                      name="organization"
                      defaultValue={userProfile.organization}
                      required
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition"
                      id="settings-org-input"
                    />
                  </div>

                  {/* Selector 1: Base Currency */}
                  <div className="space-y-1.5" id="settings-currency-group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Base Liquidity Denomination
                    </label>
                    <select
                      name="defaultCurrency"
                      defaultValue={userProfile.defaultCurrency}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition"
                      id="settings-currency-select"
                    >
                      <option value="USD ($) - United States Dollar">USD ($) - United States Dollar</option>
                      <option value="CHF (CHF) - Swiss Franc">CHF (CHF) - Swiss Franc</option>
                      <option value="EUR (€) - Eurozone Dollar">EUR (€) - Eurozone Dollar</option>
                    </select>
                  </div>
                </div>

                {/* Hardware Toggle preferences */}
                <div className="space-y-4 pt-4 border-t border-slate-100" id="settings-toggles">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block">
                    Institutional Security Protocols
                  </span>

                  <div className="space-y-3.5" id="settings-toggles-list">
                    {/* Toggle 1: 2FA */}
                    <div className="flex items-center justify-between" id="toggle-group-2fa">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Enforce Dynamic Two-Factor Tokens</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Disallow structural modifications or transfers exceeding $5,000 without validated hardware cells.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="twoFactorEnabled"
                          defaultChecked={userProfile.twoFactorEnabled}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                      </label>
                    </div>

                    {/* Toggle 2: Email alert */}
                    <div className="flex items-center justify-between" id="toggle-group-alerts">
                      <div>
                        <div className="text-xs font-bold text-slate-800">Dispatch Real-time Email Bulletins</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Automatic email warnings on all multi-sig sign events or Zurich node consensus disputes.
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="emailAlerts"
                          defaultChecked={userProfile.emailAlerts}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                      </label>
                    </div>

                    {/* Biometric Verification Simulation Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl gap-4 mt-2" id="biometric-simulation-row">
                      <div className="flex gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg h-fit shrink-0 border border-blue-500/15">
                          <Fingerprint className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Biometric Identity Signature</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Associate your workstation's physical biometric sensor (Touch ID, Windows Hello, etc.) with your multi-sig ledger profile.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setShowBiometricModal(true);
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 self-end sm:self-center shrink-0 border border-slate-800 active:scale-95 cursor-pointer shadow-sm"
                        id="btn-simulate-biometrics"
                      >
                        <Fingerprint className="h-3.5 w-3.5 text-blue-400" />
                        Verify Biometric Hardware
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2" id="settings-form-submit-wrapper">
                  <button
                    type="submit"
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow active:scale-95 cursor-pointer"
                    id="settings-btn-save"
                  >
                    Commit Security Modifications
                  </button>
                </div>
              </form>

              {/* Active Sessions Log Tracker */}
              <div className="space-y-4 pt-6 border-t border-slate-150" id="settings-active-sessions">
                <div>
                  <h4 className="font-extrabold text-slate-950 text-sm">Validated Session Hardware Ring</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Revoking a session will instantly wipe keys and log out that specific hardware interface.
                  </p>
                </div>

                <div className="space-y-3" id="settings-sessions-list">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between p-3.5 border border-slate-100 bg-slate-50/50 rounded-xl"
                      id={`session-card-${sess.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${sess.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                          <Globe className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{sess.device}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {sess.location} • token_id: {sess.id}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold font-mono text-slate-400">
                          {sess.lastActive}
                        </span>
                        {sess.status !== 'active' && (
                          <button
                            onClick={() => handleRevokeSession(sess.id)}
                            className="px-2.5 py-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition border border-red-100"
                            id={`btn-revoke-${sess.id}`}
                          >
                            Revoke Key
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </main>

        {/* Bottom Status Footer */}
        <footer className="h-8 bg-white border-t border-slate-100 flex items-center justify-between px-6 shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span>Version 4.2.0-STABLE</span>
            <span>Cloud Node: EU-WEST-1</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-500">All Systems Nominal</span>
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
        </footer>
      </div>

      {/* RENDER MODAL: NEW VAULT TRANSFER */}
      {showTransferModal && (
        <NewTransferModal
          onClose={() => setShowTransferModal(false)}
          onTransferSuccess={handleNewTransfer}
          operationalBalance={balances.operational}
          vaultBalance={balances.vault}
          reserveBalance={balances.reserve}
        />
      )}

      {/* RENDER DRAWER: CRYPTOGRAPHIC TRANSACTION DETAILS */}
      {selectedTransaction && (
        <TransactionDetailsDrawer
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      {/* RENDER MODAL: CIO BRIEFINGS DETAILS */}
      <AnimatePresence>
        {activeArticle && (
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => {
              playClickSound();
              setActiveArticle(null);
            }}
            id="article-modal-backdrop"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-150 overflow-hidden flex flex-col relative"
              id="article-modal"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={activeArticle.imageUrl}
                  alt={activeArticle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-5">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest uppercase mb-1">
                    {activeArticle.category}
                  </span>
                  <h3 className="text-white font-extrabold text-base tracking-tight leading-snug">
                    {activeArticle.title}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveArticle(null);
                  }}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950/50 backdrop-blur text-white hover:bg-slate-950/85 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-4" id="article-modal-body">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {activeArticle.description}
                </p>
                <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3" id="article-bullet-points">
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Committee Recommendations
                  </h5>
                  <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4 leading-relaxed font-semibold">
                    <li>Maintain Q4 allocation structures inside local sovereign currency brackets.</li>
                    <li>Utilize fractional secure key nodes for cross-border settlements over $50k.</li>
                    <li>Align long-term sovereign assets with standard Basel compliance criteria.</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end" id="article-modal-footer">
                <button
                  onClick={() => {
                    playClickSound();
                    setActiveArticle(null);
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow active:scale-95"
                >
                  Close Briefing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RENDER MODAL: BIOMETRIC VERIFICATION */}
      <AnimatePresence>
        {showBiometricModal && (
          <BiometricVerificationModal
            onClose={() => setShowBiometricModal(false)}
            onSuccess={() => {
              triggerToast('Biometric identity verified: Master keys synchronized.');
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
