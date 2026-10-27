import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddAccountModal } from './AddAccountModal';
import { getSupabaseClient } from '../../services/supabaseClient';
import { ManagedAccount } from '../../types/nuvio';

vi.mock('../../services/supabaseClient', () => ({
  getSupabaseClient: vi.fn(),
  MissingAnonKeyError: class extends Error {
    constructor() {
      super('A Supabase anon key is required');
    }
  },
  DEFAULT_SUPABASE_ANON_KEY: '',
  DEFAULT_SUPABASE_URL: 'https://example.invalid',
  getDefaultAnonKey: vi.fn(() => ''),
}));

function makeMockClient() {
  return {
    auth: {
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
      refreshSession: vi.fn(),
    },
    rpc: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: () => 'test-uuid-1234',
    getRandomValues: (arr: Uint32Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = 1;
      return arr;
    },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AddAccountModal', () => {
  it('submit with an empty anon key shows A Supabase anon key is required and calls no auth function', async () => {
    const user = userEvent.setup();
    const onSaveAccount = vi.fn();
    render(
      <AddAccountModal isOpen onClose={vi.fn()} onSaveAccount={onSaveAccount} />
    );
    await user.type(screen.getByPlaceholderText('e.g. Living Room TV or Family Account'), 'Test Account');
    await user.type(screen.getByPlaceholderText('family@example.com'), 'test@example.invalid');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'password');
    await user.click(screen.getByText('Connect Account'));
    await screen.findByText('A Supabase anon key is required');
    expect(onSaveAccount).not.toHaveBeenCalled();
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it('password flow with a mocked client stores user id and tokens in the saved account', async () => {
    const user = userEvent.setup();
    const mockClient = makeMockClient();
    mockClient.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@example.invalid' },
        session: { access_token: 'access-token', refresh_token: 'refresh-token' },
      },
      error: null,
    });
    mockClient.rpc.mockResolvedValue({
      data: [{ id: 1, name: 'Default', is_primary: true }],
      error: null,
    });
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getSupabaseClient>);
    const onSaveAccount = vi.fn();
    render(
      <AddAccountModal isOpen onClose={vi.fn()} onSaveAccount={onSaveAccount} />
    );
    await user.type(screen.getByPlaceholderText('e.g. Living Room TV or Family Account'), 'Test Account');
    await user.type(screen.getByPlaceholderText('family@example.com'), 'test@example.invalid');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'password');
    // open the advanced section and set the anon key
    await user.click(screen.getByText('Advanced: Backend Server Configuration'));
    const textInputs = screen.getAllByRole('textbox');
    await user.type(textInputs[textInputs.length - 1], 'test-anon-key');
    await user.click(screen.getByText('Connect Account'));
    await waitFor(() => expect(onSaveAccount).toHaveBeenCalled());
    const saved = onSaveAccount.mock.calls[0][0] as ManagedAccount;
    expect(saved.userId).toBe('user-1');
    expect(saved.accessToken).toBe('access-token');
    expect(saved.refreshToken).toBe('refresh-token');
  });

  it('token flow with a bad token shows an error', async () => {
    const user = userEvent.setup();
    const mockClient = makeMockClient();
    mockClient.auth.getUser.mockResolvedValue({ data: null, error: new Error('invalid jwt') });
    vi.mocked(getSupabaseClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getSupabaseClient>);
    const onSaveAccount = vi.fn();
    render(
      <AddAccountModal isOpen onClose={vi.fn()} onSaveAccount={onSaveAccount} />
    );
    await user.type(screen.getByPlaceholderText('e.g. Living Room TV or Family Account'), 'Test Account');
    // switch to token method
    await user.click(screen.getByText('Session JWT Token'));
    await user.type(
      screen.getByPlaceholderText('Paste Bearer JWT token from browser localStorage / cookies on nuvio.tv...'),
      'bad-token'
    );
    // open the advanced section and set the anon key
    await user.click(screen.getByText('Advanced: Backend Server Configuration'));
    const textInputs = screen.getAllByRole('textbox');
    await user.type(textInputs[textInputs.length - 1], 'test-anon-key');
    await user.click(screen.getByText('Connect Account'));
    await screen.findByText(/error|invalid/i);
    expect(onSaveAccount).not.toHaveBeenCalled();
  });
});
