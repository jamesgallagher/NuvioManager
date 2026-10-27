/**
 * Validation for Nuvio's Supabase anon key (a public client key). A valid key
 * is a well-formed JWT whose payload says `role: "anon"`.
 */

export type AnonKeyValidation =
  | { ok: true; key: string }
  | { ok: false; reason: 'format' | 'role' | 'expired' };

const MAX_KEY_LENGTH = 4096;

/**
 * Thrown when a key fails `validateAnonKey`. `reason` is the validation reason.
 */
export class InvalidAnonKeyError extends Error {
  readonly reason: 'format' | 'role' | 'expired';

  constructor(reason: 'format' | 'role' | 'expired') {
    super(`Invalid anon key: ${reason}`);
    this.name = 'InvalidAnonKeyError';
    this.reason = reason;
  }
}

function base64urlDecode(input: string): string | null {
  try {
    let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    return atob(b64);
  } catch {
    return null;
  }
}

/**
 * Decode the payload of a JWT. Returns null (never throws) when the token is
 * not three base64url parts or the payload is not a JSON object.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const decoded = base64urlDecode(parts[1]);
  if (decoded === null) return null;
  try {
    const parsed = JSON.parse(decoded);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Validate a Supabase anon key. The key must be a well-formed JWT whose
 * payload `role` is exactly `anon`, and whose `exp` (if present) is not in
 * the past. Surrounding whitespace is trimmed.
 */
export function validateAnonKey(token: string): AnonKeyValidation {
  const key = token.trim();
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
    return { ok: false, reason: 'format' };
  }
  const payload = decodeJwtPayload(key);
  if (!payload) return { ok: false, reason: 'format' };
  if (payload.role !== 'anon') return { ok: false, reason: 'role' };
  const exp = payload.exp;
  if (typeof exp === 'number' && exp * 1000 < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, key };
}

/**
 * Mask a key for display: first 8 characters + … + last 4. Never the whole key.
 */
export function maskKey(key: string): string {
  const k = key.trim();
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}

/**
 * Plain-English description of a validation failure reason.
 */
export function reasonToPlainEnglish(reason: 'format' | 'role' | 'expired'): string {
  switch (reason) {
    case 'format':
      return 'it does not look like a valid key';
    case 'role':
      return 'it is not a public (anon) key';
    case 'expired':
      return 'it has expired';
  }
}
