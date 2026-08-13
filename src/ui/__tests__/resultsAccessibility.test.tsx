import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResult, Carrier, Hit, Suggestion } from '../../im';

async function renderSuggestionPanel({
  carriers,
  suggestions,
}: {
  carriers: Carrier[];
  suggestions: Suggestion[];
}) {
  vi.resetModules();
  vi.doMock('../../state/analysisStore', () => ({
    useAnalysisStore: <T,>(selector: (state: object) => T): T =>
      selector({
        status: 'done',
        progress: null,
        result: null,
        suggestions,
        issues: [],
        errorMessage: null,
        clear: vi.fn(),
      }),
  }));
  vi.doMock('../../state/projectStore', () => ({
    useProjectStore: <T,>(selector: (state: object) => T): T =>
      selector({
        carriers,
        applySuggestions: vi.fn(),
      }),
  }));
  vi.doMock('../../state/viewStore', () => ({
    useViewStore: <T,>(selector: (state: object) => T): T =>
      selector({
        openTune: vi.fn(),
      }),
  }));

  const { SuggestionPanel } = await import('../SuggestionPanel');
  return renderToStaticMarkup(<SuggestionPanel />);
}

async function renderConflictList({
  carriers,
  result,
  expandedCarrierId,
}: {
  carriers: Carrier[];
  result: AnalysisResult;
  expandedCarrierId: string;
}) {
  vi.resetModules();
  vi.doMock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    let stateCall = 0;

    return {
      ...actual,
      useState: ((initial: unknown) => {
        stateCall += 1;
        if (stateCall === 1) return [expandedCarrierId, vi.fn()];
        if (stateCall === 2) return [false, vi.fn()];
        return actual.useState(initial);
      }) as typeof actual.useState,
    };
  });
  vi.doMock('../../state/analysisStore', () => ({
    useAnalysisStore: <T,>(selector: (state: object) => T): T =>
      selector({
        status: 'done',
        progress: null,
        result,
        suggestions: [],
        issues: [],
        errorMessage: null,
      }),
  }));
  vi.doMock('../../state/projectStore', () => ({
    useProjectStore: <T,>(selector: (state: object) => T): T =>
      selector({
        carriers,
      }),
  }));

  const { ConflictList } = await import('../ConflictList');
  return renderToStaticMarkup(<ConflictList />);
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('react');
  vi.doUnmock('../../state/analysisStore');
  vi.doUnmock('../../state/projectStore');
  vi.doUnmock('../../state/viewStore');
});

describe('Task 4 accessibility output', () => {
  it('speaks retune suggestions as an explicit from-to relationship', async () => {
    const carriers: Carrier[] = [
      { id: 'c1', label: 'Lead Mic', freqKHz: 510000, locked: false },
    ];
    const suggestions: Suggestion[] = [
      { carrierId: 'c1', fromKHz: 510000, toKHz: 522000, distanceKHz: 12000 },
    ];

    const html = await renderSuggestionPanel({ carriers, suggestions });

    expect(html).toContain('Lead Mic');
    expect(html).toContain('class="suggestion__arrow" aria-hidden="true"');
    expect(html).toContain('class="visually-hidden"> to </span>');
    expect(html).toContain('522.000 MHz');
  });

  it('shows severity words in carrier summaries and hit rows, not only colour hooks', async () => {
    const carriers: Carrier[] = [
      { id: 'c1', label: 'Lead Mic', freqKHz: 510000, locked: false },
      { id: 'c2', label: 'Backup Mic', freqKHz: 530000, locked: false },
      { id: 'c3', label: 'Ambient Mic', freqKHz: 550000, locked: false },
    ];
    const makeHit = (
      victimId: string,
      freqKHz: number,
      order: number,
      severity: Hit['severity'],
    ): Hit => ({
      victimId,
      product: { coeffs: [1, -1, 1], order, freqKHz },
      kind: 'exact',
      offsetKHz: 0,
      severity,
      selfInvolving: false,
    });
    const high = makeHit('c1', 510000, 3, 'high');
    const medium = makeHit('c2', 530000, 5, 'medium');
    const low = makeHit('c3', 550000, 7, 'low');
    const result: AnalysisResult = {
      hits: [high, medium, low],
      hitsByCarrierId: {
        c1: [high],
        c2: [medium],
        c3: [low],
      },
      conflictedIds: ['c1', 'c2', 'c3'],
      vectorsExamined: 42,
    };

    const html = await renderConflictList({
      carriers,
      result,
      expandedCarrierId: 'c1',
    });

    expect(html).toContain('aria-expanded="true"');
    expect(html.match(/High severity/g) ?? []).toHaveLength(2);
    expect(html.match(/Medium severity/g) ?? []).toHaveLength(1);
    expect(html.match(/Low severity/g) ?? []).toHaveLength(1);
  });
});
