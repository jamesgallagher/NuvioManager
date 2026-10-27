/**
 * The key helper. Runs on nuvio.tv (via a bookmarklet or a console snippet).
 * It finds Nuvio's public Supabase anon key in the page's own scripts and
 * hands it back to the manager app in a URL fragment. It reads only the anon
 * key: never cookies, storage, session tokens, credentials or form fields.
 * A key whose role is not exactly "anon" is ignored and never transmitted.
 *
 * This function must stay self-contained: no imports, no outer-scope
 * variables, no TypeScript-only runtime helpers, so `fn.toString()` yields
 * runnable code (see buildHelperSource).
 */
async function nuvioKeyHelper(managerOrigin: string): Promise<void> {
  const host = location.hostname;
  if (host !== 'nuvio.tv' && !host.endsWith('.nuvio.tv')) {
    alert('Open nuvio.tv first, then click this bookmark again.');
    return;
  }

  // Open the handle synchronously to keep the user gesture.
  const w = window.open('about:blank', '_blank');

  function showBanner(message: string): void {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.zIndex = '100000';
    el.style.background = '#1e293b';
    el.style.color = '#ffffff';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '8px';
    if (document.body) document.body.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 6000);
  }

  function deliver(token: string): void {
    const url = managerOrigin + '/#nuvio-key=' + encodeURIComponent(token);
    if (w && !w.closed) {
      w.location.href = url;
      showBanner('Nuvio key helper: key found. Opening the manager…');
    } else {
      location.href = url;
    }
  }

  function decodeMiddle(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4 !== 0) b64 += '=';
      const payload: unknown = JSON.parse(atob(b64));
      if (typeof payload !== 'object' || payload === null) return null;
      return payload as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  function isAnonToken(token: string): boolean {
    const payload = decodeMiddle(token);
    return payload !== null && payload.role === 'anon';
  }

  // Candidates: inline <script> text plus same-origin .js URLs.
  const inlineTexts: string[] = [];
  const urlSet = new Set<string>();
  for (const script of document.scripts) {
    if (script.textContent) inlineTexts.push(script.textContent);
    if (script.src) urlSet.add(script.src);
  }
  for (const entry of performance.getEntriesByType('resource')) {
    if (entry.name) urlSet.add(entry.name);
  }
  const jsUrls: string[] = [];
  for (const u of urlSet) {
    if (u.endsWith('.js')) {
      try {
        if (new URL(u).origin === location.origin) jsUrls.push(u);
      } catch {
        // not a URL; ignore
      }
    }
  }

  const tokenRe = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
  const found = new Set<string>();
  function collect(text: string): void {
    const matches = text.match(tokenRe) || [];
    for (const token of matches) {
      if (isAnonToken(token)) found.add(token);
    }
  }
  for (const text of inlineTexts) collect(text);

  // Fetch the same-origin .js files: credentials omitted, at most 80 files,
  // 8 seconds overall budget.
  const controller = new AbortController();
  const budget = setTimeout(function () {
    controller.abort();
  }, 8000);
  for (const url of jsUrls.slice(0, 80)) {
    try {
      const response = await fetch(url, { credentials: 'omit', signal: controller.signal });
      if (response.ok) collect(await response.text());
    } catch {
      // ignore
    }
  }
  clearTimeout(budget);

  if (found.size > 0) {
    deliver(Array.from(found)[0]);
    return;
  }

  // No key in the scripts: watch the page's own requests for an apikey
  // header. One-time hooks; the originals are called with the original
  // arguments unchanged, and only the apikey header is read.
  type FetchFn = (input: unknown, init?: unknown) => unknown;
  const originalFetch: FetchFn = window.fetch as unknown as FetchFn;
  type SetHeaderFn = (this: unknown, headerName: string, headerValue: string) => void;
  const originalSetHeader: SetHeaderFn =
    XMLHttpRequest.prototype.setRequestHeader as unknown as SetHeaderFn;

  function removeHooks(): void {
    window.fetch = originalFetch as unknown as typeof window.fetch;
    XMLHttpRequest.prototype.setRequestHeader =
      originalSetHeader as unknown as typeof XMLHttpRequest.prototype.setRequestHeader;
  }

  function apikeyFromInit(init: unknown): string | null {
    if (!init || typeof init !== 'object') return null;
    const headers = (init as { headers?: unknown }).headers;
    if (!headers || typeof headers !== 'object') return null;
    const headerObj = headers as Record<string, unknown>;
    if (typeof headerObj.get === 'function') {
      const value = (headerObj.get as (name: string) => unknown)('apikey');
      return typeof value === 'string' ? value : null;
    }
    if (Array.isArray(headers)) {
      for (const pair of headers) {
        if (
          Array.isArray(pair) &&
          pair.length >= 2 &&
          String(pair[0]).toLowerCase() === 'apikey' &&
          typeof pair[1] === 'string'
        ) {
          return pair[1];
        }
      }
      return null;
    }
    for (const key of Object.keys(headerObj)) {
      if (key.toLowerCase() === 'apikey' && typeof headerObj[key] === 'string') {
        return headerObj[key];
      }
    }
    return null;
  }

  function capture(token: string): void {
    clearTimeout(watchdog);
    removeHooks();
    deliver(token);
  }

  window.fetch = function (input: unknown, init?: unknown): unknown {
    try {
      const value = apikeyFromInit(init);
      if (value !== null && isAnonToken(value)) capture(value);
    } catch {
      // never break the page
    }
    return originalFetch(input, init);
  } as unknown as typeof window.fetch;

  XMLHttpRequest.prototype.setRequestHeader = function (
    this: unknown,
    headerName: string,
    headerValue: string
  ): void {
    try {
      if (String(headerName).toLowerCase() === 'apikey' && isAnonToken(headerValue)) {
        capture(headerValue);
      }
    } catch {
      // never break the page
    }
    originalSetHeader.call(this, headerName, headerValue);
  } as unknown as typeof XMLHttpRequest.prototype.setRequestHeader;

  showBanner(
    "Nuvio key helper: now reload or click around in Nuvio; I'll pick the key up from the next request."
  );
  const watchdog = setTimeout(function () {
    removeHooks();
    showBanner('Could not find the key.');
  }, 90000);
}

function normalizeManagerOrigin(managerOrigin: string): string {
  let url: URL;
  try {
    url = new URL(managerOrigin);
  } catch {
    throw new Error('Invalid manager origin');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid manager origin');
  }
  return url.origin;
}

export function buildHelperSource(managerOrigin: string): string {
  return (
    '(' +
    nuvioKeyHelper.toString() +
    ')(' +
    JSON.stringify(normalizeManagerOrigin(managerOrigin)) +
    ')'
  );
}

export function buildBookmarklet(managerOrigin: string): string {
  return 'javascript:' + encodeURIComponent(buildHelperSource(managerOrigin));
}
