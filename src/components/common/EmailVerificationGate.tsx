import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Lock,
  Sparkles,
  Receipt,
  PieChart,
  LogOut,
  ArrowRight,
  Inbox,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../services/firebase/AuthContext';

interface EmailVerificationGateProps {
  onSignOut?: () => void;
  attemptedFeature?: string | null;
}

export const EmailVerificationGate: React.FC<EmailVerificationGateProps> = ({
  onSignOut,
  attemptedFeature,
}) => {
  const {
    user,
    sendVerificationEmail,
    checkEmailVerified,
    verifyLocalEmail,
    verifyByToken,
    verificationDetails,
    logOut,
  } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Background polling to automatically detect email verification in another tab/device
  useEffect(() => {
    if (verifiedSuccess || !user || user.emailVerified) return;

    const interval = setInterval(async () => {
      try {
        const isVerified = await checkEmailVerified();
        if (isVerified) {
          setVerifiedSuccess(true);
          setStatusMessage({
            text: 'Email verified! Unlocking all core features...',
            type: 'success',
          });
          window.dispatchEvent(
            new CustomEvent('spendai-toast', {
              detail: {
                type: 'success',
                title: 'Email Verified!',
                message: 'Your account has been confirmed. Welcome to SpendAI!',
              },
            })
          );
        }
      } catch {
        // Silent poll error
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [checkEmailVerified, user, verifiedSuccess]);

  const handleCheckNow = async () => {
    setChecking(true);
    setStatusMessage(null);
    try {
      // First check direct token if available in verificationDetails
      if (verificationDetails?.token && user?.email) {
        const tokenVerified = await verifyByToken(verificationDetails.token, user.email);
        if (tokenVerified) {
          setVerifiedSuccess(true);
          setStatusMessage({
            text: 'Email verified successfully! Loading your workspace...',
            type: 'success',
          });
          return;
        }
      }

      const verified = await checkEmailVerified();
      if (verified) {
        setVerifiedSuccess(true);
        setStatusMessage({
          text: 'Email verified successfully! Loading your workspace...',
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: 'Not verified yet. Please click the link in your email, then click this button again.',
          type: 'info',
        });
      }
    } catch (e: any) {
      setStatusMessage({
        text: e?.message || 'Could not verify status. Please try again.',
        type: 'error',
      });
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setStatusMessage(null);
    try {
      const res = await sendVerificationEmail();
      setResendCooldown(30);
      setStatusMessage({
        text: res.message || `Verification link sent to ${user?.email}`,
        type: 'success',
      });
    } catch (e: any) {
      setStatusMessage({
        text: e?.message || 'Failed to resend verification email.',
        type: 'error',
      });
    } finally {
      setResending(false);
    }
  };

  const handleInstantVerify = async () => {
    setChecking(true);
    try {
      if (verificationDetails?.token && user?.email) {
        await verifyByToken(verificationDetails.token, user.email);
      } else {
        await verifyLocalEmail();
      }
      setVerifiedSuccess(true);
      setStatusMessage({
        text: 'Email confirmed! Your workspace is now fully unlocked.',
        type: 'success',
      });
    } catch (e: any) {
      setStatusMessage({
        text: e?.message || 'Verification failed.',
        type: 'error',
      });
    } finally {
      setChecking(false);
    }
  };

  const handleCopyLink = () => {
    const url = verificationDetails?.verificationUrl;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleSignOutClick = async () => {
    if (onSignOut) {
      onSignOut();
    } else {
      await logOut();
    }
  };

  const lockedFeatures = [
    {
      title: 'AI Financial Advisor & Spend Check',
      description: 'Before-you-spend intelligence & contextual financial assistance',
      icon: Sparkles,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Expense Logging & Statement Parsing',
      description: 'Add, edit, categorize transactions and import bank statements',
      icon: Receipt,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Budget Envelopes & Daily Ceilings',
      description: 'Category allocations, monthly limits, and recurring alerts',
      icon: PieChart,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div
      id="email-verification-gate"
      className="flex flex-col items-center justify-center min-h-[calc(100dvh-7rem)] py-8 px-4 sm:px-6 lg:px-8 text-center"
    >
      <div className="w-full max-w-2xl space-y-6">
        {/* Top Badge & Icon */}
        <div className="flex flex-col items-center space-y-3">
          <div className="relative flex items-center justify-center">
            <div className="h-20 w-20 rounded-3xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/5">
              <Mail className="h-10 w-10 text-blue-400 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-[#121212] border-2 border-[#1e293b] flex items-center justify-center">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <AlertTriangle size={13} className="shrink-0" />
            <span>Email Confirmation Required</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Verify Your Email Address
          </h1>

          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 max-w-lg text-center shadow-sm">
            <p className="text-sm sm:text-base font-semibold text-blue-100 leading-relaxed">
              Verification email sent. Please check your inbox and verify your email before continuing.
            </p>
            <p className="text-xs text-blue-300/80 mt-1.5 font-medium">
              Sent to: <span className="font-bold text-white underline decoration-blue-400/50">{user?.email || 'your email'}</span>
            </p>
            <p className="text-[11px] text-amber-300/90 mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg py-1 px-2.5 inline-block">
              Tip: Automated verification emails may arrive in your <span className="font-semibold text-amber-200">Spam / Junk</span> or <span className="font-semibold text-amber-200">Promotions</span> tab.
            </p>
          </div>

          {attemptedFeature && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2 text-xs text-blue-200">
              Access to <span className="font-bold">{attemptedFeature}</span> is reserved for verified accounts.
            </div>
          )}
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div
            className={`rounded-xl border p-3 text-xs flex items-center justify-center gap-2 ${
              statusMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle size={16} className="shrink-0 text-rose-400" />
            ) : (
              <Inbox size={16} className="shrink-0 text-blue-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Primary Action Card */}
        <div className="rounded-2xl border border-[#262626] bg-[#121212] p-5 sm:p-6 shadow-xl text-left space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              id="btn-check-verification-status"
              disabled={checking || verifiedSuccess}
              onClick={handleCheckNow}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer"
            >
              {checking ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Checking Email Status...</span>
                </>
              ) : verifiedSuccess ? (
                <>
                  <CheckCircle2 size={16} className="text-white" />
                  <span>Verified! Unlocking...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>I've Verified My Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="btn-resend-verification-email"
              disabled={resending || resendCooldown > 0 || verifiedSuccess}
              onClick={handleResend}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#333333] bg-[#181818] px-4 py-3 text-sm font-semibold text-gray-300 hover:bg-[#202020] hover:text-white transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={resending ? 'animate-spin' : ''} />
              <span>
                {resendCooldown > 0
                  ? `Resend Verification Email (${resendCooldown}s)`
                  : resending
                  ? 'Sending Verification Email...'
                  : 'Resend Verification Email'}
              </span>
            </button>
          </div>

          {/* Quick Access Link / Preview if available */}
          {verificationDetails?.verificationUrl && (
            <div className="rounded-xl border border-blue-500/20 bg-[#0d1629] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-300">
                  Direct Verification Link (Ready to Use):
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={verificationDetails.verificationUrl}
                  className="w-full rounded-lg border border-[#223554] bg-[#070b14] px-2.5 py-1.5 text-[11px] text-gray-300 font-mono select-all truncate focus:outline-none"
                />
                <a
                  href={verificationDetails.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition"
                >
                  <span>Open Link</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {verificationDetails.previewUrl && (
                <div className="pt-1">
                  <a
                    href={verificationDetails.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                  >
                    <span>View Sent Email in Test Web Mailbox</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Instant Sandbox Verify Option */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#1f1f1f]">
            <div className="text-[11px] text-gray-400 text-center sm:text-left">
              Testing without waiting for email delivery?
            </div>
            <button
              type="button"
              id="btn-instant-verify-sandbox"
              onClick={handleInstantVerify}
              disabled={checking || verifiedSuccess}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <ShieldCheck size={14} />
              <span>Verify Instantly (Test Mode)</span>
            </button>
          </div>
        </div>

        {/* Locked Features Preview */}
        <div className="space-y-2.5 text-left">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 px-1">
            <Lock size={13} className="text-amber-400" />
            <span>Core Features Unlocked After Verification</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {lockedFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-xl border border-[#222222] bg-[#121212]/80 p-3.5 space-y-1.5 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border ${feat.color}`}>
                      <Icon size={14} />
                    </div>
                    <span className="text-xs font-bold text-gray-200 leading-tight">
                      {feat.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer options */}
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400 pt-2">
          <span>Wrong email address?</span>
          <button
            type="button"
            onClick={handleSignOutClick}
            className="inline-flex items-center gap-1 text-gray-300 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            <LogOut size={12} />
            <span>Sign in with a different account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
