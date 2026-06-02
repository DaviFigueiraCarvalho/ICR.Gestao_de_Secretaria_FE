import * as React from 'react';
import { Button } from '@/components/ui/button';
import { parseDateString } from '@/lib/date-utils';
import { Clipboard } from 'lucide-react';

interface DateInputWithPasteProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  showPasteButton?: boolean;
  onDateParsed?: (date: string) => void;
}

/**
 * Input de data com botão para colar datas da clipboard
 * Aceita múltiplos formatos: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD
 */
export const DateInputWithPaste = React.forwardRef<
  HTMLInputElement,
  DateInputWithPasteProps
>(
  (
    {
      label,
      error,
      showPasteButton = true,
      onDateParsed,
      className,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handlePaste = async () => {
      try {
        const text = await navigator.clipboard.readText();
        const parsedDate = parseDateString(text);

        if (parsedDate && inputRef.current) {
          inputRef.current.value = parsedDate;
          const event = new Event('change', { bubbles: true });
          inputRef.current.dispatchEvent(event);
          onDateParsed?.(parsedDate);
        }
      } catch (err) {
        console.error('Erro ao colar da clipboard:', err);
      }
    };

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-white/70 text-sm font-['Nunito'] block">
            {label}
          </label>
        )}
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="date"
            className={`flex-1 bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] ${
              error ? 'border-red-500' : ''
            } ${className || ''}`}
            {...props}
          />
          {showPasteButton && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={handlePaste}
              title="Colar data da clipboard"
              className="shrink-0"
            >
              <Clipboard className="size-4" />
            </Button>
          )}
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

DateInputWithPaste.displayName = 'DateInputWithPaste';
