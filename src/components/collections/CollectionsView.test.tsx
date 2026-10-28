import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionsView } from './CollectionsView';
import { ManagedAccount } from '../../types/nuvio';

vi.mock('../../services/session', () => ({
  withSession: vi.fn(async (_a: unknown, fn: (c: unknown) => unknown) => fn({})),
}));
vi.mock('../../services/collectionService', () => ({
  pullRemoteCollections: vi.fn(),
}));

import { pullRemoteCollections } from '../../services/collectionService';

const account: ManagedAccount = {
  id: 'a',
  name: 'James Nuvio',
  email: 'a@example.invalid',
  supabaseUrl: 'https://example.invalid',
  supabaseAnonKey: 'test-anon-key',
  activeProfileId: 2,
  profiles: [{ id: 2, name: 'Daddo' }],
};

describe('CollectionsView', () => {
  beforeEach(() => {
    vi.mocked(pullRemoteCollections).mockReset();
  });
  afterEach(() => cleanup());

  it('lists collections and folders for the active profile', async () => {
    vi.mocked(pullRemoteCollections).mockResolvedValue([
      {
        id: 'c1',
        title: 'Streaming',
        pinToTop: true,
        folders: [
          { id: 'f1', title: 'Netflix', sourceCount: 2 },
          { id: 'f2', title: 'Disney', sourceCount: 1 },
        ],
      },
    ]);
    render(<CollectionsView activeAccount={account} />);
    expect(await screen.findByText('Streaming')).toBeTruthy();
    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText('2 sources')).toBeTruthy();
    expect(screen.getByText('1 source')).toBeTruthy();
    expect(screen.getByText('Pinned to top')).toBeTruthy();
    expect(pullRemoteCollections).toHaveBeenCalledWith(expect.anything(), 2);
  });

  it('shows an empty state', async () => {
    vi.mocked(pullRemoteCollections).mockResolvedValue([]);
    render(<CollectionsView activeAccount={account} />);
    expect(await screen.findByText(/No collections for this profile yet/)).toBeTruthy();
  });

  it('shows an error and no list', async () => {
    vi.mocked(pullRemoteCollections).mockImplementation(async () => {
      throw new Error('permission denied');
    });
    render(<CollectionsView activeAccount={account} />);
    expect((await screen.findByRole('alert')).textContent).toContain('permission denied');
  });

  it('Reload fetches again', async () => {
    vi.mocked(pullRemoteCollections).mockResolvedValue([]);
    render(<CollectionsView activeAccount={account} />);
    await screen.findByText(/No collections/);
    await userEvent.click(screen.getByRole('button', { name: /Reload collections/ }));
    await waitFor(() => expect(pullRemoteCollections).toHaveBeenCalledTimes(2));
  });

  it('says it is read only and offers no editing controls', async () => {
    vi.mocked(pullRemoteCollections).mockResolvedValue([]);
    render(<CollectionsView activeAccount={account} />);
    await screen.findByText(/No collections/);
    expect(screen.getByText(/read only/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /save|push|delete|add|rename/i })).toBeNull();
  });
});
