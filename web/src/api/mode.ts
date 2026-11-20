import { env } from '@/lib/env';
import { expandGroups } from './mixed';

/**
 * Les projets viennent-ils du vrai backend ? Oui sans mocks, et en mode mixte dès que `getProject`
 * est dans VITE_REAL_ENDPOINTS. Sinon le projet est la démonstration. Une seule règle, partagée : la
 * connexion décide du projet ouvert, et un projet réel ne doit jamais être remplacé par la démo
 * (le backend répondrait 404 sur l'identifiant « demo-… »).
 */
export function areProjectsReal(useMocks: boolean, realEndpoints: readonly string[]): boolean {
  return !useMocks || expandGroups(realEndpoints).includes('getProject');
}

export const projectsAreReal = areProjectsReal(env.useMocks, env.realEndpoints);
