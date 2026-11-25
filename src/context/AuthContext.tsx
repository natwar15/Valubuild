import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider, syncUserProfileToFirestore } from '../firebase';
import { apiFetch } from '../lib/api';

export interface DbUserProfile {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  monthlyEmailOptIn: boolean;
  anonymisedSharingDefault: boolean;
  lastDigestSentAt: string | null;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: DbUserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updatePreferences: (prefs: {
    monthlyEmailOptIn?: boolean;
    anonymisedSharingDefault?: boolean;
    displayName?: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

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
