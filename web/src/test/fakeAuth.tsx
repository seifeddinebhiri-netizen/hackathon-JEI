/** Faux fournisseur d'authentification pour les tests d'écrans (aucun appel Supabase). */
import { useState, type ReactNode } from 'react';
import { vi } from 'vitest';
import type { User } from '@/api/types';
import { AuthContext, type AuthContextValue } from '@/features/auth/context';

import { GOOD_PASSWORD, YASSINE } from './authFixtures';

export function FakeAuth({
  children,
  initialUser = null,
  overrides = {},
}: {
  children: ReactNode;
  initialUser?: User | null;
  overrides?: Partial<AuthContextValue>;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const value: AuthContextValue = {
    user,
    session: null,
    loading: false,
    initializing: false,
    authMode: 'supabase',
    canSignUp: true,
    demoAvailable: false,
    signIn: async (_email, password) => {
      if (password !== GOOD_PASSWORD) throw new Error('Email ou mot de passe incorrect.');
      setUser(YASSINE);
    },
    signUp: vi.fn(),
    signInDemo: vi.fn(),
    signOut: async () => setUser(null),
    requestPasswordReset: vi.fn(async () => undefined),
    updatePassword: vi.fn(async () => undefined),
    setCurrentProject: vi.fn(),
    ...overrides,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
