/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

describe('Task 4 results redesign source', () => {
  it('turns the results summary into a lead verdict card with ledger totals', () => {
    const source = read('ui/ResultsSummary.tsx');

    expect(source).toContain('const clear = external.length === 0;');
    expect(source).toContain('result-lead');
    expect(source).toContain('result-lead--clear');
    expect(source).toContain('result-lead--conflict');
    expect(source).toContain('Analysis result');
    expect(source).toContain('Plan is clear');
    expect(source).toContain('carriers need attention');
    expect(source).toContain('summary-grid__count');
  });

  it('shows suggestions as before and after lines with typed icons', () => {
    const source = read('ui/SuggestionPanel.tsx');

    expect(source).toContain("import { Icon } from './Icon';");
    expect(source).toContain('suggestion__from');
    expect(source).toContain('suggestion__arrow');
    expect(source).toContain('suggestion__to');
    expect(source).toContain('<Icon name="analyse"');
    expect(source).toContain('<Icon name="tune"');
    expect(source).toContain('applySuggestions([suggestion]);');
    expect(source).toContain('applySuggestions(applicable);');
  });

  it('adds the spectrum report headings and decorative grid without changing the chart label hook', () => {
    const source = read('ui/SpectrumStrip.tsx');

    expect(source).toContain('Field guide');
    expect(source).toContain('spectrum__grid');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('role="img" aria-label={chartLabel}');
  });

  it('threads severity classes through the conflict summaries and detail rows', () => {
    const source = read('ui/ConflictList.tsx');

    expect(source).toContain('conflict conflict--${hit.severity}');
    expect(source).toContain('worst');
    expect(source).toContain('showSelf');
    expect(source).toContain('aria-expanded={isOpen}');
  });

  it('adds the field report styling hooks to components.css', () => {
    const source = read('styles/components.css');

    expect(source).toContain('.result-lead');
    expect(source).toContain('.result-lead--clear');
    expect(source).toContain('.result-lead--conflict');
    expect(source).toContain('.summary-grid__count');
    expect(source).toContain('.suggestion__from');
    expect(source).toContain('.suggestion__arrow');
    expect(source).toContain('.suggestion__to');
    expect(source).toContain('.spectrum__grid');
    expect(source).toContain('.conflict--low');
  });
});
