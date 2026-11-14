import { createContext, useContext } from 'react';

export type ToastTone = 'ok' | 'bad' | 'info';
export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Bouton d'action (ex. « Annuler ») */
  action?: { label: string; onClick: () => void };
  /** Durée d'affichage en ms (5000 par défaut) */
  duration?: number;
};
export type ToastApi = { toast: (t: ToastInput) => void };

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const c = useContext(ToastContext);
  if (!c) throw new Error('useToast doit être utilisé sous <Toaster>');
  return c;
}
