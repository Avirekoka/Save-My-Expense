import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Copy,
  Check,
  Send,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Phone,
  Database,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Transaction } from '../../types';
import { storageService } from '../../services/storage/storage.service';
import { formatCurrency, getCurrencySymbol } from '../../utils/formatters';

interface WhatsAppStatusResponse {
  status: string;
  webhookUrl: string;
  verifyToken: string;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  outboundConfigured: boolean;
  idempotencyStore: string;
}

interface WhatsAppIntegrationCardProps {
  onNavigate?: (view: string) => void;
}

const PRESET_MESSAGES = [
  'Spent ₹500 on dinner',
  '450 dinner',
  'Paid 500 for petrol',
  'kal 350 ka lunch hua',
  'Amazon pe 1200 spend kiye',
  '₹1850 electricity bill paid via UPI',
];

export const WhatsAppIntegrationCard: React.FC<WhatsAppIntegrationCardProps> = ({
  onNavigate,
}) => {
  const [status, setStatus] = useState<WhatsAppStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Simulator state
  const [testInput, setTestInput] = useState<string>('Spent ₹500 on dinner');
  const [senderPhone, setSenderPhone] = useState<string>('+91 98765 43210');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [newlyAddedTx, setNewlyAddedTx] = useState<Transaction | null>(null);

  // User Profile Phone
  const profile = storageService.getUserProfile();
  const [linkedPhone, setLinkedPhone] = useState<string>(profile.phone || '');
  const [isSavingPhone, setIsSavingPhone] = useState<boolean>(false);
  const [phoneSavedSuccess, setPhoneSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch WhatsApp status:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSavePhone = async () => {
    setIsSavingPhone(true);
    try {
      const trimmed = linkedPhone.trim();
      const updated = {
        ...profile,
        phone: trimmed,
      };
      storageService.saveUserProfile(updated);

      // Register link on the server for WhatsApp webhook phone routing
      const clean = trimmed.replace(/[^0-9]/g, '');
      if (clean) {
        await fetch('/api/whatsapp/link-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: clean,
            userId: storageService.getCurrentUserId() || 'default_user',
            userName: profile.name || 'Account Holder',
            currencySymbol: profile.currencySymbol || '₹',
          }),
        }).catch(() => {});
      }

      setPhoneSavedSuccess(true);
      setTimeout(() => setPhoneSavedSuccess(false), 3000);
    } catch (e) {
      console.warn('Failed to save phone:', e);
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleRunSimulation = async (messageToSimulate?: string) => {
    const textToSend = (messageToSimulate || testInput).trim();
    if (!textToSend) return;

    setIsSimulating(true);
    setSimulationResult(null);
    setSimulationError(null);
    setNewlyAddedTx(null);

    try {
      const cleanPhone = (linkedPhone || senderPhone).replace(/[^0-9]/g, '') || '919876543210';
      const activeUserId = storageService.getCurrentUserId() || 'default_user';

      const res = await fetch('/api/webhooks/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: cleanPhone,
          text: textToSend,
          senderName: profile.name || 'Account Holder',
          userId: activeUserId,
          currencySymbol: profile.currencySymbol || '₹',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulation request failed');
      }

      setSimulationResult(data.result);

      // Immediately save extracted transaction into client storage ledger so it appears instantly
      if (data.result && (data.result.status === 'processed' || data.result.status === 'duplicate') && data.result.extracted) {
        const ext = data.result.extracted;
        const newTx: Transaction = {
          id: data.result.transactionId || `tx_wa_${Date.now()}`,
          userId: activeUserId,
          amount: Number(ext.amount) || 0,
          type: ext.type || 'expense',
          merchant: ext.merchant || 'Expense',
          categoryId: ext.categoryId || 'other',
          date: ext.date || new Date().toISOString().slice(0, 10),
          paymentMethod: ext.paymentMethod || 'UPI',
          source: 'whatsapp',
          tags: ['whatsapp', ext.categoryId || 'other'],
          confidenceScore: ext.confidenceScore || 95,
          notes: ext.notes ? `WhatsApp: ${ext.notes}` : `Added via WhatsApp: "${textToSend}"`,
          rawDescription: textToSend,
          referenceNo: data.result.messageId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        storageService.saveTransaction(newTx);
        setNewlyAddedTx(newTx);
      }

      // Trigger cloud sync to keep Firestore in lockstep
      await storageService.reloadFromCloud();
    } catch (err: any) {
      setSimulationError(err.message || 'Simulation error');
    } finally {
      setIsSimulating(false);
    }
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = status?.webhookUrl || `${currentOrigin}/api/webhooks/whatsapp`;
  const verifyToken = status?.verifyToken || 'spend_ai_whatsapp_token_2026';

  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 sm:p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <MessageSquare size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                WhatsApp Business Cloud API Webhook
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Webhook Ready
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Log expenses directly by chatting on WhatsApp with signature verification and Firestore idempotency.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          disabled={loadingStatus}
          className="flex items-center gap-1.5 rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252525] transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loadingStatus ? 'animate-spin' : ''} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Security & Idempotency Spec Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-blue-400" />
            <span className="text-xs font-bold text-white">Signature Verification</span>
          </div>
          <p className="text-[11px] text-gray-400">
            {status?.appSecretConfigured ? (
              <span className="text-emerald-400 font-semibold">HMAC-SHA256 Enforced</span>
            ) : (
              <span>HMAC-SHA256 Ready (Set <code className="text-xs font-mono text-gray-300">WHATSAPP_APP_SECRET</code>)</span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-amber-400" />
            <span className="text-xs font-bold text-white">Message Idempotency</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Backed by <span className="text-amber-300 font-mono">Firestore</span> collection <code className="text-xs text-amber-200">whatsapp_messages</code> to prevent duplicates.
          </p>
        </div>

        <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-xs font-bold text-white">AI Financial Parser</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Gemini 3.7 parses Hinglish & English into structured ledger transactions.
          </p>
        </div>
      </div>

      {/* Meta Webhook Setup Credentials */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider text-gray-400">
          Meta Developer Portal Webhook Setup
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Callback URL */}
          <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">Webhook Callback URL</span>
              <button
                type="button"
                onClick={() => handleCopy(webhookUrl, 'url')}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {copiedField === 'url' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedField === 'url' ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>
            <div className="rounded-lg bg-[#141414] border border-[#222] px-3 py-2 font-mono text-xs text-emerald-400 break-all select-all">
              {webhookUrl}
            </div>
            <p className="text-[10px] text-gray-500">
              Paste this in Meta App Dashboard → WhatsApp → Configuration → Callback URL.
            </p>
          </div>

          {/* Verify Token */}
          <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">Verify Token</span>
              <button
                type="button"
                onClick={() => handleCopy(verifyToken, 'token')}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                {copiedField === 'token' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedField === 'token' ? 'Copied' : 'Copy Token'}</span>
              </button>
            </div>
            <div className="rounded-lg bg-[#141414] border border-[#222] px-3 py-2 font-mono text-xs text-blue-400 break-all select-all">
              {verifyToken}
            </div>
            <p className="text-[10px] text-gray-500">
              Paste this in Meta App Dashboard → WhatsApp → Configuration → Verify Token.
            </p>
          </div>
        </div>
      </div>

      {/* User Phone Number Mapping */}
      <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone size={16} className="text-emerald-400" />
            <span className="text-xs font-bold text-white">Your WhatsApp Sender Phone Number</span>
          </div>
          <span className="text-[11px] text-gray-400">
            Incoming WhatsApp messages from this number will be linked to your account.
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="tel"
            value={linkedPhone}
            onChange={(e) => setLinkedPhone(e.target.value)}
            placeholder="+91 98765 43210 (include country code)"
            className="w-full sm:flex-1 rounded-xl border border-[#333] bg-[#141414] px-3.5 py-2 text-xs font-mono font-medium text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={handleSavePhone}
            disabled={isSavingPhone}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer shrink-0"
          >
            {phoneSavedSuccess ? <Check size={14} /> : <SaveIcon />}
            <span>{phoneSavedSuccess ? 'Phone Linked!' : 'Save Phone Number'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Webhook Simulator */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Test WhatsApp Ingestion (Live Simulator)
            </h3>
          </div>
          <span className="text-[11px] text-blue-300/80">
            Simulates the exact Meta Webhook pipeline & Firestore write
          </span>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-gray-400">Click a sample message to test:</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_MESSAGES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTestInput(preset);
                  handleRunSimulation(preset);
                }}
                disabled={isSimulating}
                className="rounded-lg border border-[#333] bg-[#1a1a1a] px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10 transition cursor-pointer"
              >
                "{preset}"
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunSimulation();
            }}
            placeholder="e.g. Spent 450 on dinner or 1200 for petrol"
            className="w-full sm:flex-1 rounded-xl border border-[#333] bg-[#141414] px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
          />
          <button
            type="button"
            onClick={() => handleRunSimulation()}
            disabled={isSimulating || !testInput.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
          >
            {isSimulating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Send Test Message</span>
              </>
            )}
          </button>
        </div>

        {/* Simulation Output Card */}
        {simulationResult && (
          <div className="rounded-xl border border-emerald-500/30 bg-[#0f0f0f] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 size={16} />
                <span>Processed & Saved to Firestore Ledger!</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                TxID: {simulationResult.transactionId}
              </span>
            </div>

            {simulationResult.extracted && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="rounded-lg bg-[#141414] border border-[#222] p-2">
                  <span className="text-[10px] text-gray-500 block">Amount</span>
                  <span className="font-bold text-white font-mono text-sm">
                    {formatCurrency(simulationResult.extracted.amount, profile.currencySymbol || '₹')}
                  </span>
                </div>
                <div className="rounded-lg bg-[#141414] border border-[#222] p-2">
                  <span className="text-[10px] text-gray-500 block">Category</span>
                  <span className="font-semibold text-emerald-400 capitalize">
                    {simulationResult.extracted.categoryId}
                  </span>
                </div>
                <div className="rounded-lg bg-[#141414] border border-[#222] p-2">
                  <span className="text-[10px] text-gray-500 block">Merchant / Purpose</span>
                  <span className="font-semibold text-white truncate block">
                    {simulationResult.extracted.merchant}
                  </span>
                </div>
                <div className="rounded-lg bg-[#141414] border border-[#222] p-2">
                  <span className="text-[10px] text-gray-500 block">Date & Method</span>
                  <span className="font-semibold text-gray-300 block">
                    {simulationResult.extracted.date} • {simulationResult.extracted.paymentMethod}
                  </span>
                </div>
              </div>
            )}

            {simulationResult.replyMessage && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300 flex items-start gap-2">
                <MessageSquare size={14} className="shrink-0 mt-0.5" />
                <span><strong>WhatsApp Automated Reply:</strong> {simulationResult.replyMessage}</span>
              </div>
            )}

            {newlyAddedTx && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2.5 border-t border-[#222]">
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-medium">
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                  <span>
                    Successfully added to your active transactions ledger!
                  </span>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('transactions')}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow-xs cursor-pointer shrink-0"
                  >
                    <span>View in Transactions</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {simulationError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
            <div>
              <span className="font-bold">Error Processing Message:</span> {simulationError}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  );
}
