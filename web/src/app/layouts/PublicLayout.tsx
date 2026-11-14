import { Outlet } from 'react-router';
import { Footer } from '@/components/layout/Footer';
import { PublicNav } from '@/components/layout/PublicNav';

export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNav />
      <main id="contenu" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
