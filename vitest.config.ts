import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // B5 (deviation 10): src/lib/ci/shell-nav.test.ts imports the shells'
  // nav.ts. Their tsconfig extends expo/tsconfig.base, which lives only in
  // each shell's own node_modules; the shells' files are plain TypeScript, so
  // the transform reads no tsconfig rather than failing to load that one.
  oxc: { tsconfig: false },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
