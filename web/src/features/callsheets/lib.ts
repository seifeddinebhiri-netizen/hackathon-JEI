/** Convocations : construction de la requête à partir du projet, et petits outils d'écran. */
import { format, parseISO } from 'date-fns';
import type { CallsheetInput, CallsheetScene, Member, Person, Project } from '@/api/types';

const EMAIL = /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim()) && value.length <= 254;
}

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Personnages détectés par le découpage, dans l'ordre d'apparition. */
export function projectCharacters(project: Pick<Project, 'scenes'>): string[] {
  const seen = new Map<string, string>();
  for (const s of project.scenes) for (const c of s.characters) if (!seen.has(norm(c))) seen.set(norm(c), c);
  return [...seen.values()];
}

/** Personnages qu'aucun acteur ne joue. */
export function charactersWithoutActor(characters: string[], members: Member[]): string[] {
  const played = new Set(members.filter((m) => m.role === 'acteur').flatMap((m) => m.characters.map(norm)));
  return characters.filter((c) => !played.has(norm(c)));
}

/** « 2026-12-01T08:30:00 » → « 08:30 » (heure locale du planning). */
function hhmm(iso: string): string | undefined {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return undefined;
  }
}

/**
 * Requête POST /callsheets/preview pour le planning du projet.
 * Le texte des scènes n'est joint que pour les membres de `withTextFor`, et seulement leurs
 * scènes : sinon il ne quitte pas le navigateur.
 */
export function buildCallsheetInput(
  project: Project,
  opts: { directorName: string; replyTo: string; withTextFor?: string[] },
): CallsheetInput {
  const members = project.members ?? [];
  const withText = new Set(opts.withTextFor ?? []);
  const textReaders = members.filter((m) => withText.has(m.id));
  const scenes: CallsheetScene[] = [];
  for (const day of project.schedule?.days ?? []) {
    for (const planned of day.scenes) {
      const scene = project.scenes.find((s) => s.id === planned.scene_id);
      if (!scene) continue;
      const needsText =
        !!scene.excerpt &&
        textReaders.some(
          (m) =>
            m.role === 'technicien' ||
            m.characters.some((c) => scene.characters.some((sc) => norm(sc) === norm(c))),
        );
      scenes.push({
        id: scene.id,
        number: scene.number,
        title: scene.title,
        date: day.date,
        call_time: day.call_time,
        start: hhmm(planned.start),
        end: hhmm(planned.end),
        location_id: scene.location_id,
        moment: scene.moment,
        characters: scene.characters,
        notes: day.backup_note ?? '',
        ...(needsText ? { text: scene.excerpt } : {}),
      });
    }
  }
  const usedLocations = new Set(scenes.map((s) => s.location_id));
  return {
    project: { title: project.title, director_name: opts.directorName, reply_to: opts.replyTo },
    scenes,
    locations: project.locations
      .filter((l) => usedLocations.has(l.id))
      .map((l) => ({ id: l.id, name: l.name, address: l.address })),
    members,
    include_scene_text: false,
    include_scene_text_for: [...withText],
  };
}

/** Lien « Ouvrir dans ma messagerie » : objet et corps pré-remplis. */
export function mailtoHref(to: string, subject: string, body: string): string {
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${encodeURIComponent(to.trim()).replace(/%40/g, '@')}?${q}`;
}

/** Télécharge le .ics d'une convocation. */
export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reprend les personnes saisies dans l'assistant (étape « Personnes ») comme membres. */
export function membersFromPeople(people: Person[], newId: () => string): Member[] {
  return people
    .filter((p) => p.name.trim())
    .map((p) => {
      const contact = p.contact?.trim() ?? '';
      const isEmail = isValidEmail(contact);
      const member: Member = {
        id: newId(),
        name: p.name.trim(),
        email: isEmail ? contact : '',
        role: p.kind === 'acteur' ? 'acteur' : 'technicien',
        characters: p.kind === 'acteur' && p.character ? [p.character] : [],
        // Le consentement se demande à la personne : jamais coché d'office
        email_consent: false,
      };
      if (contact && !isEmail) member.phone = contact;
      if (p.kind === 'equipe' && p.role.trim()) member.job = p.role.trim();
      return member;
    });
}
