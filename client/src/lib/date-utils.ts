/**
 * Utilidades para manipulação de datas
 */

/**
 * Converte datas para o formato ISO (YYYY-MM-DD)
 *
 * Aceita:
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - DD.MM.YYYY
 * - YYYY-MM-DD
 * - YYYY/MM/DD
 * - YYYY-MM-DDTHH:mm:ssZ
 * - YYYY-MM-DDTHH:mm:ss-03:00
 *
 * Qualquer informação de hora ou fuso horário é ignorada.
 */
export function parseDateString(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Remove qualquer parte de hora/fuso
  const dateOnly = trimmed.split('T')[0];

  // DD/MM/YYYY | DD-MM-YYYY | DD.MM.YYYY
  const brazilianMatch = dateOnly.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/
  );

  if (brazilianMatch) {
    const day = Number(brazilianMatch[1]);
    const month = Number(brazilianMatch[2]);
    const year = Number(brazilianMatch[3]);

    if (
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12
    ) {
      return null;
    }

    return `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  // YYYY-MM-DD | YYYY/MM/DD | YYYY.MM.DD
  const isoMatch = dateOnly.match(
    /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/
  );

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    if (
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12
    ) {
      return null;
    }

    return `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  return null;
}

/**
 * Formata qualquer data para DD/MM/YYYY ignorando hora e fuso.
 *
 * Exemplos:
 * 1978-07-04T00:00:00Z -> 04/07/1978
 * 1978-07-04 -> 04/07/1978
 * 04/07/1978 -> 04/07/1978
 */
export function formatDateString(input?: string | null): string {
  if (!input) {
    return '-';
  }

  const dateOnly = input.split('T')[0];

  // ISO -> BR
  const isoMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  // Já está em BR
  const brMatch = dateOnly.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brMatch) {
    return dateOnly;
  }

  return '-';
}

/**
 * Extrai apenas a parte da data (YYYY-MM-DD) de um valor ISO UTC,
 * ignorando completamente timezone, hora, minutos, segundos e offset.
 *
 * Use esta função para tratar campos que representam apenas datas
 * (como birthdays, datas de casamento, etc) ao invés de new Date().
 *
 * @param value - Valor ISO UTC ou null/undefined
 * @returns Apenas a parte YYYY-MM-DD ou string vazia
 */
export function parseDateOnly(value?: string | null): string {
  if (!value) return '';
  return value.split('T')[0];
}

/**
 * Formata uma data apenas (date-only) para exibição no formato DD/MM/YYYY.
 * Não aplica conversão de timezone.
 *
 * @param value - Valor ISO UTC ou null/undefined
 * @returns Data formatada em DD/MM/YYYY ou '-' se vazio
 */
export function formatDateOnly(value?: string | null): string {
  if (!value) return '-';
  
  const datePart = value.split('T')[0];
  const [year, month, day] = datePart.split('-');
  
  return `${day}/${month}/${year}`;
}

/**
 * Manipulador para evento de cola em campos de data
 */
export function handleDatePaste(
  e: React.ClipboardEvent<HTMLInputElement>
): void {
  e.preventDefault();

  const pastedText = e.clipboardData.getData('text');
  const parsedDate = parseDateString(pastedText);

  if (parsedDate) {
    const input = e.currentTarget;

    input.value = parsedDate;

    const event = new Event('change', {
      bubbles: true,
    });

    input.dispatchEvent(event);
  }
}