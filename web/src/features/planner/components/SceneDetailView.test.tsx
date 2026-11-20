import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SceneDetail } from '@/api/types';
import { SceneDetailView } from './SceneDetailView';

const detail: SceneDetail = {
  what_happens: 'Slim et Amira se disputent dans la cuisine.',
  on_screen: 'Cuisine de nuit',
  props: ['Enveloppe', 'Frigo'],
  costumes: [],
  extras: '',
  sound: ['Porte du frigo'],
  special: [],
  watch_out: ['Lumière faible', 'Son du frigo', 'Raccord de l’enveloppe'],
  model: 'test',
};

describe('SceneDetailView', () => {
  it('affiche seulement les rubriques remplies', () => {
    render(<SceneDetailView detail={detail} />);
    expect(screen.getByText('Enveloppe, Frigo')).toBeInTheDocument();
    expect(screen.getByText('Porte du frigo')).toBeInTheDocument();
    expect(screen.queryByText('Costumes')).not.toBeInTheDocument();
    expect(screen.queryByText('Figurants')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('version courte : l’action et deux points à prévoir', () => {
    render(<SceneDetailView detail={detail} compact />);
    expect(screen.getByText(detail.what_happens)).toBeInTheDocument();
    expect(screen.queryByText('Accessoires')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('rien sans fiche', () => {
    const { container } = render(<SceneDetailView detail={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
