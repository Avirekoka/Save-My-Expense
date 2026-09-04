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
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
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

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const openInNewTab = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const clearError = () => setError(null);

  // Sync user profile to Firestore
  const syncUserProfile = async (firebaseUser: User, customName?: string) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      const displayName =
        customName ||
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'User';

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName,
          photoURL: firebaseUser.photoURL || null,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
      } else {
        await setDoc(
          userRef,
          {
            lastLoginAt: serverTimestamp(),
            ...(displayName ? { displayName } : {}),
            ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
          },
          { merge: true }
        );
      }
    } catch (err: any) {
      console.warn('Firestore profile sync note:', err?.message || err);
    }
  };

  useEffect(() => {
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
        };
        setUser(appUser);
        storageService.setCurrentUser(appUser);
        await syncUserProfile(result.user);
      }
    } catch (err: any) {
      console.warn('Firebase email auth note:', err.code, err.message);
      // Seamless fallback if Email/Password provider is disabled in Firebase console
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/admin-restricted-operation'
      ) {
        // Authenticate via local account storage
        const localAccounts = getLocalAccounts();
        const existing = localAccounts.find((a) => a.email.toLowerCase() === cleanEmail);
        if (existing && existing.password !== pass) {
          const msg = 'Incorrect password for this email account.';
          setError(msg);
          throw new Error(msg);
        }

        const localUser: AppUser = {
          uid: existing?.uid || `local_${Math.abs(hashString(cleanEmail)).toString(36)}`,
          email: cleanEmail,
          displayName: existing?.name || cleanEmail.split('@')[0],
          photoURL: null,
          provider: 'local',
        };
        setUser(localUser);
        storageService.setCurrentUser(localUser);
        return;
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

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name?.trim() || cleanEmail.split('@')[0];

    try {
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      if (result.user) {
        if (cleanName) {
          await updateProfile(result.user, { displayName: cleanName });
        }
        const appUser: AppUser = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: cleanName,
          photoURL: result.user.photoURL,
          provider: 'password',
        };
        setUser(appUser);
        storageService.setCurrentUser(appUser);
        await syncUserProfile(result.user, cleanName);
      }
    } catch (err: any) {
      console.warn('Firebase email signup note:', err.code, err.message);
      // Seamless fallback if Email/Password provider is disabled in Firebase console
      if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/configuration-not-found' ||
        err.code === 'auth/admin-restricted-operation'
      ) {
        saveLocalAccount({
          uid: `local_${Math.abs(hashString(cleanEmail)).toString(36)}`,
          email: cleanEmail,
          password: pass,
          name: cleanName,
        });

        const localUser: AppUser = {
          uid: `local_${Math.abs(hashString(cleanEmail)).toString(36)}`,
          email: cleanEmail,
          displayName: cleanName,
          photoURL: null,
          provider: 'local',
        };
        setUser(localUser);
        storageService.setCurrentUser(localUser);
        return;
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
      signInAsDemo,
      logOut,
      updateUserData,
      error,
      clearError,
      isIframe,
      openInNewTab,
    }),
    [user, loading, error, isIframe, openInNewTab]
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
