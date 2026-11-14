import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { isApiError } from '@/api';
import { Toaster, TooltipProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthProvider';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // On ne réessaie pas les erreurs « métier » (4xx, réponse invalide)
        retry: (count, error) => {
          if (isApiError(error) && ((error.status >= 400 && error.status < 500) || error.code === 'reponse_invalide'))
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
      <AuthProvider>
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
