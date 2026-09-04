// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Field } from './Field';

it('labels the editable value and reports changes', () => {
  const onChange = vi.fn();
  render(<Field label="Who" value="Developers" onChange={onChange} />);
  expect(screen.getByLabelText('Who')).toHaveValue('Developers');
  fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'Team leads' } });
  expect(onChange).toHaveBeenCalledWith('Team leads');
});
