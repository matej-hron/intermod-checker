import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

describe('Task 6 fixed prompt layout', () => {
  it('stacks the mobile update prompt above a reachable Undo bar and the fixed rails', () => {
    const tokens = read('styles/tokens.css');
    const source = read('styles/components.css');

    expect(tokens).toContain(
      '--mobile-undo-bar-height: calc(var(--tap) + (var(--space-2) * 2));',
    );
    expect(tokens).toContain('--mobile-prompt-bottom:');
    expect(tokens).toContain('--mobile-update-bottom:');

    expect(source).toContain('.update-prompt {');
    expect(source).toContain('bottom: var(--mobile-update-bottom);');
    expect(source).toContain('z-index: 30;');

    expect(source).toContain('.undo-bar {');
    expect(source).toContain('left: var(--space-3);');
    expect(source).toContain('right: var(--space-3);');
    expect(source).toContain('min-height: var(--mobile-undo-bar-height);');
    expect(source).toContain('bottom: var(--mobile-prompt-bottom);');
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
