import { useEffect, useState, useCallback } from 'react';
import { parseKeyHandoff } from '../services/keyHandoff';
import { validateAnonKey, maskKey } from '../services/anonKey';
import { saveServerSettings } from '../services/serverSettings';

export type KeyHandoffResult =
  | { ok: true; masked: string }
  | { ok: false; reason: 'format' | 'role' | 'expired' };

/**
 * On mount, if the URL fragment carries a key handoff (`#nuvio-key=...`),
 * validate the token, save it as the app-wide default when it is a valid
 * anon key, and always remove the fragment from the address bar.
 */
export function useKeyHandoff() {
  const [result, setResult] = useState<KeyHandoffResult | null>(null);

  useEffect(() => {
    const handoff = parseKeyHandoff(location.hash);
    if (!handoff) return;
    const validation = validateAnonKey(handoff.token);
    if (validation.ok) {
      saveServerSettings(validation.key);
      setResult({ ok: true, masked: maskKey(validation.key) });
    } else {
      setResult({ ok: false, reason: validation.reason });
    }
    history.replaceState(null, '', location.pathname + location.search);
  }, []);

  const dismiss = useCallback(() => {
    setResult(null);
  }, []);

  return { result, dismiss };
}
