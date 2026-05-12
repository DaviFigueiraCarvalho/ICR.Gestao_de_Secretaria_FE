export interface CountryOption {
  code: string;
  name: string;
}

export const DEFAULT_COUNTRY_CODE = 'BR';

const COUNTRY_CODES = [
  'BR', 'US', 'AR', 'UY', 'PY', 'BO', 'CL', 'PE', 'CO', 'EC', 'VE', 'MX',
  'CA', 'PT', 'ES', 'FR', 'DE', 'IT', 'GB', 'IE', 'NL', 'BE', 'CH', 'AT',
  'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'GR', 'TR', 'RU', 'UA',
  'IL', 'AE', 'SA', 'EG', 'MA', 'DZ', 'TN', 'NG', 'ZA', 'MZ', 'AO', 'CV',
  'ST', 'GW', 'TL', 'IN', 'CN', 'JP', 'KR', 'TH', 'VN', 'ID', 'PH', 'AU',
  'NZ',
] as const;

const displayNames = typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['pt-BR', 'en'], { type: 'region' })
  : null;

export const COUNTRY_OPTIONS: CountryOption[] = [...COUNTRY_CODES]
  .map((code) => ({
    code,
    name: displayNames?.of(code) ?? code,
  }))
  .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }));

export const countrySelectItems = COUNTRY_OPTIONS.map((country) => ({
  id: country.code,
  name: `${country.name.toUpperCase()} (${country.code})`,
  iconUrl: `https://flagcdn.com/${country.code.toLowerCase()}.svg`,
}));

export const normalizePostalCode = (countryCode: string, value: string): string => {
  if (!value) return '';
  if (countryCode === 'BR') return value.replace(/\D/g, '').slice(0, 8);
  return value.trim();
};

export const formatPostalCode = (countryCode: string, value: string): string => {
  if (countryCode !== 'BR') return value;
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const normalizePhoneNumber = (countryCode: string, value: string): string => {
  if (!value) return '';
  if (countryCode === 'BR') return value.replace(/\D/g, '').slice(0, 11);
  return value.replace(/\s+/g, ' ').trim();
};

export const formatPhoneNumber = (countryCode: string, value: string): string => {
  if (countryCode !== 'BR') return value;
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
