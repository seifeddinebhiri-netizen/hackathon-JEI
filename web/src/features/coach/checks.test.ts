import { describe, expect, it } from 'vitest';
import { demoStep } from './demo';
import {
  ALL_IMAGES,
  CHECKS,
  flipReading,
  allOkReadings,
  instructionFor,
  pickInstruction,
  type CheckId,
  type Readings,
} from './checks';

const allOk = (): Readings => allOkReadings();

// Fichiers réellement présents dans public/coach/ (clés du type « /public/coach/ok.svg »).
const files = Object.keys(import.meta.glob('/public/coach/*.svg'));

describe('maquettes', () => {
  it('chaque maquette référencée existe dans public/coach/', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const path of ALL_IMAGES) {
      expect(files, path).toContain(`/public${path}`);
    }
  });
});

describe('consignes', () => {
  it('l’exemple : un angle trop bas donne « Élève de 5° »', () => {
    const r = allOk();
    r.angle = { ok: false, variant: 'up', amount: 5 };
    expect(pickInstruction(r, new Set())?.title).toBe('Élève de 5°');
  });

  it('le nombre apparaît dans le texte de chaque consigne chiffrée', () => {
    for (const c of CHECKS) {
      for (const [key, v] of Object.entries(c.variants)) {
        if (!v.unit) continue;
        expect(instructionFor(c.id, key, 7).title, `${c.id}:${key}`).toContain('7');
      }
    }
  });

  it('tout vert : aucune consigne', () => {
    expect(pickInstruction(allOk(), new Set())).toBeNull();
  });

  it('la stabilité passe avant l’horizon, qui passe avant la lumière', () => {
    const r = allOk();
    r.light = { ok: false, variant: 'dark', amount: 10 };
    r.horizon = { ok: false, variant: 'left', amount: 4 };
    expect(pickInstruction(r, new Set())?.check.id).toBe('horizon');
    r.steady = { ok: false, variant: 'shaky', amount: 0 };
    expect(pickInstruction(r, new Set())?.check.id).toBe('steady');
  });

  it('une consigne ignorée laisse place à la suivante', () => {
    const r = allOk();
    r.horizon = { ok: false, variant: 'left', amount: 4 };
    r.light = { ok: false, variant: 'dark', amount: 10 };
    const ignored = new Set<CheckId>(['horizon']);
    expect(pickInstruction(r, ignored)?.check.id).toBe('light');
    ignored.add('light');
    expect(pickInstruction(r, ignored)).toBeNull();
  });

  it('flipReading : vert vers rouge (variante et valeur dans la plage), puis retour au vert', () => {
    const red = flipReading('horizon', { ok: true }, () => 0.5);
    expect(red.ok).toBe(false);
    if (!red.ok) {
      expect(['left', 'right']).toContain(red.variant);
      expect(red.amount).toBeGreaterThanOrEqual(2);
      expect(red.amount).toBeLessThanOrEqual(15);
    }
    expect(flipReading('horizon', red)).toEqual({ ok: true });
  });
});

describe('démo automatique', () => {
  it('chaque étape allume un seul voyant, et toutes les étapes font le tour des contrôles', () => {
    const seen = new Set<string>();
    for (let i = 0; i < CHECKS.length; i++) {
      const failing = Object.entries(demoStep(i)).filter(([, r]) => !r.ok);
      expect(failing).toHaveLength(1);
      seen.add(failing[0][0]);
    }
    expect(seen.size).toBe(CHECKS.length);
  });

  it('les valeurs diffèrent d’un passage à l’autre', () => {
    const titles = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const r = demoStep(1); // « angle » à chaque fois
      titles.add(pickInstruction(r, new Set())!.title);
    }
    expect(titles.size).toBeGreaterThan(1);
  });
});
