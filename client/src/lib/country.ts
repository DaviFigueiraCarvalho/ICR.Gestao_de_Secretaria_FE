import { AsYouType, isValidPhoneNumber, type CountryCode } from 'libphonenumber-js';

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
  const digits = value.replace(/\D/g, '');
  if (countryCode === 'BR') return digits.slice(0, 11);
  return digits.slice(0, 15);
};

export const formatPhoneNumber = (countryCode: string, value: string): string => {
  const normalized = normalizePhoneNumber(countryCode, value);
  if (!normalized) return '';
  return new AsYouType(countryCode as CountryCode).input(normalized);
};

const COUNTRY_NAME_BY_CODE = new Map(COUNTRY_OPTIONS.map((country) => [country.code, country.name]));

export const getCountryName = (countryCode: string): string => {
  return COUNTRY_NAME_BY_CODE.get(countryCode) || countryCode;
};

const BRAZIL_PHONE_PATTERN = /^\d{2}9\d{8}$/;

export const validatePhoneNumber = (countryCode: string, value: string): string | null => {
  const normalized = normalizePhoneNumber(countryCode, value);
  if (!normalized) return null;

  if (countryCode === 'BR') {
    if (!BRAZIL_PHONE_PATTERN.test(normalized)) {
      return 'O número informado deve estar no padrão (00)90000-0000.';
    }

    return null;
  }

  if (!isValidPhoneNumber(normalized, countryCode as CountryCode)) {
    return `O número informado está fora do padrão de ${getCountryName(countryCode)}.`;
  }

  return null;
};
