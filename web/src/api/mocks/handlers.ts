/**
 * Implémentation SIMULÉE de l'API. Même signature que endpoints.ts (type `Api`).
 * - latence : VITE_MOCK_LATENCY_MS (± 30 %)
 * - échecs aléatoires : VITE_MOCK_FAIL_RATE (0 à 1) pour tester les états d'erreur
 * - chaque réponse passe par le même schéma zod que le vrai backend
 */
import { z } from 'zod';
import { eachDayOfInterval, formatISO, parseISO } from 'date-fns';
import { brand } from '@/app/brand';
import { env } from '@/lib/env';
import { isoDay } from '@/lib/format';
import { compassLabel, sunPosition } from '@/lib/sun';
import { apiError, validate } from '../client';
import type { Api } from '../endpoints';
import * as S from '../schemas';
import type * as T from '../types';
import aiTools from './data/ai-tools.json';
import { loadFestivals, searchFestivalsLocal } from './festivals';
import { checkRules } from './subtitleRules';
import demoSubtitles from './data/subtitles.json';
import { getDb, persist, uid } from './db';
import { mockParseScreenplay } from './parser';
import { mockSchedule } from './scheduler';
import { mockWeatherDay, mockWeatherRange } from './weather';
import { anchoredSlot, atTime, isRainy, isWeatherKnown, isWindy } from '@/features/planner/lib/rules';
import { TUNIS } from '@/lib/sun';

// --- Simulation réseau -----------------------------------------------------------
async function simulate<Sch extends z.ZodType>(
  where: string,
  schema: Sch,
  fn: () => unknown | Promise<unknown>,
  latencyFactor = 1,
): Promise<z.output<Sch>> {
  const jitter = 0.7 + Math.random() * 0.6;
  await new Promise((r) => setTimeout(r, env.mockLatencyMs * jitter * latencyFactor));
  if (env.mockFailRate > 0 && Math.random() < env.mockFailRate) throw apiError('serveur', 503);
  const data = await fn();
  return validate(schema, structuredClone(data), `[mock] ${where}`);
}

function requireProject(id: string): T.Project {
  const p = getDb().projects[id];
  if (!p) throw apiError('introuvable', 404, 'Projet introuvable.');
  return p;
}

// --- Géocodage (coordonnées publiques des villes) --------------------------------
const PLACES: T.GeocodeResult[] = [
  { label: 'Tunis', lat: 36.8065, lon: 10.1815 },
  { label: 'Médina de Tunis', lat: 36.7986, lon: 10.1706 },
  { label: 'La Marsa', lat: 36.8782, lon: 10.3247 },
  { label: 'Sidi Bou Saïd', lat: 36.8687, lon: 10.3417 },
  { label: 'Gammarth', lat: 36.9197, lon: 10.2894 },
  { label: 'Carthage', lat: 36.8528, lon: 10.3233 },
  { label: 'Bizerte', lat: 37.2744, lon: 9.8739 },
  { label: 'Nabeul', lat: 36.4513, lon: 10.7357 },
  { label: 'Hammamet', lat: 36.4, lon: 10.6167 },
  { label: 'Sousse', lat: 35.8256, lon: 10.6411 },
  { label: 'Monastir', lat: 35.7643, lon: 10.8113 },
  { label: 'Kairouan', lat: 35.6781, lon: 10.0963 },
  { label: 'Sfax', lat: 34.7406, lon: 10.7603 },
  { label: 'Djerba', lat: 33.8076, lon: 10.8451 },
  { label: 'Tozeur', lat: 33.9197, lon: 8.1335 },
  { label: 'Tabarka', lat: 36.9544, lon: 8.7581 },
];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function geocodeLocal(q: string): T.GeocodeResult[] {
  const n = norm(q.trim());
  if (!n) return [];
  const hits = PLACES.filter((p) => n.includes(norm(p.label)) || norm(p.label).includes(n));
  return hits.length ? hits : [{ label: `${q.trim()} (position approximative : Tunis)`, ...TUNIS }];
}

// --- Scène rapide ----------------------------------------------------------------
function quickSlotsFor(req: T.QuickSlotRequest): T.QuickSlotsResponse {
  const place = geocodeLocal(req.place)[0] ?? { label: 'Tunis', ...TUNIS };
  const start = parseISO(req.from);
  const end = parseISO(req.to);
  const days = end < start ? [] : eachDayOfInterval({ start, end }).slice(0, 31);
  const fakeScene: T.Scene = {
    id: 'quick',
    number: '1',
    title: '',
    setting: req.setting,
    moment: req.moment,
    location_id: 'quick',
    characters: [],
    estimated_hours: 1.5,
    summary: req.description,
    source: 'manuel',
    validated: false,
  };
  const loc: T.Location = {
    id: 'quick',
    name: place.label,
    address: '',
    lat: place.lat,
    lon: place.lon,
    forbidden_days: [],
    permit: 'non_necessaire',
  };

  const slots: T.QuickSlot[] = days.map((d) => {
    const dateIso = isoDay(d);
    const w = mockWeatherDay(d, place.lat, place.lon);
    const anchored = anchoredSlot(fakeScene, dateIso, loc);
    const s = anchored?.start ?? atTime(dateIso, req.setting === 'EXT' ? '09:00' : '10:00');
    const e = anchored?.end ?? atTime(dateIso, req.setting === 'EXT' ? '10:30' : '11:30');
    const pos = sunPosition(s, place.lat, place.lon);
    const sunTxt =
      pos.altitude > 0
        ? `Soleil au ${compassLabel(pos.azimuth)}, à ${Math.round(pos.altitude)}° au-dessus de l'horizon.`
        : 'Soleil sous l’horizon.';
    let verdict: T.QuickSlot['verdict'];
    let reason: string;
    if (req.setting === 'INT') {
      verdict = isRainy(w) ? 'recommande' : 'plan_b';
      reason = isRainy(w)
        ? `Jour de pluie (${w.rain_pct} %) : bon jour pour l’intérieur. ${sunTxt}`
        : isWeatherKnown(w)
          ? `Intérieur : la météo compte peu. Garde ce jour sec pour une scène extérieure si tu en as. ${sunTxt}`
          : `Intérieur : météo pas encore connue, peu importante ici. ${sunTxt}`;
    } else if (!isWeatherKnown(w)) {
      verdict = 'plan_b';
      reason = `Au-delà de 14 jours : météo à revérifier. Seule la lumière est connue. ${sunTxt}`;
    } else if (isRainy(w) || isWindy(w)) {
      verdict = 'a_eviter';
      reason = isRainy(w) ? `Pluie prévue (${w.rain_pct} %).` : `Vent fort prévu (${w.wind_kmh} km/h).`;
    } else {
      verdict = w.cloud_pct < 40 ? 'recommande' : 'plan_b';
      reason = `${w.cloud_pct < 40 ? 'Ciel plutôt dégagé' : 'Ciel couvert'} (nuages ${w.cloud_pct} %, pluie ${w.rain_pct} %). ${sunTxt}`;
    }
    return { start: formatISO(s), end: formatISO(e), verdict, reason, weather: w };
  });

  const rank = { recommande: 0, plan_b: 1, a_eviter: 2 } as const;
  slots.sort((a, b) => rank[a.verdict] - rank[b.verdict] || a.start.localeCompare(b.start));
  return { place, slots: slots.slice(0, 8) };
}

// --- Synopsis : uniquement des questions -------------------------------------------
function synopsisQuestions(input: T.SynopsisFeedbackInput): T.SynopsisFeedback {
  const text = input.text.trim();
  const q: string[] = [];
  if (!text) {
    return {
      questions: [
        'Qui est ton personnage principal, et que veut-il ?',
        'Qu’est-ce qui l’empêche de l’obtenir ?',
        'Où et quand se passe l’histoire ?',
      ],
    };
  }
  if (input.limit_chars && text.length > input.limit_chars) {
    q.push(
      `Ton texte fait ${text.length} caractères pour une limite de ${input.limit_chars}. Quelle phrase pourrait disparaître sans qu’on perde l’enjeu ?`,
    );
  }
  if (input.kind === 'phrase') {
    q.push('En une phrase : dit-elle qui, ce qu’il veut, et ce qui l’en empêche ?');
  } else {
    if (!/[A-ZÀ-Ö][a-zà-ö]+/.test(text.slice(1)))
      q.push('Le lecteur connaît-il le prénom de ton personnage principal ?');
    q.push('Quel est le moment où tout bascule pour ton personnage ?');
    if (input.kind === 'long') q.push('Le lecteur comprend-il ce qui est en jeu si le personnage échoue ?');
    if (/\b(fin|finalement|à la fin)\b/i.test(text))
      q.push('Veux-tu révéler la fin ? Beaucoup de festivals préfèrent un synopsis qui la garde.');
  }
  q.push('Un programmateur qui ne connaît pas la Tunisie comprendrait-il le contexte ?');
  return { questions: q.slice(0, 4) };
}

// --- Synopsis : traduction (mock) ---------------------------------------------------
/** Traductions connues des textes de démonstration ; sinon, traduction simulée signalée comme telle. */
const DEMO_TRANSLATIONS: Record<string, string> = {
  'Slim veut vendre le café de son père à Tunis, mais sa sœur Amira refuse de le laisser partir.':
    'Slim wants to sell his father’s café in Tunis, but his sister Amira refuses to let it go.',
  'Dans la médina de Tunis, Slim a vendu en secret le café que leur père a tenu pendant quarante ans. Quand sa sœur Amira l’apprend, une dispute éclate entre les murs blancs du café. Pendant une nuit, ils vident les étagères, retrouvent les photos, les dettes et les promesses. Au matin, Amira comprend pourquoi Slim est parti, et Slim comprend ce qu’il a vendu.':
    'In the Tunis medina, Slim has secretly sold the café their father ran for forty years. When his sister Amira finds out, a fight breaks out within the café’s white walls. Over one night, they empty the shelves and find the photos, the debts and the promises. By morning, Amira understands why Slim left, and Slim understands what he sold.',
};
function translateLocal(input: T.SynopsisTranslateInput): T.SynopsisTranslation {
  const text = input.text.trim();
  if (!text) throw apiError('invalide', 422, 'Aucun texte à traduire.');
  return {
    text:
      DEMO_TRANSLATIONS[text] ?? `[Traduction simulée : la démo ne traduit que le texte d’exemple] ${text}`,
  };
}

// --- Passeport ---------------------------------------------------------------------
const DEPARTMENTS: T.Department[] = [
  'scenario',
  'image',
  'montage',
  'son_voix',
  'musique',
  'vfx',
  'sous_titres',
  'affiche_promo',
];
const DEPT_LABEL: Record<T.Department, string> = {
  scenario: 'Scénario',
  image: 'Image et tournage',
  montage: 'Montage',
  son_voix: 'Son et voix',
  musique: 'Musique',
  vfx: 'Effets visuels',
  sous_titres: 'Sous-titres et traduction',
  affiche_promo: 'Affiche et promotion',
};

function badgeCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) =>
    Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join('');
  return `${brand.badgePrefix}-${pick(4)}-${pick(2)}`;
}

function checkPassportLocal(p: T.Passport): T.PassportCheck {
  const missing: T.PassportCheck['missing'] = [];
  const warnings: string[] = [];
  const tools = aiTools as T.AiTool[];
  for (const d of DEPARTMENTS) {
    const decl = p.declarations.find((x) => x.department === d);
    if (!decl) {
      missing.push({ department: d, message: `${DEPT_LABEL[d]} : réponds à « As-tu utilisé une IA ? ».` });
      continue;
    }
    if (decl.used_ai) {
      if (!decl.tool_id && !decl.custom_tool)
        missing.push({ department: d, message: `${DEPT_LABEL[d]} : indique l’outil utilisé.` });
      if (!decl.what.trim())
        missing.push({ department: d, message: `${DEPT_LABEL[d]} : décris ce que l’IA a fait.` });
      if (!decl.level)
        missing.push({ department: d, message: `${DEPT_LABEL[d]} : choisis le niveau d’usage.` });
      const t = tools.find((x) => x.id === decl.tool_id);
      if (t?.status === 'non_divulgue')
        warnings.push(
          `${DEPT_LABEL[d]} : ${t.name} est « Non divulgué » (le fournisseur ne publie pas ses données d’entraînement). Ce statut est valide et sera affiché tel quel.`,
        );
      if (decl.custom_tool && !decl.tool_id)
        warnings.push(
          `${DEPT_LABEL[d]} : « ${decl.custom_tool} » n’est pas dans le catalogue ; son statut sera « Non divulgué ».`,
        );
    }
  }
  return { ok: missing.length === 0, missing, warnings };
}

// --- API simulée ---------------------------------------------------------------------
export const mockApi: Api = {
  createProject: (input) =>
    simulate('POST /projects', S.projectSchema, () => {
      const p: T.Project = {
        ...input,
        id: uid('prj'),
        scenes: [],
        locations: [],
        people: [],
        festival_shortlist: [],
      };
      getDb().projects[p.id] = p;
      persist();
      return p;
    }),

  getProject: (id) => simulate(`GET /projects/${id}`, S.projectSchema, () => requireProject(id)),

  updateProject: (id, patch) =>
    simulate(
      `PATCH /projects/${id}`,
      S.projectSchema,
      () => {
        const p = { ...requireProject(id), ...patch };
        getDb().projects[id] = p;
        persist();
        return p;
      },
      0.5,
    ),

  deleteProject: (id) =>
    simulate(`DELETE /projects/${id}`, S.okSchema, () => {
      const db = getDb();
      delete db.projects[id];
      delete db.subtitles[id];
      for (const [k, v] of Object.entries(db.passports)) if (v.project_id === id) delete db.passports[k];
      persist();
      return { ok: true };
    }),

  parseScreenplay: (input) =>
    simulate('POST /planner/parse', S.parseScreenplayResultSchema, () => mockParseScreenplay(input), 2.5),

  geocode: (q) =>
    simulate('GET /planner/geocode', z.array(S.geocodeResultSchema), () => geocodeLocal(q), 0.4),

  quickSlots: (req) => simulate('POST /planner/quick', S.quickSlotsResponseSchema, () => quickSlotsFor(req)),

  generateSchedule: ({ project_id }) =>
    simulate(
      'POST /planner/schedule',
      S.scheduleSchema,
      () => {
        const p = requireProject(project_id);
        const coords = geocodeLocal(p.city)[0] ?? { ...TUNIS };
        const weather = mockWeatherRange(
          p.shooting_window.from,
          p.shooting_window.to,
          coords.lat,
          coords.lon,
        );
        return mockSchedule(p, weather);
      },
      2,
    ),

  getWeather: ({ lat, lon, from, to }) =>
    simulate(
      'GET /planner/weather',
      z.array(S.weatherDaySchema),
      () => mockWeatherRange(from, to, lat, lon),
      0.5,
    ),

  getAiTools: () => simulate('GET /ai-tools', z.array(S.aiToolSchema), () => aiTools),

  getProjectPassport: (projectId) =>
    simulate(
      `GET /projects/${projectId}/passport`,
      S.passportSchema.nullable(),
      () => Object.values(getDb().passports).find((p) => p.project_id === projectId) ?? null,
    ),

  savePassport: (input) =>
    simulate('POST /passport', S.passportSchema, () => {
      const db = getDb();
      const existing = input.id ? db.passports[input.id] : undefined;
      const id = existing?.id ?? uid('pass');
      const p: T.Passport = {
        ...input,
        id,
        c2pa_signed: existing?.c2pa_signed ?? false,
        badge_code: existing?.badge_code ?? badgeCode(),
        verify_url: `${env.publicAppUrl}/verifier/${id}`,
        updated_at: formatISO(new Date()),
      };
      db.passports[id] = p;
      persist();
      return p;
    }),

  checkPassport: (id) =>
    simulate(`GET /passport/${id}/check`, S.passportCheckSchema, () => {
      const p = getDb().passports[id];
      if (!p) throw apiError('introuvable', 404, 'Passeport introuvable.');
      return checkPassportLocal(p);
    }),

  getPassportPdfUrl: (id) =>
    simulate(`GET /passport/${id}/pdf`, S.passportPdfSchema, () => {
      if (!getDb().passports[id]) throw apiError('introuvable', 404, 'Passeport introuvable.');
      // Mock : aperçu imprimable côté front (le vrai backend renverra un PDF).
      return { url: `${env.publicAppUrl}/verifier/${id}?imprimer=1` };
    }),

  signC2pa: ({ passport_id }) =>
    simulate(
      'POST /c2pa/sign',
      S.c2paSignResultSchema,
      () => {
        const db = getDb();
        const p = db.passports[passport_id];
        if (!p) throw apiError('introuvable', 404, 'Passeport introuvable.');
        p.c2pa_signed = true;
        persist();
        return { signed: true, manifest_id: uid('c2pa'), signed_at: formatISO(new Date()), simulated: true };
      },
      2,
    ),

  verifyPassport: (id) =>
    simulate(`GET /verify/${id}`, S.verifyResultSchema, () => {
      const p = getDb().passports[id];
      if (!p) throw apiError('introuvable', 404, 'Aucun Passeport IA ne correspond à cet identifiant.');
      const ids = new Set(p.declarations.map((d) => d.tool_id).filter(Boolean));
      return {
        passport: p,
        tools: (aiTools as T.AiTool[]).filter((t) => ids.has(t.id)),
        signature: p.c2pa_signed
          ? { signed: true, signed_at: p.updated_at, manifest_id: `c2pa-${p.id}` }
          : { signed: false },
        checked_at: formatISO(new Date()),
      };
    }),

  searchFestivals: (params) =>
    simulate('GET /festivals', z.array(S.festivalMatchSchema), () => searchFestivalsLocal(params)),

  getFestival: (id) =>
    simulate(`GET /festivals/${id}`, S.festivalSchema, () => {
      const f = loadFestivals().find((x) => x.id === id);
      if (!f) throw apiError('introuvable', 404, 'Festival introuvable.');
      return f;
    }),

  createSubtitleDraft: (input) =>
    simulate(
      `POST /subtitles/${input.project_id}/draft`,
      S.subtitleDraftSchema,
      () => {
        if (!input.audio.size) throw apiError('invalide', 422, 'Le fichier est vide.');
        // Mock : le son n'est pas analysé ; on renvoie le brouillon de démonstration, rien n'est validé.
        const demo = structuredClone(demoSubtitles) as T.SubtitleDraft;
        const d: T.SubtitleDraft = {
          ...demo,
          project_id: input.project_id,
          processing: { ...demo.processing!, created_at: formatISO(new Date()) },
          lines: checkRules(demo.lines.map((l) => ({ ...l, validated: false }))),
        };
        getDb().subtitles[input.project_id] = d;
        persist();
        return d;
      },
      5,
    ),

  getSubtitleDraft: (projectId) =>
    simulate(`GET /subtitles/${projectId}`, S.subtitleDraftSchema, () => {
      const d = getDb().subtitles[projectId];
      return d
        ? { ...d, lines: checkRules(d.lines) }
        : { project_id: projectId, source_lang: 'derja', lines: [] };
    }),

  saveSubtitles: (projectId, lines) =>
    simulate(
      `PUT /subtitles/${projectId}`,
      S.subtitleDraftSchema,
      () => {
        if (new Set(lines.map((l) => l.id)).size !== lines.length)
          throw apiError('invalide', 422, 'Deux lignes ont le même identifiant.');
        const db = getDb();
        const prev = db.subtitles[projectId];
        // Comme le serveur : source_lang et processing gardés, avertissements recalculés.
        const d: T.SubtitleDraft = {
          project_id: projectId,
          source_lang: prev?.source_lang ?? 'derja',
          lines: checkRules(lines),
          ...(prev?.processing ? { processing: prev.processing } : {}),
        };
        db.subtitles[projectId] = d;
        persist();
        return d;
      },
      0.5,
    ),

  getSynopsisFeedback: (input) =>
    simulate('POST /synopsis/feedback', S.synopsisFeedbackSchema, () => synopsisQuestions(input)),

  translateSynopsis: (input) =>
    simulate('POST /synopsis/translate', S.synopsisTranslationSchema, () => translateLocal(input), 1.5),

  getPublicFilm: (id) =>
    simulate(`GET /films/${id}/public`, S.publicFilmSchema, () => {
      const db = getDb();
      const p = db.projects[id];
      if (!p) throw apiError('introuvable', 404, 'Film introuvable.');
      const pass = Object.values(db.passports).find((x) => x.project_id === id);
      const syn = p.synopsis ?? { phrase: '', court: '', long: '' };
      const page = p.film_page ?? { stills: [] };
      return {
        id,
        title: p.title,
        director: pass?.director ?? p.people.find((x) => x.role === 'Réalisation')?.name ?? '[Réalisateur]',
        synopsis_short: syn.court || syn.phrase,
        synopsis_long: syn.long,
        stills: page.stills,
        credits: p.people
          .filter((x) => x.name.trim())
          .map((x) => ({ role: x.kind === 'acteur' ? (x.character ?? 'Rôle') : x.role, name: x.name })),
        trailer_url: page.trailer_url,
        passport_badge_code: pass?.badge_code,
        verify_url: pass?.verify_url,
      };
    }),
};
