/**
 * Utilidades para manipulação de datas
 */

/**
 * Converte uma string de data em diferentes formatos para o formato ISO (YYYY-MM-DD)
 * Aceita formatos: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD, YYYY/MM/DD
 */
export function parseDateString(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Tenta o formato ISO primeiro (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      return trimmed;
    }
  }

  // Tenta formatos com separadores /, -, ou .
  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const patterns = [
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/, // DD/MM/YYYY
    /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/, // YYYY/MM/DD
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      let day: number, month: number, year: number;

      if (match[3].length === 4) {
        // DD/MM/YYYY
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      } else {
        // YYYY/MM/DD
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      }

      // Valida o mês
      if (month < 1 || month > 12) return null;

      // Valida o dia
      if (day < 1 || day > 31) return null;

      // Cria a data
      const date = new Date(year, month - 1, day);

      // Verifica se a data é válida (javascript ajusta datas inválidas)
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }

      // Retorna no formato YYYY-MM-DD
      const yyyy = year.toString().padStart(4, '0');
      const mm = month.toString().padStart(2, '0');
      const dd = day.toString().padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return null;
}

/**
 * Manipulador para evento de cola em campos de data
 * Detecta quando o usuário cola uma data e converte automaticamente
 */
export function handleDatePaste(e: React.ClipboardEvent<HTMLInputElement>): void {
  e.preventDefault();

  const pastedText = e.clipboardData.getData('text');
  const parsedDate = parseDateString(pastedText);

  if (parsedDate) {
    // Preenche o campo com a data parseada
    const input = e.currentTarget;
    input.value = parsedDate;

    // Dispara evento de mudança para React capturar
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);
  }
}
