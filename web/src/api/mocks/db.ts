/**
 * « Base de données » des mocks : en mémoire + localStorage (la démo survit au rechargement).
 * Réinitialisable depuis /mes-donnees ou avec resetMockDb().
 */
import type { Passport, Project, SubtitleDraft } from '@/api/types';
import { brand } from '@/app/brand';
import { buildDemoProject } from './data/project';
import subtitles from './data/subtitles.json';
import { env } from '@/lib/env';

const KEY = 'pp-mock-db-v1';

export type MockDb = {
  projects: Record<string, Project>;
  passports: Record<string, Passport>;
  subtitles: Record<string, SubtitleDraft>;
};

function examplePassport(): Passport {
  return {
    id: 'exemple',
    project_id: 'exemple',
    film_title: '[Film d’exemple]',
    director: '[Réalisatrice d’exemple]',
    c2pa_signed: true,
    badge_code: `${brand.badgePrefix}-EXEM-PL`,
    verify_url: `${env.publicAppUrl}/verifier/exemple`,
    updated_at: '2026-10-01T10:00:00+01:00',
    declarations: [
      {
        department: 'scenario',
        used_ai: false,
        what: '',
        human_decisions: 'Écrit entièrement par la réalisatrice.',
      },
      { department: 'image', used_ai: false, what: '', human_decisions: '' },
      {
        department: 'montage',
        used_ai: true,
        tool_id: 'tool-montage-a',
        what: 'Détection automatique des plans et synchronisation du son.',
        level: 'assistance',
        human_decisions: 'Choix des prises, rythme et ordre des séquences.',
      },
      {
        department: 'son_voix',
        used_ai: true,
        tool_id: 'tool-son-a',
        what: 'Réduction du bruit de fond sur deux scènes extérieures.',
        level: 'assistance',
        human_decisions: 'Mixage final et choix des ambiances.',
      },
      { department: 'musique', used_ai: false, what: '', human_decisions: 'Composée par [compositeur].' },
      { department: 'vfx', used_ai: false, what: '', human_decisions: '' },
      {
        department: 'sous_titres',
        used_ai: true,
        tool_id: 'tool-trad-a',
        what: 'Premier brouillon de traduction derja vers français.',
        level: 'generation_partielle',
        human_decisions: 'Chaque ligne relue, validée ou réécrite à la main.',
      },
      {
        department: 'affiche_promo',
        used_ai: true,
        tool_id: 'tool-image-a',
        what: 'Arrière-plan de l’affiche.',
        level: 'generation_complete',
        human_decisions: 'Composition, typographie et photo du personnage.',
      },
    ],
  };
}

function seed(): MockDb {
  const p = buildDemoProject();
  return {
    projects: { [p.id]: p },
    passports: { exemple: examplePassport() },
    subtitles: { [p.id]: structuredClone(subtitles) as SubtitleDraft },
  };
}

let db: MockDb | null = null;

export function getDb(): MockDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    db = raw ? (JSON.parse(raw) as MockDb) : seed();
  } catch {
    db = seed();
  }
  return db;
}

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getDb()));
  } catch {
    /* stockage plein ou désactivé : la démo continue en mémoire */
  }
}

export function resetMockDb(): void {
  db = seed();
  persist();
}

export function uid(prefix: string): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${r.slice(0, 10)}`;
}
