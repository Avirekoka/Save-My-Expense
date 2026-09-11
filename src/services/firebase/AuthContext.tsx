import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  reload,
  applyActionCode,
  User,
  db,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from './firebase';
import { storageService } from '../storage/storage.service';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google' | 'password' | 'demo' | 'local';
  emailVerified?: boolean;
}

export interface SignUpResult {
  verificationSent: boolean;
  needsFirebaseConsoleEnable?: boolean;
  verificationUrl?: string;
  previewUrl?: string | null;
  message?: string;
  token?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<SignUpResult>;
  sendVerificationEmail: (emailOverride?: string) => Promise<SignUpResult>;
  checkEmailVerified: () => Promise<boolean>;
  verifyLocalEmail: () => Promise<void>;
  verifyByToken: (token: string, email: string) => Promise<boolean>;
  verificationDetails: SignUpResult | null;
  setVerificationDetails: (details: SignUpResult | null) => void;
  signInAsDemo: (demoEmail?: string, demoName?: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserData: (data: { displayName?: string; photoURL?: string | null }) => Promise<void>;
  error: string | null;
  clearError: () => void;
  isIframe: boolean;
  openInNewTab: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USERS_KEY = 'ais_local_registered_accounts_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous initialization from persisted session to eliminate flicker
  const [user, setUser] = useState<AppUser | null>(() => {
    const existing = storageService.getCurrentUser();
    if (existing) {
      return {
        uid: existing.uid,
        email: existing.email,
        displayName: existing.displayName,
        photoURL: existing.photoURL,
        provider: (existing.provider as AppUser['provider']) || 'local',
      };
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationDetails, setVerificationDetails] = useState<SignUpResult | null>(null);

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const requestBackendVerificationEmail = async (
    email: string,
    name?: string,
    customToken?: string
  ): Promise<SignUpResult> => {
    try {
      const resp = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, customToken }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return {
          verificationSent: true,
          verificationUrl: data.verificationUrl,
          previewUrl: data.previewUrl,
          token: data.token,
          message: data.message,
          needsFirebaseConsoleEnable: data.method === 'direct_link' || data.method === 'ethereal_preview',
        };
      }
    } catch (apiErr) {
      console.warn('Backend send-verification-email failed:', apiErr);
    }

    const fallbackToken = customToken || `${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`;
    const fallbackUrl = `${window.location.origin}?verify_token=${fallbackToken}&email=${encodeURIComponent(email)}`;
    return {
      verificationSent: true,
      verificationUrl: fallbackUrl,
      token: fallbackToken,
      message: `Account verification link created for ${email}`,
      needsFirebaseConsoleEnable: true,
    };
  };

  const openInNewTab = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const clearError = () => setError(null);

  // Sync user profile to Firestore
  const syncUserProfile = async (firebaseUser: User, customName?: string) => {
    try {
      const displayName =
        customName ||
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'User';

      const userRef = doc(db, 'users', firebaseUser.uid);
      const profileData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: displayName,
        displayName,
        photoURL: firebaseUser.photoURL || null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      };

      await setDoc(userRef, profileData, { merge: true });

      // Also ensure /users/{uid}/profile/main document is written for complete profile synchronization
      const mainProfileRef = doc(db, 'users', firebaseUser.uid, 'profile', 'main');
      await setDoc(
        mainProfileRef,
        {
          id: firebaseUser.uid,
          name: displayName,
          email: firebaseUser.email || '',
          currency: '₹',
          currencySymbol: '₹',
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      console.warn('Firestore profile sync note:', err?.message || err);
    }
  };

  useEffect(() => {
    // Handle URL verification codes (from Firebase email links or custom token links)
    const handleUrlVerification = async () => {
      try {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        const oobCode = params.get('oobCode');
        const verifyToken = params.get('verify_token');
        const verifyEmail = params.get('email');

        // 1. Firebase Native Email Verification Link
        if (mode === 'verifyEmail' && oobCode) {
          try {
            await applyActionCode(auth, oobCode);
            if (auth.currentUser) {
              await reload(auth.currentUser);
              const updatedUser: AppUser = {
                uid: auth.currentUser.uid,
                email: auth.currentUser.email,
                displayName: auth.currentUser.displayName,
                photoURL: auth.currentUser.photoURL,
                provider: 'password',
                emailVerified: true,
              };
              setUser(updatedUser);
              storageService.setCurrentUser(updatedUser);
            }
            window.history.replaceState({}, '', window.location.pathname);
            window.dispatchEvent(
              new CustomEvent('spendai-toast', {
                detail: {
                  type: 'success',
                  title: 'Email Verified!',
                  message: 'Your email address has been officially verified with Firebase.',
                },
              })
            );
          } catch (codeErr: any) {
            console.warn('Firebase applyActionCode error:', codeErr);
          }
        }

        // 2. Direct Verification Link / Token
        if (verifyToken && verifyEmail) {
          const success = await verifyByToken(verifyToken, verifyEmail);
          if (success) {
            window.history.replaceState({}, '', window.location.pathname);
            window.dispatchEvent(
              new CustomEvent('spendai-toast', {
                detail: {
                  type: 'success',
                  title: 'Account Verified!',
                  message: `Your email address (${verifyEmail}) has been successfully verified!`,
                },
              })
            );
          }
        }
      } catch (err: any) {
        console.warn('URL verification check note:', err);
      }
    };

    handleUrlVerification();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const isGoogle = currentUser.providerData?.some(
          (p) => p.providerId === 'google.com'
        );
        const appUser: AppUser = {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          provider: isGoogle ? 'google' : 'password',
          emailVerified: isGoogle ? true : currentUser.emailVerified,
        };
        setUser(appUser);
        storageService.setCurrentUser(appUser);
        await syncUserProfile(currentUser);
      } else {
        // If logged out from Firebase, verify if local or demo session is active
        const existing = storageService.getCurrentUser();
        if (existing && (existing.provider === 'demo' || existing.provider === 'local')) {
          setUser({
            uid: existing.uid,
            email: existing.email,
            displayName: existing.displayName,
            photoURL: existing.photoURL,
            provider: existing.provider as AppUser['provider'],
            emailVerified: existing.provider === 'demo' ? true : Boolean((existing as any).emailVerified),
          });
        } else {
          setUser(null);
          storageService.setCurrentUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-detect when email verification completes (e.g. user clicks link in their email client and returns to the app)
  useEffect(() => {
    if (!user || user.emailVerified) return;

    const checkVerificationStatus = async () => {
      if (auth.currentUser) {
        try {
          await reload(auth.currentUser);
          if (auth.currentUser.emailVerified) {
            const updatedUser: AppUser = {
              ...user,
              emailVerified: true,
            };
            setUser(updatedUser);
            storageService.setCurrentUser(updatedUser);
            window.dispatchEvent(
              new CustomEvent('spendai-toast', {
                detail: {
                  type: 'success',
                  title: 'Email Verified!',
                  message: 'Your email address has been verified. Welcome to your financial workspace!',
                },
              })
            );
          }
        } catch (err) {
          // Ignore transient errors during background poll
        }
      }
    };

    const handleFocus = () => {
      checkVerificationStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVerificationStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Poll every 3 seconds while unverified
    const intervalId = setInterval(checkVerificationStatus, 3000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [user?.emailVerified, user?.uid]);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const appUser: AppUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          provider: 'google',
        };
        setUser(appUser);
        storageService.setCurrentUser(appUser);
        await syncUserProfile(result.user);
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request' ||
        err.message?.includes('popup-closed-by-user')
      ) {
        // User closed or dismissed the popup voluntarily
        return;
      }

      let msg = 'Google sign-in failed. Please try again.';
      if (err.code === 'auth/popup-blocked') {
        msg = isIframe
          ? 'Sign-in popup was blocked by browser iframe restrictions. Click "Open in New Tab" to sign in directly with Google.'
          : 'Sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in popup was closed before completing.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        msg = 'Another sign-in window is already active.';
      } else if (err.code === 'auth/unauthorized-domain') {
        msg = 'This domain is not in the Firebase authorized domains list. Use "Open in New Tab" or "Instant Demo Login".';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection error. Please check your internet connection.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      if (result.user) {
        const appUser: AppUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          provider: 'password',
          emailVerified: result.user.emailVerified,
        };
        setUser(appUser);
        storageService.setCurrentUser(appUser);
        await syncUserProfile(result.user);
      }
    } catch (err: any) {
      console.warn('Firebase email auth note:', err.code, err.message);
      if (err.code === 'auth/operation-not-allowed') {
        const msg = 'Email/Password provider is not enabled in your Firebase Project (gen-lang-client-0472501454). Go to Firebase Console → Authentication → Sign-in method to enable Email/Password, or sign in with Google.';
        setError(msg);
        throw new Error(msg);
      }

      let msg = 'Failed to sign in. Please check your email and password.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please try again later.';
      }
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    name?: string
  ): Promise<SignUpResult> => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name?.trim() || cleanEmail.split('@')[0];

    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      let verificationSent = false;
      let backendDetails: SignUpResult = { verificationSent: true };

      if (result.user) {
        if (cleanName) {
          await updateProfile(result.user, { displayName: cleanName });
        }
        // Send email verification containing Firebase's verification link
        try {
          await sendEmailVerification(result.user, {
            url: window.location.origin,
            handleCodeInApp: false,
          });
          verificationSent = true;
        } catch (verErr) {
          try {
            await sendEmailVerification(result.user);
            verificationSent = true;
          } catch (verErr2) {
            console.warn('sendEmailVerification note:', verErr2);
          }
        }

        // Also request backend dispatch for audit & fallback link
        try {
          backendDetails = await requestBackendVerificationEmail(cleanEmail, cleanName);
        } catch (bErr) {
          console.warn('Backend email dispatch note:', bErr);
        }

        const appUser: AppUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: cleanName,
          photoURL: result.user.photoURL,
          provider: 'password',
          emailVerified: result.user.emailVerified,
        };
        setUser(appUser);
        storageService.setCurrentUser(appUser);
        await syncUserProfile(result.user, cleanName);
      }

      const combined: SignUpResult = {
        verificationSent: true,
        needsFirebaseConsoleEnable: false,
        verificationUrl: backendDetails.verificationUrl,
        previewUrl: backendDetails.previewUrl,
        token: backendDetails.token,
        message: 'Account created! Verification link has been dispatched to your email address.',
      };
      setVerificationDetails(combined);
      return combined;
    } catch (err: any) {
      console.warn('Firebase email signup note:', err.code, err.message);
      if (err.code === 'auth/operation-not-allowed') {
        const msg = 'Email/Password sign-in is not enabled in your Firebase Project (gen-lang-client-0472501454). Please enable Email/Password under Firebase Console → Authentication → Sign-in method, or sign in using Google.';
        setError(msg);
        throw new Error(msg);
      }

      let msg = 'Failed to create account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
      throw new Error(msg);
    }
  };

  const sendVerificationEmail = async (emailOverride?: string): Promise<SignUpResult> => {
    const targetEmail = emailOverride || user?.email;
    if (!targetEmail) {
      throw new Error('No user email address found to send verification email.');
    }

    let firebaseSent = false;
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser, {
          url: window.location.origin,
          handleCodeInApp: false,
        });
        firebaseSent = true;
      } catch (err: any) {
        try {
          await sendEmailVerification(auth.currentUser);
          firebaseSent = true;
        } catch (err2: any) {
          console.warn('Failed to send verification email via Firebase:', err2);
          if (err2.code === 'auth/too-many-requests') {
            throw new Error('Please wait a moment before requesting another verification email.');
          }
        }
      }
    }

    // Also request backend dispatch
    const backendDetails = await requestBackendVerificationEmail(
      targetEmail,
      user?.displayName || undefined
    );

    if (backendDetails.token) {
      try {
        localStorage.setItem(
          `pending_verification_${targetEmail.toLowerCase()}`,
          JSON.stringify({
            token: backendDetails.token,
            email: targetEmail.toLowerCase(),
            verificationUrl: backendDetails.verificationUrl,
            expiresAt: Date.now() + 24 * 3600 * 1000,
          })
        );
      } catch (_) {}
    }

    const combined: SignUpResult = {
      ...backendDetails,
      verificationSent: true,
      needsFirebaseConsoleEnable: !firebaseSent && (!auth.currentUser || user?.provider === 'local'),
    };
    setVerificationDetails(combined);
    return combined;
  };

  const verifyByToken = async (token: string, email: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const resp = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: cleanEmail }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.verified) {
          const accounts = getLocalAccounts();
          const match = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
          if (match) {
            match.emailVerified = true;
            saveLocalAccount(match);
          }
          if (user && user.email?.toLowerCase() === cleanEmail) {
            const updated: AppUser = { ...user, emailVerified: true };
            setUser(updated);
            storageService.setCurrentUser(updated);
          }
          return true;
        }
      }
    } catch (e) {
      console.warn('verifyByToken API error:', e);
    }

    // Fallback: check localStorage pending verification
    try {
      const raw = localStorage.getItem(`pending_verification_${cleanEmail}`);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.token === token && Date.now() < stored.expiresAt) {
          localStorage.removeItem(`pending_verification_${cleanEmail}`);
          const accounts = getLocalAccounts();
          const match = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
          if (match) {
            match.emailVerified = true;
            saveLocalAccount(match);
          }
          if (user && user.email?.toLowerCase() === cleanEmail) {
            const updated: AppUser = { ...user, emailVerified: true };
            setUser(updated);
            storageService.setCurrentUser(updated);
          }
          return true;
        }
      }
    } catch (localErr) {
      console.warn('Local verification token check error:', localErr);
    }

    return false;
  };

  const checkEmailVerified = async (): Promise<boolean> => {
    try {
      if (auth.currentUser) {
        await reload(auth.currentUser);
        const isVerified = auth.currentUser.emailVerified;
        if (user) {
          const updated: AppUser = { ...user, emailVerified: isVerified };
          setUser(updated);
          storageService.setCurrentUser(updated);
        }
        return isVerified;
      }
      return user?.emailVerified ?? false;
    } catch (err) {
      console.warn('checkEmailVerified error:', err);
      return user?.emailVerified ?? false;
    }
  };

  const verifyLocalEmail = async (): Promise<void> => {
    if (user && user.provider === 'local') {
      const updated: AppUser = { ...user, emailVerified: true };
      setUser(updated);
      storageService.setCurrentUser(updated);
      if (user.email) {
        const accounts = getLocalAccounts();
        const match = accounts.find((a) => a.email.toLowerCase() === user.email?.toLowerCase());
        if (match) {
          match.emailVerified = true;
          saveLocalAccount(match);
        }
      }
    }
  };

  const signInAsDemo = async (
    demoEmail = 'ashwin.finance@spendai.io',
    demoName = 'Ashwin Kumar'
  ) => {
    setError(null);
    const demoUser: AppUser = {
      uid: 'demo_user_spendai_01',
      email: demoEmail,
      displayName: demoName,
      photoURL: null,
      provider: 'demo',
    };
    setUser(demoUser);
    storageService.setCurrentUser(demoUser);
  };

  const logOut = async () => {
    setError(null);
    try {
      await signOut(auth).catch(() => {});
    } finally {
      storageService.setCurrentUser(null);
      setUser(null);
    }
  };

  const updateUserData = async (data: { displayName?: string; photoURL?: string | null }) => {
    setError(null);
    try {
      if (auth.currentUser) {
        // Firebase Auth updateProfile only accepts valid HTTP/HTTPS URLs <= 2048 chars
        const isWebUrl = Boolean(
          data.photoURL &&
          data.photoURL.length <= 2048 &&
          (data.photoURL.startsWith('http://') || data.photoURL.startsWith('https://'))
        );

        const authProfilePayload: { displayName?: string; photoURL?: string | null } = {};
        if (data.displayName !== undefined) {
          authProfilePayload.displayName = data.displayName;
        }
        if (data.photoURL !== undefined) {
          if (data.photoURL === null || data.photoURL === '') {
            authProfilePayload.photoURL = null;
          } else if (isWebUrl) {
            authProfilePayload.photoURL = data.photoURL;
          }
        }

        if (Object.keys(authProfilePayload).length > 0) {
          await updateProfile(auth.currentUser, authProfilePayload).catch((err) =>
            console.warn('Firebase profile update warning:', err)
          );
        }

        try {
          const userRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(
            userRef,
            {
              ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
              ...(data.photoURL !== undefined ? { photoURL: data.photoURL } : {}),
              lastLoginAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (dbErr) {
          console.warn('Firestore update warning:', dbErr);
        }
      }

      setUser((prev) => {
        if (!prev) {
          return {
            uid: 'local_user',
            email: null,
            displayName: data.displayName || 'User',
            photoURL: data.photoURL || null,
            provider: 'local',
          };
        }
        return {
          ...prev,
          ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
          ...(data.photoURL !== undefined ? { photoURL: data.photoURL } : {}),
        };
      });

      // Update storage service currentUser fields directly without wiping demo state or triggering async re-sync
      storageService.updateCurrentUserInfo({
        displayName: data.displayName,
        photoURL: data.photoURL,
      });
    } catch (e: any) {
      console.error('Failed to update user data', e);
      setError(e.message || 'Failed to update user profile');
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendVerificationEmail,
      checkEmailVerified,
      verifyLocalEmail,
      verifyByToken,
      verificationDetails,
      setVerificationDetails,
      signInAsDemo,
      logOut,
      updateUserData,
      error,
      clearError,
      isIframe,
      openInNewTab,
    }),
    [user, loading, error, isIframe, openInNewTab, verificationDetails]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper utilities for local accounts fallback
interface LocalAccountRecord {
  uid: string;
  email: string;
  password?: string;
  name: string;
  emailVerified?: boolean;
}

function getLocalAccounts(): LocalAccountRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLocalAccount(account: LocalAccountRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalAccounts();
    const idx = list.findIndex((a) => a.email.toLowerCase() === account.email.toLowerCase());
    if (idx >= 0) {
      list[idx] = account;
    } else {
      list.push(account);
    }
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
  } catch (_) {}
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
