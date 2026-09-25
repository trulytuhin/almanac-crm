import {
  normalizePhone,
  parseInternationalPhone,
} from '@/lib/whatsapp/phone-utils';

/**
 * Normalize a raw phone string from a lead provider into the
 * digits-only international form Almanac stores (matching
 * `contacts.phone_normalized`), e.g. "+91 98765 43210" → "919876543210".
 *
 * Provider payloads are messy: national format, trunk prefixes, spaces,
 * dashes. Strategy:
 *   1. If it already parses as an international number (leading `+`),
 *      use it verbatim.
 *   2. Otherwise strip to digits and, for `defaultCountry` IN, apply
 *      the Indian conventions: a bare 10-digit mobile starting 6–9
 *      (trunk 0 dropped first) gets the 91 country code. This is a
 *      deliberate trade-off vs issue #586's public-API strictness —
 *      IndiaMART / JustDial payloads are national-format Indian
 *      mobiles, so the default-country assumption is what makes them
 *      usable. Integrators with international traffic must send the
 *      `+`. Anything else is rejected, not guessed at: an 8-digit
 *      string or a bare country-coded number without `+` is ambiguous
 *      and the caller records the lead as `invalid` instead of
 *      persisting (and WhatsApp-messaging) garbage.
 *   3. Anything too short or non-numeric returns null.
 *
 * @returns digits-only international number, or null when unusable.
 */
export function normalizeLeadPhone(
  raw: string | null | undefined,
  defaultCountry: 'IN' = 'IN'
): string | null {
  if (!raw) return null;

  const international = parseInternationalPhone(raw);
  if (international) return international;

  const digits = normalizePhone(raw);
  if (!digits) return null;

  if (defaultCountry === 'IN') {
    // Drop the domestic trunk prefix: "09876543210" → "9876543210".
    const withoutTrunk =
      digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
    // Only a bare 10-digit Indian mobile is usable. Everything else
    // (too short, too long, country-coded without a `+`) is rejected
    // rather than guessed at.
    if (!/^[6-9]\d{9}$/.test(withoutTrunk)) return null;
    return `91${withoutTrunk}`;
  }

  return null;
}

/** True when `raw` normalizes to a sendable international number. */
export function isValidLeadPhone(
  raw: string | null | undefined,
  defaultCountry: 'IN' = 'IN'
): boolean {
  return normalizeLeadPhone(raw, defaultCountry) !== null;
}
