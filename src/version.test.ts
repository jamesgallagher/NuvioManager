import { describe, it, expect } from 'vitest';
import pkg from '../package.json';
import { APP_VERSION, versionLabel } from './version';

describe('version', () => {
  it('the build injects the package.json version', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('formats the label with and without a commit', () => {
    expect(versionLabel('1.2.3', '')).toBe('v1.2.3');
    expect(versionLabel('1.2.3', 'a1b2c3d')).toBe('v1.2.3 (a1b2c3d)');
  });
});
