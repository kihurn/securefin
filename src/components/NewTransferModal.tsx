import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Landmark, ArrowRight, ShieldCheck, HelpCircle, Loader2, Info } from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/audio';

interface NewTransferModalProps {
  onClose: () => void;
  onTransferSuccess: (amount: number, recipientName: string, category: string, notes: string, accountName: string) => void;
  operationalBalance: number;
  vaultBalance: number;
  reserveBalance: number;
}

export const NewTransferModal: React.FC<NewTransferModalProps> = ({
  onClose,
  onTransferSuccess,
  operationalBalance,
  vaultBalance,
  reserveBalance,
}) => {
  const [step, setStep] = useState<'edit' | 'submitting' | 'success'>('edit');
  const [recipient, setRecipient] = useState('Vanguard Global REIT Fund');
  const [customRecipient, setCustomRecipient] = useState('');
  const [account, setAccount] = useState<'operational' | 'vault' | 'reserve'>('operational');
  const [amount, setAmount] = useState('4500');
  const [notes, setNotes] = useState('Monthly corporate real estate yield allocation');
  const [category, setCategory] = useState<'Technology' | 'Financial Services' | 'Travel' | 'Infrastructure' | 'Dining' | 'Income' | 'Utilities'>('Financial Services');
  
  const [submittingProgress, setSubmittingProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const quickRecipients = [
    'Vanguard Global REIT Fund',
    'Amazon Web Services',
    'Cloudflare Inc.',
    'Internal Savings Vault',
    'Custom Recipient...',
  ];

  const getAvailableBalance = () => {
    if (account === 'operational') return operationalBalance;
    if (account === 'vault') return vaultBalance;
    return reserveBalance;
  };

  const getAccountName = () => {
    if (account === 'operational') return 'Operational Treasury';
    if (account === 'vault') return 'Liquidity Storage Vault';
    return 'Asset Management Reserve';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setErrorMessage('Please enter a valid numeric transfer amount.');
      playErrorSound();
      return;
    }

    const available = getAvailableBalance();
    if (transferAmount > available) {
      setErrorMessage('Insufficient reserves available in the selected treasury vault.');
      playErrorSound();
      return;
    }

    setErrorMessage('');
    setStep('submitting');
    
    // Play multi-stage simulated ledger commitment
    const progressStages = [
      'Establishing secure TLS-1.3 session channel...',
      'Encrypting payload with SHA-256 Multi-sig keys...',
      'Disbursing transaction request to Zürich node clusters...',
      'Awaiting cryptographic consensus confirmation...',
      'Finalizing ledger entry and signing block payload...'
    ];

    let stageIndex = 0;
    setSubmittingProgress(progressStages[0]);

    const interval = setInterval(() => {
      stageIndex++;
      if (stageIndex < progressStages.length) {
        setSubmittingProgress(progressStages[stageIndex]);
      } else {
        clearInterval(interval);
        playSuccessSound();
        setStep('success');
        // Commit actual transaction in database
        const finalRecipient = recipient === 'Custom Recipient...' ? customRecipient || 'Custom Recipient' : recipient;
        setTimeout(() => {
          onTransferSuccess(transferAmount, finalRecipient, category, notes, getAccountName());
        }, 1500);
      }
    }, 900);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 transition-opacity flex items-center justify-center p-4"
        onClick={() => {
          if (step !== 'submitting') {
            playClickSound();
            onClose();
          }
        }}
        id="modal-backdrop"
      >
        {/* Modal panel container */}
        <div
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-150 overflow-hidden flex flex-col relative"
          onClick={(e) => e.stopPropagation()}
          id="modal-panel"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50" id="modal-header">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Transfer Treasury Reserves</h3>
                <p className="text-[10px] font-mono text-slate-400">LEDGER DIRECTORY • SECURE ROUTING</p>
              </div>
            </div>
            {step !== 'submitting' && (
              <button
                onClick={() => {
                  playClickSound();
                  onClose();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-150 transition"
                id="modal-close-btn"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {step === 'edit' && (
              <motion.form
                key="edit-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleSubmit}
                className="p-6 space-y-5"
                id="modal-form-body"
              >
                {/* Source Treasury account */}
                <div className="space-y-1.5" id="modal-account-group">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Debit Treasury Vault
                  </label>
                  <div className="grid grid-cols-3 gap-3" id="modal-account-selector">
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setAccount('operational');
                      }}
                      className={`p-3 rounded-xl border text-left transition ${
                        account === 'operational'
                          ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                      id="modal-btn-operational"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider font-mono">Operational</div>
                      <div className="text-sm font-extrabold font-mono mt-1">
                        ${operationalBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setAccount('vault');
                      }}
                      className={`p-3 rounded-xl border text-left transition ${
                        account === 'vault'
                          ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                      id="modal-btn-vault"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider font-mono">Storage Vault</div>
                      <div className="text-sm font-extrabold font-mono mt-1">
                        ${vaultBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setAccount('reserve');
                      }}
                      className={`p-3 rounded-xl border text-left transition ${
                        account === 'reserve'
                          ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                      id="modal-btn-reserve"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider font-mono">Reserve</div>
                      <div className="text-sm font-extrabold font-mono mt-1">
                        ${reserveBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Recipient selection */}
                <div className="grid grid-cols-2 gap-4" id="modal-recipient-category-grid">
                  <div className="space-y-1.5" id="modal-recipient-group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Recipient Entity
                    </label>
                    <select
                      value={recipient}
                      onChange={(e) => {
                        playClickSound();
                        setRecipient(e.target.value);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      id="modal-recipient-select"
                    >
                      {quickRecipients.map((rec, i) => (
                        <option key={i} value={rec}>
                          {rec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5" id="modal-category-group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Asset Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => {
                        playClickSound();
                        setCategory(e.target.value as any);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      id="modal-category-select"
                    >
                      <option value="Financial Services">Financial Services</option>
                      <option value="Technology">Technology</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Travel">Travel</option>
                      <option value="Dining">Dining</option>
                      <option value="Utilities">Utilities</option>
                    </select>
                  </div>
                </div>

                {/* Custom recipient input if customized */}
                {recipient === 'Custom Recipient...' && (
                  <div className="space-y-1.5" id="modal-custom-recipient-group">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      Custom Recipient Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Zurich Asset Management"
                      value={customRecipient}
                      onChange={(e) => setCustomRecipient(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary font-semibold"
                      id="modal-custom-recipient-input"
                    />
                  </div>
                )}

                {/* Amount input */}
                <div className="space-y-1.5" id="modal-amount-group">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    <span>Transfer Amount (USD)</span>
                    <span>
                      Max: <span className="text-slate-800">${getAvailableBalance().toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </span>
                  </div>
                  <div className="relative rounded-xl shadow-xs" id="modal-amount-wrapper">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-400 font-bold font-mono">$</span>
                    </div>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono font-bold text-slate-800"
                      id="modal-amount-input"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-xs font-bold font-mono">USD</span>
                    </div>
                  </div>
                </div>

                {/* Notes/Purpose */}
                <div className="space-y-1.5" id="modal-notes-group">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    Ledger Compliance Note
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide purpose description for regulatory tracking..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary font-medium"
                    id="modal-notes-input"
                  />
                </div>

                {/* Error handling message */}
                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 flex items-center gap-2" id="modal-error">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Transfer summary box */}
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl text-[11px] text-slate-500 leading-normal flex items-start gap-2" id="modal-summary-box">
                  <Landmark className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    Your transfer of{' '}
                    <span className="font-bold text-slate-800 font-mono">
                      ${parseFloat(amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>{' '}
                    will be debited from <span className="font-bold text-slate-800">{getAccountName()}</span>, routed securely to{' '}
                    <span className="font-bold text-slate-800">
                      {recipient === 'Custom Recipient...' ? customRecipient || 'Custom Recipient' : recipient}
                    </span>
                    , and logged forever in the immutable SecureFin audit vault.
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-brand-primary hover:bg-brand-primary-container text-white text-sm font-bold shadow-lg shadow-brand-primary/10 transition flex items-center justify-center gap-2 active:scale-95"
                  id="modal-btn-submit"
                >
                  Verify & Execute Transfer
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.form>
            )}

            {step === 'submitting' && (
              <motion.div
                key="submitting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-12 text-center flex flex-col items-center justify-center space-y-6"
                id="modal-submitting-state"
              >
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-brand-primary/10 blur-xl animate-pulse"></div>
                  <Loader2 className="h-16 w-16 text-brand-primary animate-spin" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-900 font-extrabold text-base tracking-tight">Ledger Committing in Progress</h4>
                  <p className="text-xs text-brand-primary font-mono font-semibold animate-pulse">
                    {submittingProgress}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 max-w-xs leading-normal font-medium font-mono border border-slate-100 p-2.5 rounded-lg bg-slate-50">
                  CRITICAL: Do not refresh this page. High-priority database locking and verification in progress.
                </p>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-12 text-center flex flex-col items-center justify-center space-y-6"
                id="modal-success-state"
              >
                <div className="h-20 w-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center relative">
                  {/* Glowing success circle */}
                  <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-lg animate-ping"></div>
                  <ShieldCheck className="h-12 w-12 text-emerald-600 z-10" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-slate-950 font-extrabold text-xl tracking-tight">Treasury Settled Successfully</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    The transaction request has been successfully resolved, cryptographically signed, and written to the immutable ledger index.
                  </p>
                </div>
                <div className="w-full bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-2 text-xs font-semibold text-slate-600" id="modal-success-summary">
                  <div className="flex justify-between">
                    <span>Recipient</span>
                    <span className="text-slate-900">
                      {recipient === 'Custom Recipient...' ? customRecipient || 'Custom Recipient' : recipient}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Source Treasury</span>
                    <span className="text-slate-900">{getAccountName()}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold font-mono">
                    <span>Settled Amount</span>
                    <span className="text-emerald-600">
                      -${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    onClose();
                  }}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-slate-900/10 active:scale-95"
                  id="modal-btn-done"
                >
                  Return to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};
