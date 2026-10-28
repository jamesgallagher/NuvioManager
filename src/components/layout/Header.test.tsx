import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';
import { ManagedAccount } from '../../types/nuvio';

const account: ManagedAccount = {
  id: 'a',
  name: 'Acc',
  email: 'a@example.invalid',
  supabaseUrl: 'https://example.invalid',
  supabaseAnonKey: 'test-anon-key',
  activeProfileId: 1,
  profiles: [
    { id: 1, name: 'Main' },
    { id: 2, name: 'Daddo' },
  ],
};

function renderHeader(onSelectProfile: (id: number) => void) {
  render(
    <Header
      accounts={[account]}
      activeAccount={account}
      onSelectAccount={() => {}}
      onOpenAddAccount={() => {}}
      onSelectProfile={onSelectProfile}
      onRefresh={() => {}}
      isRefreshing={false}
      status="idle"
    />
  );
}

describe('Header profile selector', () => {
  afterEach(() => cleanup());

  it('selecting a profile passes its integer number', async () => {
    const onSelectProfile = vi.fn();
    renderHeader(onSelectProfile);
    const profileSelect = screen
      .getAllByRole('combobox')
      .find((el) => el.querySelector('option[value="2"]')) as HTMLElement;
    await userEvent.selectOptions(profileSelect, '2');
    expect(onSelectProfile).toHaveBeenCalledWith(2);
  });
});
