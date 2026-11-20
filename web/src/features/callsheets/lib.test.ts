import { describe, expect, it } from 'vitest';
import type { Member, Project } from '@/api/types';
import { mockPreviewCallsheets, mockSendCallsheets } from '@/api/mocks/callsheets';
import {
  buildCallsheetInput,
  charactersWithoutActor,
  mailtoHref,
  membersFromPeople,
  projectCharacters,
} from './lib';

const amira: Member = {
  id: 'm1',
  name: 'Ines Trabelsi',
  email: 'ines@example.com',
  role: 'acteur',
  characters: ['Amira'],
  email_consent: true,
};
const tech: Member = {
  ...amira,
  id: 'm2',
  name: 'Youssef',
  email: 'y@example.com',
  role: 'technicien',
  characters: [],
};

const project = {
  id: 'p',
  title: 'Le dernier ferry',
  format: 'court',
  city: 'Tunis',
  shooting_window: { from: '2026-12-01', to: '2026-12-02' },
  max_hours_per_day: 10,
  people: [],
  festival_shortlist: [],
  members: [amira, tech],
  locations: [
    { id: 'l1', name: 'Port', address: 'Quai 3', forbidden_days: [], permit: 'non_necessaire' },
    { id: 'l2', name: 'Maison', address: 'Rue X', forbidden_days: [], permit: 'non_necessaire' },
  ],
  scenes: [
    {
      id: 's1',
      number: '1',
      title: 'Départ',
      setting: 'EXT',
      moment: 'aube',
      location_id: 'l1',
      characters: ['Amira', 'Slim'],
      estimated_hours: 2,
      summary: '',
      excerpt: 'Texte 1',
      source: 'manuel',
      validated: true,
    },
    {
      id: 's2',
      number: '2',
      title: 'Cuisine',
      setting: 'INT',
      moment: 'jour',
      location_id: 'l2',
      characters: ['Nour'],
      estimated_hours: 2,
      summary: '',
      excerpt: 'Texte 2',
      source: 'manuel',
      validated: true,
    },
  ],
  schedule: {
    generated_at: '2026-11-18T10:00:00',
    status: 'valide',
    unplaced: [],
    days: [
      {
        date: '2026-12-01',
        location_ids: ['l1', 'l2'],
        call_time: '06:30',
        scenes: [
          { scene_id: 's1', start: '2026-12-01T07:00:00', end: '2026-12-01T09:00:00', conflicts: [] },
          { scene_id: 's2', start: '2026-12-01T10:00:00', end: '2026-12-01T12:00:00', conflicts: [] },
        ],
      },
    ],
  },
} as Project;

describe('buildCallsheetInput', () => {
  it('turns the schedule into planned scenes without scene text by default', () => {
    const input = buildCallsheetInput(project, { directorName: 'Seif', replyTo: 'r@example.com' });
    expect(input.scenes.map((s) => [s.number, s.call_time, s.start, s.end])).toEqual([
      ['1', '06:30', '07:00', '09:00'],
      ['2', '06:30', '10:00', '12:00'],
    ]);
    expect(input.scenes.every((s) => s.text === undefined)).toBe(true);
    expect(input.locations.map((l) => l.id)).toEqual(['l1', 'l2']);
  });

  it('only sends the text of scenes played by the chosen member', () => {
    const input = buildCallsheetInput(project, { directorName: '', replyTo: '', withTextFor: ['m1'] });
    expect(input.scenes.find((s) => s.id === 's1')?.text).toBe('Texte 1');
    expect(input.scenes.find((s) => s.id === 's2')?.text).toBeUndefined();
  });
});

describe('team helpers', () => {
  it('lists characters without an actor', () => {
    expect(projectCharacters(project)).toEqual(['Amira', 'Slim', 'Nour']);
    expect(charactersWithoutActor(['Amira', 'Slim', 'Nour'], [amira])).toEqual(['Slim', 'Nour']);
  });

  it('imports people from the wizard without ticking consent', () => {
    let n = 0;
    const members = membersFromPeople(
      [
        {
          id: 'p1',
          kind: 'acteur',
          name: 'Ines',
          role: 'Acteur',
          character: 'Amira',
          contact: 'ines@example.com',
        },
        { id: 'p2', kind: 'equipe', name: 'Youssef', role: 'Image', contact: '+216 00 000 000' },
        { id: 'p3', kind: 'acteur', name: '', role: 'Acteur', character: 'Nour' },
      ],
      () => `id${++n}`,
    );
    expect(members).toEqual([
      {
        id: 'id1',
        name: 'Ines',
        email: 'ines@example.com',
        role: 'acteur',
        characters: ['Amira'],
        email_consent: false,
      },
      {
        id: 'id2',
        name: 'Youssef',
        email: '',
        role: 'technicien',
        characters: [],
        email_consent: false,
        phone: '+216 00 000 000',
        job: 'Image',
      },
    ]);
  });

  it('builds a mailto link with subject and body', () => {
    const href = mailtoHref('ines@example.com', 'Ta convocation', 'Bonjour Ines,\nÀ demain');
    expect(href).toBe(
      'mailto:ines@example.com?subject=Ta%20convocation&body=Bonjour%20Ines%2C%0A%C3%80%20demain',
    );
  });
});

describe('mock callsheets', () => {
  const input = buildCallsheetInput(project, { directorName: 'Seif', replyTo: '' });

  it('gives an actor only their scenes and a technician everything', () => {
    const res = mockPreviewCallsheets(input);
    const byId = Object.fromEntries(res.drafts.map((d) => [d.member_id, d]));
    expect(byId.m1.scenes.map((s) => s.number)).toEqual(['1']);
    expect(byId.m2.scenes.map((s) => s.number)).toEqual(['1', '2']);
    expect(byId.m1.text).toContain('Rendez-vous à 6 h 30');
    expect(byId.m1.text).toContain('Lever du soleil');
    expect(res.email_configured).toBe(false);
  });

  it('never sends in mock mode and skips people without consent', () => {
    const res = mockSendCallsheets({
      ...input,
      members: [amira, { ...tech, email_consent: false }],
      drafts: [
        { member_id: 'm1', subject: 'S', message: 'M', include_scene_text: false },
        { member_id: 'm2', subject: 'S', message: 'M', include_scene_text: false },
      ],
    });
    expect(res.dry_run).toBe(true);
    expect(res.results.map((r) => r.status)).toEqual(['essai', 'ignore']);
  });
});
