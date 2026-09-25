import { describe, expect, it } from 'vitest';

import { isValidLeadPhone, normalizeLeadPhone } from './phone';

describe('normalizeLeadPhone', () => {
  it('passes through international format', () => {
    expect(normalizeLeadPhone('+91 98765 43210')).toBe('919876543210');
    expect(normalizeLeadPhone('+1 (415) 555-1212')).toBe('14155551212');
  });

  it('adds the Indian country code to 10-digit mobiles', () => {
    expect(normalizeLeadPhone('9876543210')).toBe('919876543210');
    expect(normalizeLeadPhone('98765-43210')).toBe('919876543210');
  });

  it('drops the domestic trunk 0 first', () => {
    expect(normalizeLeadPhone('09876543210')).toBe('919876543210');
  });

  it('assumes India for bare 10-digit mobiles, but validates the prefix', () => {
    // Deliberate trade-off vs issue #586's public-API strictness:
    // IndiaMART/JustDial payloads are national-format Indian mobiles,
    // so a bare 10-digit mobile is treated as +91 — but it must start
    // 6–9 like a real Indian mobile. A US-style 10-digit number needs
    // an explicit `+1`, and anything ambiguous is rejected.
    expect(normalizeLeadPhone('6123456789')).toBe('916123456789');
    expect(normalizeLeadPhone('4155551212')).toBeNull();
    expect(normalizeLeadPhone('919876543210')).toBeNull(); // no leading +: ambiguous
  });

  it('rejects numbers too short to be usable', () => {
    expect(normalizeLeadPhone('123')).toBeNull();
    expect(normalizeLeadPhone('98765432')).toBeNull();
    expect(normalizeLeadPhone('')).toBeNull();
    expect(normalizeLeadPhone(null)).toBeNull();
    expect(normalizeLeadPhone('not a number')).toBeNull();
  });

  it('tolerates formatting noise around an international number', () => {
    expect(normalizeLeadPhone(' +91-98765-43210 ')).toBe('919876543210');
  });
});

describe('isValidLeadPhone', () => {
  it('mirrors normalizeLeadPhone nullability', () => {
    expect(isValidLeadPhone('9876543210')).toBe(true);
    expect(isValidLeadPhone('+14155550123')).toBe(true);
    expect(isValidLeadPhone('abc')).toBe(false);
    expect(isValidLeadPhone(undefined)).toBe(false);
  });
});
