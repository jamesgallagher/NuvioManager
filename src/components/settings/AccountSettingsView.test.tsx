import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountSettingsView } from './AccountSettingsView';
import { ManagedAccount } from '../../types/nuvio';

function account(id: string, name: string): ManagedAccount {
  return {
    id,
    name,
    email: `${name.toLowerCase()}@example.invalid`,
    supabaseUrl: 'https://example.invalid',
    supabaseAnonKey: 'test-anon-key',
    activeProfileId: 1,
    profiles: [{ id: 1, name: 'Default', isPrimary: true }],
  };
}

describe('AccountSettingsView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('delete asks confirm before calling onDeleteAccount (confirm true)', async () => {
    const accounts = [account('a', 'Account A'), account('b', 'Account B')];
    const activeAccount = accounts[0];
    const onDeleteAccount = vi.fn();
    const onSelectAccount = vi.fn();
    const onEditAccount = vi.fn();
    const onOpenAddModal = vi.fn();

    // The confirm is in the view's handler path (card 5.7 item 6): the view asks
    // confirm before calling onDeleteAccount.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <AccountSettingsView
        accounts={accounts}
        activeAccount={activeAccount}
        onSelectAccount={onSelectAccount}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onOpenAddModal={onOpenAddModal}
      />
    );

    // Find the trash (delete) buttons. They have the class "hover:text-rose-400".
    const trashButtons = document.querySelectorAll('.hover\\:text-rose-400');
    expect(trashButtons).toHaveLength(2);

    // Click the trash button for Account A (the first one).
    await userEvent.click(trashButtons[0]);
    expect(confirmSpy).toHaveBeenCalledWith('Delete this account from this browser?');
    expect(onDeleteAccount).toHaveBeenCalledWith('a');

    // Click the trash button for Account B (the second one).
    await userEvent.click(trashButtons[1]);
    expect(onDeleteAccount).toHaveBeenCalledWith('b');
  });

  it('delete confirm cancelled does not call onDeleteAccount', async () => {
    const accounts = [account('a', 'Account A'), account('b', 'Account B')];
    const activeAccount = accounts[0];
    const onDeleteAccount = vi.fn();
    const onSelectAccount = vi.fn();
    const onEditAccount = vi.fn();
    const onOpenAddModal = vi.fn();

    // Confirm returns false (the user cancels).
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <AccountSettingsView
        accounts={accounts}
        activeAccount={activeAccount}
        onSelectAccount={onSelectAccount}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onOpenAddModal={onOpenAddModal}
      />
    );

    const trashButtons = document.querySelectorAll('.hover\\:text-rose-400');
    await userEvent.click(trashButtons[0]);
    expect(confirmSpy).toHaveBeenCalledWith('Delete this account from this browser?');
    expect(onDeleteAccount).not.toHaveBeenCalled();
  });
});
