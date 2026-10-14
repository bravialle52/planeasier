import { defineConfig } from 'vitest/config'

/** Unit and scenario tests for editor math. They run in Node, without a browser. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
