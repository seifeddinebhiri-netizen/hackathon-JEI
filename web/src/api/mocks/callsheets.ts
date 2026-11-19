/**
 * Convocations SIMULÉES (VITE_USE_MOCKS=true) : mêmes règles que le serveur, en plus simple.
 * - un acteur ne reçoit que les scènes de ses personnages, un technicien tout le planning ;
 * - pas de texte de scène sauf demande ;
 * - l'envoi est toujours un essai : rien ne part.
 */
import type {
  CallsheetDraft,
  CallsheetDraftScene,
  CallsheetInput,
  CallsheetPreview,
  CallsheetScene,
  CallsheetSendInput,
  CallsheetSendResult,
  Member,
  SceneMoment,
} from '../types';

const MOMENTS: Record<SceneMoment, string> = {
  jour: 'En journée',
  nuit: 'De nuit',
  aube: 'Lever du soleil',
  heure_doree: 'Lumière du soir',
};
const EMAIL = /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[A-Za-z]{2,}$/;

const key = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

export const hourFr = (hhmm: string) => `${Number(hhmm.slice(0, 2))} h ${hhmm.slice(3, 5)}`;

export function dateFr(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const txt = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return txt.replace(/^(\p{L}+) 1 /u, '$1 1er ');
}

export function scenesFor(member: Member, scenes: CallsheetScene[]): CallsheetScene[] {
  const ordered = [...scenes].sort((a, b) =>
    `${a.date}${a.start ?? a.call_time}${a.number}`.localeCompare(
      `${b.date}${b.start ?? b.call_time}${b.number}`,
    ),
  );
  if (member.role === 'technicien') return ordered;
  const mine = new Set(member.characters.map(key).filter(Boolean));
  return ordered.filter((s) => s.characters.some((c) => mine.has(key(c))));
}

export function blockedReason(m: Member): string | null {
  if (!m.email.trim()) return "Pas d'adresse e-mail";
  if (!EMAIL.test(m.email.trim())) return 'Adresse e-mail non valide';
  if (!m.email_consent) return "N'a pas accepté de recevoir des e-mails";
  return null;
}

function scheduleText(member: Member, scenes: CallsheetDraftScene[], film: string): string {
  const lines = [`${member.role === 'acteur' ? 'Tes scènes' : 'Le planning complet'} pour « ${film} »`, ''];
  const days = [...new Set(scenes.map((s) => s.date))];
  for (const day of days) {
    const items = scenes.filter((s) => s.date === day);
    const call = items.map((s) => s.call_time).sort()[0];
    const places = [
      ...new Set(items.map((s) => (s.address ? `${s.location_name}, ${s.address}` : s.location_name))),
    ];
    const label = dateFr(day);
    lines.push(label.charAt(0).toUpperCase() + label.slice(1));
    lines.push(`Rendez-vous à ${hourFr(call)} : ${places.join(' / ')}`);
    for (const s of items) {
      const timing = s.start && s.end ? `de ${hourFr(s.start)} à ${hourFr(s.end)}` : '';
      lines.push(
        `  - Scène ${s.number}${s.title ? ` : ${s.title}` : ''} (${[s.moment_label, timing].filter(Boolean).join(', ')})`,
      );
      if (s.characters.length) lines.push(`    Personnages : ${s.characters.join(', ')}`);
      if (s.notes) lines.push(`    À savoir : ${s.notes}`);
      if (s.text) lines.push('    Texte de la scène :', ...s.text.split('\n').map((l) => `    ${l}`));
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

const icsDate = (iso: string, hhmm: string) => `${iso.replaceAll('-', '')}T${hhmm.replace(':', '')}00`;

function ics(member: Member, scenes: CallsheetDraftScene[], film: string): string {
  const esc = (v: string) =>
    v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Encadre//Convocations (essai)//FR'];
  for (const day of [...new Set(scenes.map((s) => s.date))]) {
    const items = scenes.filter((s) => s.date === day);
    const call = items.map((s) => s.call_time).sort()[0];
    const end = items
      .map((s) => s.end)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${member.id}-${day}@encadre`,
      `DTSTART;TZID=Africa/Tunis:${icsDate(day, call)}`,
      `DTEND;TZID=Africa/Tunis:${icsDate(day, end ?? call)}`,
      `SUMMARY:${esc(`Tournage « ${film} »`)}`,
      `LOCATION:${esc([...new Set(items.map((s) => s.location_name))].join(' / '))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

function draftFor(
  input: CallsheetInput,
  member: Member,
  edit?: { subject: string; message: string; include_scene_text: boolean },
): CallsheetDraft | { member_id: string; name: string; reason: string } {
  if (member.role === 'acteur' && !member.characters.some((c) => c.trim()))
    return { member_id: member.id, name: member.name, reason: 'Aucun personnage associé' };
  const mine = scenesFor(member, input.scenes);
  if (!mine.length)
    return { member_id: member.id, name: member.name, reason: 'Aucune scène planifiée pour ce membre' };
  const withText =
    edit?.include_scene_text ??
    (!!input.include_scene_text || !!input.include_scene_text_for?.includes(member.id));
  const film = input.project.title;
  const scenes: CallsheetDraftScene[] = mine.map((s) => {
    const loc = input.locations.find((l) => l.id === s.location_id);
    return {
      number: s.number,
      title: s.title,
      date: s.date,
      call_time: s.call_time,
      start: s.start ?? null,
      end: s.end ?? null,
      location_name: loc?.name || 'Lieu à confirmer',
      address: loc?.address ?? '',
      moment_label: MOMENTS[s.moment],
      characters: s.characters,
      notes: s.notes,
      text: withText ? (s.text ?? null) : null,
    };
  });
  const firstName = member.name.split(/\s+/)[0] ?? member.name;
  const message =
    edit?.message ??
    `Bonjour ${firstName},\n\nVoici ta convocation pour le tournage de « ${film} ». Tu trouveras ci-dessous ${
      member.role === 'acteur' ? 'tes scènes' : 'le planning complet'
    } : les jours, les heures de rendez-vous et les lieux. Le fichier joint ajoute les jours de tournage à ton agenda.\n\nPour toute question, réponds simplement à cet e-mail.${
      input.project.director_name ? `\n\n${input.project.director_name}` : ''
    }`;
  const schedule = scheduleText(member, scenes, film);
  return {
    member_id: member.id,
    name: member.name,
    role: member.role,
    to: member.email.trim(),
    subject: edit?.subject ?? `Ta convocation pour « ${film} » : à partir du ${dateFr(scenes[0].date)}`,
    message,
    schedule_text: schedule,
    text: `${message.trim()}\n\n${schedule}`,
    html: '', // le serveur produit le HTML ; l'écran affiche le texte
    scenes,
    ics: ics(member, scenes, film),
    ics_filename: 'convocation.ics',
    include_scene_text: withText,
    blocked_reason: blockedReason(member),
  };
}

export function mockPreviewCallsheets(input: CallsheetInput): CallsheetPreview {
  const out: CallsheetPreview = { drafts: [], not_concerned: [], email_configured: false };
  for (const m of input.members) {
    const d = draftFor(input, m);
    if ('to' in d) out.drafts.push(d);
    else out.not_concerned.push(d);
  }
  return out;
}

export function mockSendCallsheets(input: CallsheetSendInput): CallsheetSendResult {
  const results: CallsheetSendResult['results'] = input.drafts.map((edit) => {
    const m = input.members.find((x) => x.id === edit.member_id);
    if (!m)
      return {
        member_id: edit.member_id,
        name: '',
        to: '',
        status: 'erreur',
        reason: "Membre inconnu dans l'équipe",
        subject: null,
      };
    const base = { member_id: m.id, name: m.name, to: m.email.trim() };
    const d = draftFor(input, m, edit);
    if (!('to' in d)) return { ...base, status: 'ignore', reason: d.reason, subject: null };
    if (d.blocked_reason) return { ...base, status: 'ignore', reason: d.blocked_reason, subject: null };
    return { ...base, status: 'essai', reason: null, subject: d.subject };
  });
  return {
    dry_run: true,
    results,
    sent: 0, // mode essai : rien n'est parti
    skipped: results.filter((r) => r.status === 'ignore').length,
    failed: results.filter((r) => r.status === 'erreur').length,
  };
}
