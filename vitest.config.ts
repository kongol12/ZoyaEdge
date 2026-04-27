import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
      '@features': path.resolve(__dirname, './apps/web/src/features'),
      '@shared': path.resolve(__dirname, './apps/web/src/shared'),
      '@shared-types': path.resolve(__dirname, './packages/shared-types/src'),
      '@shared-utils': path.resolve(__dirname, './packages/shared-utils/src')
    },
  },
});
