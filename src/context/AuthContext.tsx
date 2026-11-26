import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider, syncUserProfileToFirestore } from '../firebase';
import { apiFetch } from '../lib/api';

export interface DbUserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  monthlyEmailOptIn: boolean;
  anonymisedSharingDefault: boolean;
  poolConsentAt?: string | null;
  lastDigestSentAt: string | null;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: DbUserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Deletes all server-side data, then the sign-in account itself. */
  deleteAccount: () => Promise<void>;
  /** Opens the sign-in / create-account dialog. */
  requestSignIn: (reason?: string) => void;
  closeSignIn: () => void;
  signInPrompt: { open: boolean; reason?: string };
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updatePreferences: (prefs: {
    monthlyEmailOptIn?: boolean;
    anonymisedSharingDefault?: boolean;
    displayName?: string;
    consentVersion?: string;
  }) => Promise<void>;
}

/** Turns Firebase error codes into plain English. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'An account already exists for that email. Try signing in instead.',
    'auth/invalid-email': 'That email address does not look right.',
    'auth/weak-password': 'Use a password of at least 8 characters.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
    'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
    'auth/operation-not-allowed': 'Email sign-up is not switched on for this site yet.',
    'auth/requires-recent-login': 'For your security, please sign out, sign in again, then retry.',
  };
  return map[code] || (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signInPrompt, setSignInPrompt] = useState<{ open: boolean; reason?: string }>({ open: false });

  const syncProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch<{ user: DbUserProfile }>('/api/me');
      setProfile(data.user);
      setAuthError(null);
      syncUserProfileToFirestore({
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName,
        monthlyEmailOptIn: data.user.monthlyEmailOptIn,
        anonymisedSharingDefault: data.user.anonymisedSharingDefault,
      });
    } catch (err) {
      console.error('Account sync error:', err);
      setAuthError(err instanceof Error ? err.message : 'Unable to sync account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      syncProfile(user);
    });
    return () => unsub();
  }, [syncProfile]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 120) });
    }
    await sendEmailVerification(cred.user).catch(() => undefined);
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerification = async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  };

  const deleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const res = await apiFetch<{ authDeleted?: boolean }>('/api/me', { method: 'DELETE' });
    if (res.authDeleted) await signOut(auth);
    else await deleteUser(user);
    setProfile(null);
  };

  const requestSignIn = (reason?: string) => setSignInPrompt({ open: true, reason });
  const closeSignIn = () => setSignInPrompt({ open: false });

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await syncProfile(auth.currentUser);
  };

  const updatePreferences = async (prefs: {
    monthlyEmailOptIn?: boolean;
    anonymisedSharingDefault?: boolean;
    displayName?: string;
    consentVersion?: string;
  }) => {
    const data = await apiFetch<{ user: DbUserProfile }>('/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
    setProfile(data.user);
    syncUserProfileToFirestore({
      uid: data.user.uid,
      email: data.user.email,
      displayName: data.user.displayName,
      monthlyEmailOptIn: data.user.monthlyEmailOptIn,
      anonymisedSharingDefault: data.user.anonymisedSharingDefault,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        authError,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        resetPassword,
        resendVerification,
        deleteAccount,
        requestSignIn,
        closeSignIn,
        signInPrompt,
        logout,
        refreshProfile,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
