// Utility para gerar siglas inteligentes de 3 letras para áreas
// Algoritmo (resumido):
// 1. Normaliza o nome (remove acentos, pontuação e stopwords comuns)
// 2. Gera uma lista de candidatos priorizando iniciais de palavras
//    e letras seguintes das mesmas palavras para evitar colisões
// 3. Se todos candidatos estiverem em uso, gera um fallback determinístico
//    baseado em hash simples do nome

const STOPWORDS = new Set([
  'DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'EM', 'NO', 'NA', 'PARA', 'POR', 'A', 'O', 'AS', 'OS'
]);

const STATE_ABBR: Record<string, string> = {
  'ESPIRITO SANTO': 'ES',
  'MINAS GERAIS': 'MG',
  'BAHIA': 'BA',
  'RIO DE JANEIRO': 'RJ',
  'MARANHAO': 'MA',
  'SAO PAULO': 'SP',
  'SANTA CATARINA': 'SC',
  'RIO GRANDE DO SUL': 'RS',
  'RIO GRANDE DO NORTE': 'RN',
};

// Phrases that should be treated as a single entity (keeps only first initial)
const MERGE_PHRASES = [
  'RIO DE JANEIRO',
];

const DIRECTION_WORDS = new Set(['NORTE','SUL','LESTE','OESTE','CENTRO','NORDESTE','NOROESTE','SUDESTE','SUDOESTE']);

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lettersFrom(word: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < word.length && i < 6; i++) {
    const ch = word[i];
    if (/[A-Z]/.test(ch)) out.push(ch);
  }
  return out;
}

function simpleHashTo3Letters(s: string): string {
  // djb2
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  h = Math.abs(h >>> 0);
  const out = [] as string[];
  for (let i = 0; i < 3; i++) {
    const v = (h >> (i * 8)) & 0xff;
    out.push(String.fromCharCode(65 + (v % 26)));
  }
  return out.join('');
}

/**
 * Gera uma lista de candidatos de sigla (prioritária para as mais "naturais").
 */
function generateCandidates(normalized: string): string[] {
  // merge known multi-word phrases (e.g., 'RIO DE JANEIRO' -> 'RIODEJANEIRO')
  for (const phrase of MERGE_PHRASES) {
    const rx = new RegExp('\\b' + phrase + '\\b', 'g');
    normalized = normalized.replace(rx, phrase.replace(/\s+/g, ''));
  }

  const words = normalized.split(' ').filter(w => w && !STOPWORDS.has(w));
  if (words.length === 0) return [];

  const letterPools = words.map(lettersFrom);

  const candidates = new Set<string>();

  // Caso comum: 3+ palavras: tente iniciais das primeiras 3
  if (letterPools.length >= 3) {
    const [a, b, c] = [letterPools[0], letterPools[1], letterPools[2]];
    for (let i = 0; i < Math.min(3, a.length); i++) {
      for (let j = 0; j < Math.min(3, b.length); j++) {
        for (let k = 0; k < Math.min(3, c.length); k++) {
          candidates.add((a[i] + b[j] + c[k]).slice(0, 3));
        }
      }
    }
  }

  // 2 palavras: combine letras das duas e preencha com próximas
  if (letterPools.length === 2) {
    const [a, b] = [letterPools[0], letterPools[1]];
    for (let i = 0; i < Math.min(4, a.length); i++) {
      for (let j = 0; j < Math.min(3, b.length); j++) {
        const s = (a[i] || '') + (b[j] || '');
        if (s.length >= 3) candidates.add(s.slice(0, 3));
        else {
          // complemente com próximas letras de a ou b
          // preferir consoantes ao preencher terceiro caractere
          const extraCandidates = [a[i+1], a[0], b[j+1], b[1]];
          let extra = 'X';
          for (const ec of extraCandidates) {
            if (!ec) continue;
            if (!/[AEIOU]/.test(ec)) { extra = ec; break; }
            extra = ec;
          }
          candidates.add((s + extra).slice(0,3));
        }
      }
    }
    // também tente AAA, AAB com mais letras da primeira palavra
    for (let i = 0; i < Math.min(6, a.length); i++) {
      const s = (a[i] || '') + (a[i+1] || a[0] || 'X') + (b[0] || 'X');
      candidates.add(s.slice(0,3));
    }
  }

  // 1 palavra: tente janelas de 3 letras
  if (letterPools.length === 1) {
    const a = letterPools[0];
    for (let i = 0; i < a.length; i++) {
      const s = (a[i] || '') + (a[i+1] || '') + (a[i+2] || 'X');
      candidates.add(s.slice(0,3));
    }
    // se palavra curta, complete com X
    if (a.length === 1) candidates.add((a[0] + 'XX').slice(0,3));
    if (a.length === 2) candidates.add((a[0]+a[1]+'X').slice(0,3));
  }

  // Guarantee there is at least one candidate: fallback to initials of original words
  if (candidates.size === 0) {
    const initials = normalized.split(' ').map(w => w[0] || 'X').slice(0,3).join('').padEnd(3, 'X');
    candidates.add(initials);
  }

  return Array.from(candidates);
}

/**
 * Gera uma sigla de 3 letras para uma área. Se `used` for fornecido, tenta
 * evitar colisões retornando a primeira candidata disponível.
 *
 * Exemplo: generateAreaCode('Área de Jovens', new Set(['AJX'])) -> 'AJV' etc.
 */
export function generateAreaCode(name: string, used?: Set<string>): string {
  const raw = (name || '').trim();
  const normalized = normalizeName(name || '');

  // special case: detect hyphenated forms like 'Espírito Santo - Sul'
  if (raw.includes('-')) {
    const parts = raw.split('-').map(p => p.trim());
    if (parts.length >= 2) {
      const left = normalizeName(parts[0]);
      const right = normalizeName(parts.slice(1).join(' '));
      const leftKey = left.replace(/\s+/g, ' ');
      const stateAbbr = STATE_ABBR[leftKey];
      const rightWord = right.split(' ').filter(Boolean)[0] || '';
      if (stateAbbr && rightWord && DIRECTION_WORDS.has(rightWord)) {
        const code = `${stateAbbr}-${rightWord[0]}`;
        if (!used || !used.has(code)) return code;
        // if taken, try without hyphen
        const compact = (stateAbbr + rightWord[0]).slice(0,3);
        if (!used.has(compact)) return compact;
      }
    }
  }

  const candidates = generateCandidates(normalized);

  // normalize candidate format
  const normalizedCandidates = candidates
    .map(c => c.toUpperCase().replace(/[^A-Z]/g, ''))
    .map(c => (c + 'XXX').slice(0,3));

  if (!used || used.size === 0) return normalizedCandidates[0] || simpleHashTo3Letters(normalized || name);

  for (const c of normalizedCandidates) {
    if (!used.has(c)) return c;
  }

  // Se chegou aqui, gere variações baseadas no hash + tentativas com letras
  const fallback = simpleHashTo3Letters(normalized || name);
  if (!used.has(fallback)) return fallback;

  // tente rotação das letras do fallback
  for (let i = 0; i < 26; i++) {
    const a = String.fromCharCode(65 + ((fallback.charCodeAt(0)-65 + i) % 26));
    for (let j = 0; j < 26; j++) {
      const b = String.fromCharCode(65 + ((fallback.charCodeAt(1)-65 + j) % 26));
      const c = String.fromCharCode(65 + ((fallback.charCodeAt(2)-65 + ((i+j)%26)) % 26));
      const candidate = a + b + c;
      if (!used.has(candidate)) return candidate;
    }
  }

  // por fim, se tudo falhar (muito improvável), retorne o fallback mesmo
  return fallback;
}

export { normalizeName };
