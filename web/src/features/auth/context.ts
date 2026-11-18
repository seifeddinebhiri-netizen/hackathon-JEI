import { createContext } from 'react';
import type { Session, User } from '@/api/types';

/** Interface identique à la future intégration Supabase (voir docs/INTEGRATION.md). */
export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  /** Une connexion ou une inscription est en cours. */
  loading: boolean;
  /** La session enregistrée est en cours de lecture : ne pas rediriger vers /connexion tout de suite. */
  initializing: boolean;
  /** « supabase » : vrais comptes ; « simulated » : connexion simulée (aucun serveur). */
  authMode: 'supabase' | 'simulated';
  canSignUp: boolean;
  demoAvailable: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<'signed_in' | 'confirm_email'>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Change le projet courant (ex. après « Nouveau film »). Avec Supabase : profil utilisateur. */
  setCurrentProject: (projectId: string) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
