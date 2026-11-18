/**
 * Festivals simulés : MÊMES fiches et MÊME logique que le backend
 * (backend/app/services/festival_service.py), pour qu'aucun écran ne change quand on bascule.
 * data/festivals.json est une copie de backend/data/festivals.json : à recopier quand il change.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { isoDay } from '@/lib/format';
import type * as T from '../types';
import raw from './data/festivals.json';

const URGENT_DAYS = 14;

type RawFestival = Omit<T.Festival, 'deadline_status'>;

export function deadlineStatus(deadline: string | null, today: string): T.DeadlineStatus {
  if (!deadline) return 'a_confirmer';
  return deadline < today ? 'passee' : 'ouverte';
}

/** Fiche sans source ni date de vérification : jamais affichée. */
export function loadFestivals(today = isoDay(new Date())): T.Festival[] {
  return (raw as RawFestival[])
    .filter((f) => f.source_url && f.checked_at)
    .map((f) => ({ ...f, deadline_status: deadlineStatus(f.deadline, today) }));
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function isFree(fee: string): boolean {
  return norm(fee).trim().startsWith('gratuit');
}

function applyFilters(list: T.Festival[], p: T.FestivalSearchParams): T.Festival[] {
  const q = norm(p.q ?? '').trim();
  return list.filter((f) => {
    if (q && !norm(`${f.name} ${f.country} ${f.city ?? ''}`).includes(q)) return false;
    if (p.country && norm(f.country) !== norm(p.country)) return false;
    // Garde les festivals sans durée maximale connue (on ne les exclut pas sans preuve).
    if (p.max_duration_min && f.max_duration_min !== null && f.max_duration_min < p.max_duration_min)
      return false;
    if (p.fee && (p.fee === 'gratuit') !== isFree(f.fee)) return false;
    if (p.deadline_before && (f.deadline === null || f.deadline > p.deadline_before)) return false;
    if (p.subtitle_lang && !f.subtitle_langs.includes(p.subtitle_lang)) return false;
    if (p.ai_policy && f.ai_policy !== p.ai_policy) return false;
    if (p.open_only && f.deadline_status !== 'ouverte') return false;
    return true;
  });
}

export function rankFestival(f: T.Festival, film: T.FilmProfile | undefined, today: Date): T.FestivalMatch {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 3;
  let blocked = false;

  if (film) {
    if (f.max_duration_min !== null) {
      if (film.duration_min <= f.max_duration_min) {
        score++;
        reasons.push(`Durée compatible (${film.duration_min} min pour ${f.max_duration_min} min maximum).`);
      } else {
        blocked = true;
        warnings.push(`Durée au-delà du maximum (${f.max_duration_min} min).`);
      }
    }
    if (film.declared_ai_departments > 0) {
      if (f.ai_policy === 'interdite') {
        blocked = true;
        warnings.push('Le festival refuse les films avec IA générative, et ton Passeport en déclare.');
      } else if (f.ai_policy === 'a_declarer') {
        reasons.push('Le festival demande une déclaration IA : ton Passeport IA la prépare.');
      } else if (f.ai_policy === 'section_dediee') {
        warnings.push(
          'Les films faits entièrement par IA vont dans une section à part : vérifie la bonne section.',
        );
      } else if (f.ai_policy === 'acceptee') {
        reasons.push("Le festival accepte l'usage de l'IA.");
      } else {
        warnings.push("Le règlement ne dit rien sur l'IA : demande au festival avant de t'inscrire.");
      }
    }
  }

  if (isFree(f.fee)) {
    score++;
    reasons.push('Inscription gratuite.');
  }

  if (f.subtitle_langs.length) {
    if (f.subtitle_langs.includes('fr'))
      reasons.push("Sous-titres français acceptés : brouillon disponible dans l'onglet Sous-titres.");
    else warnings.push(`Sous-titres demandés en : ${f.subtitle_langs.join(', ')}.`);
  }

  if (f.deadline === null) {
    warnings.push('Date limite à confirmer : vérifie le site officiel.');
  } else {
    const left = differenceInCalendarDays(parseISO(f.deadline), today);
    if (left < 0) {
      blocked = true;
      warnings.push('Appel clos pour cette édition : à garder pour le prochain appel.');
    } else if (left <= URGENT_DAYS) {
      score--;
      warnings.push(`Date limite dans ${left} jours : dossier à préparer vite.`);
    }
  }

  if (blocked) score = 1;
  const clamped = Math.max(1, Math.min(5, score)) as T.FestivalMatch['score'];
  return { festival: f, score: clamped, reasons: reasons.slice(0, 3), warnings };
}

const GROUP: Record<T.DeadlineStatus, number> = { ouverte: 0, a_confirmer: 1, passee: 2 };

/** Ouverts d'abord (date la plus proche), puis à confirmer, puis clos (les plus récents d'abord). */
function compare(a: T.FestivalMatch, b: T.FestivalMatch, withFilm: boolean): number {
  const key = (m: T.FestivalMatch) => {
    const f = m.festival;
    const group = GROUP[f.deadline_status];
    const t = f.deadline ? parseISO(f.deadline).getTime() : 0;
    return [withFilm ? -m.score : 0, group, group === 2 ? -t : t] as const;
  };
  const ka = key(a);
  const kb = key(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a.festival.name.localeCompare(b.festival.name);
}

export function searchFestivalsLocal(p: T.FestivalSearchParams, now = new Date()): T.FestivalMatch[] {
  const list = applyFilters(loadFestivals(isoDay(now)), p);
  return list.map((f) => rankFestival(f, p.film, now)).sort((a, b) => compare(a, b, !!p.film));
}
