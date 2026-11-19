/**
 * Pièces d'un dossier de festival, calculées depuis les exigences (`requirements`) du festival
 * et l'état du projet (synopsis, sous-titres, Passeport IA, page film).
 * Fonctions pures : aucun appel réseau, aucun calcul de compatibilité (fait par le serveur).
 */
import type {
  FestivalRequirement,
  Festival,
  FilmPageContent,
  KitPieceState,
  Passport,
  ShortlistItem,
  SubtitleLine,
  SynopsisKind,
  SynopsisTexts,
} from '@/api/types';
import { lineText } from './srt';

export type PieceState = 'bloquant' | 'a_faire' | 'pret';
export type PieceAction = { label: string; to: string } | { label: string; toggle: FestivalRequirement };

export type Piece = {
  /** Même clé = même pièce, préparée une seule fois pour tous les festivals qui la demandent. */
  key: string;
  kind: FestivalRequirement['kind'];
  title: string;
  /** État de la pièce, en clair. */
  detail: string;
  /** Ce que le festival demande, tel qu'écrit dans le règlement. */
  requirement: string;
  state: PieceState;
  action?: PieceAction;
};

export type DossierContext = {
  filmDurationMin?: number;
  synopsis: SynopsisTexts;
  /** undefined : pas encore chargé. */
  subtitles?: SubtitleLine[];
  /** undefined : pas encore chargé ; null : pas de Passeport. */
  passport?: Passport | null;
  filmPage: FilmPageContent;
  /** Pièces cochées à la main, par clé (`pieceKeyOf`) : les mêmes pour tous les dossiers. */
  pieces: Record<string, KitPieceState>;
};

export const PIECE_STATE_LABELS: Record<PieceState, string> = {
  bloquant: 'Bloquant',
  a_faire: 'À faire',
  pret: 'Prêt',
};

const MANUAL_TITLES: Partial<Record<FestivalRequirement['kind'], string>> = {
  affiche: 'Affiche',
  bio: 'Biographie et filmographie',
  droits_musique: 'Droits musicaux',
};

const SYNOPSIS_TITLES: Record<SynopsisKind, string> = {
  phrase: 'Synopsis en une phrase',
  court: 'Synopsis court',
  long: 'Synopsis long',
};

/**
 * Limites d'EXEMPLE (maquette) quand le règlement n'en donne pas : affichées comme telles.
 * Les vraies limites viennent de `requirements[].limit_chars`.
 */
export const EXAMPLE_SYNOPSIS_LIMITS: Record<string, Partial<Record<SynopsisKind, number>>> = {
  'bsff-next-generation': { phrase: 150, court: 300 },
  'vienna-shorts': { court: 500 },
  'clermont-international': { long: 1500 },
};

export type SynopsisLimit = { limit: number | null; example: boolean; requested: boolean };

/** Version de synopsis demandée par une exigence (court par défaut). */
export function synopsisKindOf(r: FestivalRequirement): SynopsisKind {
  const d = r.detail.toLowerCase();
  if (/\bphrase\b|logline/.test(d)) return 'phrase';
  if (/\blong\b/.test(d) || (r.limit_chars ?? 0) >= 1000) return 'long';
  return 'court';
}

/** Limite d'un festival pour une version : règlement d'abord, puis exemple marqué comme tel. */
export function synopsisLimit(f: Festival, kind: SynopsisKind): SynopsisLimit {
  const req = f.requirements.find((r) => r.kind === 'synopsis' && synopsisKindOf(r) === kind);
  if (req?.limit_chars) return { limit: req.limit_chars, example: false, requested: true };
  const ex = EXAMPLE_SYNOPSIS_LIMITS[f.id]?.[kind];
  if (ex) return { limit: ex, example: true, requested: true };
  return { limit: null, example: false, requested: !!req };
}

/** Langue des sous-titres à préparer : anglais d'abord (film en derja), puis français. */
export function subtitleLangOf(f: Festival, r: FestivalRequirement): 'fr' | 'en' | null {
  if (f.subtitle_langs.includes('en')) return 'en';
  if (f.subtitle_langs.includes('fr')) return 'fr';
  const d = r.detail.toLowerCase();
  if (d.includes('anglais')) return 'en';
  if (d.includes('français') || d.includes('francais')) return 'fr';
  return null;
}

const MANUAL_KINDS = new Set<FestivalRequirement['kind']>(['affiche', 'bio', 'droits_musique', 'format']);

/**
 * Clé d'enregistrement d'une pièce cochée à la main (table kit_pieces), null pour les pièces
 * calculées (synopsis, sous-titres, déclaration IA, photos, page film). Une même clé est partagée
 * par tous les dossiers qui demandent la pièce : la cocher une fois remplit tous ces dossiers.
 * « Film et inscription » est propre à chaque festival.
 */
export function pieceKeyOf(f: Festival, r: FestivalRequirement): string | null {
  if (!MANUAL_KINDS.has(r.kind)) return null;
  return r.kind === 'format' ? `format:${f.id}` : r.kind;
}

function isDone(f: Festival, r: FestivalRequirement, ctx: DossierContext): boolean {
  const key = pieceKeyOf(f, r);
  return !!key && ctx.pieces[key] === 'pret';
}

/** Nouveau dossier pour un festival. Ses pièces viennent du projet (rien n'est copié). */
export function newShortlistItem(f: Festival): ShortlistItem {
  return {
    festival_id: f.id,
    status: f.deadline_status === 'passee' ? 'prochain_appel' : 'a_preparer',
  };
}

function subtitlePiece(f: Festival, r: FestivalRequirement, ctx: DossierContext): Piece {
  const lang = subtitleLangOf(f, r);
  const title =
    lang === 'en' ? 'Sous-titres anglais' : lang === 'fr' ? 'Sous-titres français' : 'Sous-titres';
  const to = `/festival/sous-titres?dossier=${encodeURIComponent(f.id)}${lang ? `&langue=${lang}` : ''}`;
  const base = { key: `sous_titres:${lang ?? 'autre'}`, kind: r.kind, title, requirement: r.detail };
  const lines = ctx.subtitles;
  if (lines === undefined)
    return {
      ...base,
      state: 'a_faire',
      detail: 'Brouillon en cours de chargement.',
      action: { label: 'Ouvrir', to },
    };
  if (!lines.length)
    return {
      ...base,
      state: 'a_faire',
      detail: 'Pas encore de brouillon : importe le son de ton film.',
      action: { label: 'Préparer', to },
    };
  const validated = lines.filter((l) => l.validated).length;
  const missing = lang ? lines.filter((l) => !lineText(l, lang)).length : 0;
  if (validated < lines.length)
    return {
      ...base,
      state: 'a_faire',
      detail: `Brouillon IA : ${validated} lignes sur ${lines.length} validées.`,
      action: { label: 'Relire', to },
    };
  if (missing)
    return {
      ...base,
      state: 'a_faire',
      detail: `${missing} ligne${missing > 1 ? 's' : ''} sans texte ${lang === 'en' ? 'anglais' : 'français'}.`,
      action: { label: 'Compléter', to },
    };
  return {
    ...base,
    state: 'pret',
    detail: 'Toutes les lignes sont validées.',
    action: { label: 'Voir', to },
  };
}

function synopsisPiece(f: Festival, r: FestivalRequirement, ctx: DossierContext): Piece {
  const kind = synopsisKindOf(r);
  const text = ctx.synopsis[kind].trim();
  const { limit, example } = synopsisLimit(f, kind);
  const to = `/festival/synopsis?version=${kind}&dossier=${encodeURIComponent(f.id)}`;
  const base = { key: `synopsis:${kind}`, kind: r.kind, title: SYNOPSIS_TITLES[kind], requirement: r.detail };
  const ex = example ? ' (limite d’exemple)' : '';
  if (!text)
    return { ...base, state: 'a_faire', detail: 'Pas encore écrit.', action: { label: 'Écrire', to } };
  if (limit && text.length > limit)
    return {
      ...base,
      state: 'bloquant',
      detail: `${text.length} caractères, le formulaire en accepte ${limit}${ex}.`,
      action: { label: 'Raccourcir', to },
    };
  return {
    ...base,
    state: 'pret',
    detail: limit
      ? `${text.length} / ${limit} caractères${ex}.`
      : 'Pas de limite précise : ton texte actuel convient.',
    action: { label: 'Ouvrir', to },
  };
}

function declarationPiece(
  f: Festival,
  r: FestivalRequirement,
  item: ShortlistItem | undefined,
  ctx: DossierContext,
): Piece {
  const to = `/festival/dossiers/${encodeURIComponent(f.id)}/declaration-ia`;
  const base = { key: 'declaration_ia', kind: r.kind, title: 'Déclaration IA', requirement: r.detail };
  const p = ctx.passport;
  if (p === undefined)
    return {
      ...base,
      state: 'a_faire',
      detail: 'Passeport IA en cours de chargement.',
      action: { label: 'Ouvrir', to },
    };
  if (p === null)
    return {
      ...base,
      state: 'a_faire',
      detail: 'Passeport IA à remplir (environ 5 minutes).',
      action: { label: 'Déclarer', to },
    };
  const used = p.declarations.filter((d) => d.used_ai).length;
  if (f.ai_policy === 'interdite' && used > 0)
    return {
      ...base,
      state: 'bloquant',
      detail: 'Le festival refuse l’IA générative et ton Passeport en déclare.',
      action: { label: 'Voir', to },
    };
  if (item?.ai_choice)
    return {
      ...base,
      state: 'pret',
      detail: 'Validée par toi depuis ton Passeport.',
      action: { label: 'Voir', to },
    };
  return {
    ...base,
    state: 'a_faire',
    detail: 'Proposition prête depuis ton Passeport : à valider.',
    action: { label: 'Valider', to },
  };
}

function filmPagePiece(r: FestivalRequirement, ctx: DossierContext): Piece {
  const to = '/festival/page-film';
  if (r.kind === 'photos') {
    const n = ctx.filmPage.stills.length;
    return {
      key: 'photos',
      kind: r.kind,
      title: 'Photos du film',
      requirement: r.detail,
      state: n ? 'pret' : 'a_faire',
      detail: n ? `${n} photo${n > 1 ? 's' : ''} choisie${n > 1 ? 's' : ''}.` : 'Aucune photo choisie.',
      action: { label: n ? 'Voir' : 'Choisir', to },
    };
  }
  const ok = !!ctx.filmPage.trailer_url;
  return {
    key: 'page_film',
    kind: r.kind,
    title: 'Page film et bande-annonce',
    requirement: r.detail,
    state: ok ? 'pret' : 'a_faire',
    detail: ok ? 'Lien de la bande-annonce ajouté.' : 'Lien de la bande-annonce à ajouter.',
    action: { label: ok ? 'Voir' : 'Ajouter', to },
  };
}

function manualPiece(f: Festival, r: FestivalRequirement, ctx: DossierContext): Piece {
  const done = isDone(f, r, ctx);
  if (r.kind === 'format') {
    const base = { key: `format:${f.id}`, kind: r.kind, title: 'Film et inscription', requirement: r.detail };
    if (ctx.filmDurationMin && f.max_duration_min !== null && ctx.filmDurationMin > f.max_duration_min)
      return {
        ...base,
        state: 'bloquant',
        detail: `Ton film fait ${ctx.filmDurationMin} min, le festival accepte ${f.max_duration_min} min max.`,
      };
    return {
      ...base,
      state: done ? 'pret' : 'a_faire',
      detail: r.detail,
      action: { label: done ? 'Annuler' : 'Marquer comme prêt', toggle: r },
    };
  }
  return {
    key: r.kind,
    kind: r.kind,
    title: MANUAL_TITLES[r.kind] ?? r.kind,
    requirement: r.detail,
    state: done ? 'pret' : 'a_faire',
    detail: r.detail,
    action: { label: done ? 'Annuler' : 'Marquer comme prêt', toggle: r },
  };
}

const ORDER: Record<PieceState, number> = { bloquant: 0, a_faire: 1, pret: 2 };

/** Ce qui bloque d'abord, puis ce qui reste à faire, puis ce qui est prêt. */
export function sortPieces<P extends { state: PieceState }>(pieces: P[]): P[] {
  return pieces
    .map((p, i) => [p, i] as const)
    .sort((a, b) => ORDER[a[0].state] - ORDER[b[0].state] || a[1] - b[1])
    .map(([p]) => p);
}

/** Pièces demandées par CE festival (une seule fois chacune), triées bloquant → à faire → prêt. */
export function dossierPieces(f: Festival, item: ShortlistItem | undefined, ctx: DossierContext): Piece[] {
  const out = new Map<string, Piece>();
  for (const r of f.requirements) {
    const p =
      r.kind === 'sous_titres'
        ? subtitlePiece(f, r, ctx)
        : r.kind === 'synopsis'
          ? synopsisPiece(f, r, ctx)
          : r.kind === 'declaration_ia'
            ? declarationPiece(f, r, item, ctx)
            : r.kind === 'photos' || r.kind === 'bande_annonce'
              ? filmPagePiece(r, ctx)
              : manualPiece(f, r, ctx);
    const prev = out.get(p.key);
    if (!prev || ORDER[p.state] < ORDER[prev.state]) out.set(p.key, p);
  }
  return sortPieces([...out.values()]);
}

export function countReady(pieces: Piece[]): number {
  return pieces.filter((p) => p.state === 'pret').length;
}

export type SharedPiece = Omit<Piece, 'action' | 'requirement'> & { usedBy: string[] };

/**
 * Colonne « Mes pièces » : chaque pièce une seule fois, avec les festivals qui l'utilisent.
 * Son état est le moins avancé parmi les dossiers (un festival qui bloque la rend bloquante).
 */
export function sharedPieces(
  dossiers: { festival: Festival; pieces: Piece[]; label?: string }[],
): SharedPiece[] {
  const map = new Map<string, SharedPiece>();
  for (const { festival, pieces, label } of dossiers) {
    const name = label ?? festival.name;
    for (const p of pieces) {
      const cur = map.get(p.key);
      if (!cur) {
        map.set(p.key, {
          key: p.key,
          kind: p.kind,
          title: p.title,
          detail: p.detail,
          state: p.state,
          usedBy: [name],
        });
        continue;
      }
      if (!cur.usedBy.includes(name)) cur.usedBy.push(name);
      if (ORDER[p.state] < ORDER[cur.state]) {
        cur.state = p.state;
        cur.detail = p.detail;
      }
    }
  }
  return sortPieces([...map.values()]);
}
