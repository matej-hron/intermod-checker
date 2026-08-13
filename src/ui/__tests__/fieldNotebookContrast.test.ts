import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

type Rgba = [number, number, number, number];

function tokenBlock(css: string, theme: 'light' | 'dark'): string {
  const pattern =
    theme === 'light'
      ? /:root\s*\{([\s\S]*?)\n\}/
      : /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\}/;
  const match = css.match(pattern);
  if (!match) throw new Error(`Missing ${theme} token block`);
  return match[1];
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Missing --${name}`);
  return match[1].trim();
}

function colour(value: string): Rgba {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return [
      Number.parseInt(value.slice(1, 3), 16),
      Number.parseInt(value.slice(3, 5), 16),
      Number.parseInt(value.slice(5, 7), 16),
      1,
    ];
  }

  const match = value.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (!match) throw new Error(`Unsupported colour ${value}`);
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] === undefined ? 1 : Number(match[4]),
  ];
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground[3];
  return [
    Math.round(foreground[0] * alpha + background[0] * (1 - alpha)),
    Math.round(foreground[1] * alpha + background[1] * (1 - alpha)),
    Math.round(foreground[2] * alpha + background[2] * (1 - alpha)),
    1,
  ];
}

function mix(foreground: Rgba, background: Rgba, amount: number): Rgba {
  return [
    Math.round(foreground[0] * amount + background[0] * (1 - amount)),
    Math.round(foreground[1] * amount + background[1] * (1 - amount)),
    Math.round(foreground[2] * amount + background[2] * (1 - amount)),
    1,
  ];
}

function luminance([red, green, blue]: Rgba): number {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: Rgba, second: Rgba): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Field Notebook contrast tokens', () => {
  const tokens = read('styles/tokens.css');
  const base = read('styles/base.css');
  const components = read('styles/components.css');

  it('uses AA token pairs for primary buttons, links, and medium badges', () => {
    expect(base).toMatch(
      /\.btn--primary\s*\{[\s\S]*?background: var\(--action\);[\s\S]*?color: var\(--action-contrast\);/,
    );
    expect(base).toMatch(
      /\.badge--medium\s*\{[\s\S]*?background: var\(--near-bg\);[\s\S]*?color: var\(--near-foreground\);/,
    );
    expect(components).toMatch(
      /\.about__trigger\s*\{[\s\S]*?color: var\(--link\);/,
    );
    expect(components).toMatch(
      /\.about__authors a\s*\{[\s\S]*?color: var\(--link\);/,
    );

    for (const theme of ['light', 'dark'] as const) {
      const block = tokenBlock(tokens, theme);
      const paper = colour(token(block, 'paper'));
      const actionText = colour(token(block, 'action-contrast'));
      const nearBackground = composite(colour(token(block, 'near-bg')), paper);
      const pairs = [
        ['primary action', actionText, colour(token(block, 'action'))],
        ['pressed primary action', actionText, colour(token(block, 'action-pressed'))],
        ['link', colour(token(block, 'link')), paper],
        ['medium badge', colour(token(block, 'near-foreground')), nearBackground],
      ] as const;

      for (const [name, foreground, background] of pairs) {
        expect(
          contrast(foreground, background),
          `${theme} ${name} contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('uses a two-colour focus indicator visible on paper, header, and pinned card', () => {
    expect(base).toMatch(
      /:focus-visible\s*\{[\s\S]*?outline: 2px solid var\(--focus-outer\);[\s\S]*?box-shadow: 0 0 0 2px var\(--focus-inner\);/,
    );

    for (const theme of ['light', 'dark'] as const) {
      const block = tokenBlock(tokens, theme);
      const paper = colour(token(block, 'paper'));
      const forest = colour(token(block, 'forest'));
      const focusColours = [
        colour(token(block, 'focus-inner')),
        colour(token(block, 'focus-outer')),
      ];
      const surfaces = [
        ['paper', paper],
        ['forest header', forest],
        ['pinned forest top', mix(forest, paper, 0.92)],
        ['pinned forest bottom', mix(forest, paper, 0.82)],
      ] as const;

      for (const [name, surface] of surfaces) {
        const strongestRing = Math.max(
          ...focusColours.map((focusColour) => contrast(focusColour, surface)),
        );
        expect(
          strongestRing,
          `${theme} focus indicator against ${name}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
