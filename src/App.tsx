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
  Fingerprint,
  Terminal,
  ChevronDown,
  ChevronUp,
  Play,
  Check,
  AlertTriangle,
  Cpu,
  Layers,
  Camera,
  EyeOff
} from 'lucide-react';

import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { SecureFinLogo } from './components/SecureFinLogo';
import { TransactionDetailsDrawer } from './components/TransactionDetailsDrawer';
import { NewTransferModal } from './components/NewTransferModal';
import { BiometricVerificationModal } from './components/BiometricVerificationModal';
import { FaceVerificationProvider } from './FaceVerificationContext';
import { FaceEnrollmentModal } from './components/FaceEnrollmentModal';

import {
  initialUserProfile,
  initialSessions,
  initialTransactions,
  initialScheduledObligations,
  initialInsights
} from './data';
import { UserProfile, Transaction } from './types';
import { getSecurityModules, executeSecurityModule, SecurityModule } from './security';
import { playClickSound, playSuccessSound, playTransitionSound } from './utils/audio';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  // Authentication & View Flow State
  const [pageState, setPageState] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'ledger' | 'payments' | 'insights' | 'settings' | 'admin'>('dashboard');

  // Firebase auth client state
  const [authToken, setAuthToken] = useState<string | null>(null);

  const fetchUserData = async (token: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Check if profile exists first to handle auto-sync if missing
      let profileRes = await fetch('/api/user/profile', { headers });
      
      if (profileRes.status === 404) {
        console.log('User profile not found. Triggering identity synchronization...');
        const syncRes = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (syncRes.ok) {
          profileRes = await fetch('/api/user/profile', { headers });
        }
      }

      const [txRes, obligationsRes, sessionsRes, balancesRes] = await Promise.all([
        fetch('/api/transactions', { headers }),
        fetch('/api/scheduled-obligations', { headers }),
        fetch('/api/sessions', { headers }),
        fetch('/api/balances', { headers }),
      ]);

      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUserProfile(profile);
        if (profile.faceDescriptor && profile.email) {
          const emailKey = profile.email.toLowerCase().trim();
          localStorage.setItem(`fintrust_face_baseline_${emailKey}`, JSON.stringify(profile.faceDescriptor));
          localStorage.setItem(`fintrust_face_baseline_global`, JSON.stringify(profile.faceDescriptor));
        }
        if (profile.role === 'admin') {
          setActiveTab('admin');
        }
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
    const customToken = localStorage.getItem('fintrust_custom_token');
    if (customToken) {
      localStorage.removeItem('fintrust_is_google_user');
      setAuthToken(customToken);
      setPageState('dashboard');
      fetchUserData(customToken);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        localStorage.setItem('fintrust_is_google_user', 'true');
        
        // If Google registration is currently in progress, let the register flow guide the steps (Google Details & Biometrics)
        if (localStorage.getItem('fintrust_registering_google') === 'true') {
          return;
        }

        setAuthToken(token);
        setPageState('dashboard');
        fetchUserData(token);
      } else {
        if (!localStorage.getItem('fintrust_custom_token')) {
          localStorage.removeItem('fintrust_is_google_user');
          setAuthToken(null);
          setPageState('landing');
        }
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

  // Dynamic Cash Flow / Liquidity State — loaded from Supabase, initialized to database defaults
  const [balances, setBalances] = useState({
    operational: 254820.00,
    vault: 1420000.00,
    reserve: 8500000.00,
  });

  // UI Interactive States
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showFaceEnrollModal, setShowFaceEnrollModal] = useState(false);
  const [multiFacePauseEnabled, setMultiFacePauseEnabled] = useState(false);
  const [cardFrozen, setCardFrozen] = useState(false);

  useEffect(() => {
    if (userProfile?.email) {
      const emailKey = userProfile.email.toLowerCase().trim();
      const val = localStorage.getItem(`fintrust_multi_face_pause_${emailKey}`);
      if (val !== null) {
        setMultiFacePauseEnabled(val === 'true');
      } else {
        const globalVal = localStorage.getItem('fintrust_multi_face_pause_global');
        setMultiFacePauseEnabled(globalVal === 'true');
      }
    }
  }, [userProfile]);

  // Auto-prompt face biometrics setup if user lacks registered face
  useEffect(() => {
    if (pageState === 'dashboard' && userProfile && userProfile.email && userProfile.email !== 'no-email@fintrust.global') {
      const emailKey = userProfile.email.toLowerCase().trim();
      const stored = localStorage.getItem(`fintrust_face_baseline_${emailKey}`) || localStorage.getItem('fintrust_face_baseline_global');
      if (!stored && !userProfile.faceDescriptor) {
        console.log('[Face Shield] No face signature found. Prompting enrollment...');
        const timer = setTimeout(() => {
          setShowFaceEnrollModal(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [pageState, userProfile]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<string | null>(null);

  // Search and Filter state in Ledger tab
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('All');

  // Selected Insight Article modal
  const [activeArticle, setActiveArticle] = useState<typeof initialInsights[0] | null>(null);

  // Security Feature Modules states
  const [securityModules, setSecurityModules] = useState<SecurityModule[]>([]);
  const [runningModuleId, setRunningModuleId] = useState<string | null>(null);
  const [expandedLogModuleId, setExpandedLogModuleId] = useState<string | null>(null);

  // Admin Portal State
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any | null>(null);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminUserSearch, setAdminUserSearch] = useState<string>('');
  const [adminAuditSearch, setAdminAuditSearch] = useState<string>('');

  const fetchAdminData = async () => {
    if (!authToken) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      const headers = { 'Authorization': `Bearer ${authToken}` };
      const [usersRes, auditRes, healthRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/audit-logs', { headers }),
        fetch('/api/admin/system-health', { headers })
      ]);

      if (usersRes.ok && auditRes.ok && healthRes.ok) {
        const usersData = await usersRes.json();
        const auditData = await auditRes.json();
        const healthData = await healthRes.json();
        setAdminUsers(usersData);
        setAdminAuditLogs(auditData);
        setSystemHealth(healthData);
      } else {
        const isForbidden = usersRes.status === 403 || auditRes.status === 403 || healthRes.status === 403;
        const errData = isForbidden
          ? { error: 'Access Denied: Admin authorization required' }
          : await auditRes.json().catch(() => ({ error: 'Failed to load administrative logs' }));
        setAdminError(errData.error || 'Failed to load administrative registers.');
      }
    } catch (err: any) {
      console.error('Failed to load administrative logs:', err);
      setAdminError('Failed to establish connection with administrative endpoint.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleUpdateUserRole = async (targetUid: string, newRole: 'user' | 'admin') => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ targetUid, newRole })
      });
      if (res.ok) {
        triggerToast(`Role updated to: ${newRole.toUpperCase()}`);
        fetchAdminData();
      } else {
        const err = await res.json();
        triggerToast(err.error || 'Failed to update user privilege.');
      }
    } catch (e) {
      console.error('Role update failed:', e);
      triggerToast('Connection error during cryptographic role update.');
    }
  };

  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAdminData();
    }
  }, [activeTab, authToken]);

  useEffect(() => {
    setSecurityModules(getSecurityModules());
  }, []);

  const handleRunSecurityModule = async (moduleId: string) => {
    playClickSound();
    setRunningModuleId(moduleId);
    try {
      // Simulate real calculation latency
      await new Promise((resolve) => setTimeout(resolve, 800));
      const res = await executeSecurityModule(moduleId, { transactions });
      setSecurityModules(getSecurityModules());
      if (res.success) {
        triggerToast(`Security sweep complete: ${res.message}`);
        playSuccessSound();
      } else {
        triggerToast(`Security module warning: ${res.message}`);
      }
    } catch (e: any) {
      triggerToast(`Error executing module: ${e.message}`);
    } finally {
      setRunningModuleId(null);
    }
  };

  const handleRunAllSecurityModules = async () => {
    playClickSound();
    triggerToast('Initiating full secure hardware security suite run...');
    const modules = getSecurityModules();
    for (const mod of modules) {
      if (mod.status === 'active') {
        setRunningModuleId(mod.id);
        await new Promise((resolve) => setTimeout(resolve, 600));
        await executeSecurityModule(mod.id, { transactions });
        setSecurityModules(getSecurityModules());
      }
    }
    setRunningModuleId(null);
    triggerToast('All institutional security modules successfully validated.');
    playSuccessSound();
  };

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
    } else {
      localStorage.removeItem('fintrust_registering_google');
    }
  };

  const handleLogout = async () => {
    playTransitionSound();
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('fintrust_custom_token');
    localStorage.removeItem('fintrust_is_google_user');
    setAuthToken(null);
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
          throw new Error('Secure ledger failed to write block.');
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

      // Compute and update local balances
      const nextBalances = (() => {
        if (accountName.includes('Operational')) return { ...balances, operational: balances.operational - amount };
        if (accountName.includes('Vault')) return { ...balances, vault: balances.vault - amount };
        return { ...balances, reserve: balances.reserve - amount };
      })();

      setBalances(nextBalances);

      // Persist updated balances to Supabase if logged in
      if (authToken) {
        const balResponse = await fetch('/api/balances', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(nextBalances)
        });
        if (!balResponse.ok) {
          console.error('Balance persistence failed.');
        }
      }

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
          let errMsg = 'Vault registry update rejected.';
          try {
            const errData = await response.json();
            if (errData && errData.error) {
              errMsg = errData.error + (errData.details ? `: ${errData.details}` : '');
            }
          } catch (e) {
            // ignore JSON parse error
          }
          throw new Error(errMsg);
        }
      } else {
        setUserProfile((prev) => ({
          ...prev,
          ...updatedProfile,
        }));
      }

      // Persist multi-face pause configuration locally
      if (userProfile?.email) {
        const emailKey = userProfile.email.toLowerCase().trim();
        localStorage.setItem(`fintrust_multi_face_pause_${emailKey}`, multiFacePauseEnabled ? 'true' : 'false');
        localStorage.setItem('fintrust_multi_face_pause_global', multiFacePauseEnabled ? 'true' : 'false');
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
        String(trx.id).toLowerCase().includes(ledgerSearch.toLowerCase()) ||
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
        onLoginSuccess={(profile, token) => {
          if (token) {
            localStorage.setItem('fintrust_custom_token', token);
            setAuthToken(token);
            fetchUserData(token);
          }
          if (profile) {
            setUserProfile(profile);
            if (profile.faceDescriptor && profile.email) {
              const emailKey = profile.email.toLowerCase().trim();
              localStorage.setItem(`fintrust_face_baseline_${emailKey}`, JSON.stringify(profile.faceDescriptor));
              localStorage.setItem(`fintrust_face_baseline_global`, JSON.stringify(profile.faceDescriptor));
            }
          }
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
        onRegisterSuccess={(profile, token) => {
          localStorage.removeItem('fintrust_registering_google');
          if (token) {
            localStorage.setItem('fintrust_custom_token', token);
            setAuthToken(token);
            fetchUserData(token);
          }
          if (profile) {
            setUserProfile(profile as any);
            if (profile.faceDescriptor && profile.email) {
              const emailKey = profile.email.toLowerCase().trim();
              localStorage.setItem(`fintrust_face_baseline_${emailKey}`, JSON.stringify(profile.faceDescriptor));
              localStorage.setItem(`fintrust_face_baseline_global`, JSON.stringify(profile.faceDescriptor));
            }
          }
          triggerToast('Institutional identity registered and keys deployed successfully.');
          handlePageChange('dashboard');
        }}
        onBackToHome={() => handlePageChange('landing')}
        onGoToLogin={() => handlePageChange('login')}
      />
    );
  }

  return (
    <FaceVerificationProvider
      userProfile={userProfile}
      onLogout={handleLogout}
    >
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
          {userProfile.role === 'admin' ? (
            <>
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3 font-mono">
                Administrative Control
              </span>
              
              <button
                onClick={() => handleTabChange('admin')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${
                  activeTab === 'admin'
                    ? 'bg-brand-secondary-container text-brand-primary shadow-sm'
                    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                }`}
                id="sidebar-tab-admin"
              >
                <Shield className="h-4.5 w-4.5 text-brand-primary" />
                Admin Portal
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </nav>

        {/* Quick transfer button inside sidebar */}
        <div className="p-4 border-t border-slate-200 space-y-4" id="sidebar-footer-controls">
          {userProfile.role !== 'admin' && (
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
          )}

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
                {activeTab === 'dashboard' ? 'Core Portfolio' : activeTab === 'ledger' ? 'Immutable Activity Ledger' : activeTab === 'payments' ? 'Treasury Reserves' : activeTab === 'insights' ? 'Strategic Intelligence' : activeTab === 'settings' ? 'Security Registry' : 'Admin Portal'}
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
                    {userProfile.role === 'admin' ? (
                      <button
                        onClick={() => handleTabChange('admin')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'admin' ? 'bg-brand-secondary-container text-brand-primary shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                      >
                        <Shield className="h-4.5 w-4.5 text-brand-primary" />
                        Admin Portal
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleTabChange('dashboard')}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'dashboard' ? 'bg-brand-secondary-container text-brand-primary shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <LayoutDashboard className="h-4.5 w-4.5" />
                          Core Dashboard
                        </button>
                        <button
                          onClick={() => handleTabChange('ledger')}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'ledger' ? 'bg-brand-secondary-container text-brand-primary shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <Receipt className="h-4.5 w-4.5" />
                          Activity Ledger
                        </button>
                        <button
                          onClick={() => handleTabChange('payments')}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'payments' ? 'bg-brand-secondary-container text-brand-primary shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <CreditCard className="h-4.5 w-4.5" />
                          Treasury & Cards
                        </button>
                        <button
                          onClick={() => handleTabChange('insights')}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'insights' ? 'bg-brand-secondary-container text-brand-primary shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <Lightbulb className="h-4.5 w-4.5" />
                          Wealth Insights
                        </button>
                        <button
                          onClick={() => handleTabChange('settings')}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold tracking-tight transition ${activeTab === 'settings' ? 'bg-brand-secondary-container text-brand-primary shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <Settings className="h-4.5 w-4.5" />
                          Security Settings
                        </button>
                      </>
                    )}
                  </nav>
                </div>

                <div className="space-y-4">
                  {userProfile.role !== 'admin' && (
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
                  )}
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
                        Capital allocations and high-grade trust distributions.
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
                          0x7f39a1c{String(trx.id).split('-')[1] || String(trx.id)}e4b5...
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
                      Direct real-time settlement across authorized secure vaults, corporations, and real-estate trustees.
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
                  Strategic high-net-worth intelligence briefings curated for {userProfile.name} and the investment committee of {userProfile.organization || "Sterling Capital Partners"}.
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
                      alt={`${userProfile.name} headshot`}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-xl object-cover border-2 border-brand-primary"
                      id="settings-avatar-img"
                    />
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{userProfile.name}</h4>
                      <p className="text-xs text-slate-400">
                        {userProfile.jobTitle} • {userProfile.organization || "Authorized Core Vault Signer"}
                      </p>
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

                    {/* Face Verification Enrollment Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl gap-4 mt-2" id="face-enrollment-row">
                      <div className="flex gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg h-fit shrink-0 border border-indigo-500/15">
                          <Camera className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            Continuous Face Shield Signature
                            {localStorage.getItem(`fintrust_face_baseline_${userProfile?.email?.toLowerCase().trim()}`) || localStorage.getItem('fintrust_face_baseline_global') ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full font-mono">
                                ● ENROLLED
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full font-mono">
                                ● NOT ENROLLED
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Register or retake your workstation's facial biometric template baseline to secure active sessions with continuous 10-second sweeps.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setShowFaceEnrollModal(true);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 self-end sm:sm:self-center shrink-0 border border-indigo-700 active:scale-95 cursor-pointer shadow-sm"
                        id="btn-enroll-face-settings"
                      >
                        <Camera className="h-3.5 w-3.5 text-indigo-200" />
                        Register / Retake Face
                      </button>
                    </div>

                    {/* Shoulder-Surfing Auto-Pause Toggle Row */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl gap-4 mt-2" id="settings-multi-face-pause-row">
                      <div className="flex gap-3">
                        <div className="p-2 bg-rose-500/10 text-rose-600 rounded-lg h-fit shrink-0 border border-rose-500/15">
                          <EyeOff className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Shoulder-Surfing Privacy Shield</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Automatically pause active workspace for 3 seconds if secondary viewers or multiple faces are detected looking at the screen.
                          </div>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          name="multiFacePauseEnabled"
                          checked={multiFacePauseEnabled}
                          onChange={(e) => {
                            playClickSound();
                            setMultiFacePauseEnabled(e.target.checked);
                            if (userProfile?.email) {
                              const emailKey = userProfile.email.toLowerCase().trim();
                              localStorage.setItem(`fintrust_multi_face_pause_${emailKey}`, e.target.checked ? 'true' : 'false');
                              localStorage.setItem('fintrust_multi_face_pause_global', e.target.checked ? 'true' : 'false');
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                      </label>
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

          {/* TAB 6: SOVEREIGN ADMIN PORTAL */}
          {activeTab === 'admin' && (
            <div className="space-y-6" id="tab-admin-portal">
              
              {/* Top Row: System Health, Connection Stats & Defenses */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Host Health Metrics */}
                <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4" id="admin-health-metrics">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4.5 w-4.5 text-brand-primary" />
                      <span className="text-xs font-bold text-slate-800">System Health</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 animate-pulse">
                      ONLINE
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Uptime</span>
                      <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : systemHealth.uptime}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Memory RSS</span>
                      <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : `${systemHealth.memory?.rss || '0'} MB`}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Runtime</span>
                      <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : systemHealth.nodeVersion}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Environment</span>
                      <span className="text-sm font-bold text-indigo-600 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : (systemHealth.env || 'production').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Storage & Database Gateway */}
                <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4" id="admin-db-gateway">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4.5 w-4.5 text-brand-primary" />
                      <span className="text-xs font-bold text-slate-800">Database & Registry Sync</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                      SECURE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">PG Client Pool</span>
                      <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : '10 / 10 Max'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Query Latency</span>
                      <span className="text-sm font-bold text-emerald-600 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : `${systemHealth.dbLatencyMs} ms`}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Total Users</span>
                      <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                        {adminLoading ? '...' : adminUsers.length}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Auth Provider</span>
                      <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                        Firebase
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Shield Metrics & Interventions */}
                <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4" id="admin-shield-metrics">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-800">Active Shield Interventions</span>
                    </div>
                    <button
                      onClick={fetchAdminData}
                      disabled={adminLoading}
                      className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                      id="btn-refresh-admin-data"
                      title="Refresh real-time diagnostics"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Blocked IPs</span>
                      <span className="text-sm font-bold text-rose-600 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : systemHealth.securityMetrics?.blockedIpsCount || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Sanitized Fields</span>
                      <span className="text-sm font-bold text-amber-600 font-mono mt-0.5 block">
                        {adminLoading || !systemHealth ? '...' : systemHealth.securityMetrics?.sanitizationCount || 0}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl col-span-2 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Security Status</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 block">Shields actively defending routes</span>
                      </div>
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-lg border border-emerald-100">
                        100% DEPLOYED
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Callout if any */}
              {adminError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 space-y-3 shadow-sm">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
                  <h4 className="font-bold text-sm">Administrative Authority Verification Failed</h4>
                  <p className="text-xs max-w-md mx-auto">{adminError}</p>
                </div>
              )}

              {!adminError && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  
                  {/* Left Section: Identity Directory + Active Shields List & Interactive Sweeps (6 cols on XL) */}
                  <div className="xl:col-span-6 space-y-6">
                    
                    {/* A. Identity Directory */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-sm" id="admin-user-registry">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm">Identity Registry</h3>
                          <p className="text-[10px] text-slate-400">Manage directory records and permission ring mappings.</p>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search identity..."
                            value={adminUserSearch}
                            onChange={(e) => setAdminUserSearch(e.target.value)}
                            className="w-full sm:w-48 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition"
                          />
                          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                        </div>
                      </div>

                      {adminLoading ? (
                        <div className="py-12 text-center text-slate-400 text-xs font-mono animate-pulse">
                          Synchronizing master directory matrices...
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1 space-y-3">
                          {adminUsers
                            .filter(u => 
                              u.name.toLowerCase().includes(adminUserSearch.toLowerCase()) || 
                              u.email.toLowerCase().includes(adminUserSearch.toLowerCase()) || 
                              (u.role || 'user').toLowerCase().includes(adminUserSearch.toLowerCase())
                            )
                            .map((u) => {
                              return (
                                <div key={u.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 first:pt-0">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`}
                                      alt={u.name}
                                      className="h-9 w-9 rounded-lg object-cover border border-slate-200"
                                    />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800">{u.name}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider uppercase ${u.role === 'admin' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-500'}`}>
                                          {u.role || 'user'}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-medium">{u.email} • {u.jobTitle || 'Unassigned Node'}</div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                                    <div className="flex gap-1">
                                      {u.role === 'admin' ? (
                                        <button
                                          onClick={() => handleUpdateUserRole(u.uid, 'user')}
                                          disabled={u.email === userProfile.email}
                                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-lg text-[10px] font-bold transition border border-slate-200 cursor-pointer"
                                          title={u.email === userProfile.email ? "Cannot demote yourself" : "Demote to normal user role"}
                                        >
                                          Demote
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleUpdateUserRole(u.uid, 'admin')}
                                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold transition border border-red-100 cursor-pointer"
                                          title="Promote to system admin role"
                                        >
                                          Promote
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* B. Active Shields, Actions & Automated Sweeps */}
                    <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-sm" id="admin-shield-controller">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm">System Protection Sweeps</h3>
                          <p className="text-[10px] text-slate-400">Validate active defense signatures and execute sweeps on demand.</p>
                        </div>
                        <button
                          onClick={handleRunAllSecurityModules}
                          disabled={runningModuleId !== null}
                          className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary-container text-white rounded-xl text-[10px] font-bold tracking-tight transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          Trigger Full Suite Scan
                        </button>
                      </div>

                      <div className="space-y-3">
                        {securityModules.map((mod) => (
                          <div key={mod.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${mod.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Shield className="h-4.5 w-4.5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">{mod.name}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${mod.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                                    {mod.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                                  {mod.description}
                                </p>
                                {mod.lastResult && (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <span className="text-[8px] font-bold font-mono text-slate-400 uppercase">Last Run Result:</span>
                                    <span className={`text-[9px] font-mono font-bold ${mod.lastResult.success ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {mod.lastResult.message}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleRunSecurityModule(mod.id)}
                              disabled={runningModuleId !== null}
                              className="px-2.5 py-1 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-[10px] font-bold transition shrink-0 cursor-pointer"
                            >
                              {runningModuleId === mod.id ? 'Running...' : 'Run Sweep'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Right Section: Cryptographic Security Audit Log (6 cols on XL) */}
                  <div className="xl:col-span-6 bg-white border border-slate-150 rounded-2xl p-5 space-y-4 shadow-sm" id="admin-audit-log-panel">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">Security Audit Logs</h3>
                        <p className="text-[10px] text-slate-400">Immutable security event registry for system diagnostics & compliance.</p>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search logs (IP, event, context)..."
                          value={adminAuditSearch}
                          onChange={(e) => setAdminAuditSearch(e.target.value)}
                          className="w-full sm:w-64 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary focus:bg-white transition"
                        />
                        <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                      </div>
                    </div>

                    {adminLoading ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-mono animate-pulse">
                        Synchronizing master cryptographic security records...
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto pr-1 space-y-3">
                        {adminAuditLogs.length === 0 ? (
                          <div className="py-12 text-center text-slate-400 text-xs font-mono">
                            No cryptographic logs recorded. System pristine.
                          </div>
                        ) : (
                          adminAuditLogs
                            .filter(log => {
                              const eventName = log.event || log.eventType || '';
                              const searchStr = `${log.timestamp} ${eventName} ${log.ipAddress || ''} ${log.userId || ''} ${JSON.stringify(log.details || {})}`.toLowerCase();
                              return searchStr.includes(adminAuditSearch.toLowerCase());
                            })
                            .map((log, index) => {
                              const logKey = `${log.timestamp}-${index}`;
                              const isExpanded = expandedAuditLogId === logKey;
                              const eventName = log.event || log.eventType || '';
                              const isBreach = eventName.includes('BREACH') || eventName.includes('BLOCKED') || eventName.includes('ATTACK');
                              const isSanitize = eventName.includes('SANITIZATION') || eventName.includes('XSS') || eventName.includes('SANITIZED');
                              
                              let badgeColor = "bg-slate-100 text-slate-600";
                              if (isBreach) badgeColor = "bg-rose-50 text-rose-600 border border-rose-100";
                              else if (isSanitize) badgeColor = "bg-amber-50 text-amber-600 border border-amber-100";
                              else if (eventName.includes('SUCCESS') || eventName.includes('SYNC')) badgeColor = "bg-emerald-50 text-emerald-600 border border-emerald-100";

                              return (
                                <div key={logKey} className="pt-3 first:pt-0 space-y-2">
                                  <div 
                                    onClick={() => setExpandedAuditLogId(isExpanded ? null : logKey)}
                                    className="flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition"
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <div className="shrink-0 mt-0.5">
                                        <Terminal className={`h-4 w-4 ${isBreach ? 'text-rose-500' : isSanitize ? 'text-amber-500' : 'text-slate-500'}`} />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-bold text-slate-800 tracking-tight">{eventName}</span>
                                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${badgeColor}`}>
                                            {log.ipAddress || log.details?.ipAddress || log.details?.ip || '0.0.0.0'}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                          {log.timestamp}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <span className="text-[9px] font-mono font-bold text-slate-400">
                                        {isExpanded ? 'Collapse' : 'Expand Details'}
                                      </span>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: -4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="p-3 bg-slate-900 rounded-xl text-[10px] font-mono text-slate-300 overflow-x-auto space-y-1.5 border border-slate-800 shadow-inner"
                                    >
                                      <div className="flex justify-between border-b border-slate-800 pb-1 mb-1.5">
                                        <span className="text-slate-500 font-bold uppercase text-[9px]">Log Metadata Payload</span>
                                        <span className="text-emerald-400 font-bold uppercase text-[9px]">Verified Integrity Hash</span>
                                      </div>
                                      <div><span className="text-slate-500">Event Type:</span> {eventName}</div>
                                      <div><span className="text-slate-500">Timestamp:</span> {log.timestamp}</div>
                                      <div><span className="text-slate-500">IP Origin:</span> {log.ipAddress || log.details?.ipAddress || log.details?.ip || 'Internal Loopback'}</div>
                                      {log.userId && <div><span className="text-slate-500">Origin Node:</span> {log.userId}</div>}
                                      {log.details && (
                                        <div className="mt-2 space-y-1">
                                          <div className="text-slate-500 font-bold border-t border-slate-800 pt-1.5 mt-1.5">Context Parameters:</div>
                                          <pre className="text-indigo-300 text-[9px] whitespace-pre-wrap leading-relaxed">
                                            {JSON.stringify(log.details, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}
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
          userName={userProfile.name}
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
                    <li>Maintain Q4 allocation structures inside local currency brackets.</li>
                    <li>Utilize fractional secure key nodes for cross-border settlements over $50k.</li>
                    <li>Align long-term secure assets with standard Basel compliance criteria.</li>
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
            userEmail={userProfile.email}
            userDisplayName={userProfile.name}
            onSuccess={() => {
              if (userProfile && userProfile.email) {
                try {
                  const saved = localStorage.getItem('fintrust_biometric_emails') || '[]';
                  const emails = JSON.parse(saved);
                  if (!emails.includes(userProfile.email)) {
                    emails.push(userProfile.email);
                    localStorage.setItem('fintrust_biometric_emails', JSON.stringify(emails));
                  }
                } catch (e) {
                  console.error('Failed to save biometric profile:', e);
                }
              }
              triggerToast('Biometric identity verified: Master keys synchronized.');
            }}
          />
        )}
      </AnimatePresence>

      {/* RENDER MODAL: FACE BIOMETRIC ENROLLMENT */}
      <AnimatePresence>
        {showFaceEnrollModal && (
          <FaceEnrollmentModal
            onClose={() => setShowFaceEnrollModal(false)}
            userEmail={userProfile.email}
            onSuccess={async (descriptor) => {
              try {
                const token = authToken || localStorage.getItem('fintrust_custom_token');
                if (token) {
                  const numericArray = Array.from(descriptor);
                  const response = await fetch('/api/user/profile', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                      ...userProfile,
                      faceDescriptor: numericArray
                    })
                  });
                  if (!response.ok) {
                    console.error('Failed to sync biometric profile with server.');
                  }
                }
              } catch (e) {
                console.error('Failed to sync biometric profile:', e);
              }
              // Force local reference update so FaceVerificationProvider rechecks baseline
              const numericArray = Array.from(descriptor);
              setUserProfile({ ...userProfile, faceDescriptor: numericArray });
              triggerToast('Continuous Face Shield Signature registered successfully.');
              setShowFaceEnrollModal(false);
            }}
          />
        )}
      </AnimatePresence>

    </div>
    </FaceVerificationProvider>
  );
}
