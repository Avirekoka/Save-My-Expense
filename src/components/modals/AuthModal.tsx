import React, { useState } from 'react';
import {
  Sparkles,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
  ExternalLink,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  MailCheck,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../../services/firebase/AuthContext';
import { useScrollLock } from '../../hooks/useScrollLock';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  useScrollLock(isOpen);

  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendVerificationEmail,
    checkEmailVerified,
    verifyLocalEmail,
    verifyByToken,
    verificationDetails,
    signInAsDemo,
    error,
    clearError,
    isIframe,
    openInNewTab,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Email verification state
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationChecking, setVerificationChecking] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setLocalError(null);
      setVerificationPending(false);
      setVerificationSuccess(false);
      setResendStatus(null);
      setResendCooldown(0);
      setResending(false);
    }
  }, [isOpen, initialMode]);

  // Cooldown countdown
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Auto-detect when user clicks email verification link while modal is open
  React.useEffect(() => {
    if (!isOpen || !verificationPending || verificationSuccess) return;

    let isSubscribed = true;
    const checkStatus = async () => {
      try {
        const verified = await checkEmailVerified();
        if (verified && isSubscribed) {
          setVerificationSuccess(true);
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      } catch (err) {
        // quiet catch for periodic poll
      }
    };

    const handleFocus = () => {
      checkStatus();
    };

    window.addEventListener('focus', handleFocus);
    const interval = setInterval(checkStatus, 3000);

    return () => {
      isSubscribed = false;
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [isOpen, verificationPending, verificationSuccess, checkEmailVerified, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(cleanEmail, password);
        onClose();
      } else {
        await signUpWithEmail(cleanEmail, password, name);
        onClose();
        window.dispatchEvent(
          new CustomEvent('spendai-toast', {
            detail: {
              type: 'info',
              title: 'Account Created',
              message: 'Verification email sent. Please check your inbox and spam folder before continuing.',
            },
          })
        );
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    setVerificationChecking(true);
    setResendStatus(null);
    setLocalError(null);
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        setVerificationSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setLocalError('Email is not verified yet. Please check your inbox or spam folder and click the link.');
      }
    } catch (e: any) {
      setLocalError(e.message || 'Error checking verification status.');
    } finally {
      setVerificationChecking(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setResendStatus(null);
    setLocalError(null);
    try {
      const targetEmail = email.trim();
      const res = await sendVerificationEmail(targetEmail);
      setResendCooldown(30);
      setResendStatus(res.message || `Verification email sent. Please check your inbox at ${targetEmail}.`);
    } catch (e: any) {
      setLocalError(e.message || 'Could not resend email. Please try again in a few moments.');
    } finally {
      setResending(false);
    }
  };

  const handleCopyLink = () => {
    const url = verificationDetails?.verificationUrl;
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      });
    }
  };

  const handleDirectVerify = async () => {
    setVerificationChecking(true);
    try {
      if (verificationDetails?.token && email) {
        const verified = await verifyByToken(verificationDetails.token, email.trim());
        if (verified) {
          setVerificationSuccess(true);
          setTimeout(() => onClose(), 1200);
          return;
        }
      }
      await verifyLocalEmail();
      setVerificationSuccess(true);
      setTimeout(() => onClose(), 1000);
    } catch (e: any) {
      setLocalError(e.message || 'Could not verify account.');
    } finally {
      setVerificationChecking(false);
    }
  };

  const handleSimulateLocalVerify = async () => {
    await verifyLocalEmail();
    setVerificationSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    clearError();
    setSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-in was cancelled or encountered an issue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setLocalError(null);
    clearError();
    setSubmitting(true);
    try {
      await signInAsDemo();
      onClose();
    } catch (err: any) {
      setLocalError(err.message || 'Could not start demo session.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = localError || error;
  const isPopupBlocked =
    activeError?.toLowerCase().includes('popup') ||
    activeError?.toLowerCase().includes('blocked') ||
    activeError?.toLowerCase().includes('new tab');

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md my-auto rounded-2xl border border-[#262626] bg-[#141414] p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 rounded-xl p-2 text-gray-400 hover:bg-[#262626] hover:text-white transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Scrollable Container for Modal Body */}
        <div className="overflow-y-auto overscroll-contain pr-1 sm:pr-0 -mr-1 sm:mr-0 space-y-4">
          {verificationPending ? (
            /* Email Verification Prompt Screen */
            <div className="text-center py-4 px-2 sm:px-4 space-y-4 animate-in fade-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md">
                {verificationSuccess ? (
                  <CheckCircle2 size={32} className="text-emerald-400 animate-bounce" />
                ) : (
                  <MailCheck size={32} className="text-blue-400" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">
                  {verificationSuccess ? 'Email Verified Successfully!' : 'Confirm Your Email'}
                </h3>
                
                {/* Clean UI Message as requested */}
                <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-center shadow-sm">
                  <p className="text-xs sm:text-sm font-semibold text-blue-100 leading-relaxed">
                    Verification email sent. Please check your inbox and verify your email before continuing.
                  </p>
                  <p className="text-[11px] text-blue-300/80 mt-2 font-medium">
                    Sent to: <span className="text-white font-semibold underline decoration-blue-400/40">{email}</span>
                  </p>
                </div>
              </div>

              {verificationSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-medium">Email verified successfully! Redirecting to workspace...</span>
                </div>
              )}

              {resendStatus && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 flex items-center justify-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>{resendStatus}</span>
                </div>
              )}

              {/* Direct Verification Link Display (if present) */}
              {verificationDetails?.verificationUrl && (
                <div className="rounded-xl border border-blue-500/20 bg-[#0d1527] p-3 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-blue-300">
                      Direct Verification Link:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition"
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
                      className="w-full rounded-lg border border-[#223554] bg-[#070b14] px-2.5 py-1.5 text-[11px] text-gray-300 select-all font-mono truncate focus:outline-none"
                    />
                    <a
                      href={verificationDetails.verificationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-blue-500 transition"
                    >
                      <span>Open</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  {verificationDetails.previewUrl && (
                    <div className="pt-1">
                      <a
                        href={verificationDetails.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                      >
                        <span>View Sent Email in Web Inbox (Test Mailbox)</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Firebase Console Provider Notice */}
              {verificationDetails?.needsFirebaseConsoleEnable && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>Firebase Auth Provider Setup</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    To receive automated verification emails directly from Google's servers, enable the Email/Password provider in your Firebase project.
                  </p>
                  <a
                    href="https://console.firebase.google.com/project/gen-lang-client-0472501454/authentication/providers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 hover:underline"
                  >
                    <span>Open Firebase Console Settings</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}

              {activeError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300 flex items-center justify-center gap-2">
                  <AlertCircle size={14} className="text-rose-400 shrink-0" />
                  <span>{activeError}</span>
                </div>
              )}

              <div className="space-y-2 pt-2">
                {/* Primary Action: Check status / confirm verification */}
                <button
                  type="button"
                  id="btn-check-verification-status"
                  disabled={verificationChecking || verificationSuccess}
                  onClick={handleCheckVerification}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer"
                >
                  {verificationChecking ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Checking verification status...</span>
                    </>
                  ) : verificationSuccess ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Verified! Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>I've Verified My Email</span>
                    </>
                  )}
                </button>

                {/* Resend Verification Email Button as requested */}
                <button
                  type="button"
                  id="btn-resend-verification-email"
                  disabled={resending || resendCooldown > 0 || verificationSuccess}
                  onClick={handleResendVerification}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 py-2.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/20 hover:text-white transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={13} className={resending ? 'animate-spin' : ''} />
                  <span>
                    {resending
                      ? 'Sending Verification Email...'
                      : resendCooldown > 0
                      ? `Resend Verification Email (${resendCooldown}s)`
                      : 'Resend Verification Email'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={verificationChecking || verificationSuccess}
                  onClick={handleDirectVerify}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-[#262626] bg-[#171717] py-2 text-[11px] text-gray-400 hover:text-white hover:bg-[#1f1f1f] transition cursor-pointer"
                >
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span>Instant Verification (Test / Dev Mode)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVerificationPending(false);
                    setMode('signin');
                  }}
                  className="w-full text-center text-xs text-gray-400 hover:text-white pt-1 cursor-pointer transition"
                >
                  Back to Sign In
                </button>
              </div>

              {/* Security badge */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 border-t border-[#222] pt-3 pb-1 text-center flex-wrap">
                <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                <span>Spam Protection &amp; Verified Email Authentication</span>
              </div>
            </div>
          ) : (
            <>
              {/* Brand Header */}
              <div className="text-center pt-1 px-4 sm:px-6">
                <div className="mx-auto flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 shadow-sm mb-2.5">
                  <Sparkles size={20} />
                </div>
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  {mode === 'signin' ? 'Sign In to SpendAI' : 'Create an Account'}
                </h2>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-1 leading-normal max-w-xs mx-auto">
                  {mode === 'signin'
                    ? 'Access cloud synchronized budgets, verified ledgers, and AI insights.'
                    : 'Start tracking expenses with automated categorization and spam-protected email verification.'}
                </p>
              </div>

          {/* Iframe Notice */}
          {isIframe && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-300">
              <span className="truncate">Running in preview iframe.</span>
              <button
                type="button"
                onClick={openInNewTab}
                className="flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer shrink-0"
              >
                <span>Open in New Tab</span>
                <ExternalLink size={11} />
              </button>
            </div>
          )}

          {/* Primary Auth Actions */}
          <div className="space-y-2.5">
            {/* Google One-Click Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full min-h-[42px] flex items-center justify-center gap-2.5 rounded-xl border border-[#333] bg-[#1c1c1c] px-3 sm:px-4 py-2 text-xs font-semibold text-white hover:border-[#444] hover:bg-[#222] transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.3c0 2.9.7 5.6 1.9 8l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Quick Demo Login Option */}
            <button
              type="button"
              onClick={handleDemoSignIn}
              disabled={submitting}
              className="w-full min-h-[42px] flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 sm:px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/15 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Zap size={14} className="text-emerald-400 shrink-0" />
              <span className="truncate">Instant Demo (1-Click Test Login)</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-3 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#262626]" />
            </div>
            <span className="relative bg-[#141414] px-3 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-gray-500">
              or continue with email
            </span>
          </div>

          {/* Error Alert */}
          {activeError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11px]">{activeError}</div>
              </div>
              {activeError.includes('Firebase') && (
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0472501454/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/25 py-2 text-[11px] font-semibold text-blue-200 hover:bg-blue-600/40 transition"
                >
                  <ExternalLink size={12} />
                  <span>Open Firebase Authentication Providers Console</span>
                </a>
              )}
              {isPopupBlocked && (
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/20 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500/30 transition cursor-pointer"
                >
                  <ExternalLink size={12} />
                  <span>Open in New Tab to Complete Sign-In</span>
                </button>
              )}
            </div>
          )}

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ashwin Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] pl-9 pr-3 py-2 text-base sm:text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                  />
                  <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] pl-9 pr-3 py-2 text-base sm:text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-[#262626] bg-[#0f0f0f] pl-9 pr-10 py-2 text-base sm:text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-hidden"
                />
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-300 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[42px] mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-500 transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <span>{mode === 'signin' ? 'Sign In with Email' : 'Create Account'}</span>
              )}
            </button>
          </form>

          {/* Footer Toggle */}
          <div className="text-center text-xs text-gray-400 pt-1">
            {mode === 'signin' ? (
              <span>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setLocalError(null);
                    clearError();
                  }}
                  className="font-semibold text-blue-400 hover:underline cursor-pointer p-1"
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setLocalError(null);
                    clearError();
                  }}
                  className="font-semibold text-blue-400 hover:underline cursor-pointer p-1"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 border-t border-[#222] pt-3 pb-1 text-center flex-wrap">
            <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
            <span>Spam Protection &amp; Firebase Auth Encryption Active</span>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
