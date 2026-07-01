import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Transaction } from '../types';
import { X, ShieldCheck, Clock, ShieldAlert, FileText, ArrowDownToLine, Copy, Check, Fingerprint, RefreshCw } from 'lucide-react';
import { playClickSound, playSuccessSound } from '../utils/audio';

interface TransactionDetailsDrawerProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionDetailsDrawer: React.FC<TransactionDetailsDrawerProps> = ({
  transaction,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!transaction) return null;

  // Synthesize a deterministic SHA256 mock hash for the block proof
  const generateMockHash = (id: string) => {
    return `0x7f39a1c${id.split('-')[1] || '9482'}e4b52c009d17d5ea8e24c965b16f39e31d8c1cfa82e1d092c4e23`;
  };

  const handleCopyHash = () => {
    playClickSound();
    const hash = generateMockHash(transaction.id);
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    playClickSound();
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      playSuccessSound();
      alert(`Downloaded secure document: ${transaction.attachmentName || 'Statement.pdf'}`);
    }, 1500);
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 transition-opacity"
        onClick={() => {
          playClickSound();
          onClose();
        }}
        id="drawer-backdrop"
      />

      {/* Slide over Drawer Panel */}
      <div
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
        id="drawer-container"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50" id="drawer-header">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-brand-primary" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Security Ledger Certificate</h3>
              <p className="text-[10px] font-mono text-slate-400">ID: {transaction.id}</p>
            </div>
          </div>
          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-150 transition"
            id="drawer-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" id="drawer-body">
          {/* Main Hero Amount & Merchant */}
          <div className="text-center space-y-2 py-4 bg-slate-50/50 rounded-xl border border-slate-100" id="drawer-hero-amount">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
              SETTLED VALUE
            </span>
            <div
              className={`text-3xl font-extrabold tracking-tight font-mono ${
                transaction.amount > 0 ? 'text-emerald-600' : 'text-slate-950'
              }`}
            >
              {transaction.amount > 0 ? '+' : ''}
              {transaction.amount.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
              })}
            </div>
            <div className="text-sm font-bold text-slate-800">{transaction.description}</div>
            
            {/* Status pill */}
            <div className="flex justify-center pt-2">
              {transaction.status === 'Verified' ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 shadow-xs">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verified & Signed
                </div>
              ) : transaction.status === 'Pending' ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100 shadow-xs animate-pulse">
                  <Clock className="h-3.5 w-3.5" />
                  Consensus Pending
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100 shadow-xs">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Settling...
                </div>
              )}
            </div>
          </div>

          {/* Core Metadata Grid */}
          <div className="space-y-4" id="drawer-metadata">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-100 pb-1.5">
              Ledger Specifications
            </h4>
            
            <div className="grid grid-cols-2 gap-y-4 text-xs" id="drawer-spec-grid">
              <div>
                <div className="text-slate-400 font-semibold mb-0.5">Settle Date</div>
                <div className="font-semibold text-slate-800">{transaction.date}</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold mb-0.5">Settle Time</div>
                <div className="font-mono font-semibold text-slate-800">{transaction.time}</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold mb-0.5">Asset Category</div>
                <div className="font-semibold text-slate-800">{transaction.category}</div>
              </div>
              <div>
                <div className="text-slate-400 font-semibold mb-0.5">Merchant Entity</div>
                <div className="font-semibold text-slate-800">{transaction.merchant}</div>
              </div>
            </div>
          </div>

          {/* Cryptographic block proof representation */}
          <div className="space-y-2 bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] border border-slate-850" id="drawer-crypto-hash">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-1.5 border-b border-slate-900">
              <span>Cryptographic Block Certificate</span>
              <button
                onClick={handleCopyHash}
                className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition"
                title="Copy Block Hash"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy Certificate'}
              </button>
            </div>
            <div className="break-all pt-1.5 leading-relaxed text-sky-300">
              {generateMockHash(transaction.id)}
            </div>
            <div className="text-[9px] text-slate-500 pt-1 leading-normal">
              Validated using SHA-256 Secure Consensus signatures with multi-sig core redundancy.
            </div>
          </div>

          {/* Transaction Note / Purpose */}
          {transaction.notes && (
            <div className="space-y-2" id="drawer-notes">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                Compliance Note / Purpose
              </h4>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed italic">
                "{transaction.notes}"
              </p>
            </div>
          )}

          {/* Verified Document Attachment */}
          <div className="space-y-2.5" id="drawer-attachment">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              Audit Document
            </h4>
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-white shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                    {transaction.attachmentName || 'Compliance_Doc.pdf'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {transaction.attachmentSize || '1.2 MB'} • PDF Document
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="p-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 rounded-lg transition disabled:opacity-50"
                id="drawer-download-btn"
                title="Download verified copy"
              >
                {downloading ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Audit events sequence */}
          <div className="space-y-3" id="drawer-audit-timeline">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              Audit Timeline Logs
            </h4>
            <div className="space-y-3 pl-3 border-l-2 border-slate-100 text-xs text-slate-500" id="drawer-timeline-list">
              <div className="relative">
                <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="font-mono text-[10px] text-slate-400 block">{transaction.time}</span>
                <span className="font-semibold text-slate-700">Settlement fully committed to SecureFin distributed ledger.</span>
              </div>
              <div className="relative">
                <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-blue-500"></span>
                <span className="font-mono text-[10px] text-slate-400 block">T-minus 2s</span>
                <span className="font-semibold text-slate-700">Cryptographic consensus signed by Zürich server node #14.</span>
              </div>
              <div className="relative">
                <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-slate-300"></span>
                <span className="font-mono text-[10px] text-slate-400 block">T-minus 4s</span>
                <span className="font-semibold text-slate-700">Transaction initialized by Alexander Sterling.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3" id="drawer-footer">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition active:scale-95"
            id="drawer-footer-download"
          >
            Download PDF
          </button>
          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition active:scale-95"
            id="drawer-footer-done"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};
