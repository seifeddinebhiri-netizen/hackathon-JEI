import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { isApiError } from '@/api';
import { Toaster, TooltipProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { SupabaseAuthProvider } from '@/features/auth/SupabaseAuthProvider';
import { VideoSessionProvider } from '@/features/festival/video/VideoSessionProvider';
import { hasRealAuth } from '@/lib/supabase';

// Vrais comptes si Supabase est configuré, sinon connexion simulée (démo sans serveur).
const Auth = hasRealAuth ? SupabaseAuthProvider : AuthProvider;

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // On ne réessaie pas les erreurs « métier » (4xx, réponse invalide)
        retry: (count, error) => {
          if (
            isApiError(error) &&
            ((error.status >= 400 && error.status < 500) || error.code === 'reponse_invalide')
          )
            return false;
          return count < 1;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      <Auth>
        <TooltipProvider>
          <Toaster>
            <VideoSessionProvider>{children}</VideoSessionProvider>
          </Toaster>
        </TooltipProvider>
      </Auth>
    </QueryClientProvider>
  );
}
