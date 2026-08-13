import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

describe('Task 6 fixed prompt layout', () => {
  it('keeps the mobile undo and update prompts above the fixed action rails', () => {
    const source = read('styles/components.css');

    expect(source).toContain('.update-prompt {');
    expect(source).toContain('inset: auto var(--space-4)');
    expect(source).toContain('calc(var(--mobile-fixed-bottom) + env(safe-area-inset-bottom))');
    expect(source).toContain('z-index: 30;');

    expect(source).toContain('.undo-bar {');
    expect(source).toContain('left: var(--space-3);');
    expect(source).toContain('right: var(--space-3);');
    expect(source).toContain('bottom: calc(var(--mobile-fixed-bottom) + env(safe-area-inset-bottom));');
    expect(source).toContain('z-index: 20;');
  });

  it('places undo bottom-left and update bottom-right on desktop with capped widths', () => {
    const source = read('styles/components.css');

    expect(source).toContain('@media (min-width: 48rem) {');
    expect(source).toContain('right: var(--space-4);');
    expect(source).toContain('left: auto;');
    expect(source).toContain('bottom: var(--space-4);');
    expect(source).toContain('max-width: min(24rem, calc(50vw - var(--space-5)));');
    expect(source).toContain('left: var(--space-4);');
    expect(source).toContain('right: auto;');
  });
});
