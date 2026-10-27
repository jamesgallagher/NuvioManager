import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogManager } from './CatalogManager';
import { EnrichedCatalogRow, ManagedAccount } from '../../types/nuvio';

function row(key: string, addonId: string, addonName: string, type: string, enabled: boolean, order: number): EnrichedCatalogRow {
  return {
    key,
    addonId,
    addonName,
    addonBaseUrl: `https://${addonId}.example.invalid/manifest.json`,
    catalogId: key,
    catalogName: `Catalog ${key}`,
    customTitle: '',
    type,
    enabled,
    order,
    isCollection: false,
    collectionId: '',
  };
}

const account: ManagedAccount = {
  id: 'a',
  name: 'Test Account',
  email: 'a@example.invalid',
  supabaseUrl: 'https://example.invalid',
  supabaseAnonKey: 'test-anon-key',
  activeProfileId: 1,
  profiles: [{ id: 1, name: 'Default', isPrimary: true }],
};

const catalogs: EnrichedCatalogRow[] = [
  row('a', 'addon-1', 'Addon One', 'movies', true, 0),
  row('b', 'addon-2', 'Addon Two', 'series', false, 1),
  row('c', 'addon-1', 'Addon One', 'series', true, 2),
];

function renderManager(overrides: Partial<React.ComponentProps<typeof CatalogManager>> = {}) {
  const props = {
    catalogs,
    activeAccount: account,
    hasUnsavedChanges: false,
    isSaving: false,
    onMove: vi.fn(),
    onToggleEnabled: vi.fn(),
    onUpdateTitle: vi.fn(),
    onEnableAll: vi.fn(),
    onDisableAll: vi.fn(),
    onResetOrder: vi.fn(),
    onSaveToRemote: vi.fn(),
    ...overrides,
  };
  return render(<CatalogManager {...props} />);
}

afterEach(() => {
  cleanup();
});

// Count visible catalog cards by looking for the index badges (numbered circles).
function countCards(): number {
  return document.querySelectorAll('.group').length;
}

describe('CatalogManager', () => {
  it('search filter narrows the list to matching rows', async () => {
    renderManager();
    expect(countCards()).toBe(3);

    const searchInput = screen.getByPlaceholderText('Search catalog or addon...');
    await userEvent.type(searchInput, 'Addon Two');
    expect(countCards()).toBe(1);
    expect(screen.getByText('Catalog b')).toBeTruthy();
  });

  it('addon filter narrows the list to one addon', async () => {
    renderManager();
    expect(countCards()).toBe(3);

    // The addon filter is the first select element.
    const selects = screen.getAllByRole('combobox');
    const addonSelect = selects[0];
    await userEvent.selectOptions(addonSelect, 'addon-1');
    // Only addon-1 rows remain (a and c).
    expect(countCards()).toBe(2);
    expect(screen.getByText('Catalog a')).toBeTruthy();
    expect(screen.getByText('Catalog c')).toBeTruthy();
    expect(screen.queryByText('Catalog b')).toBeNull();
  });

  it('type filter narrows the list to one type', async () => {
    renderManager();
    expect(countCards()).toBe(3);

    // The type filter is the second select element.
    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects[1];
    await userEvent.selectOptions(typeSelect, 'series');
    // Only series rows remain (b and c).
    expect(countCards()).toBe(2);
    expect(screen.getByText('Catalog b')).toBeTruthy();
    expect(screen.getByText('Catalog c')).toBeTruthy();
    expect(screen.queryByText('Catalog a')).toBeNull();
  });

  it('status filter (Visible/Hidden) narrows the list', async () => {
    renderManager();
    expect(countCards()).toBe(3);

    // Click the "Hidden" status filter button.
    // The status filter buttons are in the toolbar area.
    // Use the button with the text "Hidden" that is in the status filter group.
    const hiddenButtons = screen.getAllByRole('button', { name: 'Hidden' });
    // The first one is the status filter button (the others are "Hidden on TV" badges, but those are spans, not buttons).
    // Actually, the "Hidden on TV" is a span, so getAllByRole('button') should only find the status filter button.
    // But there might be multiple if there are multiple hidden cards.
    // Let's just click the first one.
    await userEvent.click(hiddenButtons[0]);
    // Only row b is hidden.
    expect(countCards()).toBe(1);
    expect(screen.getByText('Catalog b')).toBeTruthy();

    // Click "Visible" to show only visible rows.
    const visibleBtn = screen.getByRole('button', { name: 'Visible' });
    await userEvent.click(visibleBtn);
    expect(countCards()).toBe(2);
    expect(screen.getByText('Catalog a')).toBeTruthy();
    expect(screen.getByText('Catalog c')).toBeTruthy();
  });

  it('reordering while filtered passes the master index to onMove', async () => {
    const onMove = vi.fn();
    renderManager({ onMove });

    // Filter to show only addon-1 rows (a at master index 0, c at master index 2).
    const selects = screen.getAllByRole('combobox');
    const addonSelect = selects[0];
    await userEvent.selectOptions(addonSelect, 'addon-1');
    expect(countCards()).toBe(2);

    // Click "Move Up" on the second visible card (Catalog c, master index 2).
    // The move-up button calls onMove(index, index - 1) where index is the master index.
    // Catalog c is at master index 2, so onMove(2, 1).
    const moveUpButtons = screen.getAllByTitle('Move Up');
    // The first visible card (Catalog a, master index 0) has Move Up disabled (isFirst).
    // The second visible card (Catalog c, master index 2) has Move Up enabled.
    await userEvent.click(moveUpButtons[1]);
    expect(onMove).toHaveBeenCalledWith(2, 1);
  });

  it('unsaved banner shows only when hasUnsavedChanges is true', () => {
    renderManager({ hasUnsavedChanges: true });
    expect(screen.getByText('You have unsaved catalog modifications')).toBeTruthy();
  });

  it('unsaved banner does not show when hasUnsavedChanges is false', () => {
    renderManager({ hasUnsavedChanges: false });
    expect(screen.queryByText('You have unsaved catalog modifications')).toBeNull();
  });
});
