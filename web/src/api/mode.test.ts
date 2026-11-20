import { describe, expect, it } from 'vitest';
import { areProjectsReal } from './mode';

describe('les projets viennent-ils du vrai backend ?', () => {
  it('sans mocks : toujours oui', () => {
    expect(areProjectsReal(false, [])).toBe(true);
  });

  it('avec mocks et sans rien de réel : non, c’est la démonstration', () => {
    expect(areProjectsReal(true, [])).toBe(false);
    expect(areProjectsReal(true, ['searchFestivals', 'getFestival'])).toBe(false);
  });

  it('mode mixte : oui dès que getProject est réel', () => {
    expect(areProjectsReal(true, ['getProject'])).toBe(true);
    expect(areProjectsReal(true, ['getPassportPdfUrl', 'createProject', 'getProject'])).toBe(true);
  });

  it('un autre nom de la famille projet ne suffit pas : le projet ouvert se lit avec getProject', () => {
    expect(areProjectsReal(true, ['createProject'])).toBe(false);
  });
});
