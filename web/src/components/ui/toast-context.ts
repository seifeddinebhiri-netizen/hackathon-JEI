import { createContext, useContext } from 'react';

export type ToastTone = 'ok' | 'bad' | 'info';
export type ToastApi = { toast: (t: { title: string; description?: string; tone?: ToastTone }) => void };

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const c = useContext(ToastContext);
  if (!c) throw new Error('useToast doit être utilisé sous <Toaster>');
  return c;
}
