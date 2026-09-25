import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { signHmacSignature, verifyHmacSignature } from './verify';

const SECRET = 'test-verify-secret';
const BODY = JSON.stringify({ name: 'Asha', phone: '9876543210' });

function sign(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')}`;
}

describe('verifyHmacSignature', () => {
  it('accepts a valid sha256= prefixed signature', () => {
    expect(verifyHmacSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it('accepts a bare hex digest', () => {
    expect(
      verifyHmacSignature(BODY, sign(BODY).slice('sha256='.length), SECRET)
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(verifyHmacSignature(`${BODY} `, sign(BODY), SECRET)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    expect(verifyHmacSignature(BODY, sign(BODY), 'wrong-secret')).toBe(false);
  });

  it('rejects missing/empty inputs', () => {
    expect(verifyHmacSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyHmacSignature(BODY, '', SECRET)).toBe(false);
    expect(verifyHmacSignature(BODY, sign(BODY), '')).toBe(false);
    expect(verifyHmacSignature(BODY, 'not-hex!!', SECRET)).toBe(false);
  });

  it('signHmacSignature round-trips', () => {
    expect(
      verifyHmacSignature(BODY, signHmacSignature(BODY, SECRET), SECRET)
    ).toBe(true);
  });
});
