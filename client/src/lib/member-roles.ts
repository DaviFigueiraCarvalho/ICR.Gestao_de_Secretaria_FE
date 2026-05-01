export interface MemberRoleOption {
  value: number;
  label: string;
}

export const MEMBER_ROLE_OPTIONS: MemberRoleOption[] = [
  { value: 0, label: 'Sem função' },
  { value: 1, label: 'Pastor' },
  { value: 2, label: 'Presbitero' },
  { value: 3, label: 'Diacono' },
  { value: 4, label: 'Obreiro' },
  { value: 5, label: 'Midias' },
  { value: 6, label: 'Louvor' },
  { value: 7, label: 'Som / Projecao' },
  { value: 8, label: 'Secretaria / Integracao' },
  { value: 9, label: 'Ensino' },
  { value: 10, label: 'Evangelizacao / Social' },
  { value: 11, label: 'Familias' },
  { value: 12, label: 'Outros' },
];

export const PASTOR_ROLE = 1;
export const PRESBITERO_ROLE = 2;
export const GENDER_MALE = 1;
export const GENDER_FEMALE = 2;

const MALE_ONLY_ROLE_VALUES = new Set([PASTOR_ROLE, PRESBITERO_ROLE, 3, 4]);

export const isMaleOnlyMemberRole = (role: unknown): boolean => {
  return MALE_ONLY_ROLE_VALUES.has(Number(role));
};

export const getMemberRoleOptionsForGender = (gender?: number | string): MemberRoleOption[] => {
  if (Number(gender) === GENDER_FEMALE) {
    return MEMBER_ROLE_OPTIONS.filter((option) => option.value === 0 || !MALE_ONLY_ROLE_VALUES.has(option.value));
  }

  return MEMBER_ROLE_OPTIONS;
};

export const getMemberRoleValue = (value: unknown): number | '' => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : '';
  }
  return '';
};

export const getMemberRoleLabel = (role: unknown, roleName?: string): string => {
  if (roleName?.trim()) return roleName;

  const numericRole = getMemberRoleValue(role);
  if (numericRole === '') {
    if (typeof role === 'string' && role.trim()) return role;
    return '-';
  }

  return MEMBER_ROLE_OPTIONS.find((option) => option.value === numericRole)?.label ?? `Cargo ${numericRole}`;
};