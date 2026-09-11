import React, { useState } from 'react';
import { Mail, RefreshCw, CheckCircle2, AlertTriangle, X, Loader2, ShieldAlert, Copy, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '../../services/firebase/AuthContext';
import { useRouter } from '../../router/RouterContext';

export const EmailVerificationBanner: React.FC = () => {
  const { user, sendVerificationEmail, checkEmailVerified, verifyLocalEmail, verificationDetails } = useAuth();
  const { currentRoute } = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

  // Only display if user is logged in with email/password and is not yet verified
  if (!user || user.provider === 'demo' || user.provider === 'google') {
    return null;
  }

  if (user.emailVerified === true || dismissed) {
    return null;
  }

  // When on any core page, EmailVerificationGate is already taking full view
  if (currentRoute !== 'settings') {
    return null;
  }

  const handleCheckStatus = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        setMessageType('success');
        setMessage('Your email has been verified! Thank you.');
      } else {
        setMessageType('error');
        setMessage('Not verified yet. Please check your inbox or use the link button.');
      }
    } catch (e: any) {
      setMessageType('error');
      setMessage(e.message || 'Could not verify status right now.');
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setMessage(null);
    try {
      const res = await sendVerificationEmail();
      setMessageType('success');
      setMessage(res.message || 'Verification link resent to ' + user.email);
    } catch (e: any) {
      setMessageType('error');
      setMessage(e.message || 'Could not send verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleInstantVerify = async () => {
    await verifyLocalEmail();
    setMessageType('success');
    setMessage('Email verified for this session!');
  };

  const handleCopy = () => {
    const url = verificationDetails?.verificationUrl;
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div
      id="email-verification-banner"
      className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 transition-all z-40"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <span className="leading-tight text-amber-100">
            <strong className="font-semibold text-white">Email Verification Required:</strong> Please verify{' '}
            <span className="font-mono text-amber-300 font-semibold">{user.email}</span> to secure your account and prevent spam.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          {message && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                messageType === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {message}
            </span>
          )}

          {verificationDetails?.verificationUrl && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/20 px-2.5 py-1 text-[11px] font-bold text-blue-200 hover:bg-blue-500/30 transition cursor-pointer"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 transition disabled:opacity-50 cursor-pointer"
          >
            {resending ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
            <span>Resend Link</span>
          </button>

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50 cursor-pointer"
          >
            {checking ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            <span>Check Status</span>
          </button>

          {user.provider === 'local' && (
            <button
              type="button"
              onClick={handleInstantVerify}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
            >
              Instant Verify
            </button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss banner"
            className="rounded-lg p-1 text-amber-400 hover:text-white hover:bg-amber-500/20 transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
