/**
 * Parse a key handoff from a URL fragment. Accepts `#nuvio-key=<urlencoded
 * token>` (other `&` params are ignored); returns null for anything else.
 */
export function parseKeyHandoff(hash: string): { token: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('nuvio-key');
  if (!token) return null;
  return { token };
}
