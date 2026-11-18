import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NEUTRAL } from '../imageFilter';
import { QuickAdjust } from './QuickAdjust';

function setup(props: Partial<React.ComponentProps<typeof QuickAdjust>> = {}) {
  const onOpenChange = vi.fn();
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(
    <QuickAdjust
      open={false}
      onOpenChange={onOpenChange}
      adjust={NEUTRAL}
      onChange={onChange}
      onReset={onReset}
      locked={false}
      {...props}
    />,
  );
  return { onOpenChange, onChange, onReset };
}

describe('tiroir « contraste · chaleur »', () => {
  it('fermé : seule la poignée est utilisable ; elle ouvre le tiroir', () => {
    const { onOpenChange } = setup();
    const handle = screen.getByRole('button', { name: /Contraste · Chaleur/ });
    expect(handle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(handle);
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('ouvert : deux curseurs (contraste, chaleur) qui renvoient leur valeur', () => {
    const { onChange, onReset } = setup({ open: true });
    const contrast = screen.getByRole('slider', { name: /Contraste/ });
    const warmth = screen.getByRole('slider', { name: /Chaleur/ });
    expect(contrast).toHaveValue('1');
    expect(warmth).toHaveValue('0');
    fireEvent.change(contrast, { target: { value: '1.3' } });
    expect(onChange).toHaveBeenCalledWith('contrast', 1.3);
    fireEvent.change(warmth, { target: { value: '-0.5' } });
    expect(onChange).toHaveBeenCalledWith('temperature', -0.5);
    fireEvent.click(screen.getByRole('button', { name: 'Remettre à zéro' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('prise en cours sans retouche : curseurs bloqués et expliqués', () => {
    setup({ open: true, locked: true });
    expect(screen.getByRole('slider', { name: /Contraste/ })).toBeDisabled();
    expect(screen.getByText(/ne peut pas démarrer pendant une prise/)).toBeInTheDocument();
  });
});
