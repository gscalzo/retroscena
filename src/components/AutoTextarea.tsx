import { useLayoutEffect, useRef } from 'react';
import type { ChangeEventHandler, TextareaHTMLAttributes } from 'react';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
}

function fit(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  const border = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${textarea.scrollHeight + border}px`;
}

export function AutoTextarea({ value, onChange, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const textarea = ref.current as HTMLTextAreaElement;
    const resize = () => fit(textarea);
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [value]);
  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      onChange={(event) => {
        fit(event.currentTarget);
        onChange(event);
      }}
    />
  );
}
