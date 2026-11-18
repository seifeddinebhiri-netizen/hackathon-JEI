import { Navigate, useLocation } from 'react-router';

/** Ancienne page « Regarder et valider » : la relecture se fait maintenant sur un seul écran. */
export default function Regarder() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/festival/sous-titres', search }} replace />;
}
