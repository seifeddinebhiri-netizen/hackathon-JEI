import { describe, expect, it } from 'vitest';
import { festivalMatchSchema } from '../schemas';
import { deadlineStatus, loadFestivals, searchFestivalsLocal } from './festivals';

const NOW = new Date('2026-11-18T12:00:00');
const film = { duration_min: 15, language: 'Derja', genre: 'Fiction', declared_ai_departments: 1 };

describe('festivals simulés (même forme et même logique que le backend)', () => {
  it('contient les 20 fiches vérifiées, au format du contrat', () => {
    const all = searchFestivalsLocal({}, NOW);
    expect(all).toHaveLength(20);
    for (const m of all) expect(festivalMatchSchema.safeParse(m).success).toBe(true);
  });

  it('calcule le statut de la date limite à la lecture', () => {
    expect(deadlineStatus(null, '2026-11-18')).toBe('a_confirmer');
    expect(deadlineStatus('2026-09-22', '2026-11-18')).toBe('passee');
    expect(deadlineStatus('2027-01-31', '2026-11-18')).toBe('ouverte');
    expect(loadFestivals('2026-11-18').find((f) => f.id === 'fifak')?.deadline_status).toBe('a_confirmer');
  });

  it('filtre les appels ouverts et classe selon le film', () => {
    const open = searchFestivalsLocal({ open_only: true, film }, NOW);
    expect(open.every((m) => m.festival.deadline_status === 'ouverte')).toBe(true);
    expect(open[0].score).toBeGreaterThanOrEqual(open[open.length - 1].score);
    const short = open.find((m) => m.festival.id === 'a-films-ouverts')!;
    expect(short.score).toBe(1); // 5 min max pour un film de 15 min
    expect(short.warnings[0]).toBe('Durée au-delà du maximum (5 min).');
  });

  it('un appel clos est bloquant et renvoie au prochain appel', () => {
    const jcc = searchFestivalsLocal({ q: 'carthage', film }, NOW).find(
      (m) => m.festival.id === 'jcc-courts',
    )!;
    expect(jcc.score).toBe(1);
    expect(jcc.warnings).toContain('Appel clos pour cette édition : à garder pour le prochain appel.');
  });

  it('cherche aussi dans la ville, sans tenir compte des accents', () => {
    expect(searchFestivalsLocal({ q: 'kelibia' }, NOW).map((m) => m.festival.id)).toEqual(['fifak']);
  });
});
