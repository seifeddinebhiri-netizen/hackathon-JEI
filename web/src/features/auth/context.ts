import { createContext } from 'react';
import type { Session, User } from '@/api/types';

/** Interface identique à la future intégration Supabase (voir docs/INTEGRATION.md). */
export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Change le projet courant (ex. après « Nouveau film »). Avec Supabase : profil utilisateur. */
  setCurrentProject: (projectId: string) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
