import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GetKeyView } from './GetKeyView';
import { buildBookmarklet, buildHelperSource } from '../../helper/keyHelper';
import { copyText } from '../../services/clipboard';

vi.mock('../../services/clipboard', () => ({
  copyText: vi.fn(),
}));

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Build a fake JWT (header.payload.signature) with a dummy signature. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

const anonKey = fakeJwt({ role: 'anon' });
const serviceRoleKey = fakeJwt({ role: 'service_role' });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(copyText).mockResolvedValue(true);
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderView() {
  return render(<GetKeyView isOpen onClose={vi.fn()} />);
}

describe('GetKeyView', () => {
  it('shows No key saved when nothing is saved', () => {
    renderView();
    expect(screen.getByText('No key saved')).not.toBeNull();
  });

  it('shows the masked saved key when a key is saved', () => {
    localStorage.setItem(
      'nuvio_server_settings_v1',
      JSON.stringify({ supabaseAnonKey: anonKey, savedAt: new Date().toISOString() })
    );
    renderView();
    const masked = anonKey.slice(0, 8) + '…' + anonKey.slice(-4);
    expect(screen.getByText(`Key saved: ${masked}`)).not.toBeNull();
  });

  it('Remove asks to confirm and clears the saved key', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'nuvio_server_settings_v1',
      JSON.stringify({ supabaseAnonKey: anonKey, savedAt: new Date().toISOString() })
    );
    renderView();
    expect(vi.mocked(window.confirm)).not.toHaveBeenCalled();
    await user.click(screen.getByText('Remove'));
    expect(vi.mocked(window.confirm)).toHaveBeenCalled();
    expect(localStorage.getItem('nuvio_server_settings_v1')).toBeNull();
    expect(screen.getByText('No key saved')).not.toBeNull();
  });

  it('the helper link href starts with javascript: and contains the page origin', () => {
    renderView();
    const link = screen.getByText('Nuvio key helper');
    expect(link.getAttribute('href')).toBe(buildBookmarklet(location.origin));
    expect(link.getAttribute('href')).toMatch(/^javascript:/);
  });

  it('clicking the helper link does nothing (preventDefault)', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByText('Nuvio key helper'));
    expect(window.location.hash).toBe('');
  });

  it('Copy snippet shows Copied on success', async () => {
    const user = userEvent.setup();
    vi.mocked(copyText).mockResolvedValue(true);
    renderView();
    await user.click(screen.getByText('Copy snippet'));
    expect(screen.getByText('Copied')).not.toBeNull();
  });

  it('Copy snippet shows the fallback text on failure', async () => {
    const user = userEvent.setup();
    vi.mocked(copyText).mockResolvedValue(false);
    renderView();
    await user.click(screen.getByText('Copy snippet'));
    expect(screen.getByText('Could not copy; select the text below')).not.toBeNull();
  });

  it('the textarea contains the helper source', () => {
    renderView();
    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).value).toBe(buildHelperSource(location.origin));
  });

  it('manual paste: a valid anon key saves and shows the masked key', async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(screen.getByPlaceholderText('Paste the anon key'), anonKey);
    await user.click(screen.getByText('Save key'));
    const masked = anonKey.slice(0, 8) + '…' + anonKey.slice(-4);
    expect(screen.getByText(`Key saved: ${masked}`)).not.toBeNull();
    const settings = JSON.parse(localStorage.getItem('nuvio_server_settings_v1')!);
    expect(settings.supabaseAnonKey).toBe(anonKey);
  });

  it('manual paste: a service_role key shows a plain-English refusal and saves nothing', async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(screen.getByPlaceholderText('Paste the anon key'), serviceRoleKey);
    await user.click(screen.getByText('Save key'));
    expect(screen.getByText('it is not a public (anon) key')).not.toBeNull();
    expect(localStorage.getItem('nuvio_server_settings_v1')).toBeNull();
  });

  it('manual paste: an empty input shows a message', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByText('Save key'));
    expect(screen.getByText('it does not look like a valid key')).not.toBeNull();
  });
});
