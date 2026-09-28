import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  Terminal,
  CloudUpload,
  LogIn,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../services/firebase/AuthContext';
import { storageService } from '../../services/storage/storage.service';

interface FirebaseDiagnosticsCardProps {
  onOpenAuthModal?: () => void;
}

export const FirebaseDiagnosticsCard: React.FC<FirebaseDiagnosticsCardProps> = ({
  onOpenAuthModal,
}) => {
  const { user } = useAuth();
  const isDemoUser = storageService.isDemoUser();
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    authStatus: string;
    userId: string | null;
    dbName: string;
    writeLatencyMs?: number;
    readLatencyMs?: number;
    error?: string;
    details?: string;
  } | null>(null);

  const [syncResult, setSyncResult] = useState<{
    count: number;
    error?: string;
  } | null>(null);

  const projectId = 'gen-lang-client-0472501454';
  const databaseId = 'ai-studio-aiexpenseintelli-4a79c71e-794b-4d2a-a6ec-0c34fcbf7680';

  const handleRunDiagnostic = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await storageService.testFirestoreConnection();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        authStatus: user ? 'Authenticated' : 'Unknown',
        userId: user?.uid || null,
        dbName: databaseId,
        error: err?.message || String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncLocal = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await storageService.syncLocalTransactionsToFirestore();
      setSyncResult(res);
    } catch (err: any) {
      setSyncResult({ count: 0, error: err?.message || String(err) });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Database size={15} />
            </div>
            <h2 className="text-base font-bold text-white">Firebase Firestore Diagnostics</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Verify database connectivity, security rule access, and real-time transaction insertions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user && !isDemoUser ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real Account Active</span>
            </span>
          ) : isDemoUser ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-400">
              <AlertTriangle size={12} />
              <span>Demo Mode (Local Only)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-500/10 border border-gray-500/30 px-3 py-1 text-xs font-semibold text-gray-400">
              <KeyRound size={12} />
              <span>Not Signed In</span>
            </span>
          )}
        </div>
      </div>

      {/* Connection Info Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-[#262626] bg-[#0f0f0f] p-3 space-y-1">
          <div className="text-[11px] text-gray-400 font-medium">Firebase Project</div>
          <div className="font-mono text-white text-[11px] truncate" title={projectId}>
            {projectId}
          </div>
        </div>

        <div className="rounded-lg border border-[#262626] bg-[#0f0f0f] p-3 space-y-1">
          <div className="text-[11px] text-gray-400 font-medium">Named Firestore DB</div>
          <div className="font-mono text-blue-400 text-[11px] truncate" title={databaseId}>
            {databaseId}
          </div>
        </div>

        <div className="rounded-lg border border-[#262626] bg-[#0f0f0f] p-3 space-y-1">
          <div className="text-[11px] text-gray-400 font-medium">Active Session UID</div>
          <div className="font-mono text-gray-300 text-[11px] truncate">
            {user?.uid ? user.uid : isDemoUser ? 'demo_user_spendai_01' : 'None (Guest)'}
          </div>
        </div>
      </div>

      {/* Demo Mode Notice if Active */}
      {isDemoUser && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-200">
            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
            <span>Why transactions might not appear in Firebase:</span>
          </div>
          <p className="leading-relaxed">
            You are logged into an <strong>Instant Demo Session</strong>. In demo mode, transactions are held safely in browser memory to avoid modifying production cloud data.
          </p>
          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 transition cursor-pointer"
            >
              <LogIn size={13} />
              <span>Sign In with Real Account to Save to Firebase</span>
            </button>
          )}
        </div>
      )}

      {/* Interactive Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleRunDiagnostic}
          disabled={testing}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer shadow-xs"
        >
          <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
          <span>{testing ? 'Testing Firebase Insert...' : 'Test Live Firebase Insert & Read'}</span>
        </button>

        {user && !isDemoUser && (
          <button
            onClick={handleSyncLocal}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-[#262626] bg-[#0f0f0f] px-4 py-2 text-xs font-bold text-gray-200 hover:bg-[#1a1a1a] disabled:opacity-50 transition cursor-pointer"
          >
            <CloudUpload size={14} className={syncing ? 'animate-bounce' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync Local Transactions to Firebase'}</span>
          </button>
        )}
      </div>

      {/* Live Diagnostic Result */}
      {testResult && (
        <div
          className={`rounded-xl border p-4 text-xs space-y-2 animate-in fade-in ${
            testResult.success
              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {testResult.success ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-emerald-200">Firebase Firestore Connection: 100% Operational</span>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-rose-400" />
                <span className="text-rose-200">Firebase Test Result: Issue Detected</span>
              </>
            )}
          </div>

          {testResult.details && <p className="leading-relaxed">{testResult.details}</p>}

          {testResult.error && (
            <div className="rounded-lg bg-black/40 border border-rose-500/20 p-2.5 font-mono text-[11px] text-rose-300">
              <strong>Error Details:</strong> {testResult.error}
            </div>
          )}

          {testResult.success && (
            <div className="flex items-center gap-4 text-[11px] text-emerald-400/90 pt-1">
              <span>Write latency: <strong>{testResult.writeLatencyMs}ms</strong></span>
              <span>Read latency: <strong>{testResult.readLatencyMs}ms</strong></span>
              <span>Collection: <code>/users/{'{uid}'}/transactions</code></span>
            </div>
          )}
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div
          className={`rounded-xl border p-3 text-xs flex items-center gap-2 animate-in fade-in ${
            syncResult.error
              ? 'border-rose-500/30 bg-rose-950/20 text-rose-300'
              : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
          }`}
        >
          {syncResult.error ? (
            <>
              <XCircle size={15} className="shrink-0 text-rose-400" />
              <span>Failed to sync: {syncResult.error}</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span>Successfully pushed {syncResult.count} local transactions to your cloud Firestore database!</span>
            </>
          )}
        </div>
      )}

      {/* Step-by-Step Debugging Instructions */}
      <div className="rounded-xl border border-[#262626] bg-[#0f0f0f] p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
          <Terminal size={14} className="text-blue-400" />
          <span>How to Inspect & Debug in Real Time</span>
        </div>
        <ol className="list-decimal list-inside text-xs text-gray-400 space-y-1.5 leading-relaxed">
          <li>
            <strong>Open Browser Console:</strong> Press <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#333] text-gray-300">F12</kbd> (or <kbd className="bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#333] text-gray-300">Cmd + Option + I</kbd> on Mac) and switch to the <strong>Console</strong> tab.
          </li>
          <li>
            <strong>Add a Transaction:</strong> Click <em>&quot;Add Expense&quot;</em> in the header and submit a new transaction.
          </li>
          <li>
            <strong>Real-time Toast & Logs:</strong> SpendAI now broadcasts an explicit toast alert and detailed console log showing either <code>Synced to Firebase</code> or the exact Firebase error code (e.g. <code>permission-denied</code>, <code>unauthenticated</code>).
          </li>
          <li>
            <strong>Verify in Firebase Console:</strong> Go to Firebase Console ➔ <strong>Firestore Database</strong> ➔ select database <code>{databaseId}</code> ➔ navigate to <code>users &gt; {'{your_uid}'} &gt; transactions</code>.
          </li>
        </ol>
      </div>
    </div>
  );
};
