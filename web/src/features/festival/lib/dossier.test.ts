import { describe, expect, it } from 'vitest';
import type { Festival, Passport, ShortlistItem, SubtitleLine } from '@/api/types';
import {
  countReady,
  dossierPieces,
  newShortlistItem,
  pieceKeyOf,
  sharedPieces,
  synopsisLimit,
  type DossierContext,
} from './dossier';

const fest = (p: Partial<Festival>): Festival => ({
  id: 'vienna-shorts',
  name: 'Vienna Shorts · Fiction & Documentary',
  country: 'Autriche',
  deadline: '2027-01-31',
  deadline_status: 'ouverte',
  fee: '19 € puis 29 €',
  max_duration_min: 30,
  subtitle_langs: ['en'],
  ai_policy: 'a_declarer',
  requirements: [],
  source_url: 'https://exemple.invalid',
  checked_at: '2026-11-18',
  ...p,
});

const vienna = fest({
  requirements: [
    { kind: 'declaration_ia', detail: 'Déclaration de l’usage de l’IA dans le formulaire' },
    { kind: 'sous_titres', detail: 'Sous-titres anglais obligatoires' },
    { kind: 'photos', detail: 'Jusqu’à 3 photos du film' },
    { kind: 'synopsis', detail: 'Synopsis court dans le formulaire' },
    { kind: 'format', detail: '30 minutes maximum ; lien de visionnage' },
  ],
});

const passport: Passport = {
  id: 'p',
  project_id: 'demo',
  film_title: 'Dar Hmeti',
  director: 'Yassine',
  c2pa_signed: false,
  updated_at: '2026-11-10',
  declarations: [
    { department: 'montage', used_ai: true, what: 'Son', level: 'assistance', human_decisions: '' },
  ],
};

const sub = (validated: boolean, en = 'Hello'): SubtitleLine => ({
  id: Math.random().toString(36),
  start: '00:00:01,000',
  end: '00:00:02,000',
  source: '…',
  fr: 'Bonjour',
  en,
  confidence: 'elevee',
  validated,
});

const ctx = (p: Partial<DossierContext> = {}): DossierContext => ({
  filmDurationMin: 15,
  synopsis: { phrase: '', court: 'Un texte court.', long: '' },
  subtitles: [sub(true), sub(false)],
  passport,
  filmPage: { stills: ['/photos/a.jpg', '/photos/b.jpg', '/photos/c.jpg'] },
  pieces: {},
  ...p,
});

describe('pièces d’un dossier', () => {
  it('crée une pièce par exigence du festival, triée bloquant → à faire → prêt', () => {
    const pieces = dossierPieces(
      vienna,
      newShortlistItem(vienna),
      ctx({ synopsis: { phrase: '', court: 'x'.repeat(600), long: '' } }),
    );
    expect(pieces.map((p) => [p.title, p.state])).toEqual([
      ['Synopsis court', 'bloquant'], // 600 > 500 (limite d'exemple de Vienna)
      ['Déclaration IA', 'a_faire'],
      ['Sous-titres anglais', 'a_faire'],
      ['Film et inscription', 'a_faire'],
      ['Photos du film', 'pret'],
    ]);
    expect(pieces[0].detail).toBe('600 caractères, le formulaire en accepte 500 (limite d’exemple).');
    expect(pieces[2].detail).toBe('Brouillon IA : 1 lignes sur 2 validées.');
    expect(countReady(pieces)).toBe(1);
  });

  it('suit l’état réel : sous-titres validés, déclaration validée, pièce cochée à la main', () => {
    const item: ShortlistItem = { ...newShortlistItem(vienna), ai_choice: 'outil_technique' };
    const pieces = dossierPieces(
      vienna,
      item,
      ctx({ subtitles: [sub(true), sub(true)], pieces: { 'format:vienna-shorts': 'pret' } }),
    );
    expect(pieces.every((p) => p.state === 'pret')).toBe(true);
  });

  it('une pièce cochée une fois remplit tous les dossiers qui la demandent (aucune copie)', () => {
    const bsff = fest({ id: 'bsff', requirements: [{ kind: 'affiche', detail: 'Affiche A4' }] });
    const clermont = fest({ id: 'clermont', requirements: [{ kind: 'affiche', detail: 'Affiche du film' }] });
    // Même clé pour les deux festivals, même si le règlement est écrit autrement
    expect(pieceKeyOf(bsff, bsff.requirements[0])).toBe('affiche');
    expect(pieceKeyOf(clermont, clermont.requirements[0])).toBe('affiche');
    const c = ctx({ pieces: { affiche: 'pret' } });
    expect(dossierPieces(bsff, undefined, c)[0].state).toBe('pret');
    expect(dossierPieces(clermont, undefined, c)[0].state).toBe('pret');
    // « Film et inscription » reste propre à chaque festival ; les pièces calculées n'ont pas de clé
    expect(pieceKeyOf(vienna, vienna.requirements[4])).toBe('format:vienna-shorts');
    expect(pieceKeyOf(vienna, vienna.requirements[1])).toBeNull();
  });

  it('bloque un film trop long et une IA refusée', () => {
    const strict = fest({
      id: 'strict',
      max_duration_min: 5,
      ai_policy: 'interdite',
      requirements: [
        { kind: 'format', detail: '5 minutes maximum' },
        { kind: 'declaration_ia', detail: 'Attestation : aucune IA' },
      ],
    });
    const pieces = dossierPieces(strict, undefined, ctx());
    expect(pieces.map((p) => p.state)).toEqual(['bloquant', 'bloquant']);
    expect(pieces[0].detail).toBe('Ton film fait 15 min, le festival accepte 5 min max.');
  });

  it('sans Passeport ni brouillon : pièces à faire avec la bonne action', () => {
    const pieces = dossierPieces(vienna, undefined, ctx({ passport: null, subtitles: [] }));
    const decl = pieces.find((p) => p.key === 'declaration_ia')!;
    expect(decl.detail).toBe('Passeport IA à remplir (environ 5 minutes).');
    expect(decl.action).toEqual({ label: 'Déclarer', to: '/festival/dossiers/vienna-shorts/declaration-ia' });
    expect(pieces.find((p) => p.key === 'sous_titres:en')!.action).toEqual({
      label: 'Préparer',
      to: '/festival/sous-titres?dossier=vienna-shorts&langue=en',
    });
  });

  it('ne compte pas deux fois une pièce demandée deux fois par le même festival', () => {
    const f = fest({
      requirements: [
        { kind: 'photos', detail: '3 photos du film' },
        { kind: 'photos', detail: '1 photo du réalisateur' },
      ],
    });
    expect(dossierPieces(f, undefined, ctx())).toHaveLength(1);
  });

  it('un festival sans exigence n’a aucune pièce', () => {
    expect(dossierPieces(fest({ requirements: [] }), undefined, ctx())).toEqual([]);
  });
});

describe('Mes pièces : chaque pièce une seule fois', () => {
  it('regroupe les pièces et liste les festivals qui les utilisent', () => {
    const bsff = fest({
      id: 'bsff-next-generation',
      name: 'BSFF · Next Generation',
      requirements: [
        { kind: 'sous_titres', detail: 'Copie sous-titrée en anglais' },
        { kind: 'photos', detail: '3 photos du film + 1 photo du réalisateur' },
      ],
    });
    const c = ctx();
    const shared = sharedPieces([
      { festival: bsff, pieces: dossierPieces(bsff, undefined, c), label: 'BSFF' },
      { festival: vienna, pieces: dossierPieces(vienna, undefined, c), label: 'Vienna Shorts' },
    ]);
    const subs = shared.find((p) => p.key === 'sous_titres:en')!;
    expect(subs.usedBy).toEqual(['BSFF', 'Vienna Shorts']);
    expect(shared.filter((p) => p.key === 'photos')).toHaveLength(1);
    expect(shared.find((p) => p.key === 'synopsis:court')!.usedBy).toEqual(['Vienna Shorts']);
  });

  it('prend l’état le moins avancé : une pièce bloquante pour un festival l’est partout', () => {
    const tight = fest({
      id: 'x',
      name: 'X',
      requirements: [{ kind: 'synopsis', detail: 'Synopsis', limit_chars: 10 }],
    });
    const loose = fest({ id: 'y', name: 'Y', requirements: [{ kind: 'synopsis', detail: 'Synopsis' }] });
    const c = ctx();
    const [p] = sharedPieces([
      { festival: loose, pieces: dossierPieces(loose, undefined, c) },
      { festival: tight, pieces: dossierPieces(tight, undefined, c) },
    ]);
    expect(p.state).toBe('bloquant');
    expect(p.usedBy).toEqual(['Y', 'X']);
  });
});

describe('limites de synopsis', () => {
  it('le règlement d’abord, puis une limite d’exemple marquée comme telle', () => {
    const f = fest({
      id: 'z',
      requirements: [{ kind: 'synopsis', detail: 'Synopsis de 300 caractères', limit_chars: 300 }],
    });
    expect(synopsisLimit(f, 'court')).toEqual({ limit: 300, example: false, requested: true });
    expect(synopsisLimit(vienna, 'court')).toEqual({ limit: 500, example: true, requested: true });
    expect(synopsisLimit(vienna, 'long')).toEqual({ limit: null, example: false, requested: false });
  });
});

describe('dossier', () => {
  it('un appel clos part « pour le prochain appel »', () => {
    expect(newShortlistItem(fest({ deadline_status: 'passee' })).status).toBe('prochain_appel');
    expect(newShortlistItem(vienna)).toEqual({ festival_id: 'vienna-shorts', status: 'a_preparer' });
  });
});
