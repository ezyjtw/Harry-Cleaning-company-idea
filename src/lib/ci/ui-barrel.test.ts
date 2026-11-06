import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// B6.8 (James-ruled 2026-10-07): the ui barrel and its orphaned exports are
// deleted. What stays is imported directly; Modal became Dialog (B6.2).
const UI = join(__dirname, '..', '..', 'components', 'ui');

describe('the ui barrel stays gone', () => {
  it('ui/ holds only the directly imported primitives', () => {
    expect(existsSync(join(UI, 'index.ts'))).toBe(false);
    const left = readdirSync(UI).filter((f) => !f.endsWith('.test.tsx') && !f.endsWith('.test.ts'));
    for (const f of left)
      expect([
        'Dialog.tsx',
        'dialog-a11y.ts',
        'FieldError.tsx',
        'PasswordInput.tsx',
        'PasswordRequirements.tsx',
        'SimpleMarkdown.tsx',
      ]).toContain(f);
  });
});
