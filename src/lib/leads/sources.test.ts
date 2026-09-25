import { describe, expect, it } from 'vitest';

import {
  isLeadProvider,
  serializeLeadSource,
  validateLeadSourceInput,
} from './sources';

describe('isLeadProvider', () => {
  it('accepts the five known providers', () => {
    for (const p of [
      'indiamart',
      'justdial',
      'google_ads',
      'meta',
      'webhook',
    ]) {
      expect(isLeadProvider(p)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isLeadProvider('facebook')).toBe(false);
    expect(isLeadProvider('')).toBe(false);
    expect(isLeadProvider(null)).toBe(false);
    expect(isLeadProvider(undefined)).toBe(false);
  });
});

describe('validateLeadSourceInput', () => {
  it('accepts a minimal valid body', () => {
    const res = validateLeadSourceInput({
      name: 'IndiaMART store',
      provider: 'indiamart',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.input.name).toBe('IndiaMART store');
      expect(res.input.provider).toBe('indiamart');
      expect(res.input.is_active).toBe(true);
      expect(res.input.verify_secret).toBeNull();
      expect(res.input.field_mapping).toEqual({});
    }
  });

  it('encrypts the verify secret instead of storing it plain', () => {
    const res = validateLeadSourceInput({
      name: 'x',
      provider: 'webhook',
      verify_secret: 's3cr3t',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.input.verify_secret).not.toBeNull();
      expect(res.input.verify_secret).not.toContain('s3cr3t');
    }
  });

  it('requires a name', () => {
    expect(validateLeadSourceInput({ provider: 'webhook' }).ok).toBe(false);
    expect(
      validateLeadSourceInput({ name: '  ', provider: 'webhook' }).ok
    ).toBe(false);
  });

  it('rejects unknown providers', () => {
    const res = validateLeadSourceInput({ name: 'x', provider: 'nope' });
    expect(res.ok).toBe(false);
  });

  it('validates field_mapping shape', () => {
    expect(
      validateLeadSourceInput({
        name: 'x',
        provider: 'webhook',
        field_mapping: { phone: 'customer_mobile' },
      }).ok
    ).toBe(true);
    expect(
      validateLeadSourceInput({
        name: 'x',
        provider: 'webhook',
        field_mapping: ['phone'],
      }).ok
    ).toBe(false);
    expect(
      validateLeadSourceInput({
        name: 'x',
        provider: 'webhook',
        field_mapping: { phone: 42 },
      }).ok
    ).toBe(false);
  });
});

describe('serializeLeadSource', () => {
  it('strips the webhook key and verify secret', () => {
    const out = serializeLeadSource({
      id: '1',
      name: 'x',
      webhook_key: 'SECRET',
      verify_secret: 'ALSO_SECRET',
    });
    expect(out).toEqual({ id: '1', name: 'x' });
    expect('webhook_key' in out).toBe(false);
    expect('verify_secret' in out).toBe(false);
  });
});
