import { describe, expect, it } from 'vitest';
import { fileSlug } from './print';

describe('fileSlug', () => {
  it('donne des noms de fichiers clairs, comme le serveur', () => {
    expect(`${fileSlug('Le dernier ferry')}_planning`).toBe('Le-dernier-ferry_planning');
    expect(`${fileSlug('Le dernier ferry')}_convocation_${fileSlug('Amira')}`).toBe(
      'Le-dernier-ferry_convocation_Amira',
    );
    expect(fileSlug('L’été à Sfax !')).toBe('L-ete-a-Sfax');
    expect(fileSlug('   ')).toBe('document');
  });
});
