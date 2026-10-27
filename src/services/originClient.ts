/**
 * Generate a unique origin client id for Supabase RPC calls:
 * `nuvio-support-web-` + 8 random base36 characters (crypto.getRandomValues).
 */
export function makeOriginClientId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (const byte of bytes) {
    suffix += (byte % 36).toString(36);
  }
  return `nuvio-support-web-${suffix}`;
}
