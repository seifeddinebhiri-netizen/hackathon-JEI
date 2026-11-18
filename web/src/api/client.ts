import type { z } from 'zod';
import { env } from '@/lib/env';

export type ApiErrorCode =
  | 'reseau'
  | 'delai_depasse'
  | 'non_autorise'
  | 'interdit'
  | 'introuvable'
  | 'conflit'
  | 'trop_de_requetes'
  | 'trop_volumineux'
  | 'invalide'
  | 'serveur'
  | 'reponse_invalide'
  | 'inconnu';

/** Erreur typée renvoyée par toute la couche API. `message` est toujours en français. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

const MESSAGES: Record<ApiErrorCode, string> = {
  reseau: 'Impossible de joindre le serveur. Vérifie ta connexion.',
  delai_depasse: 'Le serveur met trop de temps à répondre. Réessaie dans un instant.',
  non_autorise: 'Ta session a expiré. Reconnecte-toi.',
  interdit: "Tu n'as pas accès à cette ressource.",
  introuvable: 'Élément introuvable.',
  conflit: 'Ces données ont été modifiées ailleurs. Recharge la page.',
  trop_de_requetes: 'Trop de demandes en peu de temps. Réessaie dans un instant.',
  trop_volumineux: 'Fichier trop volumineux.',
  invalide: 'Certaines informations envoyées ne sont pas valides.',
  serveur: 'Le serveur a rencontré un problème. Réessaie dans un instant.',
  reponse_invalide: "La réponse du serveur n'a pas le format attendu.",
  inconnu: "Une erreur inattendue s'est produite.",
};

export function errorFromStatus(status: number, serverMessage?: string): ApiError {
  const code: ApiErrorCode =
    status === 401
      ? 'non_autorise'
      : status === 403
        ? 'interdit'
        : status === 404
          ? 'introuvable'
          : status === 409
            ? 'conflit'
            : status === 429
              ? 'trop_de_requetes'
              : status === 413
                ? 'trop_volumineux'
                : status === 400 || status === 422
                  ? 'invalide'
                  : status >= 500
                    ? 'serveur'
                    : 'inconnu';
  return new ApiError(status, code, serverMessage || MESSAGES[code]);
}

export function apiError(code: ApiErrorCode, status = 0, message?: string): ApiError {
  return new ApiError(status, code, message ?? MESSAGES[code]);
}

/** Valide une réponse avec zod ; jamais d'écran blanc si le backend dévie du contrat. */
export function validate<S extends z.ZodType>(schema: S, data: unknown, where: string): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    if (import.meta.env.DEV) console.error(`[api] Réponse invalide pour ${where}`, r.error.issues);
    throw new ApiError(0, 'reponse_invalide', `${MESSAGES.reponse_invalide} (${where})`);
  }
  return r.data;
}

// --- Jeton d'authentification ---------------------------------------------------
let tokenGetter: () => string | null = () => null;
/** Appelé par AuthProvider pour fournir le jeton courant. */
export function setAuthTokenGetter(fn: () => string | null): void {
  tokenGetter = fn;
}

export const DEFAULT_TIMEOUT_MS = 15_000;
export const UPLOAD_TIMEOUT_MS = 60_000;

type RequestOptions<S extends z.ZodType> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  formData?: FormData;
  schema: S;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function request<S extends z.ZodType>(
  path: string,
  opts: RequestOptions<S>,
): Promise<z.output<S>> {
  // `VITE_API_URL` peut être relative (ex. « /api », relayée par le serveur de dev) : on la résout
  // par rapport à la page.
  const base = new URL(env.apiUrl.endsWith('/') ? env.apiUrl : `${env.apiUrl}/`, window.location.origin);
  const url = new URL(path.replace(/^\//, ''), base);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData; // le navigateur pose le Content-Type multipart
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort(opts.signal?.reason));

  let res: Response;
  try {
    res = await fetch(url, { method: opts.method ?? 'GET', headers, body, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && controller.signal.reason === 'timeout') throw apiError('delai_depasse');
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw apiError('reseau');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let serverMessage: string | undefined;
    try {
      const j = (await res.json()) as { message?: string; detail?: string };
      serverMessage =
        typeof j.message === 'string' ? j.message : typeof j.detail === 'string' ? j.detail : undefined;
    } catch {
      /* corps vide ou non JSON */
    }
    throw errorFromStatus(res.status, serverMessage);
  }

  const data: unknown = res.status === 204 ? { ok: true } : await res.json().catch(() => undefined);
  return validate(opts.schema, data, `${opts.method ?? 'GET'} ${path}`);
}
