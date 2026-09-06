// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Field } from './Field';

afterEach(() => vi.restoreAllMocks());

it('labels the editable value and reports changes', () => {
  const scrollHeight = vi
    .spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get')
    .mockReturnValue(96);
  vi.spyOn(HTMLTextAreaElement.prototype, 'offsetHeight', 'get').mockReturnValue(98);
  vi.spyOn(HTMLTextAreaElement.prototype, 'clientHeight', 'get').mockReturnValue(96);
  const onChange = vi.fn();
  render(<Field label="Who" value="Developers" onChange={onChange} />);
  const field = screen.getByLabelText('Who');
  expect(field).toHaveValue('Developers');
  expect(field).toHaveStyle({ height: '98px' });
  scrollHeight.mockReturnValue(144);
  fireEvent.change(field, { target: { value: 'Team leads' } });
  expect(onChange).toHaveBeenCalledWith('Team leads');
  expect(field).toHaveStyle({ height: '146px' });
  scrollHeight.mockReturnValue(160);
  fireEvent(window, new Event('resize'));
  expect(field).toHaveStyle({ height: '162px' });
});
