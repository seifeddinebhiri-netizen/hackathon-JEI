/** Lecture centralisée des variables d'environnement (préfixe VITE_). */
function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}
function num(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== undefined ? n : fallback;
}

/** Liste séparée par des virgules → noms nettoyés (« a, b ,,c » → [a, b, c]). */
export function list(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export const env = {
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000',
  useMocks: bool(import.meta.env.VITE_USE_MOCKS as string | undefined, true),
  /** Avec les mocks : fonctions de src/api/endpoints.ts qui passent quand même par le vrai backend. */
  realEndpoints: list(import.meta.env.VITE_REAL_ENDPOINTS as string | undefined),
  /** Coach branché au vrai backend (plan par l'IA) même quand le reste est simulé. */
  realCoach: bool(import.meta.env.VITE_REAL_COACH as string | undefined, !!import.meta.env.VITE_SUPABASE_URL),
  mockLatencyMs: num(import.meta.env.VITE_MOCK_LATENCY_MS as string | undefined, 600),
  mockFailRate: num(import.meta.env.VITE_MOCK_FAIL_RATE as string | undefined, 0),
  publicAppUrl:
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  demoEmail: (import.meta.env.VITE_DEMO_EMAIL as string | undefined) ?? '',
  demoPassword: (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
} as const;
