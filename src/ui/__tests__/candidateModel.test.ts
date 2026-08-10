import { describe, expect, it } from 'vitest';
import {
  countByVerdict,
  filterEvaluations,
  nearestClearKHz,
} from '../candidateModel';
import type { CandidateEvaluation, Verdict } from '../../im';

function evaluation(freqKHz: number, worst: Verdict): CandidateEvaluation {
  return {
    freqKHz,
    worst,
    verdicts: {} as CandidateEvaluation['verdicts'],
    explanation: null,
  };
}

describe('nearestClearKHz', () => {
  it('returns null when nothing is clear', () => {
    const evaluations = [evaluation(500000, 'exact'), evaluation(500025, 'near')];
    expect(nearestClearKHz(evaluations, 500000)).toBe(null);
  });

  it('picks the clear candidate closest to the current frequency', () => {
    const evaluations = [
      evaluation(499900, 'clear'),
      evaluation(500000, 'exact'),
      evaluation(500050, 'clear'),
    ];
    expect(nearestClearKHz(evaluations, 500000)).toBe(500050);
  });

  it('never proposes the frequency already in use', () => {
    const evaluations = [evaluation(500000, 'clear'), evaluation(500100, 'clear')];
    expect(nearestClearKHz(evaluations, 500000)).toBe(500100);
  });

  it('falls back to the first clear candidate when there is no current frequency', () => {
    const evaluations = [evaluation(500200, 'clear'), evaluation(500000, 'clear')];
    expect(nearestClearKHz(evaluations, null)).toBe(500200);
  });
});

describe('filterEvaluations', () => {
  const evaluations = [
    evaluation(500000, 'exact'),
    evaluation(500025, 'clear'),
    evaluation(500050, 'near'),
  ];

  it('returns everything for "all"', () => {
    expect(filterEvaluations(evaluations, 'all', null)).toHaveLength(3);
  });

  it('keeps only clear candidates for "clear"', () => {
    expect(filterEvaluations(evaluations, 'clear', null).map((e) => e.freqKHz)).toEqual([
      500025,
    ]);
  });

  it('keeps only non-clear candidates for "problem"', () => {
    expect(
      filterEvaluations(evaluations, 'problem', null).map((e) => e.freqKHz),
    ).toEqual([500000, 500050]);
  });

  it('always keeps the current frequency so the user does not lose their place', () => {
    expect(filterEvaluations(evaluations, 'clear', 500000).map((e) => e.freqKHz)).toEqual(
      [500000, 500025],
    );
  });

  it('preserves ascending frequency order', () => {
    const filtered = filterEvaluations(evaluations, 'all', null);
    expect(filtered.map((e) => e.freqKHz)).toEqual([500000, 500025, 500050]);
  });
});

describe('countByVerdict', () => {
  it('counts each bucket independently of any filter', () => {
    const evaluations = [
      evaluation(500000, 'exact'),
      evaluation(500025, 'clear'),
      evaluation(500050, 'clear'),
    ];
    expect(countByVerdict(evaluations)).toEqual({ all: 3, clear: 2, problem: 1 });
  });
});
