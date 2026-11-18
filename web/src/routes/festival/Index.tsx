import { Navigate, useSearchParams } from 'react-router';
import Catalogue from './Catalogue';

/** Anciennes URL du Kit (`/festival?onglet=…`) → nouvelles routes. */
const OLD_TABS: Record<string, string> = {
  trouver: '/festival',
  selection: '/festival/dossiers',
  'sous-titres': '/festival/sous-titres',
  synopsis: '/festival/synopsis',
  'page-film': '/festival/page-film',
};

export default function FestivalIndex() {
  const [params] = useSearchParams();
  const tab = params.get('onglet');
  if (tab !== null) return <Navigate to={OLD_TABS[tab] ?? '/festival'} replace />;
  return <Catalogue />;
}
