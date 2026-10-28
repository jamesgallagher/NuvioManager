import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The footer shows this version, so bump package.json with every change.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const commit = (process.env.VITE_APP_COMMIT || '').slice(0, 7);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
  server: {
    port: 5173,
    host: true
  },
  test: {
    environment: 'jsdom',
    globals: false
  }
});
