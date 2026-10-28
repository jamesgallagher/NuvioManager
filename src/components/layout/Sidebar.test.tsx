import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { versionLabel } from '../../version';

describe('Sidebar footer', () => {
  afterEach(() => cleanup());

  it('shows the app version', () => {
    render(<Sidebar activeTab="catalogs" onTabChange={() => {}} catalogsCount={0} addonsCount={0} />);
    expect(screen.getByText(`${versionLabel()} • Remote Hub`)).toBeTruthy();
    expect(screen.queryByText(/^v1\.0 /)).toBeNull();
  });
});
