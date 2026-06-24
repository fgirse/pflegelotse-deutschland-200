import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit- und Integrationstests laufen in Node. Playwright-E2E-Tests liegen
// unter e2e/ und werden separat ausgeführt (nicht von vitest).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'e2e', '.next'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
