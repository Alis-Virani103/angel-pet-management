import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AUTHORITY_MODULES, AuthorityModule, EmployeeProfile, PermissionAction } from '../types';
import { auth, db, firebaseConfig, isLiveFirebaseConfigured } from '../firebase/config';

interface AuthState {
  user: User | null;
  profile: EmployeeProfile | null;
  isAdmin: boolean;
  loading: boolean;
  configurationError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  can: (module: AuthorityModule, action: PermissionAction) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const configurationError = isLiveFirebaseConfigured && auth && db
    ? ''
    : 'Secure employee sign-in is unavailable. Configure Firebase Authentication and Firestore first.';

  const refreshProfile = async () => {
    if (!auth?.currentUser || !db) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [token, profileSnapshot] = await Promise.all([
      auth.currentUser.getIdTokenResult(true),
      getDoc(doc(db, 'userProfiles', auth.currentUser.uid))
    ]);
    setIsAdmin(token.claims.admin === true);
    setProfile(profileSnapshot.exists() ? profileSnapshot.data() as EmployeeProfile : null);
  };

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    const firebaseAuth = auth;
    const firestore = db;
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      try {
        if (nextUser) {
          const [token, profileSnapshot] = await Promise.all([
            nextUser.getIdTokenResult(true),
            getDoc(doc(firestore, 'userProfiles', nextUser.uid))
          ]);
          setIsAdmin(token.claims.admin === true);
          setProfile(profileSnapshot.exists() ? profileSnapshot.data() as EmployeeProfile : null);
        } else {
          setIsAdmin(false);
          setProfile(null);
        }
      } catch (error) {
        console.error('Unable to load employee permissions:', error);
        setIsAdmin(false);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    profile,
    isAdmin,
    loading,
    configurationError,
    signIn: async (email, password) => {
      if (!auth) throw new Error(configurationError || 'Firebase Authentication is unavailable.');
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signOutUser: async () => {
      if (auth) await signOut(auth);
    },
    can: (module, action) => {
      if (isAdmin) return true;
      if (!profile?.active) return false;
      const allowed: PermissionAction[] = profile.permissions?.[module] || [];
      return allowed.includes(action);
    },
    refreshProfile
  }), [user, profile, isAdmin, loading, configurationError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};

export const EmployeeAccessGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isAdmin, loading, configurationError, signIn, signOutUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (configurationError) {
    return <div className="min-h-screen grid place-items-center bg-slate-50 p-6"><div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-6 text-sm text-slate-700 shadow-sm"><h1 className="text-lg font-bold text-slate-900">Firebase setup required</h1><p className="mt-2">{configurationError}</p></div></div>;
  }
  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Checking employee access…</div>;
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError('');
            setSubmitting(true);
            try {
              await signIn(email, password);
            } catch (loginError) {
              if (loginError instanceof FirebaseError && loginError.code === 'auth/configuration-not-found') {
                setError(
                  `Firebase Authentication is not configured for project "${firebaseConfig.projectId}". ` +
                  'Verify this deployment uses the same Firebase project as the employee account and that Email/Password sign-in is enabled.'
                );
              } else {
                setError(loginError instanceof Error ? loginError.message : 'Sign-in failed.');
              }
            } finally {
              setSubmitting(false);
            }
          }}
          className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div><h1 className="text-xl font-bold text-slate-900">Angel Pet ERP</h1><p className="mt-1 text-sm text-slate-500">Sign in with your employee account.</p></div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
          <label className="block"><span className="form-label">Work email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="form-input" /></label>
          <label className="block"><span className="form-label">Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="form-input" /></label>
          <button disabled={submitting} className="btn-primary w-full justify-center">{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    );
  }
  if (!isAdmin && (!profile || !profile.active)) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div><h1 className="text-lg font-bold text-slate-900">Access not configured</h1><p className="mt-2 text-sm text-slate-600">This account has no active employee permissions. Ask your administrator to configure access.</p></div>
          <button onClick={() => void signOutUser()} className="btn-secondary">Sign out</button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

export const PermissionRoute: React.FC<{ module: AuthorityModule; children: React.ReactNode }> = ({ module, children }) => {
  const { can } = useAuth();
  if (can(module, 'view')) return <>{children}</>;
  return <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center"><h1 className="font-bold text-slate-900">Access denied</h1><p className="mt-2 text-sm text-slate-500">Your account does not have permission to view {AUTHORITY_MODULES.find((item) => item.key === module)?.label}.</p></div>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin
    ? <>{children}</>
    : <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center"><h1 className="font-bold text-slate-900">Administrator access required</h1></div>;
};
