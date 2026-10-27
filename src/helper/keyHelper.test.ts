import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildHelperSource, buildBookmarklet } from './keyHelper';

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a fake JWT (header.payload.signature) with a dummy signature. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

const MANAGER_ORIGIN = 'http://192.168.0.148:8095';

interface FakePageOptions {
  hostname: string;
  origin: string;
  scripts: { src?: string; textContent?: string }[];
  resourceEntries?: string[];
  fetchResponses?: Record<string, string>;
  popupBlocked?: boolean;
}

type FakeFetchFn = (url: string, init?: unknown) => Promise<{ ok: boolean; text: () => Promise<string> }>;
type FakeSetHeaderFn = (name: string, value: string) => void;

interface FakePage {
  window: { open: ReturnType<typeof vi.fn>; fetch: FakeFetchFn };
  document: {
    scripts: { src?: string; textContent?: string }[];
    body: { children: unknown[]; appendChild: (el: unknown) => void; removeChild: (el: unknown) => void };
    createElement: (tag: string) => {
      tagName: string;
      textContent: string;
      style: Record<string, string>;
      parentNode: unknown;
    };
  };
  location: { hostname: string; origin: string; href: string };
  performance: { getEntriesByType: (type: string) => { name: string }[] };
  fetch: FakeFetchFn;
  XMLHttpRequest: { prototype: { setRequestHeader: FakeSetHeaderFn } };
  AbortController: typeof AbortController;
  alert: (message: string) => void;
}

function makePage(options: FakePageOptions) {
  const fetchCalls: { url: string; init: unknown }[] = [];
  const xhrCalls: { name: string; value: string }[] = [];
  const alertCalls: string[] = [];

  const originalFetch = vi.fn(async (url: string, init?: unknown) => {
    fetchCalls.push({ url, init });
    const text = (options.fetchResponses && options.fetchResponses[url]) || '';
    return { ok: true, text: async () => text };
  });
  const originalSetHeader = vi.fn((name: string, value: string) => {
    xhrCalls.push({ name, value });
  });

  const popup = options.popupBlocked ? null : { closed: false, location: { href: '' } };
  const openFn = vi.fn(() => popup);

  const body = {
    children: [] as unknown[],
    appendChild(el: unknown) {
      this.children.push(el);
      (el as { parentNode: unknown }).parentNode = this;
    },
    removeChild(el: unknown) {
      const i = this.children.indexOf(el);
      if (i >= 0) this.children.splice(i, 1);
      (el as { parentNode: unknown }).parentNode = null;
    },
  };

  const page: FakePage = {
    window: { open: openFn, fetch: originalFetch },
    document: {
      scripts: options.scripts,
      body,
      createElement: (tag: string) => ({
        tagName: tag,
        textContent: '',
        style: {},
        parentNode: null,
      }),
    },
    location: { hostname: options.hostname, origin: options.origin, href: '' },
    performance: {
      getEntriesByType: (type: string) => {
        expect(type).toBe('resource');
        return (options.resourceEntries || []).map((name) => ({ name }));
      },
    },
    fetch: originalFetch,
    XMLHttpRequest: { prototype: { setRequestHeader: originalSetHeader } },
    AbortController,
    alert: (message: string) => {
      alertCalls.push(message);
    },
  };

  return { page, body, popup, fetchCalls, xhrCalls, alertCalls, originalFetch, originalSetHeader, openFn };
}

/**
 * Harness: run the generated source with fake globals, exactly as a
 * bookmarklet would run it on a page.
 */
function runSource(source: string, page: FakePage): Promise<void> {
  const fn = new Function(
    'window',
    'document',
    'location',
    'performance',
    'fetch',
    'XMLHttpRequest',
    'AbortController',
    'alert',
    'return ' + source
  );
  return fn(
    page.window,
    page.document,
    page.location,
    page.performance,
    page.fetch,
    page.XMLHttpRequest,
    page.AbortController,
    page.alert
  ) as Promise<void>;
}

const source = buildHelperSource(MANAGER_ORIGIN);

afterEach(() => {
  vi.useRealTimers();
});

describe('keyHelper source (run against a fake page)', () => {
  it('1. self-contained: runs without ReferenceError; no __name, import or require', async () => {
    expect(source).not.toContain('__name(');
    expect(source).not.toContain('import ');
    expect(source).not.toContain('require(');
    const { page, alertCalls } = makePage({
      hostname: 'example.com',
      origin: 'https://example.com',
      scripts: [],
    });
    await expect(runSource(source, page)).resolves.toBeUndefined();
    expect(alertCalls).toEqual(['Open nuvio.tv first, then click this bookmark again.']);
  });

  it('2. leak guard: no forbidden references in the source', () => {
    for (const forbidden of [
      'document.cookie',
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'password',
      'Authorization',
      'access_token',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('3. wrong host: alert, no window, no fetch', async () => {
    const { page, alertCalls, openFn, fetchCalls } = makePage({
      hostname: 'example.com',
      origin: 'https://example.com',
      scripts: [],
    });
    await runSource(source, page);
    expect(alertCalls).toEqual(['Open nuvio.tv first, then click this bookmark again.']);
    expect(openFn).not.toHaveBeenCalled();
    expect(fetchCalls).toEqual([]);
  });

  it('4. found in a script: the anon token is delivered; the service_role token appears nowhere', async () => {
    const anon = fakeJwt({ role: 'anon' });
    const serviceRole = fakeJwt({ role: 'service_role' });
    const { page, popup, fetchCalls, xhrCalls, alertCalls } = makePage({
      hostname: 'nuvio.tv',
      origin: 'https://nuvio.tv',
      scripts: [
        { textContent: `var key = "${anon}";` },
        { textContent: `var other = "${serviceRole}";` },
      ],
    });
    await runSource(source, page);
    expect(popup!.location.href).toBe(MANAGER_ORIGIN + '/#nuvio-key=' + encodeURIComponent(anon));
    expect(popup!.location.href).not.toContain(serviceRole);
    expect(page.location.href).not.toContain(serviceRole);
    for (const msg of alertCalls) expect(msg).not.toContain(serviceRole);
    for (const call of fetchCalls) {
      expect(call.url).not.toContain(serviceRole);
      expect(JSON.stringify(call.init)).not.toContain(serviceRole);
    }
    for (const call of xhrCalls) {
      expect(call.name).not.toContain(serviceRole);
      expect(call.value).not.toContain(serviceRole);
    }
  });

  it('5. fetches use credentials omit and never more than 80 files', async () => {
    const urls: string[] = [];
    for (let i = 0; i < 100; i++) urls.push(`https://nuvio.tv/js/file${i}.js`);
    const { page, fetchCalls } = makePage({
      hostname: 'nuvio.tv',
      origin: 'https://nuvio.tv',
      scripts: [],
      resourceEntries: urls,
    });
    await runSource(source, page);
    expect(fetchCalls.length).toBe(80);
    for (const call of fetchCalls) {
      expect(call.init).toEqual(expect.objectContaining({ credentials: 'omit' }));
      expect(call.init).toHaveProperty('signal');
    }
  });

  it('6. popup blocked: location.href is set to the same URL', async () => {
    const anon = fakeJwt({ role: 'anon' });
    const { page } = makePage({
      hostname: 'nuvio.tv',
      origin: 'https://nuvio.tv',
      scripts: [{ textContent: anon }],
      popupBlocked: true,
    });
    await runSource(source, page);
    expect(page.location.href).toBe(MANAGER_ORIGIN + '/#nuvio-key=' + encodeURIComponent(anon));
  });

  it('7. no key in scripts: hooks watch apikey, deliver, and are removed', async () => {
    vi.useFakeTimers();
    const anon = fakeJwt({ role: 'anon' });
    const serviceRole = fakeJwt({ role: 'service_role' });
    const { page, popup, originalFetch, originalSetHeader } = makePage({
      hostname: 'nuvio.tv',
      origin: 'https://nuvio.tv',
      scripts: [],
    });
    await runSource(source, page);

    // A service_role apikey is ignored (no delivery, original still called).
    page.XMLHttpRequest.prototype.setRequestHeader.call({}, 'apikey', serviceRole);
    expect(popup!.location.href).toBe('');
    expect(originalSetHeader).toHaveBeenCalledWith('apikey', serviceRole);

    // An anon apikey triggers delivery; the original fetch is called with the
    // original arguments unchanged.
    await page.window.fetch('https://nuvio.tv/api/x', { headers: { apikey: anon } });
    expect(popup!.location.href).toBe(MANAGER_ORIGIN + '/#nuvio-key=' + encodeURIComponent(anon));
    expect(originalFetch).toHaveBeenCalledWith('https://nuvio.tv/api/x', { headers: { apikey: anon } });

    // The hooks are removed after delivery.
    expect(page.window.fetch).toBe(originalFetch);
    expect(page.XMLHttpRequest.prototype.setRequestHeader).toBe(originalSetHeader);
  });

  it('7b. no capture within 90 s: hooks removed and Could not find the key banner', async () => {
    vi.useFakeTimers();
    const { page, body, originalFetch } = makePage({
      hostname: 'nuvio.tv',
      origin: 'https://nuvio.tv',
      scripts: [],
    });
    await runSource(source, page);
    vi.advanceTimersByTime(90000);
    const banners = body.children.map((el) => (el as { textContent: string }).textContent);
    expect(banners).toContain('Could not find the key.');
    expect(page.window.fetch).toBe(originalFetch);
  });

  it('8. banner element is added and removed after 6 s', async () => {
    vi.useFakeTimers();
    const anon = fakeJwt({ role: 'anon' });
    const { page, body } = makePage({
      hostname: 'nuvio.tv',
      origin: 'https://nuvio.tv',
      scripts: [{ textContent: anon }],
    });
    await runSource(source, page);
    const banners = () => body.children.map((el) => (el as { textContent: string }).textContent);
    expect(banners()).toEqual(['Nuvio key helper: key found. Opening the manager…']);
    vi.advanceTimersByTime(6000);
    expect(banners()).toEqual([]);
  });
});

describe('buildHelperSource / buildBookmarklet', () => {
  it('9. invalid origins throw Invalid manager origin', () => {
    expect(() => buildHelperSource('ftp://x')).toThrow('Invalid manager origin');
    expect(() => buildHelperSource('javascript:alert(1)')).toThrow('Invalid manager origin');
    expect(() => buildHelperSource('not a url')).toThrow('Invalid manager origin');
    expect(() => buildHelperSource('')).toThrow('Invalid manager origin');
    expect(() => buildBookmarklet('ftp://x')).toThrow('Invalid manager origin');
  });

  it('9. an origin with a path is reduced to its origin', () => {
    const s = buildHelperSource('https://example.com/some/path?q=1');
    expect(s).toContain('"https://example.com"');
  });

  it('9. buildBookmarklet starts with javascript: and decodes back to the source', () => {
    const bookmarklet = buildBookmarklet(MANAGER_ORIGIN);
    expect(bookmarklet.startsWith('javascript:')).toBe(true);
    expect(decodeURIComponent(bookmarklet.slice('javascript:'.length))).toBe(
      buildHelperSource(MANAGER_ORIGIN)
    );
  });
});
