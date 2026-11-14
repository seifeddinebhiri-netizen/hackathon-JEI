import { Outlet, ScrollRestoration } from 'react-router';

export function RootLayout() {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only-focusable fixed top-2 left-2 z-[70] bg-gold px-4 py-3 font-semibold text-ink"
      >
        Aller au contenu
      </a>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
