import { Outlet } from 'react-router';
import { AppNav } from '@/components/layout/AppNav';
import { RequireAuth } from '@/features/auth/components/RequireAuth';

export function AppLayout() {
  return (
    <RequireAuth>
      <div className="flex min-h-dvh flex-col">
        <AppNav />
        <main id="contenu" tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-0">
          <div className="container-pp py-8 md:py-12">
            <Outlet />
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
