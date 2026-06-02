import { describe, expect, it } from 'vitest';
import { formatPhoneNumber, normalizePhoneNumber, validatePhoneNumber } from '../client/src/lib/country';

describe('country phone helpers', () => {
  it('normalizes phone numbers to digits', () => {
    expect(normalizePhoneNumber('US', '(213) 373-4253')).toBe('2133734253');
  });

  it('formats brazilian phone numbers', () => {
    expect(formatPhoneNumber('BR', '11987654321')).toBe('(11) 98765-4321');
  });

  it('accepts valid international numbers and rejects invalid ones', () => {
    expect(validatePhoneNumber('US', '2133734253')).toBeNull();
    expect(validatePhoneNumber('US', '123')).toBe('O número informado está fora do padrão de Estados Unidos.');
  });
});