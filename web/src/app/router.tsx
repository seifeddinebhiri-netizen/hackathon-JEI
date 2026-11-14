import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from './layouts/AppLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { RootLayout } from './layouts/RootLayout';
import { RouteError } from './RouteError';

/** Chargement paresseux : chaque écran est un fichier séparé dans le build. */
type PageModule = { default: React.ComponentType };
const page = (load: () => Promise<PageModule>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: '_ui', ...page(() => import('@/routes/UiKit')) }] // exclue du build de production
  : [];

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, ...page(() => import('@/routes/Home')) },
          { path: 'connexion', ...page(() => import('@/routes/Login')) },
          { path: 'verifier/:id', ...page(() => import('@/routes/Verify')) },
          { path: 'film/:id', ...page(() => import('@/routes/FilmPublic')) },
          ...devRoutes,
          { path: '*', ...page(() => import('@/routes/NotFound')) },
        ],
      },
      {
        element: <AppLayout />,
        errorElement: <RouteError />,
        children: [
          { path: 'projet', ...page(() => import('@/routes/ProjectDashboard')) },
          { path: 'planner', ...page(() => import('@/routes/PlannerHome')) },
          { path: 'planner/rapide', ...page(() => import('@/routes/PlannerQuick')) },
          { path: 'planner/projet', ...page(() => import('@/routes/PlannerWizard')) },
          { path: 'planner/calendrier', ...page(() => import('@/routes/PlannerCalendar')) },
          { path: 'planner/jour/:date', ...page(() => import('@/routes/PlannerDay')) },
          { path: 'coach', ...page(() => import('@/routes/Coach')) },
          { path: 'passeport', ...page(() => import('@/routes/Passport')) },
          { path: 'festival', ...page(() => import('@/routes/Festival')) },
          { path: 'mes-donnees', ...page(() => import('@/routes/MyData')) },
        ],
      },
    ],
  },
]);
