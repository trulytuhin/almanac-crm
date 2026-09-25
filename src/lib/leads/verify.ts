import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify an HMAC-SHA256 signature over the raw request body.
 *
 * Providers sign with `X-Signature: sha256=<hex>` (GitHub-style) or a
 * bare hex digest; both are accepted. Comparison is timing-safe.
 *
 * @param rawBody the exact bytes received (request.text()), not the
 *   re-serialized JSON — re-serialization changes whitespace/key order
 *   and breaks the signature.
 * @param signatureHeader value of the `X-Signature` header, or null.
 * @param secret the source's verify_secret (decrypted).
 */
export function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  const hex = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;

  let provided: Buffer;
  try {
    provided = Buffer.from(hex.trim(), 'hex');
  } catch {
    return false;
  }
  if (provided.length === 0) return false;

  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest();

  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

/** Sign a body the way a provider would — for docs/tests, not prod. */
export function signHmacSignature(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}
