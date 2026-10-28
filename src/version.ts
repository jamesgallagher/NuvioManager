// Injected at build time by vite.config.ts (version from package.json, short
// commit from the Docker build). Guarded so tools that skip the define still work.
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_COMMIT: string = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : '';

/** For example `v1.0.1` or `v1.0.1 (a1b2c3d)` when a commit is known. */
export function versionLabel(version: string = APP_VERSION, commit: string = APP_COMMIT): string {
  return commit ? `v${version} (${commit})` : `v${version}`;
}
