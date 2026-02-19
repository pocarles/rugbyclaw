import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Avoid running compiled test artifacts from previous builds.
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});

