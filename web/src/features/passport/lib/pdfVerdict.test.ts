import { describe, expect, it } from 'vitest';
import type { PdfVerification } from '@/api';
import { verdictOf } from './pdfVerdict';

const base: PdfVerification = {
  state: 'valid',
  issued_by_us: true,
  signing_mode: 'production',
  badge_code: 'EN-ABCD-23',
  film_title: 'Dar Hmeti',
  tools: [],
  problems: [],
  matches_passport: true,
  reasons: [],
};
const v = (over: Partial<PdfVerification>, page = 'EN-ABCD-23') => verdictOf({ ...base, ...over }, page);

describe('verdict donné à un festival', () => {
  it('le seul verdict rassurant : intact, signé par nous, identique au Passeport actuel', () => {
    const r = v({});
    expect(r.tone).toBe('ok');
    expect(r.title).toBe('Authentique et à jour');
  });

  it('sans signature : prudence, pas d’accusation', () => {
    const r = v({ state: 'none', issued_by_us: false });
    expect(r).toMatchObject({ tone: 'warn', title: 'Aucune signature' });
  });

  it('fichier modifié : alerte, et on ne se fie pas à son contenu', () => {
    const r = v({ state: 'invalid', issued_by_us: false });
    expect(r.tone).toBe('bad');
    expect(r.details.join(' ')).toMatch(/Ne te fie pas/);
  });

  it('signé par quelqu’un d’autre : jamais « authentique », même s’il est intact', () => {
    const r = v({ issued_by_us: false, signer: 'Imposteur SA', matches_passport: undefined });
    expect(r.tone).toBe('warn');
    expect(r.title).toBe('Intact, mais pas signé par nous');
    expect(r.details[0]).toContain('Imposteur SA');
  });

  it('Passeport modifié depuis l’émission : intact mais pas à jour, avec le motif', () => {
    const r = v({
      matches_passport: false,
      reasons: ['Le Passeport a été modifié depuis l’émission de ce PDF.'],
    });
    expect(r.tone).toBe('warn');
    expect(r.title).toBe('Authentique, mais le Passeport a changé');
    expect(r.details).toContain('Le Passeport a été modifié depuis l’émission de ce PDF.');
  });

  it('comparaison impossible (code inconnu…) : le dit, sans conclure', () => {
    const r = v({
      matches_passport: undefined,
      reasons: ['Aucun Passeport ne porte ce code dans notre base.'],
    });
    expect(r.title).toBe('Authentique, comparaison impossible');
    expect(r.tone).toBe('warn');
  });

  it('PDF d’un autre Passeport que celui de la page : signalé avant tout éloge', () => {
    const r = v({ badge_code: 'EN-ZZZZ-99' }, 'EN-ABCD-23');
    expect(r.title).toBe('Ce PDF est celui d’un autre Passeport');
    expect(r.details[0]).toContain('EN-ZZZZ-99');
    expect(verdictOf({ ...base, badge_code: 'en-abcd-23' }, 'EN-ABCD-23').tone).toBe('ok'); // casse ignorée
  });

  it('signature de test : annoncée honnêtement, y compris dans le verdict positif', () => {
    const r = v({ signing_mode: 'test' });
    expect(r.tone).toBe('ok');
    expect(r.details.join(' ')).toMatch(/certificat de test/);
    expect(v({ signing_mode: 'production' }).details.join(' ')).not.toMatch(/certificat de test/);
  });
});
