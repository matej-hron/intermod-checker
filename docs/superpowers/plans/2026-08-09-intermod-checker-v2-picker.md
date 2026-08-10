# Intermodulation Checker v2 — Candidate Picker, Locking, Exclusions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-carrier Tune view that lists nearby candidate frequencies with a per-criterion pass/fail grid and a plain-language verdict, plus carrier locking and user-defined exclusion ranges, all sharing one evaluation primitive with the existing suggestion engine.

**Architecture:** A new engine primitive `evaluateCandidate()` answers "what happens if carrier *i* moves to frequency *f*?" and returns a verdict per interference criterion (`{transmitters}T{order}O`) plus spacing and exclusion. The existing `suggest()` is refactored to call it in a cheap `first-hit` mode, so both the batch fixer and the interactive picker can never disagree. A new worker request (`tune`) evaluates a window of candidates off the main thread; a new `tuneStore` and `TuneView` render the results as an accessible table.

**Tech Stack:** TypeScript (strict, project references), React 19, Zustand 5, Vite 8, Vitest 4, oxlint. No new dependencies.

**Source of truth:** `docs/superpowers/specs/2026-08-09-intermod-checker-v2-picker-design.md` (v2 spec) extending `docs/superpowers/specs/2026-08-09-intermod-checker-design.md` (v1 spec). Read the v2 spec before starting.

## Global Constraints

- **Integer kilohertz everywhere** in the engine, worker, stores, and persistence. Megahertz exists only at the UI boundary via `MHzInput`, `kHzToMHzText`, `mhzToKHz`, and `parseFrequencyMHz`. Never introduce a float frequency into engine code.
- **An exact hit is `offset === 0`.** No epsilon, ever.
- **`enumerateVectors` reuses a single mutable `coeffs` array across visitor calls.** Anything retained beyond the callback MUST be copied or derived inside the callback. This is the single most common defect in this codebase.
- **Only products the moved carrier is party to count** when judging a candidate (v1 spec §4.3, v2 spec §4.3). Judging a candidate on the whole set's cleanliness rejects every candidate for every carrier once two independent conflicts exist. See the load-bearing comment in `src/im/suggest.ts`.
- **Self-involving products are excluded** from conflict judgements, matching `analyze()`'s `conflictedIds`.
- **Invalid input is reported, never silently coerced** (v1 spec §6).
- **Colour is never the sole carrier of meaning.** Every verdict indicator has both a shape and a text label available to assistive technology.
- Existing defaults in `src/im/types.ts` are unchanged: `bandMinKHz=500000`, `bandMaxKHz=700000`, `lowOrder=3`, `highOrder=5`, `oddOnly=true`, `nearHitWindowKHz=25`, `deviationKHz=0`, `minSpacingKHz=250`, `suggestionStepKHz=25`. `MAX_ORDER=9`, `MIN_CARRIERS=2`, `MAX_CARRIERS=24`.
- **Tests live in `src/im/__tests__/*.test.ts`.** Vitest only picks up that glob.
- **Typecheck is `npm run typecheck`** (`tsc -b --noEmit`; the root tsconfig is references-only so plain `tsc --noEmit` does nothing).
- **The gate before any commit that touches code:** `npm run typecheck && npm run lint && npm run test`.
- Every task ends with a commit. Commit messages use Conventional Commits (`feat:`, `refactor:`, `test:`, `docs:`).

## File Structure

**New engine files**

| File | Responsibility |
|---|---|
| `src/im/criteria.ts` | `Verdict`, `CriterionKey`, criterion naming/bucketing, verdict ordering, the realizable criterion set for a `Settings`. Pure, no scanning. |
| `src/im/evaluate.ts` | `evaluateCandidate()` — the one shared "what if carrier *i* moves to *f*?" primitive. |
| `src/im/candidates.ts` | `generateCandidates()` — the nearest-first candidate window used by the Tune view. |

**Modified engine files**

| File | Change |
|---|---|
| `src/im/types.ts` | `Carrier.locked`, `Exclusion`, `Settings.exclusions`, `ValidationField` gains `'exclusions'`. |
| `src/im/project.ts` | `PROJECT_VERSION = 2`, carrier/exclusion normalisation, backward-compatible v1 load. |
| `src/im/validate.ts` | Exclusion range validation and carrier-inside-exclusion warnings. |
| `src/im/suggest.ts` | Rebuilt on `evaluateCandidate`; honours `locked` and exclusions. |
| `src/im/index.ts` | Re-export the three new modules. |

**Worker / state**

| File | Change |
|---|---|
| `src/worker/protocol.ts` | `TuneRequest`, `TuneDoneResponse`, `'tune'` progress phase. |
| `src/worker/analysis.worker.ts` | Handle `tune`. |
| `src/worker/client.ts` | `AnalysisClient.tune()`. |
| `src/state/tuneStore.ts` | New. Owns the Tune session: selected carrier, half-width, evaluations, status. Uses its **own** `AnalysisClient` instance so tuning never cancels an analysis. |
| `src/state/viewStore.ts` | New. Which top-level view is showing, and the carrier Tune should preselect. |
| `src/state/projectStore.ts` | Persist `version: PROJECT_VERSION`; exclusion CRUD actions. |

**UI**

| File | Change |
|---|---|
| `src/ui/VerdictDot.tsx` | New. One accessible verdict indicator (shape + colour + text). |
| `src/ui/ExclusionEditor.tsx` | New. Add/edit/remove exclusion ranges. |
| `src/ui/ContextStrip.tsx` | New. Read-only row of every carrier, used by the Tune view. |
| `src/ui/CandidateGrid.tsx` | New. The candidate table. |
| `src/ui/TuneView.tsx` | New. Tune view shell: carrier selector, context strip, grid, widen control. |
| `src/ui/FrequencyTable.tsx` | Lock toggle column, "Tune" button per row. |
| `src/ui/SettingsPanel.tsx` | Renders `ExclusionEditor`. |
| `src/ui/SuggestionPanel.tsx` | Per-suggestion "Choose myself" link into Tune. |
| `src/App.tsx` | Three-view navigation. |
| `src/index.css` | Styles for dots, grid, context strip, tabs. |

---

### Task 1: Data model — `locked`, `Exclusion`, project format version 2

Spec: §3.1, §3.2, §3.3.

**Files:**
- Modify: `src/im/types.ts`
- Modify: `src/im/project.ts`
- Modify: `src/state/projectStore.ts`
- Test: `src/im/__tests__/project.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Carrier { id: string; label: string; freqKHz: number; locked: boolean }`
  - `interface Exclusion { id: string; label: string; startKHz: number; endKHz: number }`
  - `Settings.exclusions: Exclusion[]`, default `[]`
  - `PROJECT_VERSION = 2`
  - `normalizeExclusion(e: Exclusion): Exclusion` — swaps `startKHz`/`endKHz` when reversed.

- [ ] **Step 1: Write the failing migration tests**

Append to `src/im/__tests__/project.test.ts`:

```ts
describe('v2 migration', () => {
  it('loads a version 1 file with locked false and no exclusions', () => {
    const json = JSON.stringify({
      version: 1,
      name: 'Old',
      carriers: [
        { id: 'a', label: 'Mic 1', freqKHz: 510000 },
        { id: 'b', label: 'Mic 2', freqKHz: 530000 },
      ],
      settings: { bandMinKHz: 500000, bandMaxKHz: 700000 },
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.carriers.every((c) => c.locked === false)).toBe(true);
    expect(parsed.settings.exclusions).toEqual([]);
  });

  it('round-trips a version 2 file', () => {
    const carriers = [
      { id: 'a', label: 'Mic 1', freqKHz: 510000, locked: true },
      { id: 'b', label: 'Mic 2', freqKHz: 530000, locked: false },
    ];
    const settings = {
      ...DEFAULT_SETTINGS,
      exclusions: [
        { id: 'x1', label: 'Local DTV', startKHz: 566000, endKHz: 574000 },
      ],
    };
    const parsed = parseProject(serializeProject('P', carriers, settings));
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.version).toBe(2);
    expect(parsed.carriers).toEqual(carriers);
    expect(parsed.settings.exclusions).toEqual(settings.exclusions);
  });

  it('rejects a version 3 file', () => {
    const parsed = parseProject(
      JSON.stringify({ version: 3, name: 'Future', carriers: [], settings: {} }),
    );
    expect('error' in parsed).toBe(true);
  });

  it('normalizes a reversed exclusion range on load', () => {
    const json = JSON.stringify({
      version: 2,
      name: 'P',
      carriers: [{ id: 'a', label: 'Mic 1', freqKHz: 510000, locked: false }],
      settings: {
        exclusions: [{ id: 'x', label: 'Backwards', startKHz: 600000, endKHz: 560000 }],
      },
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.settings.exclusions[0]).toEqual({
      id: 'x',
      label: 'Backwards',
      startKHz: 560000,
      endKHz: 600000,
    });
  });

  it('drops malformed exclusions rather than passing NaN to the engine', () => {
    const json = JSON.stringify({
      version: 2,
      name: 'P',
      carriers: [{ id: 'a', label: 'Mic 1', freqKHz: 510000, locked: false }],
      settings: { exclusions: [{ id: 'x', label: 'Bad', startKHz: '560000', endKHz: 600000 }] },
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.settings.exclusions).toEqual([]);
  });
});
```

The existing `import` line at the top of that file must include `DEFAULT_SETTINGS` and `serializeProject` if it does not already.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/im/__tests__/project.test.ts`
Expected: FAIL — `parsed.carriers[0].locked` is `undefined`, `parsed.settings.exclusions` is `undefined`, and the version 3 case passes only by accident.

- [ ] **Step 3: Extend the types**

In `src/im/types.ts`, add `locked` to `Carrier`, add `Exclusion`, add `exclusions` to `Settings` and `DEFAULT_SETTINGS`, and extend `ValidationField`:

```ts
export interface Carrier {
  id: string;
  label: string;
  freqKHz: number;
  /** A locked carrier is never retuned by any automated process. */
  locked: boolean;
}

/** A span of the band that a carrier may not occupy. Both bounds inclusive. */
export interface Exclusion {
  id: string;
  label: string;
  startKHz: number;
  endKHz: number;
}

export interface Settings {
  bandMinKHz: number;
  bandMaxKHz: number;
  lowOrder: number;
  highOrder: number;
  oddOnly: boolean;
  nearHitWindowKHz: number;
  deviationKHz: number;
  minSpacingKHz: number;
  suggestionStepKHz: number;
  exclusions: Exclusion[];
}
```

Add `exclusions: []` to `DEFAULT_SETTINGS`, and change:

```ts
export type ValidationField = 'carriers' | 'frequency' | 'settings' | 'exclusions';
```

Add the two helpers to `src/im/types.ts` as well, since they are pure data operations on `Exclusion`:

```ts
export function normalizeExclusion(e: Exclusion): Exclusion {
  return e.startKHz <= e.endKHz
    ? e
    : { ...e, startKHz: e.endKHz, endKHz: e.startKHz };
}

/** Inclusive on both bounds, per spec §3.2. */
export function isExcluded(freqKHz: number, exclusions: readonly Exclusion[]): boolean {
  return exclusions.some((e) => freqKHz >= e.startKHz && freqKHz <= e.endKHz);
}
```

- [ ] **Step 4: Teach the project loader version 2**

In `src/im/project.ts`:

```ts
export const PROJECT_VERSION = 2;
```

Replace `isCarrier` with a normaliser, because a v1 carrier is structurally valid but missing `locked`:

```ts
function toCarrier(value: unknown): Carrier | null {
  if (typeof value !== 'object' || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string') return null;
  if (typeof c.label !== 'string') return null;
  if (typeof c.freqKHz !== 'number' || !Number.isFinite(c.freqKHz)) return null;
  return {
    id: c.id,
    label: c.label,
    freqKHz: c.freqKHz,
    locked: c.locked === true,
  };
}
```

Add exclusion sanitisation. A hand-edited or older file can carry a string where a number belongs, and an unchecked value reaches the engine's comparisons as `NaN`, silently excluding nothing:

```ts
function sanitizeExclusions(raw: unknown): Exclusion[] {
  if (!Array.isArray(raw)) return [];
  const out: Exclusion[] = [];
  for (const value of raw) {
    if (typeof value !== 'object' || value === null) continue;
    const e = value as Record<string, unknown>;
    if (typeof e.id !== 'string') continue;
    if (typeof e.label !== 'string') continue;
    if (typeof e.startKHz !== 'number' || !Number.isFinite(e.startKHz)) continue;
    if (typeof e.endKHz !== 'number' || !Number.isFinite(e.endKHz)) continue;
    out.push(
      normalizeExclusion({
        id: e.id,
        label: e.label,
        startKHz: e.startKHz,
        endKHz: e.endKHz,
      }),
    );
  }
  return out;
}
```

Call it from `sanitizeSettings`, after the numeric loop:

```ts
  if (typeof s.oddOnly === 'boolean') out.oddOnly = s.oddOnly;
  out.exclusions = sanitizeExclusions(s.exclusions);
  return out;
```

`DEFAULT_SETTINGS.exclusions` is a shared array literal, so `{ ...DEFAULT_SETTINGS }` aliases it. Assigning a fresh array unconditionally (as above) avoids handing callers a reference into the module default.

In `parseProject`, replace the `every(isCarrier)` check with the normalising map:

```ts
  if (!Array.isArray(candidate.carriers)) {
    return { error: 'The project contains no readable frequency list.' };
  }
  const carriers: Carrier[] = [];
  for (const raw of candidate.carriers) {
    const c = toCarrier(raw);
    if (c === null) {
      return { error: 'The project contains no readable frequency list.' };
    }
    carriers.push(c);
  }
```

and use `carriers` for the duplicate-id check and in the returned object. Update the imports at the top of the file to include `Exclusion` and `normalizeExclusion`.

- [ ] **Step 5: Update the store's seed data and persisted version**

In `src/state/projectStore.ts`:

- `initialCarriers()` gains `locked: false` on both entries.
- `addCarrier()` gains `locked: false`.
- The `persist()` body writes `version: PROJECT_VERSION` instead of the literal `1`, and imports `PROJECT_VERSION` from `../im`.

Leave `STORAGE_KEY` as `'intermod-checker:project:v1'`. The key names the storage slot, not the file format, and `parseProject` now migrates v1 content in place — changing the key would orphan every existing user's saved project, which is exactly the outcome backward-compatible loading exists to prevent.

- [ ] **Step 6: Run the full test suite**

Run: `npm run typecheck && npm run test`
Expected: PASS. Existing tests that build `Carrier` literals will fail typecheck until `locked: false` is added — add it to every such literal in `src/im/__tests__/*.test.ts` (the `carrier()` helpers in `analyze.test.ts` and `suggest.test.ts` are the main ones; fix the helper, not each call site).

- [ ] **Step 7: Commit**

```bash
git add src/im/types.ts src/im/project.ts src/state/projectStore.ts src/im/__tests__
git commit -m "feat: add carrier locking and exclusion ranges to the data model"
```

---

### Task 2: Exclusion and lock validation

Spec: §5.4, §6.

**Files:**
- Modify: `src/im/validate.ts`
- Test: `src/im/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: `Exclusion`, `Settings.exclusions`, `Carrier.locked`, `ValidationField` (Task 1).
- Produces: no new exports; `validate()` keeps its signature `(carriers, settings) => ValidationIssue[]`.

- [ ] **Step 1: Write the failing tests**

Append to `src/im/__tests__/validate.test.ts`:

```ts
describe('exclusions', () => {
  const base = { ...DEFAULT_SETTINGS };
  const carriers: Carrier[] = [
    { id: 'a', label: 'Mic 1', freqKHz: 510000, locked: false },
    { id: 'b', label: 'Mic 2', freqKHz: 570000, locked: false },
  ];

  it('flags a carrier sitting inside an exclusion range', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Local DTV', startKHz: 566000, endKHz: 574000 }],
    };
    const issues = validate(carriers, settings);
    const issue = issues.find((i) => i.carrierIds.includes('b'));
    expect(issue).toBeDefined();
    expect(issue?.field).toBe('exclusions');
    expect(issue?.message).toContain('Local DTV');
  });

  it('treats the exclusion bounds as inclusive', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Edge', startKHz: 570000, endKHz: 580000 }],
    };
    expect(validate(carriers, settings).some((i) => i.carrierIds.includes('b'))).toBe(true);
  });

  it('flags an exclusion that lies entirely outside the band', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Elsewhere', startKHz: 800000, endKHz: 810000 }],
    };
    const issue = validate(carriers, settings).find((i) => i.message.includes('Elsewhere'));
    expect(issue?.message).toContain('no effect');
  });

  it('flags an exclusion that covers the whole band', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'Everything', startKHz: 400000, endKHz: 800000 }],
    };
    expect(
      validate(carriers, settings).some((i) => i.message.includes('leaves no usable')),
    ).toBe(true);
  });

  it('accepts a clean set with a harmless exclusion', () => {
    const settings = {
      ...base,
      exclusions: [{ id: 'x', label: 'IEM rack', startKHz: 600000, endKHz: 604000 }],
    };
    expect(validate(carriers, settings)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/im/__tests__/validate.test.ts`
Expected: FAIL — `issue` is `undefined` in the first four cases.

- [ ] **Step 3: Implement the validation**

Add to `src/im/validate.ts`, after the existing spacing loop and before `return issues`:

```ts
  for (const e of settings.exclusions) {
    if (!Number.isInteger(e.startKHz) || !Number.isInteger(e.endKHz)) {
      issues.push({
        field: 'exclusions',
        message: `Exclusion "${e.label}" must use whole kilohertz.`,
        carrierIds: [],
      });
      continue;
    }
    if (e.endKHz < settings.bandMinKHz || e.startKHz > settings.bandMaxKHz) {
      issues.push({
        field: 'exclusions',
        message: `Exclusion "${e.label}" is outside the band and has no effect.`,
        carrierIds: [],
      });
      continue;
    }
    if (e.startKHz <= settings.bandMinKHz && e.endKHz >= settings.bandMaxKHz) {
      issues.push({
        field: 'exclusions',
        message: `Exclusion "${e.label}" covers the whole band and leaves no usable frequency.`,
        carrierIds: [],
      });
    }
  }

  for (const c of carriers) {
    const blocking = settings.exclusions.find(
      (e) => c.freqKHz >= e.startKHz && c.freqKHz <= e.endKHz,
    );
    if (blocking !== undefined) {
      issues.push({
        field: 'exclusions',
        message: `${(c.freqKHz / 1000).toFixed(3)} MHz is inside the excluded range "${blocking.label}".`,
        carrierIds: [c.id],
      });
    }
  }
```

Note the carrier-inside-exclusion check reads the bounds directly rather than calling `isExcluded`, because the message must name *which* range blocked it (spec §3.2: overlapping ranges are not merged precisely so the user learns which one applies).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run typecheck && npm run test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add src/im/validate.ts src/im/__tests__/validate.test.ts
git commit -m "feat: validate exclusion ranges and carriers inside them"
```

---

### Task 3: Criteria — naming, bucketing, verdict ordering

Spec: §4.1, §4.2.

**Files:**
- Create: `src/im/criteria.ts`
- Modify: `src/im/index.ts`
- Test: `src/im/__tests__/criteria.test.ts`

**Interfaces:**
- Consumes: `Settings` (Task 1).
- Produces:
  - `type Verdict = 'clear' | 'near' | 'exact'`
  - `type CriterionKey = string`
  - `const SPACING_CRITERION = 'spacing'`, `const EXCLUSION_CRITERION = 'exclusion'`
  - `txBucket(coeffs: readonly number[]): number` — 1, 2, or 3
  - `criterionKey(bucket: number, order: number): CriterionKey`
  - `realizableCriteria(settings: Settings): CriterionKey[]`
  - `verdictRank(v: Verdict): number`
  - `worseVerdict(a: Verdict, b: Verdict): Verdict`
  - `criterionLabel(key: CriterionKey): string` — human text for headers and screen readers

- [ ] **Step 1: Write the failing tests**

Create `src/im/__tests__/criteria.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  criterionKey,
  criterionLabel,
  realizableCriteria,
  txBucket,
  worseVerdict,
  verdictRank,
} from '../criteria';
import { DEFAULT_SETTINGS } from '../types';

describe('txBucket', () => {
  it('counts a harmonic of one transmitter as bucket 1', () => {
    expect(txBucket([3, 0, 0])).toBe(1);
  });

  it('counts a two-transmitter product as bucket 2', () => {
    expect(txBucket([2, -1, 0])).toBe(2);
  });

  it('counts a three-transmitter product as bucket 3', () => {
    expect(txBucket([1, 1, -1, 0])).toBe(3);
  });

  it('caps four or more transmitters at bucket 3', () => {
    expect(txBucket([1, 1, 1, 1, -1])).toBe(3);
  });
});

describe('criterionKey', () => {
  it('formats as {bucket}T{order}O', () => {
    expect(criterionKey(2, 3)).toBe('2T3O');
    expect(criterionKey(3, 5)).toBe('3T5O');
  });
});

describe('realizableCriteria', () => {
  it('lists the default set in order, strictest first', () => {
    expect(realizableCriteria(DEFAULT_SETTINGS)).toEqual([
      '1T3O',
      '2T3O',
      '3T3O',
      '1T5O',
      '2T5O',
      '3T5O',
    ]);
  });

  it('includes even orders when oddOnly is off', () => {
    expect(
      realizableCriteria({
        ...DEFAULT_SETTINGS,
        lowOrder: 2,
        highOrder: 3,
        oddOnly: false,
      }),
    ).toEqual(['1T2O', '2T2O', '1T3O', '2T3O', '3T3O']);
  });

  it('omits buckets that cannot occur at a given order', () => {
    // A 2nd-order product cannot involve three transmitters.
    expect(realizableCriteria({ ...DEFAULT_SETTINGS, lowOrder: 2, highOrder: 2, oddOnly: false }))
      .toEqual(['1T2O', '2T2O']);
  });
});

describe('verdict ordering', () => {
  it('ranks exact above near above clear', () => {
    expect(verdictRank('exact')).toBeGreaterThan(verdictRank('near'));
    expect(verdictRank('near')).toBeGreaterThan(verdictRank('clear'));
  });

  it('keeps the worse of two verdicts', () => {
    expect(worseVerdict('clear', 'near')).toBe('near');
    expect(worseVerdict('exact', 'near')).toBe('exact');
    expect(worseVerdict('clear', 'clear')).toBe('clear');
  });
});

describe('criterionLabel', () => {
  it('describes an interference criterion in words', () => {
    expect(criterionLabel('2T3O')).toBe('2 transmitters, 3rd order');
    expect(criterionLabel('3T5O')).toBe('3 or more transmitters, 5th order');
    expect(criterionLabel('1T3O')).toBe('1 transmitter, 3rd order');
  });

  it('describes the non-interference criteria', () => {
    expect(criterionLabel('spacing')).toBe('Minimum spacing');
    expect(criterionLabel('exclusion')).toBe('Excluded range');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/im/__tests__/criteria.test.ts`
Expected: FAIL — `Cannot find module '../criteria'`.

- [ ] **Step 3: Implement `src/im/criteria.ts`**

```ts
import type { Settings } from './types';

export type Verdict = 'clear' | 'near' | 'exact';

/**
 * Either an interference criterion written `{bucket}T{order}O` — `2T3O` is
 * "two transmitters, third order" — or one of the two non-interference keys
 * below.
 */
export type CriterionKey = string;

export const SPACING_CRITERION = 'spacing';
export const EXCLUSION_CRITERION = 'exclusion';

/**
 * The number of distinct carriers contributing to a product, capped at 3.
 *
 * The cap is deliberate (spec §4.1): the user acts on "two transmitters
 * interacting" versus "a combination of several", and exact counts above three
 * would multiply columns without changing any decision.
 */
export function txBucket(coeffs: readonly number[]): number {
  let count = 0;
  for (const c of coeffs) {
    if (c !== 0) {
      count += 1;
      if (count === 3) return 3;
    }
  }
  return count;
}

export function criterionKey(bucket: number, order: number): CriterionKey {
  return `${bucket}T${order}O`;
}

/**
 * Every criterion the current settings could produce, ordered by increasing
 * order then increasing bucket so the strictest test is leftmost.
 *
 * A bucket above the order is impossible: each contributing transmitter needs
 * at least one unit of order.
 */
export function realizableCriteria(settings: Settings): CriterionKey[] {
  const keys: CriterionKey[] = [];
  for (let order = settings.lowOrder; order <= settings.highOrder; order += 1) {
    if (settings.oddOnly && order % 2 === 0) continue;
    for (let bucket = 1; bucket <= 3; bucket += 1) {
      if (order < bucket) continue;
      keys.push(criterionKey(bucket, order));
    }
  }
  return keys;
}

const RANK: Record<Verdict, number> = { clear: 0, near: 1, exact: 2 };

export function verdictRank(verdict: Verdict): number {
  return RANK[verdict];
}

export function worseVerdict(a: Verdict, b: Verdict): Verdict {
  return RANK[a] >= RANK[b] ? a : b;
}

function ordinal(order: number): string {
  if (order === 1) return '1st';
  if (order === 2) return '2nd';
  if (order === 3) return '3rd';
  return `${order}th`;
}

export function criterionLabel(key: CriterionKey): string {
  if (key === SPACING_CRITERION) return 'Minimum spacing';
  if (key === EXCLUSION_CRITERION) return 'Excluded range';
  const match = /^(\d+)T(\d+)O$/.exec(key);
  if (match === null) return key;
  const bucket = Number(match[1]);
  const order = Number(match[2]);
  const who =
    bucket === 1 ? '1 transmitter' : bucket === 3 ? '3 or more transmitters' : `${bucket} transmitters`;
  return `${who}, ${ordinal(order)} order`;
}
```

- [ ] **Step 4: Export the module**

Add `export * from './criteria';` to `src/im/index.ts`, after `./products`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/im/criteria.ts src/im/index.ts src/im/__tests__/criteria.test.ts
git commit -m "feat: add interference criteria and verdict ordering"
```

---

### Task 4: The `evaluateCandidate` primitive

Spec: §4.2, §4.3, §4.6. This is the heart of v2 — read the spec sections before writing code.

**Files:**
- Create: `src/im/evaluate.ts`
- Modify: `src/im/index.ts`
- Test: `src/im/__tests__/evaluate.test.ts`

**Interfaces:**
- Consumes: `Verdict`, `CriterionKey`, `criterionKey`, `txBucket`, `realizableCriteria`, `worseVerdict`, `verdictRank`, `SPACING_CRITERION`, `EXCLUSION_CRITERION` (Task 3); `effectiveWindowKHz` from `./analyze`; `scanProducts` from `./products`; `isExcluded`, `Carrier`, `Settings` (Task 1).
- Produces:
  - `interface CandidateExplanation { order: number; verdict: Verdict; offsetKHz: number; contributors: string[] }`
  - `interface CandidateEvaluation { freqKHz: number; verdicts: Record<CriterionKey, Verdict>; worst: Verdict; explanation: CandidateExplanation | null }`
  - `function evaluateCandidate(freqs: number[], index: number, candidateKHz: number, settings: Settings, carriers: readonly Carrier[], mode?: 'full' | 'first-hit'): CandidateEvaluation`
  - `function explanationText(explanation: CandidateExplanation | null): string`

Note the `freqs` parameter is the **mutable working array** (`carriers.map(c => c.freqKHz)`), matching how `suggest()` already carries partially-solved state. `evaluateCandidate` writes `candidateKHz` into `freqs[index]` and restores it before returning; `carriers` is used only for labels.

- [ ] **Step 1: Write the failing tests**

Create `src/im/__tests__/evaluate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { evaluateCandidate, explanationText } from '../evaluate';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

function carrier(id: string, mhz: number, locked = false): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000), locked };
}

const third: Settings = { ...DEFAULT_SETTINGS, lowOrder: 3, highOrder: 3 };

function evaluate(
  carriers: Carrier[],
  index: number,
  candidateMHz: number,
  settings: Settings = third,
  mode: 'full' | 'first-hit' = 'full',
) {
  const freqs = carriers.map((c) => c.freqKHz);
  return evaluateCandidate(
    freqs,
    index,
    Math.round(candidateMHz * 1000),
    settings,
    carriers,
    mode,
  );
}

describe('evaluateCandidate', () => {
  it('reports an exact two-transmitter third-order hit under 2T3O', () => {
    // 2*510 - 511 = 509, so 509.000 is an exact hit for the third carrier.
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509);
    expect(evaluation.verdicts['2T3O']).toBe('exact');
    expect(evaluation.worst).toBe('exact');
  });

  it('reports a three-transmitter product under 3T3O', () => {
    // 510 + 520 - 505 = 525.
    const carriers = [
      carrier('a', 510),
      carrier('b', 520),
      carrier('c', 505),
      carrier('d', 525),
    ];
    const evaluation = evaluate(carriers, 3, 525);
    expect(evaluation.verdicts['3T3O']).toBe('exact');
  });

  it('reports a near miss as near, not exact', () => {
    // 2*510 - 511 = 509; 509.018 is 18 kHz away, inside the 25 kHz window.
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509.018);
    expect(evaluation.verdicts['2T3O']).toBe('near');
    expect(evaluation.worst).toBe('near');
    expect(evaluation.explanation?.offsetKHz).toBe(18);
  });

  it('keeps the worst verdict when a criterion has both a near and an exact hit', () => {
    // 2*510-511 = 509 exact, and 2*511-513.02 = 508.98 is 20 kHz away.
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
      carrier('d', 513.02),
    ];
    const evaluation = evaluate(carriers, 2, 509);
    expect(evaluation.verdicts['2T3O']).toBe('exact');
  });

  it('reports clear when nothing lands nearby', () => {
    const carriers = [carrier('a', 500.1), carrier('b', 530.3), carrier('c', 570.7)];
    const evaluation = evaluate(carriers, 2, 570.7);
    expect(evaluation.worst).toBe('clear');
    expect(evaluation.explanation).toBeNull();
  });

  it('counts only products the moved carrier is party to', () => {
    // Two independent clusters. While cluster two is still broken, a candidate
    // for cluster one must not be blamed for it. This pins the v1 Critical fix
    // at the primitive level.
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('v1', 509),
      carrier('d', 610),
      carrier('e', 611),
      carrier('v2', 609),
    ];
    // 508.950, not 508.975: 2*510 - 511 = 509.000 and the near-hit window is
    // 25 kHz *inclusive*, so 508.975 is a near miss against the untouched set.
    // (v1's suggest() reaches 508.975 only because carrier b has already been
    // moved by the time c is solved.)
    expect(evaluate(carriers, 2, 508.95).worst).toBe('clear');
  });

  it('names the contributing carriers, excluding the mover', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509);
    expect(evaluation.explanation?.contributors).toEqual(['a', 'b']);
    expect(evaluation.explanation?.order).toBe(3);
  });

  it('builds contributors from a copy, not the shared coefficient array', () => {
    // Twelve carriers produce thousands of vectors after the winning one, so a
    // retained reference to the reused array would report a later vector's
    // contributors instead. The winning product is 3rd order, so it can name at
    // most three carriers; a 5th-order vector leaking in would name more.
    const carriers = Array.from({ length: 12 }, (_, i) => carrier(`m${i}`, 502 + i * 2.5));
    const evaluation = evaluate(carriers, 0, 502, DEFAULT_SETTINGS);
    expect(evaluation.explanation?.order).toBe(3);
    expect(evaluation.explanation?.contributors.length).toBeLessThanOrEqual(3);
    expect(evaluation.explanation?.contributors).not.toContain('m0');
  });

  it('prefers the lowest order among products sharing the worst verdict', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const evaluation = evaluate(carriers, 2, 509, { ...DEFAULT_SETTINGS, lowOrder: 3, highOrder: 5 });
    expect(evaluation.explanation?.order).toBe(3);
  });

  it('fails the spacing criterion inside the minimum spacing', () => {
    const carriers = [carrier('a', 510), carrier('b', 530), carrier('c', 570)];
    // 510.100 is 100 kHz from a, below the 250 kHz minimum.
    expect(evaluate(carriers, 2, 510.1).verdicts.spacing).toBe('exact');
    // Exactly 250 kHz away is allowed.
    expect(evaluate(carriers, 2, 510.25).verdicts.spacing).toBe('clear');
  });

  it('fails the exclusion criterion inclusively at both edges', () => {
    const settings: Settings = {
      ...third,
      exclusions: [{ id: 'x', label: 'DTV', startKHz: 566000, endKHz: 574000 }],
    };
    const carriers = [carrier('a', 510), carrier('b', 530), carrier('c', 590)];
    expect(evaluate(carriers, 2, 566, settings).verdicts.exclusion).toBe('exact');
    expect(evaluate(carriers, 2, 574, settings).verdicts.exclusion).toBe('exact');
    expect(evaluate(carriers, 2, 574.025, settings).verdicts.exclusion).toBe('clear');
  });

  it('short-circuits in first-hit mode without scanning products', () => {
    const carriers = [carrier('a', 510), carrier('b', 530), carrier('c', 570)];
    const evaluation = evaluate(carriers, 2, 510.1, third, 'first-hit');
    expect(evaluation.worst).toBe('exact');
    expect(evaluation.verdicts.spacing).toBe('exact');
  });

  it('agrees with full mode on whether a candidate is clear', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    for (const mhz of [508.975, 509, 509.025, 512.5, 540]) {
      const full = evaluate(carriers, 2, mhz, third, 'full');
      const fast = evaluate(carriers, 2, mhz, third, 'first-hit');
      expect(fast.worst === 'clear').toBe(full.worst === 'clear');
    }
  });

  it('restores the working frequency array', () => {
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    const freqs = carriers.map((c) => c.freqKHz);
    evaluateCandidate(freqs, 2, 540000, third, carriers);
    expect(freqs).toEqual([510000, 511000, 509000]);
  });
});

describe('explanationText', () => {
  it('names the mechanism and the culprits for an exact hit', () => {
    expect(
      explanationText({ order: 3, verdict: 'exact', offsetKHz: 0, contributors: ['Mic 1', 'Mic 5'] }),
    ).toBe('3rd order · Mic 1 + Mic 5');
  });

  it('includes the distance for a near miss', () => {
    expect(
      explanationText({ order: 5, verdict: 'near', offsetKHz: 18, contributors: ['Mic 2', 'Mic 7'] }),
    ).toBe('5th order · 18 kHz away · Mic 2 + Mic 7');
  });

  it('says clear when there is nothing to explain', () => {
    expect(explanationText(null)).toBe('Clear');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/im/__tests__/evaluate.test.ts`
Expected: FAIL — `Cannot find module '../evaluate'`.

- [ ] **Step 3: Implement `src/im/evaluate.ts`**

```ts
import { effectiveWindowKHz } from './analyze';
import { scanProducts } from './products';
import {
  EXCLUSION_CRITERION,
  SPACING_CRITERION,
  criterionKey,
  realizableCriteria,
  txBucket,
  verdictRank,
  worseVerdict,
  type CriterionKey,
  type Verdict,
} from './criteria';
import { isExcluded, type Carrier, type Settings } from './types';

export interface CandidateExplanation {
  order: number;
  verdict: Verdict;
  offsetKHz: number;
  /** Labels of carriers with a non-zero coefficient, excluding the mover. */
  contributors: string[];
}

export interface CandidateEvaluation {
  freqKHz: number;
  verdicts: Record<CriterionKey, Verdict>;
  /** The worst verdict across every criterion, spacing and exclusion included. */
  worst: Verdict;
  explanation: CandidateExplanation | null;
}

function ordinal(order: number): string {
  if (order === 1) return '1st';
  if (order === 2) return '2nd';
  if (order === 3) return '3rd';
  return `${order}th`;
}

export function explanationText(explanation: CandidateExplanation | null): string {
  if (explanation === null) return 'Clear';
  const parts = [`${ordinal(explanation.order)} order`];
  if (explanation.offsetKHz !== 0) parts.push(`${explanation.offsetKHz} kHz away`);
  if (explanation.contributors.length > 0) parts.push(explanation.contributors.join(' + '));
  return parts.join(' · ');
}

/**
 * Answers "what happens if carrier `index` moves to `candidateKHz`?".
 *
 * `full` resolves every criterion, which the Tune grid needs. `first-hit`
 * returns as soon as anything is non-clear, preserving the early abort
 * `suggest()` depends on; its unresolved criteria stay `clear`, so a
 * `first-hit` result must never be rendered as a grid row.
 *
 * Only products the moved carrier is party to count, and self-involving
 * products are ignored — see spec §4.3 and the note in `suggest.ts`. Judging a
 * candidate on the whole set's cleanliness rejects every candidate for every
 * carrier once two independent conflicts exist.
 */
export function evaluateCandidate(
  freqs: number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
  carriers: readonly Carrier[],
  mode: 'full' | 'first-hit' = 'full',
): CandidateEvaluation {
  const interference = realizableCriteria(settings);
  const verdicts: Record<CriterionKey, Verdict> = {};
  for (const key of interference) verdicts[key] = 'clear';

  let spacing: Verdict = 'clear';
  for (let i = 0; i < freqs.length; i += 1) {
    if (i === index) continue;
    if (Math.abs(freqs[i] - candidateKHz) < settings.minSpacingKHz) {
      spacing = 'exact';
      break;
    }
  }
  verdicts[SPACING_CRITERION] = spacing;
  verdicts[EXCLUSION_CRITERION] = isExcluded(candidateKHz, settings.exclusions)
    ? 'exact'
    : 'clear';

  const settle = (explanation: CandidateExplanation | null): CandidateEvaluation => {
    let worst: Verdict = 'clear';
    for (const key of Object.keys(verdicts)) worst = worseVerdict(worst, verdicts[key]);
    return { freqKHz: candidateKHz, verdicts, worst, explanation };
  };

  // Nothing the product scan could find would change the answer `suggest()`
  // is asking for, and the scan is by far the expensive part.
  if (
    mode === 'first-hit' &&
    (verdicts[SPACING_CRITERION] === 'exact' || verdicts[EXCLUSION_CRITERION] === 'exact')
  ) {
    return settle(null);
  }

  let best: CandidateExplanation | null = null;
  let exactCount = 0;

  const original = freqs[index];
  freqs[index] = candidateKHz;

  scanProducts(freqs, settings, (productKHz, coeffs, order) => {
    const key = criterionKey(txBucket(coeffs), order);
    // Already at the worst verdict: nothing this product could add changes the
    // criterion, and it cannot improve `explanation` either, because order is
    // fixed within a criterion and the offset is already zero.
    if (verdicts[key] === 'exact') return;

    const window = effectiveWindowKHz(order, settings);
    const moverContributes = coeffs[index] !== 0;

    for (let v = 0; v < freqs.length; v += 1) {
      if (coeffs[v] !== 0) continue;
      if (v !== index && !moverContributes) continue;

      const offset = Math.abs(freqs[v] - productKHz);
      if (offset > window) continue;

      const verdict: Verdict = offset === 0 ? 'exact' : 'near';
      const previous = verdicts[key];
      verdicts[key] = worseVerdict(previous, verdict);
      if (previous !== 'exact' && verdicts[key] === 'exact') exactCount += 1;

      const current = best;
      const better =
        current === null ||
        verdictRank(verdict) > verdictRank(current.verdict) ||
        (verdict === current.verdict && order < current.order) ||
        (verdict === current.verdict &&
          order === current.order &&
          offset < current.offsetKHz);

      if (better) {
        // Derived here rather than retained: `coeffs` is the single mutable
        // array `enumerateVectors` reuses across visitor calls.
        const contributors: string[] = [];
        for (let i = 0; i < freqs.length; i += 1) {
          if (i !== index && coeffs[i] !== 0) contributors.push(carriers[i].label);
        }
        best = { order, verdict, offsetKHz: offset, contributors };
      }

      if (mode === 'first-hit') return false;
    }

    if (exactCount >= interference.length) return false;
  });

  freqs[index] = original;
  return settle(best);
}
```

- [ ] **Step 4: Export the module**

Add `export * from './evaluate';` to `src/im/index.ts`, after `./criteria`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/im/__tests__/evaluate.test.ts`
Expected: PASS, all cases.

If `best` triggers a TypeScript "possibly null" or `never` complaint, do **not** reach for `!` — the `const current = best;` local exists precisely so the narrowing happens on a value TypeScript can track through the closure. Keep that shape.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run typecheck && npm run lint && npm run test`

```bash
git add src/im/evaluate.ts src/im/index.ts src/im/__tests__/evaluate.test.ts
git commit -m "feat: add the evaluateCandidate engine primitive"
```

---

### Task 5: Candidate range generation

Spec: §4.5.

**Files:**
- Create: `src/im/candidates.ts`
- Modify: `src/im/index.ts`
- Test: `src/im/__tests__/candidates.test.ts`

**Interfaces:**
- Consumes: `Settings` (Task 1).
- Produces:
  - `const DEFAULT_TUNE_HALF_WIDTH_KHZ = 2000`
  - `const MAX_TUNE_CANDIDATES = 500`
  - `generateCandidates(fromKHz: number, settings: Settings, halfWidthKHz?: number): number[]` — nearest-first generation order
  - `widenHalfWidth(halfWidthKHz: number, settings: Settings): number`

- [ ] **Step 1: Write the failing tests**

Create `src/im/__tests__/candidates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TUNE_HALF_WIDTH_KHZ,
  MAX_TUNE_CANDIDATES,
  generateCandidates,
  widenHalfWidth,
} from '../candidates';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const settings: Settings = { ...DEFAULT_SETTINGS };

describe('generateCandidates', () => {
  it('starts at the current frequency and alternates below then above', () => {
    expect(generateCandidates(600000, settings).slice(0, 5)).toEqual([
      600000, 599975, 600025, 599950, 600050,
    ]);
  });

  it('produces 161 candidates for the default window and step', () => {
    // 2000 kHz either side at 25 kHz, plus the current frequency.
    expect(generateCandidates(600000, settings)).toHaveLength(161);
  });

  it('never exceeds the half-width', () => {
    for (const f of generateCandidates(600000, settings)) {
      expect(Math.abs(f - 600000)).toBeLessThanOrEqual(DEFAULT_TUNE_HALF_WIDTH_KHZ);
    }
  });

  it('clips to the band without losing the other side', () => {
    const candidates = generateCandidates(500500, settings);
    expect(candidates.every((f) => f >= settings.bandMinKHz)).toBe(true);
    // 500.500 has only 500 kHz of room below but the full 2 MHz above.
    expect(candidates).toContain(502500);
    expect(candidates).not.toContain(499975);
  });

  it('omits the current frequency when it is outside the band', () => {
    expect(generateCandidates(499000, settings)).not.toContain(499000);
  });

  it('respects the candidate cap', () => {
    const wide = generateCandidates(600000, settings, 100000);
    expect(wide).toHaveLength(MAX_TUNE_CANDIDATES);
  });

  it('returns nothing when the step is not positive', () => {
    expect(generateCandidates(600000, { ...settings, suggestionStepKHz: 0 })).toEqual([]);
  });
});

describe('widenHalfWidth', () => {
  it('doubles the window', () => {
    expect(widenHalfWidth(2000, settings)).toBe(4000);
  });

  it('stops at the band width', () => {
    expect(widenHalfWidth(150000, settings)).toBe(200000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/im/__tests__/candidates.test.ts`
Expected: FAIL — `Cannot find module '../candidates'`.

- [ ] **Step 3: Implement `src/im/candidates.ts`**

```ts
import type { Settings } from './types';

/** Default distance either side of the current frequency, in kHz. */
export const DEFAULT_TUNE_HALF_WIDTH_KHZ = 2000;

/** Hard ceiling on rows the Tune view will evaluate and render. */
export const MAX_TUNE_CANDIDATES = 500;

/**
 * Frequencies to offer for a carrier, in *generation* order: the current
 * frequency first, then outward, alternating below and above.
 *
 * Generation order is nearest-first so that the cap keeps the closest options
 * rather than an arbitrary contiguous slice, and so `suggest()` — which wants
 * the nearest clear frequency, not a browsable list — can consume it directly.
 * The Tune grid sorts by ascending frequency for display (spec §4.5).
 */
export function generateCandidates(
  fromKHz: number,
  settings: Settings,
  halfWidthKHz: number = DEFAULT_TUNE_HALF_WIDTH_KHZ,
): number[] {
  const step = settings.suggestionStepKHz;
  const out: number[] = [];
  if (!Number.isFinite(step) || step <= 0) return out;

  const inBand = (f: number): boolean =>
    f >= settings.bandMinKHz && f <= settings.bandMaxKHz;

  if (inBand(fromKHz)) out.push(fromKHz);

  for (let k = 1; out.length < MAX_TUNE_CANDIDATES; k += 1) {
    const offset = Math.ceil(k / 2) * step;
    if (offset > halfWidthKHz) break;
    const candidate = k % 2 === 1 ? fromKHz - offset : fromKHz + offset;
    // `continue`, not `break`: one side can run out of band while the other
    // still has room.
    if (!inBand(candidate)) continue;
    out.push(candidate);
  }

  return out;
}

export function widenHalfWidth(halfWidthKHz: number, settings: Settings): number {
  const bandWidth = settings.bandMaxKHz - settings.bandMinKHz;
  return Math.min(halfWidthKHz * 2, bandWidth);
}
```

- [ ] **Step 4: Export the module**

Add `export * from './candidates';` to `src/im/index.ts`, after `./evaluate`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/im/candidates.ts src/im/index.ts src/im/__tests__/candidates.test.ts
git commit -m "feat: add nearest-first candidate range generation"
```

---

### Task 6: Rebuild `suggest()` on the primitive, honouring locks and exclusions

Spec: §4.4, §6.

**Files:**
- Modify: `src/im/suggest.ts`
- Test: `src/im/__tests__/suggest.test.ts`

**Interfaces:**
- Consumes: `evaluateCandidate` (Task 4), `Carrier.locked` and `Settings.exclusions` (Task 1).
- Produces: `suggest(carriers, settings, onProgress?)` unchanged in signature and in `Suggestion` shape. `MAX_CANDIDATES` stays exported at 2000. The private helpers `isCandidateClean` and `respectsSpacing` are **deleted** — their logic now lives in `evaluateCandidate`.

- [ ] **Step 1: Write the failing tests**

Append to `src/im/__tests__/suggest.test.ts`:

```ts
describe('locking', () => {
  it('never proposes a new frequency for a locked carrier', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      { ...carrier('c', 509), locked: true },
    ];
    for (const s of suggest(carriers, settings)) {
      if (s.carrierId !== 'c') continue;
      expect(s.toKHz).toBeNull();
      expect(s.failureReason).toContain('locked');
    }
  });

  it('treats a locked carrier as fixed context when solving the others', () => {
    const carriers = [
      { ...carrier('a', 510), locked: true },
      carrier('b', 511),
      carrier('c', 509),
    ];
    const suggestions = suggest(carriers, settings);
    // a stays put; b and c are moved around it.
    const a = suggestions.find((s) => s.carrierId === 'a');
    if (a !== undefined) expect(a.toKHz).toBeNull();
    const applied = carriers.map((c) => {
      const s = suggestions.find((x) => x.carrierId === c.id);
      return s && s.toKHz !== null ? { ...c, freqKHz: s.toKHz } : c;
    });
    expect(applied.find((c) => c.id === 'a')?.freqKHz).toBe(510000);
  });

  it('explains itself when every conflicted carrier is locked', () => {
    const carriers = [
      { ...carrier('a', 510), locked: true },
      { ...carrier('b', 511), locked: true },
      { ...carrier('c', 509), locked: true },
    ];
    const suggestions = suggest(carriers, settings);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.toKHz === null)).toBe(true);
    expect(suggestions.every((s) => (s.failureReason ?? '').includes('locked'))).toBe(true);
  });
});

describe('exclusions', () => {
  it('never proposes a frequency inside an excluded range', () => {
    const excluded: Settings = {
      ...settings,
      exclusions: [{ id: 'x', label: 'DTV', startKHz: 508000, endKHz: 510500 }],
    };
    const carriers = [carrier('a', 510), carrier('b', 511), carrier('c', 509)];
    for (const s of suggest(carriers, excluded)) {
      if (s.toKHz === null) continue;
      expect(s.toKHz >= 508000 && s.toKHz <= 510500).toBe(false);
    }
  });
});
```

Also update the `carrier()` helper at the top of that file so it produces `locked: false` (Task 1 already required this; confirm it is there).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/im/__tests__/suggest.test.ts`
Expected: FAIL — locked carriers are still retuned and excluded ranges are still proposed.

- [ ] **Step 3: Rewrite `src/im/suggest.ts`**

Replace the whole file with:

```ts
import { analyze } from './analyze';
import { evaluateCandidate } from './evaluate';
import type { Carrier, Settings, Suggestion } from './types';

export const MAX_CANDIDATES = 2000;

const LOCKED_REASON =
  'This frequency is locked, so it was left where it is. Unlock it to let the tool retune it, or move one of the other transmitters instead.';

export function suggest(
  carriers: readonly Carrier[],
  settings: Settings,
  onProgress?: (fraction: number) => void,
): Suggestion[] {
  const baseline = analyze(carriers, settings);
  if (baseline.conflictedIds.length === 0) {
    onProgress?.(1);
    return [];
  }

  const working = carriers.map((c) => c.freqKHz);
  const indexById = new Map(carriers.map((c, i) => [c.id, i]));
  const suggestions: Suggestion[] = [];
  const total = baseline.conflictedIds.length;

  baseline.conflictedIds.forEach((carrierId, position) => {
    const index = indexById.get(carrierId);
    if (index === undefined) return;

    const fromKHz = working[index];

    // A locked carrier still counts as context for everyone else, but nothing
    // may retune it. Reporting it explicitly matters: an empty result here
    // would read as "nothing to fix" for a set that is demonstrably broken.
    if (carriers[index].locked) {
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: null,
        distanceKHz: null,
        failureReason: LOCKED_REASON,
      });
      onProgress?.((position + 1) / total);
      return;
    }

    const step = settings.suggestionStepKHz;
    let found: number | null = null;
    let examined = 0;

    for (let k = 1; k <= MAX_CANDIDATES && found === null; k += 1) {
      const offset = Math.ceil(k / 2) * step;
      const candidate = k % 2 === 1 ? fromKHz - offset : fromKHz + offset;
      examined += 1;

      if (candidate < settings.bandMinKHz || candidate > settings.bandMaxKHz) {
        continue;
      }

      // `first-hit` keeps v1's early abort: this caller only asks "is it
      // completely clean?", so resolving every criterion would be wasted work.
      const evaluation = evaluateCandidate(
        working,
        index,
        candidate,
        settings,
        carriers,
        'first-hit',
      );
      if (evaluation.worst !== 'clear') continue;

      found = candidate;
    }

    if (found === null) {
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: null,
        distanceKHz: null,
        failureReason: `No interference-free frequency was found within ${examined} candidates. Widen the band, lower the highest order, reduce the number of transmitters, or remove an exclusion.`,
      });
    } else {
      working[index] = found;
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: found,
        distanceKHz: Math.abs(found - fromKHz),
      });
    }

    onProgress?.((position + 1) / total);
  });

  onProgress?.(1);
  return suggestions;
}
```

Note the "only the mover counts" reasoning that used to live in this file's `isCandidateClean` doc comment now lives on `evaluateCandidate`. Do not lose it.

- [ ] **Step 4: Run the whole suite — this is the parity check**

Run: `npm run test`
Expected: PASS, including the pre-existing v1 assertions `b → 510950` / `c → 508975`, the two-cluster test, and "produces a set that is clean once every suggestion is applied". Those are the parity tests required by spec §7.9; if any of them changed behaviour, the refactor is wrong — fix `evaluateCandidate`, do not edit the expectations.

- [ ] **Step 5: Run the gate and commit**

Run: `npm run typecheck && npm run lint && npm run test`

```bash
git add src/im/suggest.ts src/im/__tests__/suggest.test.ts
git commit -m "refactor: rebuild suggest() on evaluateCandidate with locking and exclusions"
```

---

### Task 7: Worker protocol — the `tune` request

Spec: §4.6.

**Files:**
- Modify: `src/worker/protocol.ts`
- Modify: `src/worker/analysis.worker.ts`
- Modify: `src/worker/client.ts`

**Interfaces:**
- Consumes: `generateCandidates` (Task 5), `evaluateCandidate` / `CandidateEvaluation` (Task 4), `realizableCriteria` / `CriterionKey` (Task 3).
- Produces:
  - `TuneRequest { type: 'tune'; runId: number; carriers: Carrier[]; settings: Settings; carrierId: string; halfWidthKHz: number }`
  - `TuneDoneResponse { type: 'tune-done'; runId: number; carrierId: string; currentKHz: number; criteria: CriterionKey[]; evaluations: CandidateEvaluation[] }`
  - `WorkerProgress.phase: 'analyze' | 'suggest' | 'tune'`
  - `interface WorkerTuneResult { carrierId: string; currentKHz: number; criteria: CriterionKey[]; evaluations: CandidateEvaluation[] }`
  - `AnalysisClient.tune(carriers, settings, carrierId, halfWidthKHz, onProgress): Promise<WorkerTuneResult>`

There is no unit test for this task: the worker is only meaningful in a browser and the codebase has no worker test harness. It is verified end-to-end in Task 12. Keep the task small and lean on typecheck.

- [ ] **Step 1: Extend the protocol**

In `src/worker/protocol.ts`, add the imports `CandidateEvaluation` and `CriterionKey` from `'../im'`, then:

```ts
export interface TuneRequest {
  type: 'tune';
  runId: number;
  carriers: Carrier[];
  settings: Settings;
  carrierId: string;
  halfWidthKHz: number;
}

export type WorkerRequest = RunRequest | TuneRequest;

export interface TuneDoneResponse {
  type: 'tune-done';
  runId: number;
  carrierId: string;
  currentKHz: number;
  /** Interference criteria worth a column, already filtered and ordered. */
  criteria: CriterionKey[];
  /** Sorted by ascending frequency, ready to render. */
  evaluations: CandidateEvaluation[];
}
```

Change `ProgressResponse.phase` to `'analyze' | 'suggest' | 'tune'` and add `TuneDoneResponse` to the `WorkerResponse` union.

- [ ] **Step 2: Handle `tune` in the worker**

Rewrite `src/worker/analysis.worker.ts`:

```ts
import {
  analyze,
  evaluateCandidate,
  generateCandidates,
  realizableCriteria,
  suggest,
  validate,
} from '../im';
import type { RunRequest, TuneRequest, WorkerRequest, WorkerResponse } from './protocol';

const TUNE_PROGRESS_INTERVAL = 8;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function handleRun(request: RunRequest): void {
  const { runId, carriers, settings } = request;
  const issues = validate(carriers, settings);
  if (issues.length > 0) {
    post({ type: 'invalid', runId, issues });
    return;
  }

  const result = analyze(carriers, settings, (fraction) => {
    post({ type: 'progress', runId, phase: 'analyze', fraction });
  });

  const suggestions = suggest(carriers, settings, (fraction) => {
    post({ type: 'progress', runId, phase: 'suggest', fraction });
  });

  post({ type: 'done', runId, result, suggestions });
}

function handleTune(request: TuneRequest): void {
  const { runId, carriers, settings, carrierId, halfWidthKHz } = request;
  const issues = validate(carriers, settings);
  if (issues.length > 0) {
    post({ type: 'invalid', runId, issues });
    return;
  }

  const index = carriers.findIndex((c) => c.id === carrierId);
  if (index === -1) {
    post({ type: 'error', runId, message: 'That transmitter is no longer in the list.' });
    return;
  }

  const freqs = carriers.map((c) => c.freqKHz);
  const currentKHz = freqs[index];
  const candidates = generateCandidates(currentKHz, settings, halfWidthKHz);

  const evaluations = candidates.map((candidateKHz, i) => {
    const evaluation = evaluateCandidate(
      freqs,
      index,
      candidateKHz,
      settings,
      carriers,
      'full',
    );
    if ((i + 1) % TUNE_PROGRESS_INTERVAL === 0) {
      post({
        type: 'progress',
        runId,
        phase: 'tune',
        fraction: (i + 1) / candidates.length,
      });
    }
    return evaluation;
  });

  // Generation is nearest-first; display is ascending by frequency (spec §4.5).
  evaluations.sort((a, b) => a.freqKHz - b.freqKHz);

  // An always-clear column is noise, so only criteria something actually fell
  // into get a column (spec §4.1). Computed here, once, so the column set does
  // not shift as the user scrolls.
  const criteria = realizableCriteria(settings).filter((key) =>
    evaluations.some((e) => e.verdicts[key] !== 'clear'),
  );

  post({ type: 'tune-done', runId, carrierId, currentKHz, criteria, evaluations });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'run') handleRun(request);
    else if (request.type === 'tune') handleTune(request);
  } catch (error) {
    post({
      type: 'error',
      runId: request.runId,
      message: error instanceof Error ? error.message : 'Analysis failed.',
    });
  }
};
```

- [ ] **Step 3: Add `tune()` to the client**

Rewrite the body of `AnalysisClient` in `src/worker/client.ts` so `run()` and `tune()` share one lifecycle. Everything above the class stays; add the `'tune'` phase to `WorkerProgress` and the new result type:

```ts
export interface WorkerProgress {
  phase: 'analyze' | 'suggest' | 'tune';
  fraction: number;
}

export interface WorkerTuneResult {
  carrierId: string;
  currentKHz: number;
  criteria: CriterionKey[];
  evaluations: CandidateEvaluation[];
}
```

Import `CandidateEvaluation` and `CriterionKey` from `'../im'`. Then:

```ts
export class AnalysisClient {
  private worker: Worker | null = null;
  private nextRunId = 1;
  private rejectActive: ((reason: Error) => void) | null = null;

  private execute<T>(
    build: (runId: number) => WorkerRequest,
    onProgress: (progress: WorkerProgress) => void,
    extract: (message: WorkerResponse) => T | undefined,
  ): Promise<T> {
    this.cancel();

    const worker = createWorker();
    this.worker = worker;
    const runId = this.nextRunId;
    this.nextRunId += 1;

    return new Promise<T>((resolve, reject) => {
      this.rejectActive = reject;

      // Called on every settling path so a terminated worker can never deliver
      // a late progress tick to a caller that has already moved on.
      const finish = () => {
        detach(worker);
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        this.rejectActive = null;
      };

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.runId !== runId) return;

        if (message.type === 'progress') {
          onProgress({ phase: message.phase, fraction: message.fraction });
          return;
        }
        if (message.type === 'invalid') {
          finish();
          reject(new AnalysisInvalidError(message.issues));
          return;
        }
        if (message.type === 'error') {
          finish();
          reject(new Error(message.message));
          return;
        }

        const value = extract(message);
        if (value === undefined) return;
        finish();
        resolve(value);
      };

      worker.onerror = () => {
        finish();
        reject(new Error('The analysis worker failed to start.'));
      };

      worker.onmessageerror = () => {
        finish();
        reject(new Error('The analysis worker sent a message that could not be read.'));
      };

      worker.postMessage(build(runId));
    });
  }

  run(
    carriers: Carrier[],
    settings: Settings,
    onProgress: (progress: WorkerProgress) => void,
  ): Promise<WorkerRunResult> {
    return this.execute<WorkerRunResult>(
      (runId) => ({ type: 'run', runId, carriers, settings }),
      onProgress,
      (message) =>
        message.type === 'done'
          ? { result: message.result, suggestions: message.suggestions }
          : undefined,
    );
  }

  tune(
    carriers: Carrier[],
    settings: Settings,
    carrierId: string,
    halfWidthKHz: number,
    onProgress: (progress: WorkerProgress) => void,
  ): Promise<WorkerTuneResult> {
    return this.execute<WorkerTuneResult>(
      (runId) => ({ type: 'tune', runId, carriers, settings, carrierId, halfWidthKHz }),
      onProgress,
      (message) =>
        message.type === 'tune-done'
          ? {
              carrierId: message.carrierId,
              currentKHz: message.currentKHz,
              criteria: message.criteria,
              evaluations: message.evaluations,
            }
          : undefined,
    );
  }

  cancel(): void {
    if (this.worker === null) return;
    detach(this.worker);
    this.worker.terminate();
    this.worker = null;
    this.rejectActive?.(new AnalysisCancelledError());
    this.rejectActive = null;
  }
}
```

Add `WorkerRequest` to the type import from `'./protocol'`.

- [ ] **Step 4: Verify the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS. The build must succeed — a mistyped worker URL only fails at bundle time.

- [ ] **Step 5: Commit**

```bash
git add src/worker
git commit -m "feat: add a tune request to the analysis worker"
```

---

### Task 8: Tune and view state

Spec: §4.5, §4.6, §5.1.

**Files:**
- Create: `src/state/tuneStore.ts`
- Create: `src/state/viewStore.ts`
- Modify: `src/state/projectStore.ts`

**Interfaces:**
- Consumes: `AnalysisClient.tune` / `WorkerTuneResult` (Task 7), `DEFAULT_TUNE_HALF_WIDTH_KHZ` / `widenHalfWidth` (Task 5), `Exclusion` (Task 1).
- Produces:
  - `useViewStore` with `view: 'setup' | 'results' | 'tune'`, `goTo(view)`, `openTune(carrierId)`
  - `useTuneStore` with `carrierId`, `halfWidthKHz`, `status`, `progress`, `currentKHz`, `criteria`, `evaluations`, `issues`, `errorMessage`, `select(carrierId)`, `run(carriers, settings)`, `widen(carriers, settings)`, `clear()`
  - `useProjectStore` gains `addExclusion()`, `updateExclusion(id, patch)`, `removeExclusion(id)`

- [ ] **Step 1: Create `src/state/tuneStore.ts`**

```ts
import { create } from 'zustand';
import {
  DEFAULT_TUNE_HALF_WIDTH_KHZ,
  widenHalfWidth,
  type CandidateEvaluation,
  type Carrier,
  type CriterionKey,
  type Settings,
  type ValidationIssue,
} from '../im';
import {
  AnalysisCancelledError,
  AnalysisClient,
  AnalysisInvalidError,
} from '../worker/client';

// A dedicated client, not the analysis store's: `AnalysisClient` allows one
// in-flight request, so sharing it would make opening the Tune view cancel a
// running analysis and vice versa.
const client = new AnalysisClient();

type Status = 'idle' | 'running' | 'done' | 'error';

interface TuneState {
  carrierId: string | null;
  halfWidthKHz: number;
  status: Status;
  fraction: number;
  currentKHz: number | null;
  criteria: CriterionKey[];
  evaluations: CandidateEvaluation[];
  issues: ValidationIssue[];
  errorMessage: string | null;
  select: (carrierId: string) => void;
  run: (carriers: Carrier[], settings: Settings) => Promise<void>;
  widen: (carriers: Carrier[], settings: Settings) => Promise<void>;
  clear: () => void;
  reset: () => void;
}

// Same hazard as the analysis store: `client.tune()` cancels the previous
// request synchronously but its rejection lands as a microtask, after the newer
// call has already set `status: 'running'`. The token lets a superseded call
// recognise itself and leave shared state alone.
let runToken = 0;

const EMPTY = {
  status: 'idle' as Status,
  fraction: 0,
  currentKHz: null,
  criteria: [] as CriterionKey[],
  evaluations: [] as CandidateEvaluation[],
  issues: [] as ValidationIssue[],
  errorMessage: null,
};

export const useTuneStore = create<TuneState>((set, get) => ({
  carrierId: null,
  halfWidthKHz: DEFAULT_TUNE_HALF_WIDTH_KHZ,
  ...EMPTY,

  select: (carrierId) => {
    runToken += 1;
    client.cancel();
    set({ carrierId, halfWidthKHz: DEFAULT_TUNE_HALF_WIDTH_KHZ, ...EMPTY });
  },

  run: async (carriers, settings) => {
    const carrierId = get().carrierId;
    if (carrierId === null) return;
    const halfWidthKHz = get().halfWidthKHz;
    const token = (runToken += 1);

    set({ ...EMPTY, status: 'running' });

    try {
      const result = await client.tune(
        carriers,
        settings,
        carrierId,
        halfWidthKHz,
        ({ fraction }) => {
          if (token !== runToken) return;
          set({ fraction });
        },
      );
      if (token !== runToken) return;
      set({
        status: 'done',
        fraction: 1,
        currentKHz: result.currentKHz,
        criteria: result.criteria,
        evaluations: result.evaluations,
      });
    } catch (error) {
      if (token !== runToken) return;
      if (error instanceof AnalysisCancelledError) {
        set({ status: 'idle', fraction: 0 });
        return;
      }
      if (error instanceof AnalysisInvalidError) {
        set({
          status: 'error',
          issues: error.issues,
          errorMessage: 'Fix the highlighted problems before tuning.',
        });
        return;
      }
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Tuning failed.',
      });
    }
  },

  widen: async (carriers, settings) => {
    set({ halfWidthKHz: widenHalfWidth(get().halfWidthKHz, settings) });
    await get().run(carriers, settings);
  },

  // Results describe the frequencies they were computed from. Any edit
  // invalidates them, but the carrier being tuned stays selected so the view
  // can immediately recompute rather than dumping the user back to an
  // empty screen.
  clear: () => {
    runToken += 1;
    client.cancel();
    set({ ...EMPTY });
  },

  reset: () => {
    runToken += 1;
    client.cancel();
    set({ carrierId: null, halfWidthKHz: DEFAULT_TUNE_HALF_WIDTH_KHZ, ...EMPTY });
  },
}));
```

- [ ] **Step 2: Create `src/state/viewStore.ts`**

```ts
import { create } from 'zustand';
import { useTuneStore } from './tuneStore';

export type ViewName = 'setup' | 'results' | 'tune';

interface ViewState {
  view: ViewName;
  goTo: (view: ViewName) => void;
  openTune: (carrierId: string) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'setup',
  goTo: (view) => set({ view }),
  openTune: (carrierId) => {
    useTuneStore.getState().select(carrierId);
    set({ view: 'tune' });
  },
}));
```

- [ ] **Step 3: Wire the project store**

In `src/state/projectStore.ts`:

Import `useTuneStore` from `./tuneStore` and `type Exclusion` from `../im`. In `update()`, invalidate the Tune results alongside the analysis:

```ts
  const update = (partial: Partial<ProjectState>): void => {
    set(partial);
    persist();
    useAnalysisStore.getState().clear();
    useTuneStore.getState().clear();
  };
```

Add the exclusion actions to the interface and the returned object:

```ts
    addExclusion: () => {
      const { settings } = get();
      const middle = Math.round((settings.bandMinKHz + settings.bandMaxKHz) / 2);
      update({
        settings: {
          ...settings,
          exclusions: [
            ...settings.exclusions,
            {
              id: newId(),
              label: `Excluded range ${settings.exclusions.length + 1}`,
              startKHz: middle,
              endKHz: middle + 1000,
            },
          ],
        },
      });
    },

    updateExclusion: (id, patch) => {
      const { settings } = get();
      update({
        settings: {
          ...settings,
          exclusions: settings.exclusions.map((e) =>
            e.id === id ? normalizeExclusion({ ...e, ...patch }) : e,
          ),
        },
      });
    },

    removeExclusion: (id) => {
      const { settings } = get();
      update({
        settings: {
          ...settings,
          exclusions: settings.exclusions.filter((e) => e.id !== id),
        },
      });
    },
```

Declare them on `ProjectState`:

```ts
  addExclusion: () => void;
  updateExclusion: (id: string, patch: Partial<Omit<Exclusion, 'id'>>) => void;
  removeExclusion: (id: string) => void;
```

Import `normalizeExclusion` from `../im`.

- [ ] **Step 4: Verify the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS. If TypeScript reports a circular import between `projectStore` and `tuneStore`, check the direction — `tuneStore` must not import `projectStore`.

- [ ] **Step 5: Commit**

```bash
git add src/state
git commit -m "feat: add tune and view state stores"
```

---

### Task 9: Setup UI — lock toggle and exclusions editor

Spec: §5.4.

**Files:**
- Create: `src/ui/ExclusionEditor.tsx`
- Modify: `src/ui/FrequencyTable.tsx`
- Modify: `src/ui/SettingsPanel.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `addExclusion` / `updateExclusion` / `removeExclusion` (Task 8), `useViewStore.openTune` (Task 8), `Carrier.locked` (Task 1), `MHzInput` (existing).
- Produces: `<ExclusionEditor />`.

- [ ] **Step 1: Add the lock column and Tune button to `FrequencyTable`**

Add `Lock` as a header between `Frequency (MHz)` and `Status`, and add the two controls per row. Import `useViewStore` from `../state/viewStore`, and read `const openTune = useViewStore((s) => s.openTune);`.

New cell after the frequency cell:

```tsx
              <td>
                <label className="lock">
                  <input
                    type="checkbox"
                    checked={carrier.locked}
                    onChange={(e) =>
                      updateCarrier(carrier.id, { locked: e.target.checked })
                    }
                    aria-label={`Lock the frequency of ${carrier.label}`}
                  />
                  <span aria-hidden="true">{carrier.locked ? '🔒' : '🔓'}</span>
                </label>
              </td>
```

The emoji is `aria-hidden` because the checkbox already carries the accessible name and state; announcing both would be redundant.

Add a Tune button in the existing actions cell, before Remove:

```tsx
                <button type="button" onClick={() => openTune(carrier.id)}>
                  Tune
                </button>
```

Update the mobile media query in `src/index.css` so the extra column does not overflow — the existing rule hides the first column; leave it as is and add:

```css
.lock { display: inline-flex; align-items: center; gap: 0.25rem; margin: 0; }
```

- [ ] **Step 2: Create `src/ui/ExclusionEditor.tsx`**

```tsx
import { kHzToMHzText } from '../im';
import { useProjectStore } from '../state/projectStore';
import { MHzInput } from './MHzInput';

export function ExclusionEditor() {
  const settings = useProjectStore((s) => s.settings);
  const addExclusion = useProjectStore((s) => s.addExclusion);
  const updateExclusion = useProjectStore((s) => s.updateExclusion);
  const removeExclusion = useProjectStore((s) => s.removeExclusion);

  return (
    <div className="exclusions">
      <h3>Excluded ranges</h3>
      <p className="hint">
        Frequencies inside these ranges are never offered — use them for local
        TV broadcast, in-ear monitors, intercom, or any block you must keep
        clear. Interference products landing inside an excluded range are
        ignored, because nothing of yours is listening there.
      </p>

      {settings.exclusions.length === 0 ? (
        <p className="hint">No excluded ranges. The whole band is available.</p>
      ) : (
        <table className="freq-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>From (MHz)</th>
              <th>To (MHz)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {settings.exclusions.map((exclusion) => (
              <tr key={exclusion.id}>
                <td>
                  <input
                    aria-label={`Label for excluded range ${exclusion.label}`}
                    value={exclusion.label}
                    onChange={(e) =>
                      updateExclusion(exclusion.id, { label: e.target.value })
                    }
                  />
                </td>
                <td>
                  <MHzInput
                    label={`Start of ${exclusion.label} in megahertz`}
                    valueKHz={exclusion.startKHz}
                    onCommit={(startKHz) => updateExclusion(exclusion.id, { startKHz })}
                  />
                </td>
                <td>
                  <MHzInput
                    label={`End of ${exclusion.label} in megahertz`}
                    valueKHz={exclusion.endKHz}
                    onCommit={(endKHz) => updateExclusion(exclusion.id, { endKHz })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => removeExclusion(exclusion.id)}
                    aria-label={`Remove excluded range ${exclusion.label}`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button type="button" onClick={addExclusion}>
        Add excluded range
      </button>
      <p className="hint">
        Band: {kHzToMHzText(settings.bandMinKHz)}–{kHzToMHzText(settings.bandMaxKHz)} MHz.
      </p>
    </div>
  );
}
```

Entering a reversed range is normalised by `updateExclusion` (Task 8 calls `normalizeExclusion`), so a user who types the end first is not punished for it.

- [ ] **Step 3: Render it from `SettingsPanel`**

Import `ExclusionEditor` in `src/ui/SettingsPanel.tsx` and place `<ExclusionEditor />` immediately before the "Reset to defaults" button.

- [ ] **Step 4: Verify manually and run the gate**

Run: `npm run dev`, open http://localhost:5173/, then:
- toggle a lock and confirm the icon changes and the previous analysis result is cleared,
- add an excluded range covering one of your carriers and confirm a validation warning appears after pressing Analyse,
- reload the page and confirm both the lock and the range survive (this exercises the Task 1 persistence path).

Stop the server (`lsof -ti :5173` then `kill <pid>` with the literal number).

Run: `npm run typecheck && npm run lint && npm run test`

- [ ] **Step 5: Commit**

```bash
git add src/ui/ExclusionEditor.tsx src/ui/FrequencyTable.tsx src/ui/SettingsPanel.tsx src/index.css
git commit -m "feat: add lock toggles and an excluded range editor"
```

---

### Task 10: Navigation and the Tune view shell

Spec: §5.1, §5.2 (context strip and carrier selector).

**Files:**
- Create: `src/ui/ContextStrip.tsx`
- Create: `src/ui/TuneView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `useViewStore` and `useTuneStore` (Task 8), `kHzToMHzText` (existing).
- Produces: `<ContextStrip />`, `<TuneView />`. `TuneView` renders `<CandidateGrid />` in Task 11; for this task it renders a placeholder line reporting how many candidates were evaluated, which Task 11 replaces.

- [ ] **Step 1: Create `src/ui/ContextStrip.tsx`**

```tsx
import { kHzToMHzText } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';

/**
 * Every carrier at a glance while one is being tuned. Without it the Tune view
 * would show a single frequency in isolation, which is exactly the whole-set
 * awareness the user needs while choosing.
 */
export function ContextStrip() {
  const carriers = useProjectStore((s) => s.carriers);
  const result = useAnalysisStore((s) => s.result);
  const selectedId = useTuneStore((s) => s.carrierId);
  const select = useTuneStore((s) => s.select);

  const conflicted = new Set(result?.conflictedIds ?? []);

  return (
    <ul className="context-strip">
      {carriers.map((carrier) => {
        const isSelected = carrier.id === selectedId;
        const state = conflicted.has(carrier.id)
          ? 'conflict'
          : result
            ? 'clear'
            : 'unknown';
        return (
          <li key={carrier.id}>
            <button
              type="button"
              className={`context-chip context-chip--${state}${
                isSelected ? ' context-chip--selected' : ''
              }`}
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => select(carrier.id)}
            >
              <span className="context-chip__label">{carrier.label}</span>
              <span className="context-chip__freq">{kHzToMHzText(carrier.freqKHz)}</span>
              <span className="context-chip__state">
                {carrier.locked ? 'locked, ' : ''}
                {state === 'conflict' ? 'conflict' : state === 'clear' ? 'clear' : 'not analysed'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Create `src/ui/TuneView.tsx`**

```tsx
import { useEffect } from 'react';
import { kHzToMHzText } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';
import { ContextStrip } from './ContextStrip';

export function TuneView() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);

  const carrierId = useTuneStore((s) => s.carrierId);
  const halfWidthKHz = useTuneStore((s) => s.halfWidthKHz);
  const status = useTuneStore((s) => s.status);
  const fraction = useTuneStore((s) => s.fraction);
  const evaluations = useTuneStore((s) => s.evaluations);
  const issues = useTuneStore((s) => s.issues);
  const errorMessage = useTuneStore((s) => s.errorMessage);
  const select = useTuneStore((s) => s.select);
  const run = useTuneStore((s) => s.run);
  const widen = useTuneStore((s) => s.widen);

  const carrier = carriers.find((c) => c.id === carrierId) ?? null;

  // Re-evaluate whenever there is a selection but no results — which is the
  // state `select()` leaves behind, and the one `projectStore.update()` leaves
  // behind after a frequency is applied. One effect covers both.
  useEffect(() => {
    if (carrierId === null) return;
    if (status !== 'idle') return;
    void run(carriers, settings);
  }, [carrierId, status, carriers, settings, run]);

  if (carriers.length === 0) {
    return (
      <section className="panel">
        <h2>Tune</h2>
        <p className="hint">Add some frequencies first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Tune</h2>
      <ContextStrip />

      {carrier === null ? (
        <p className="hint">Pick a transmitter above to see the frequencies available to it.</p>
      ) : (
        <>
          <p>
            Tuning <strong>{carrier.label}</strong>, currently{' '}
            <strong>{kHzToMHzText(carrier.freqKHz)} MHz</strong>. Showing ±
            {kHzToMHzText(halfWidthKHz)} MHz.
          </p>

          {carrier.locked && (
            <p className="hint">
              This transmitter is locked, so choosing a frequency here will not
              change it.{' '}
              <button
                type="button"
                onClick={() => updateCarrier(carrier.id, { locked: false })}
              >
                Unlock
              </button>
            </p>
          )}

          {status === 'running' && (
            <p>Evaluating candidates… {Math.round(fraction * 100)}%</p>
          )}

          {errorMessage !== null && <p className="error">{errorMessage}</p>}
          {issues.length > 0 && (
            <ul className="error">
              {issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}

          {status === 'done' && (
            <>
              {/* Replaced by <CandidateGrid /> in the next task. */}
              <p>{evaluations.length} candidates evaluated.</p>
              <button
                type="button"
                onClick={() => void widen(carriers, settings)}
                disabled={halfWidthKHz >= settings.bandMaxKHz - settings.bandMinKHz}
              >
                Widen search
              </button>
            </>
          )}
        </>
      )}

      <p className="hint">
        <button type="button" onClick={() => select(carriers[0].id)}>
          Tune the first transmitter
        </button>
      </p>
    </section>
  );
}
```

Remove that last "Tune the first transmitter" paragraph once Task 11 lands — it exists only so this task is independently exercisable before the grid arrives. It is listed again in Task 11 Step 4 so it cannot be forgotten.

- [ ] **Step 3: Add navigation to `src/App.tsx`**

Replace the flat body with three views. Keep every existing component and the footer exactly as they are:

```tsx
import { FrequencyTable } from './ui/FrequencyTable';
import { SettingsPanel } from './ui/SettingsPanel';
import { ResultsSummary } from './ui/ResultsSummary';
import { ConflictList } from './ui/ConflictList';
import { SpectrumStrip } from './ui/SpectrumStrip';
import { SuggestionPanel } from './ui/SuggestionPanel';
import { ProjectBar } from './ui/ProjectBar';
import { TuneView } from './ui/TuneView';
import { useProjectStore } from './state/projectStore';
import { useAnalysisStore } from './state/analysisStore';
import { useViewStore, type ViewName } from './state/viewStore';

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'results', label: 'Results' },
  { id: 'tune', label: 'Tune' },
];

export default function App() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const errorMessage = useAnalysisStore((s) => s.errorMessage);
  const issues = useAnalysisStore((s) => s.issues);
  const run = useAnalysisStore((s) => s.run);
  const cancel = useAnalysisStore((s) => s.cancel);
  const view = useViewStore((s) => s.view);
  const goTo = useViewStore((s) => s.goTo);

  return (
    <main className="app">
      <h1>Intermodulation Checker</h1>
      <ProjectBar />

      <nav className="views" aria-label="Sections">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={view === v.id ? 'view-tab view-tab--active' : 'view-tab'}
            aria-current={view === v.id ? 'page' : undefined}
            onClick={() => goTo(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <section className="panel">
        <button
          type="button"
          onClick={() => {
            void run(carriers, settings);
            goTo('results');
          }}
          disabled={status === 'running'}
        >
          Analyse
        </button>
        {status === 'running' && (
          <>
            <span>
              {progress?.phase === 'suggest' ? 'Finding alternatives' : 'Analysing'}{' '}
              {Math.round((progress?.fraction ?? 0) * 100)}%
            </span>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </>
        )}
        {errorMessage !== null && <p className="error">{errorMessage}</p>}
        {issues.length > 0 && (
          <ul className="error">
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        )}
      </section>

      {view === 'setup' && (
        <>
          <FrequencyTable />
          <SettingsPanel />
        </>
      )}

      {view === 'results' && (
        <>
          <ResultsSummary />
          <SuggestionPanel />
          <SpectrumStrip />
          <ConflictList />
        </>
      )}

      {view === 'tune' && <TuneView />}

      <footer className="panel hint">
        <p>
          This tool models intermodulation products arithmetically from the
          frequencies you enter. It does not know your transmitter power,
          antenna placement, receiver filtering, or any signal that is not in
          your list, and it does not check licensing or broadcast allocations.
          Treat its output as a planning aid, not a guarantee — always verify on
          site before a performance.
        </p>
      </footer>
    </main>
  );
}
```

The Analyse button stays outside the view switch: it is the app's primary action and hiding it behind a tab would make the Results view show stale-looking emptiness with no way to fill it.

- [ ] **Step 4: Add the styles**

Append to `src/index.css`:

```css
.views { display: flex; gap: 0.25rem; margin-bottom: 1rem; }
.view-tab { border: 1px solid #8884; border-radius: 4px; padding: 0.35rem 0.9rem; background: transparent; }
.view-tab--active { background: #8882; font-weight: 600; }
.context-strip { display: flex; flex-wrap: wrap; gap: 0.4rem; list-style: none; padding: 0; margin: 0 0 1rem; }
.context-chip { display: flex; flex-direction: column; align-items: flex-start; gap: 0.05rem; border: 1px solid #8884; border-left-width: 4px; border-radius: 4px; padding: 0.3rem 0.6rem; background: transparent; text-align: left; margin: 0; }
.context-chip--clear { border-left-color: #2a842a; }
.context-chip--conflict { border-left-color: #d33; }
.context-chip--unknown { border-left-color: #888; }
.context-chip--selected { background: #8882; outline: 2px solid #6684; }
.context-chip__label { font-weight: 600; }
.context-chip__freq { font-variant-numeric: tabular-nums; }
.context-chip__state { font-size: 0.75rem; color: #888; }
```

- [ ] **Step 5: Verify manually and run the gate**

Run: `npm run dev`, open http://localhost:5173/, press Analyse, switch to Tune, click a chip, and confirm the candidate count appears and "Widen search" doubles it. Stop the server.

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/ui/TuneView.tsx src/ui/ContextStrip.tsx src/index.css
git commit -m "feat: add view navigation and the Tune view shell"
```

---

### Task 11: The candidate grid

Spec: §5.2, §4.5 (display order, widening, empty state), plus the accessibility requirements.

**Files:**
- Create: `src/ui/VerdictDot.tsx`
- Create: `src/ui/CandidateGrid.tsx`
- Modify: `src/ui/TuneView.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `CandidateEvaluation`, `explanationText` (Task 4); `criterionLabel`, `SPACING_CRITERION`, `EXCLUSION_CRITERION`, `Verdict`, `CriterionKey` (Task 3); `useTuneStore` (Task 8).
- Produces: `<VerdictDot verdict criterion />`, `<CandidateGrid />`.

- [ ] **Step 1: Create `src/ui/VerdictDot.tsx`**

```tsx
import { criterionLabel, type CriterionKey, type Verdict } from '../im';

const VERDICT_TEXT: Record<Verdict, string> = {
  clear: 'clear',
  near: 'near miss',
  exact: 'direct hit',
};

/**
 * Colour is never the only signal: the three verdicts differ in shape (hollow,
 * ring, filled) and each dot carries a text label for assistive technology.
 */
export function VerdictDot({
  verdict,
  criterion,
}: {
  verdict: Verdict;
  criterion: CriterionKey;
}) {
  return (
    <span className={`dot dot--${verdict}`}>
      <span className="visually-hidden">
        {criterionLabel(criterion)}: {VERDICT_TEXT[verdict]}
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Create `src/ui/CandidateGrid.tsx`**

```tsx
import {
  EXCLUSION_CRITERION,
  SPACING_CRITERION,
  criterionLabel,
  explanationText,
  kHzToMHzText,
  type Carrier,
} from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';
import { VerdictDot } from './VerdictDot';

function deltaText(offsetKHz: number): string {
  if (offsetKHz === 0) return '0';
  return offsetKHz > 0 ? `+${offsetKHz}` : `${offsetKHz}`;
}

export function CandidateGrid({ carrier }: { carrier: Carrier }) {
  const settings = useProjectStore((s) => s.settings);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const evaluations = useTuneStore((s) => s.evaluations);
  const criteria = useTuneStore((s) => s.criteria);
  const currentKHz = useTuneStore((s) => s.currentKHz);

  const showExclusion = settings.exclusions.length > 0;

  if (evaluations.length === 0) {
    return (
      <p className="hint">
        No frequency in this range is inside the band. Widen the band in Setup,
        or reduce the suggestion step.
      </p>
    );
  }

  // Evaluations arrive sorted by ascending frequency, which is how a spectrum
  // reads; the Δ column carries the distance that nearest-first ordering would
  // otherwise convey.
  let bestKHz: number | null = null;
  for (const evaluation of evaluations) {
    if (evaluation.worst !== 'clear') continue;
    if (currentKHz !== null && evaluation.freqKHz === currentKHz) continue;
    if (
      bestKHz === null ||
      (currentKHz !== null &&
        Math.abs(evaluation.freqKHz - currentKHz) < Math.abs(bestKHz - currentKHz))
    ) {
      bestKHz = evaluation.freqKHz;
    }
  }

  const apply = (freqKHz: number): void => {
    if (carrier.locked) return;
    updateCarrier(carrier.id, { freqKHz });
    // A displayed verdict must always describe the real configuration, so the
    // analysis is re-run against the frequencies that are now actually set.
    const { carriers, settings: next } = useProjectStore.getState();
    void useAnalysisStore.getState().run(carriers, next);
  };

  return (
    <>
      {bestKHz === null && (
        <p className="hint">
          Nothing in this range is completely clear. Widen the search, remove an
          excluded range, or move one of the other transmitters.
        </p>
      )}

      <table className="candidate-grid">
        <caption className="visually-hidden">
          Candidate frequencies for {carrier.label}, each rated against every
          interference test.
        </caption>
        <thead>
          <tr>
            <th scope="col">Frequency (MHz)</th>
            <th scope="col">Δ kHz</th>
            <th scope="col" title={criterionLabel(SPACING_CRITERION)}>
              Spacing
            </th>
            {showExclusion && (
              <th scope="col" title={criterionLabel(EXCLUSION_CRITERION)}>
                Excl.
              </th>
            )}
            {criteria.map((key) => (
              <th key={key} scope="col" title={criterionLabel(key)}>
                {key.replace('O', '')}
              </th>
            ))}
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((evaluation) => {
            const isCurrent = evaluation.freqKHz === currentKHz;
            const isBest = evaluation.freqKHz === bestKHz;
            const classes = ['candidate-row'];
            if (isCurrent) classes.push('candidate-row--current');
            if (isBest) classes.push('candidate-row--best');

            return (
              <tr key={evaluation.freqKHz} className={classes.join(' ')}>
                <th scope="row">
                  <button
                    type="button"
                    className="candidate-pick"
                    disabled={carrier.locked || isCurrent}
                    onClick={() => apply(evaluation.freqKHz)}
                  >
                    {kHzToMHzText(evaluation.freqKHz)}
                  </button>
                  {isCurrent && <span className="badge">current</span>}
                  {isBest && <span className="badge badge--good">nearest clear</span>}
                </th>
                <td className="num">
                  {currentKHz === null ? '' : deltaText(evaluation.freqKHz - currentKHz)}
                </td>
                <td>
                  <VerdictDot
                    verdict={evaluation.verdicts[SPACING_CRITERION]}
                    criterion={SPACING_CRITERION}
                  />
                </td>
                {showExclusion && (
                  <td>
                    <VerdictDot
                      verdict={evaluation.verdicts[EXCLUSION_CRITERION]}
                      criterion={EXCLUSION_CRITERION}
                    />
                  </td>
                )}
                {criteria.map((key) => (
                  <td key={key}>
                    <VerdictDot verdict={evaluation.verdicts[key]} criterion={key} />
                  </td>
                ))}
                <td>{explanationText(evaluation.explanation)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
```

The header shows `2T3` rather than `2T3O` because the trailing `O` reads as a zero at small sizes; the full wording is in the `title` and in every dot's screen-reader label.

- [ ] **Step 3: Add the styles**

Append to `src/index.css`:

```css
.visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
.candidate-grid { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.candidate-grid th, .candidate-grid td { text-align: left; padding: 0.25rem 0.5rem; border-bottom: 1px solid #8882; white-space: nowrap; }
.candidate-grid thead th { font-size: 0.8rem; color: #888; }
.candidate-row--current { background: #8882; }
.candidate-row--best { outline: 2px solid #2a842a66; }
.candidate-pick { font: inherit; background: transparent; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
.candidate-pick:disabled { text-decoration: none; cursor: default; color: inherit; }
.num { text-align: right; }
.dot { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 50%; box-sizing: border-box; }
.dot--clear { border: 1px solid #2a842a88; background: transparent; }
.dot--near { border: 3px solid #d98910; background: transparent; }
.dot--exact { border: 1px solid #d33; background: #d33; }
```

Hollow, ring, filled — three distinguishable shapes, so the grid works without colour discrimination.

- [ ] **Step 4: Render the grid from `TuneView`**

In `src/ui/TuneView.tsx`:
- import `CandidateGrid`,
- replace `<p>{evaluations.length} candidates evaluated.</p>` with `<CandidateGrid carrier={carrier} />`,
- **delete the trailing "Tune the first transmitter" paragraph** added in Task 10 — the context strip is the carrier selector now,
- if `evaluations` is no longer referenced, remove its selector to keep the lint clean.

- [ ] **Step 5: Verify in a real browser**

Run: `npm run build && npx vite preview --port 4173`, then open http://localhost:4173/ and check:
- the grid renders, the current frequency has a `current` badge, and the nearest clear candidate is marked,
- clicking a frequency applies it, the analysis re-runs, and the grid recomputes around the new frequency,
- **Tab reaches every frequency button and Enter applies it**,
- the console shows no errors and the worker actually ran (the grid is populated),
- with an excluded range defined, the `Excl.` column appears and rows inside the range show a filled dot; with none defined the column is absent.

Stop the preview server (`lsof -ti :4173`, then `kill <literal pid>`).

- [ ] **Step 6: Run the gate and commit**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`

```bash
git add src/ui/VerdictDot.tsx src/ui/CandidateGrid.tsx src/ui/TuneView.tsx src/index.css
git commit -m "feat: add the candidate grid to the Tune view"
```

---

### Task 12: Suggestions→Tune link, documentation, and release

Spec: §5.3, §8.

**Files:**
- Modify: `src/ui/SuggestionPanel.tsx`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-09-intermod-checker-v2-picker-design.md` (status line only)

**Interfaces:**
- Consumes: `useViewStore.openTune` (Task 8).
- Produces: nothing new.

- [ ] **Step 1: Add the per-suggestion link into Tune**

In `src/ui/SuggestionPanel.tsx`, import `useViewStore` from `../state/viewStore`, read `const openTune = useViewStore((s) => s.openTune);`, and add a button to every list item — including the ones with `toKHz === null`, since a carrier the tool could not solve is exactly the case where the user most wants to see the options themselves:

```tsx
            <button type="button" onClick={() => openTune(suggestion.carrierId)}>
              Choose myself
            </button>
```

Place it after the Apply button for solvable suggestions and after the failure reason for the rest.

- [ ] **Step 2: Correct the panel's overclaim if it is still there**

Read the introductory `<p className="hint">` in that file. It must not promise that applying every suggestion yields a clean set — a congested band can leave later carriers unsolvable (v2 spec §8). If the wording still promises it, replace with:

```tsx
      <p className="hint">
        Each suggestion is calculated with the previous ones already applied.
        Run the analysis again afterwards to confirm the result: in a congested
        band the later carriers can run out of room, and any carrier listed
        without a replacement is left where it is.
      </p>
```

- [ ] **Step 3: Update the README**

Add to the feature list: carrier locking, excluded ranges, and the Tune view. Add a short "Tune" section:

```markdown
### Tune

Pick one transmitter and see every frequency available to it within ±2 MHz,
each rated against the interference tests that apply. A test is named
`{transmitters}T{order}` — `2T3` is "two transmitters, third order", the
strongest and most common kind of intermodulation. Alongside them, `Spacing`
checks the minimum gap to your other transmitters and `Excl.` checks your
excluded ranges. The Verdict column names the worst product and which
transmitters cause it.

Dots are hollow for clear, a ring for a near miss, and filled for a direct hit,
so the grid is readable without relying on colour.

### Locking and excluded ranges

Lock a transmitter in Setup when its frequency cannot change — a fixed install,
a unit already programmed, a presenter's handheld. Nothing will ever propose
moving it, and the suggestion engine works around it instead.

Add excluded ranges for blocks you must keep clear: local TV broadcast, in-ear
monitors, intercom. No frequency inside one is ever offered. Interference
products landing inside an excluded range are ignored, because nothing of yours
is listening there.
```

Also confirm the README does not claim that applying all suggestions guarantees a clean set.

- [ ] **Step 4: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, everything.

- [ ] **Step 5: Verify the production build in a real browser**

This codebase's convention is browser verification against the production build, because two v1 defects were only visible there. If `playwright-core` is not installed:

```bash
cd /tmp && npm i playwright-core
```

Serve `npm run preview` and drive Chrome with `chromium.launch({ channel: 'chrome' })`. Assert:
- zero console errors and zero failed network requests on load,
- Analyse completes and the Results view populates,
- the Tune view renders a populated grid (proving the worker's `tune` path works in a bundled worker, which no unit test covers),
- applying a candidate updates the frequency and re-runs the analysis,
- a version 1 project file still loads (seed `localStorage` with a v1 payload before load).

Stop every server afterwards with a literal PID from `lsof -ti :<port>`.

- [ ] **Step 6: Mark the spec implemented and commit**

Change the spec's `Status: approved` line to `Status: implemented`.

```bash
git add src/ui/SuggestionPanel.tsx README.md docs/superpowers/specs
git commit -m "feat: link suggestions into Tune and document v2"
```

- [ ] **Step 7: Push and confirm the deployment**

```bash
git push origin main
gh run watch --exit-status
```

Then load https://matej-hron.github.io/intermod-checker/ and confirm the Tune view works on the deployed subpath — the worker URL is the part most likely to break under a non-root `base`.

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §2.1.1 `locked` honoured by engine and UI | 1, 6, 9 |
| §2.1.2 exclusion ranges | 1, 2, 4, 6, 9 |
| §2.1.3 `evaluateCandidate` | 4 |
| §2.1.4 Tune view | 10, 11 |
| §2.1.5 `suggest()` refactored onto the primitive | 6 |
| §2.1.6 project format v2 with v1 loading | 1 |
| §3.1 `Carrier.locked` | 1 |
| §3.2 `Exclusion`, normalized, overlaps kept | 1 |
| §3.3 persistence and migration | 1 |
| §4.1 criteria, bucketing, ordering, empty columns hidden | 3, 7 |
| §4.2 verdicts, spacing and exclusion criteria, band not a criterion | 3, 4, 5 |
| §4.3 the primitive, `mode`, mover rule, explanation tie-breaks, mutable-array constraint | 4 |
| §4.4 `suggest()` on the primitive, locking, exclusions, all-locked message | 6 |
| §4.5 candidate range, generation vs display order, widen, no-clear message | 5, 7, 11 |
| §4.6 worker, cancellation, exact-criterion skip, early stop, cap, selection-triggered | 4, 7, 8 |
| §5.1 navigation | 10 |
| §5.2 full width, context strip, carrier selector, grid columns, current row, nearest clear, apply and re-analyse, verdict text, a11y | 10, 11 |
| §5.3 Suggestions↔Tune division and link | 12 |
| §5.4 lock toggle, exclusions editor, validation warnings | 2, 9 |
| §6 error handling | 2, 6, 11 |
| §7.1–7.10 the ten required tests | 3 (7.1), 4 (7.2, 7.3, 7.4, 7.5), 6 (7.6, 7.7, 7.9), 5 (7.8), 1 (7.10) |
| §8 v1 correction | 12 |
| §9 disclaimer unchanged | — (footer untouched in Task 10) |

**Notes from the review pass, already folded in above**

- Spec §7.3 ("only the mover counts") originally used 508.975 as the clear candidate. Traced through the arithmetic: `2×510 − 511 = 509.000` and the 25 kHz window is inclusive, so 508.975 is a *near miss* against the untouched set. v1's `suggest()` only reaches it because carrier b has already moved by then. Task 4's test uses **508.950**, which is genuinely clear against the original frequencies.
- The spec's §7 self-involving requirement has no isolated fixture: a product a victim contributes to that lands on that victim requires the three frequencies to be in arithmetic progression, and an arithmetic progression always produces a non-self-involving hit as well. The rule stays covered by `analyze.test.ts` (v1) and, observably, by the contributors assertions in Task 4.
- `DEFAULT_SETTINGS.exclusions` is a shared array literal, so `{ ...DEFAULT_SETTINGS }` aliases it. Task 1 assigns a fresh array in `sanitizeSettings` unconditionally.
- `STORAGE_KEY` deliberately stays `:v1` — it names the storage slot, not the file format. Changing it would orphan every saved project, which is the exact failure backward-compatible loading exists to prevent.
- `first-hit` mode returns before scanning at all when spacing or exclusion already fails, which is both correct and the largest single saving for `suggest()`.
- Naming is consistent across tasks: `evaluateCandidate`, `generateCandidates`, `widenHalfWidth`, `realizableCriteria`, `criterionKey`, `criterionLabel`, `txBucket`, `worseVerdict`, `verdictRank`, `explanationText`, `normalizeExclusion`, `isExcluded`, `openTune`, `select`, `run`, `widen`, `clear`, `reset`.
