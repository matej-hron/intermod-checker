/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

describe('Task 5 tune redesign source', () => {
  it('adds a field-guide heading and tune context summary without changing tune actions', () => {
    const source = read('ui/TuneView.tsx');

    expect(source).toContain("import { Icon } from './Icon';");
    expect(source).toContain('<div className="panel__heading">');
    expect(source).toContain('<span className="eyebrow">Frequency field guide</span>');
    expect(source).toContain('className="tune-context"');
    expect(source).toContain('className="tune-context__item"');
    expect(source).toContain('className="tune-context__label"');
    expect(source).toContain('<Icon name="tune"');
    expect(source).toContain('void widen(carriers, settings)');
    expect(source).toContain('disabled={halfWidthKHz >= settings.bandMaxKHz - settings.bandMinKHz}');
  });

  it('keeps context-strip switching while rendering labelled notebook stamps', () => {
    const source = read('ui/ContextStrip.tsx');

    expect(source).toContain("className={`context-chip context-chip--${state}");
    expect(source).toContain('className="context-chip__meta"');
    expect(source).toContain('className="context-chip__stamp"');
    expect(source).toContain("{carrier.locked ? 'Locked' : 'Unlocked'}");
    expect(source).toContain("state === 'conflict' ? 'Conflict' : state === 'clear' ? 'Clear' : 'Pending'");
    expect(source).toContain('onClick={() => select(carrier.id)}');
  });

  it('preserves candidate filtering logic while making mobile state hooks explicit', () => {
    const source = read('ui/CandidateList.tsx');

    expect(source).toContain("import { Icon } from './Icon';");
    expect(source).toContain("const [filter, setFilter] = useState<CandidateFilter>('clear');");
    expect(source).toContain('const counts = countByVerdict(evaluations, currentKHz);');
    expect(source).toContain('const shown = filterEvaluations(evaluations, filter, currentKHz);');
    expect(source).toContain('Apply frequency');
    expect(source).toContain('<Icon name="tune"');
    expect(source).toContain("if (evaluation.worst === 'near') classes.push('candidate--near');");
    expect(source).toContain("if (evaluation.worst === 'exact') classes.push('candidate--exact');");
    expect(source).toContain('disabled={locked}');
    expect(source).toContain('<span className="badge">current</span>');
    expect(source).toContain('<span className="badge badge--good">nearest clear</span>');
  });

  it('adds ledger-row classes and sticky heading hooks without changing table semantics', () => {
    const source = read('ui/CandidateGrid.tsx');

    expect(source).toContain('className="grid-scroll"');
    expect(source).toContain('<th scope="col">');
    expect(source).toContain('<th scope="row">');
    expect(source).toContain('className="candidate-grid__heading"');
    expect(source).toContain("if (evaluation.worst === 'near') classes.push('candidate-row--near');");
    expect(source).toContain("if (evaluation.worst === 'exact') classes.push('candidate-row--exact');");
    expect(source).toContain('<span className="badge">current</span>');
    expect(source).toContain('<span className="badge badge--good">nearest clear</span>');
  });

  it('adds the field-guide styling hooks to components.css', () => {
    const tokens = read('styles/tokens.css');
    const source = read('styles/components.css');

    expect(tokens).toContain('--app-bar-title-line:');
    expect(tokens).toContain('--app-bar-descriptor-line:');
    expect(tokens).toContain('--app-bar-height:');
    expect(source).toContain('min-height: var(--app-bar-height);');
    expect(source).toContain('line-height: var(--app-bar-title-line);');
    expect(source).toContain('line-height: var(--app-bar-descriptor-line);');
    expect(source).toContain('top: calc(var(--app-bar-height) + var(--space-2));');
    expect(source).toContain('.tune-context');
    expect(source).toContain('.tune-context__item');
    expect(source).toContain('.context-chip__meta');
    expect(source).toContain('.context-chip__stamp');
    expect(source).toContain('.pinned__action');
    expect(source).toContain('.candidate--near');
    expect(source).toContain('.candidate--exact');
    expect(source).toContain('.candidate-row--near');
    expect(source).toContain('.candidate-row--exact');
    expect(source).toContain('.candidate-grid__heading');
    expect(source).toContain('.candidate-grid thead th');
    expect(source).toContain('.segmented__option {');
    expect(source).toContain('min-height: var(--tap);');
    expect(source).not.toContain('min-height: calc(var(--tap) - 0.25rem);');
    expect(source).toMatch(
      /@media \(min-width: 48rem\) \{\s+\.grid-scroll \{\s+max-height: min\(60vh, 40rem\);\s+overflow: auto;\s+overscroll-behavior: contain;\s+scrollbar-gutter: stable;\s+\}\s+\}/,
    );
  });

  it('reuses the redesigned tune heading in the empty state', () => {
    const source = read('ui/TuneView.tsx');

    expect(source).toContain("if (carriers.length === 0) {");
    expect(source).toContain('{heading}');
    expect(source).toContain('<span className="eyebrow">Frequency field guide</span>');
    expect(source).toContain('<h2 className="tune-heading">');
    expect(source).toContain('<Icon name="tune" size={18} className="tune-heading__icon" />');
    expect(source).toContain('<p className="hint">Add some frequencies first.</p>');
    expect(source).not.toContain('<h2>Tune</h2>');
  });
});
