import type { Minister } from '../hooks/useICRApi';

export type MinisterCoverageStatus = 'covered' | 'uncovered' | 'unknown';

export interface MinisterCoverageSummary {
  total: number;
  covered: number;
  uncovered: number;
  unknown: number;
}

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (['true', '1', 'sim', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const isSameOrAfterToday = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidate = new Date(date);
  candidate.setHours(0, 0, 0, 0);

  return candidate.getTime() >= today.getTime();
};

export const resolveMinisterCoverageStatus = (minister: Minister): MinisterCoverageStatus => {
  const explicitStatus = normalizeText(
    minister.coverageStatus ?? minister.insuranceStatus ?? minister.status,
  );

  if (explicitStatus.includes('segur') || explicitStatus.includes('insur') || explicitStatus.includes('cobert')) {
    return 'covered';
  }

  if (explicitStatus.includes('nao') || explicitStatus.includes('não') || explicitStatus.includes('uncover') || explicitStatus.includes('not')) {
    return 'uncovered';
  }

  const explicitInsured = parseBoolean(minister.insured ?? minister.isInsured ?? minister.segurado);
  if (explicitInsured === true) return 'covered';
  if (explicitInsured === false) return 'uncovered';

  const explicitEligible = parseBoolean(minister.eligible ?? minister.isEligible);
  if (explicitEligible === true) return 'covered';

  const cardValidity = parseDate(minister.cardValidity);
  if (cardValidity) {
    return isSameOrAfterToday(cardValidity) ? 'covered' : 'uncovered';
  }

  if (parseDate(minister.ministerOrdinationDate) || parseDate(minister.presbiterOrdinationDate)) {
    return 'covered';
  }

  return 'unknown';
};

export const getMinisterCoverageLabel = (minister: Minister): string => {
  switch (resolveMinisterCoverageStatus(minister)) {
    case 'covered':
      return 'Segurado / Elegível';
    case 'uncovered':
      return 'Não segurado';
    default:
      return 'Sem dados';
  }
};

export const getMinisterCoverageBadgeClass = (minister: Minister): string => {
  switch (resolveMinisterCoverageStatus(minister)) {
    case 'covered':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'uncovered':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    default:
      return 'bg-white/10 text-white/60 border-white/20';
  }
};

export const summarizeMinisterCoverage = (ministers: Minister[]): MinisterCoverageSummary => {
  return ministers.reduce<MinisterCoverageSummary>(
    (summary, minister) => {
      summary.total += 1;

      switch (resolveMinisterCoverageStatus(minister)) {
        case 'covered':
          summary.covered += 1;
          break;
        case 'uncovered':
          summary.uncovered += 1;
          break;
        default:
          summary.unknown += 1;
          break;
      }

      return summary;
    },
    { total: 0, covered: 0, uncovered: 0, unknown: 0 },
  );
};
