
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Unit tests run anywhere. Integration tests (which hit Postgres) should set up their
    // own DB via a setupFile pointed at TEST_DATABASE_URL — see references/testing.md in the
    // nodejs-architecture skill. Kept out of the global config so `npm test` runs without a DB.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
