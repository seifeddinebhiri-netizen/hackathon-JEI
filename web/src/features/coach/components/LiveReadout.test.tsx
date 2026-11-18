import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NO_MEASUREMENTS } from '../measure/compare';
import { warmthWord } from '../measure/warmth';
import { LiveReadout } from './LiveReadout';

describe('relevé de l’image', () => {
  it('mots de chaleur', () => {
    expect(warmthWord(0.4)).toBe('chaude');
    expect(warmthWord(-0.4)).toBe('froide');
    expect(warmthWord(0.05)).toBe('neutre');
  });

  it('affiche les trois valeurs, avec la virgule française', () => {
    render(<LiveReadout m={{ ...NO_MEASUREMENTS, luma: 0.48, contrast: 0.31, warmth: 0.2 }} />);
    expect(screen.getByLabelText('Mesures de l’image')).toHaveTextContent(
      'Lum. 0,48 · Contraste 0,31 · Image chaude (+0,20)',
    );
  });
});
