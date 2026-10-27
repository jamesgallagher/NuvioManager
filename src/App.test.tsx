import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { getSupabaseClient } from './services/supabaseClient';

vi.mock('./services/supabaseClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/supabaseClient')>();
  return { ...actual, getSupabaseClient: vi.fn() };
});

// A fake anon key built in code (not a real key).
function b64url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
const FAKE_ANON_KEY = `${b64url({ alg: 'HS256' })}.${b64url({ role: 'anon' })}.fakesignaturefakesignature`;

describe('App: key handed off by the helper reaches the Add Account form', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
    window.location.hash = '';
    vi.mocked(getSupabaseClient).mockReset();
  });

  it('uses the key saved from the URL fragment after the app has already loaded', async () => {
    const signIn = vi.fn().mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    vi.mocked(getSupabaseClient).mockReturnValue({ auth: { signInWithPassword: signIn } } as never);
    window.location.hash = `#nuvio-key=${encodeURIComponent(FAKE_ANON_KEY)}`;

    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/Anon key saved/);

    await user.click(screen.getByRole('button', { name: /Add Your First Account/i }));
    await user.type(screen.getByPlaceholderText(/Living Room TV/i), 'Test');
    await user.type(screen.getByPlaceholderText('family@example.com'), 'user@example.invalid');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: /Connect Account/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(getSupabaseClient).toHaveBeenCalledWith(expect.any(String), FAKE_ANON_KEY);
    expect(screen.queryByText(/anon key is required/i)).toBeNull();
  });

  it('shows the missing-key error when no key has been saved', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Add Your First Account/i }));
    await user.type(screen.getByPlaceholderText(/Living Room TV/i), 'Test');
    await user.type(screen.getByPlaceholderText('family@example.com'), 'user@example.invalid');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'not-a-real-password');
    await user.click(screen.getByRole('button', { name: /Connect Account/i }));

    expect(await screen.findByText(/anon key is required/i)).toBeTruthy();
  });
});
