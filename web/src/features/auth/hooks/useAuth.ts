import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context';

export function useAuth(): AuthContextValue {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth doit être utilisé sous <AuthProvider>');
  return c;
}
