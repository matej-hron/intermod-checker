# Intermodulation Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static browser app that checks 10–12 wireless microphone carrier frequencies in 500–700 MHz for intermodulation collisions and proposes replacement frequencies for the offending carriers.

**Architecture:** A pure, framework-free calculation engine in `src/im/` enumerates intermodulation coefficient vectors and matches the resulting products against the user's own receivers. A Web Worker runs that engine off the main thread. A React UI reads the worker's results through two zustand stores, and projects persist to `localStorage` with JSON export/import. No backend exists.

**Tech Stack:** Vite 6, React 19, TypeScript 5 (strict), zustand 5, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-08-09-intermod-checker-design.md`

## Global Constraints

- All engine arithmetic uses **integer kilohertz**. Never store or compute a frequency as a float MHz value inside `src/im/`. The UI converts at its boundary.
- `src/im/` must not import React, DOM APIs, `localStorage`, or the worker. It is pure TypeScript and independently testable.
- TypeScript runs in `strict` mode. `npx tsc --noEmit` must pass before any task is considered done.
- All user-facing strings are **English**.
- Default settings, used verbatim wherever defaults are needed: `bandMinKHz = 500000`, `bandMaxKHz = 700000`, `lowOrder = 3`, `highOrder = 5`, `oddOnly = true`, `nearHitWindowKHz = 25`, `deviationKHz = 0`, `minSpacingKHz = 250`, `suggestionStepKHz = 25`.
- Carrier count limits: minimum 2, maximum 24.
- Order limits: minimum allowed order is 2; `lowOrder <= highOrder`.
- Commit style is Conventional Commits, e.g. `feat(im): ...`, `test(im): ...`, `feat(ui): ...`, `chore: ...`.
- Every commit message ends with these two trailers:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f
```

## File Structure

| Path | Responsibility |
|---|---|
| `src/im/types.ts` | Domain types and `DEFAULT_SETTINGS` |
| `src/im/units.ts` | MHz ↔ kHz conversion and input parsing |
| `src/im/enumerate.ts` | Canonical coefficient-vector enumeration |
| `src/im/format.ts` | Render a coefficient vector as `2A − B` |
| `src/im/analyze.ts` | Evaluate vectors into products, match against receivers |
| `src/im/validate.ts` | Pre-analysis validation of carriers and settings |
| `src/im/suggest.ts` | Replacement-frequency search |
| `src/im/index.ts` | Public engine API re-exports |
| `src/worker/analysis.worker.ts` | Runs analyze/suggest off the main thread |
| `src/worker/client.ts` | Typed promise + progress wrapper around the worker |
| `src/state/projectStore.ts` | Carriers, settings, persistence, export/import |
| `src/state/analysisStore.ts` | Run status, progress, results, cancellation |
| `src/ui/FrequencyTable.tsx` | Editable carrier rows |
| `src/ui/SettingsPanel.tsx` | Analysis settings form |
| `src/ui/ResultsSummary.tsx` | Verdict and severity counts |
| `src/ui/ConflictList.tsx` | Per-carrier expandable conflict detail |
| `src/ui/SpectrumStrip.tsx` | Linear band view of carriers and products |
| `src/ui/SuggestionPanel.tsx` | Proposed replacements with apply actions |
| `src/ui/ProjectBar.tsx` | Save/load/export/import actions |
| `src/App.tsx` | Composition root |

---

### Task 1: Project scaffold, domain types, and units

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/im/types.ts`
- Create: `src/im/units.ts`
- Test: `src/im/__tests__/units.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Carrier`, `Settings`, `DEFAULT_SETTINGS`, `Product`, `Hit`, `HitKind`, `Severity`, `AnalysisResult`, `Suggestion`, `ValidationIssue` from `src/im/types.ts`; `mhzToKHz(mhz: number): number`, `kHzToMHzText(khz: number): string`, `parseFrequencyMHz(text: string): number | null` from `src/im/units.ts`.

- [ ] **Step 1: Scaffold the project**

Run in the repository root (`/Users/matejhron/src/playground/intermodulacni-interference`):

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install zustand
npm install -D vitest
```

If `npm create vite` refuses because the directory is not empty, answer to keep existing files; `docs/` and `.git/` must survive.

- [ ] **Step 2: Add the test script and Vitest config**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
```

Add `/// <reference types="vitest" />` as the first line of `vite.config.ts` so the `test` key typechecks.

- [ ] **Step 3: Write the failing units test**

Create `src/im/__tests__/units.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mhzToKHz, kHzToMHzText, parseFrequencyMHz } from '../units';

describe('units', () => {
  it('converts MHz to integer kHz', () => {
    expect(mhzToKHz(500)).toBe(500000);
    expect(mhzToKHz(614.375)).toBe(614375);
  });

  it('rounds sub-kHz input to the nearest kHz', () => {
    expect(mhzToKHz(614.3751)).toBe(614375);
  });

  it('formats kHz back to a three-decimal MHz string', () => {
    expect(kHzToMHzText(614375)).toBe('614.375');
    expect(kHzToMHzText(500000)).toBe('500.000');
  });

  it('parses valid frequency text', () => {
    expect(parseFrequencyMHz('614.375')).toBe(614.375);
    expect(parseFrequencyMHz(' 614,375 ')).toBe(614.375);
  });

  it('rejects invalid frequency text', () => {
    expect(parseFrequencyMHz('')).toBeNull();
    expect(parseFrequencyMHz('abc')).toBeNull();
    expect(parseFrequencyMHz('-5')).toBeNull();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/units.test.ts`
Expected: FAIL — cannot resolve `../units`.

- [ ] **Step 5: Write `src/im/types.ts`**

```ts
export interface Carrier {
  id: string;
  label: string;
  freqKHz: number;
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
}

export const DEFAULT_SETTINGS: Settings = {
  bandMinKHz: 500000,
  bandMaxKHz: 700000,
  lowOrder: 3,
  highOrder: 5,
  oddOnly: true,
  nearHitWindowKHz: 25,
  deviationKHz: 0,
  minSpacingKHz: 250,
  suggestionStepKHz: 25,
};

export const MIN_CARRIERS = 2;
export const MAX_CARRIERS = 24;

export interface Product {
  /** Coefficient per carrier, index-aligned with the carrier array. */
  coeffs: number[];
  /** Sum of absolute coefficients. */
  order: number;
  /** Always positive, in kHz. */
  freqKHz: number;
}

export type HitKind = 'exact' | 'near';
export type Severity = 'high' | 'medium' | 'low';

export interface Hit {
  victimId: string;
  product: Product;
  kind: HitKind;
  offsetKHz: number;
  severity: Severity;
  /** True when the victim carrier also contributes to the product. */
  selfInvolving: boolean;
}

export interface AnalysisResult {
  hits: Hit[];
  hitsByCarrierId: Record<string, Hit[]>;
  conflictedIds: string[];
  vectorsExamined: number;
}

export interface Suggestion {
  carrierId: string;
  fromKHz: number;
  /** Null when no clean replacement was found. */
  toKHz: number | null;
  /** Null when `toKHz` is null. */
  distanceKHz: number | null;
  /** Present only when `toKHz` is null. */
  failureReason?: string;
}

export type ValidationField = 'carriers' | 'frequency' | 'settings';

export interface ValidationIssue {
  field: ValidationField;
  message: string;
  /** Carrier ids the issue applies to; empty for whole-set issues. */
  carrierIds: string[];
}
```

- [ ] **Step 6: Write `src/im/units.ts`**

```ts
export function mhzToKHz(mhz: number): number {
  return Math.round(mhz * 1000);
}

export function kHzToMHzText(khz: number): string {
  return (khz / 1000).toFixed(3);
}

export function parseFrequencyMHz(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/units.test.ts && npx tsc --noEmit`
Expected: PASS, and no type errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(im): scaffold Vite app with domain types and unit conversion

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 2: Canonical coefficient-vector enumeration

**Files:**
- Create: `src/im/enumerate.ts`
- Test: `src/im/__tests__/enumerate.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `enumerateVectors(n: number, lowOrder: number, highOrder: number, oddOnly: boolean, visit: (coeffs: readonly number[], order: number) => boolean | void): number`. The `visit` callback receives a **reused mutable array** — callers must copy it if they retain it. Returning `false` from `visit` aborts enumeration early. The return value is the number of vectors visited.

Only vectors whose first non-zero coefficient is positive are generated. This is the canonical-form rule from spec section 4.1: a vector and its negation describe the same physical product, so emitting one of each pair halves the search space, and `analyze` recovers the correct product by taking the absolute value of the summed frequency.

- [ ] **Step 1: Write the failing test**

Create `src/im/__tests__/enumerate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { enumerateVectors } from '../enumerate';

function collect(
  n: number,
  low: number,
  high: number,
  oddOnly: boolean,
): number[][] {
  const out: number[][] = [];
  enumerateVectors(n, low, high, oddOnly, (coeffs) => {
    out.push([...coeffs]);
  });
  return out;
}

describe('enumerateVectors', () => {
  it('enumerates third-order vectors for two carriers', () => {
    const vectors = collect(2, 3, 3, true);
    expect(vectors).toHaveLength(6);
    expect(vectors).toContainEqual([2, -1]);
    expect(vectors).toContainEqual([1, -2]);
    expect(vectors).toContainEqual([2, 1]);
    expect(vectors).toContainEqual([1, 2]);
    expect(vectors).toContainEqual([3, 0]);
    expect(vectors).toContainEqual([0, 3]);
  });

  it('emits only canonical vectors, never a negated duplicate', () => {
    const vectors = collect(3, 2, 5, false);
    for (const v of vectors) {
      const firstNonZero = v.find((c) => c !== 0);
      expect(firstNonZero).toBeGreaterThan(0);
    }
  });

  it('emits every vector exactly once', () => {
    const vectors = collect(3, 2, 5, false);
    const keys = new Set(vectors.map((v) => v.join(',')));
    expect(keys.size).toBe(vectors.length);
  });

  it('respects the order bounds', () => {
    const vectors = collect(3, 3, 5, false);
    for (const v of vectors) {
      const order = v.reduce((sum, c) => sum + Math.abs(c), 0);
      expect(order).toBeGreaterThanOrEqual(3);
      expect(order).toBeLessThanOrEqual(5);
    }
  });

  it('emits only odd orders when oddOnly is set', () => {
    const vectors = collect(4, 2, 5, true);
    expect(vectors.length).toBeGreaterThan(0);
    for (const v of vectors) {
      const order = v.reduce((sum, c) => sum + Math.abs(c), 0);
      expect(order % 2).toBe(1);
    }
  });

  it('reports the visited count and passes the order to the visitor', () => {
    const orders: number[] = [];
    const count = enumerateVectors(2, 3, 3, true, (coeffs, order) => {
      orders.push(order);
      expect(coeffs).toHaveLength(2);
    });
    expect(count).toBe(6);
    expect(orders.every((o) => o === 3)).toBe(true);
  });

  it('stops early when the visitor returns false', () => {
    let seen = 0;
    const count = enumerateVectors(3, 2, 5, false, () => {
      seen += 1;
      return seen < 3;
    });
    expect(seen).toBe(3);
    expect(count).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/enumerate.test.ts`
Expected: FAIL — cannot resolve `../enumerate`.

- [ ] **Step 3: Write the implementation**

Create `src/im/enumerate.ts`:

```ts
export type VectorVisitor = (
  coeffs: readonly number[],
  order: number,
) => boolean | void;

/**
 * Enumerates canonical intermodulation coefficient vectors.
 *
 * A vector is canonical when its first non-zero coefficient is positive, which
 * makes each vector/negation pair appear exactly once.
 *
 * The array handed to `visit` is reused between calls — copy it to retain it.
 * Returning `false` from `visit` aborts enumeration.
 */
export function enumerateVectors(
  n: number,
  lowOrder: number,
  highOrder: number,
  oddOnly: boolean,
  visit: VectorVisitor,
): number {
  const coeffs = new Array<number>(n).fill(0);
  let visited = 0;
  let aborted = false;

  const recurse = (index: number, used: number, seenNonZero: boolean): void => {
    if (aborted) return;

    if (index === n) {
      if (!seenNonZero) return;
      if (used < lowOrder) return;
      if (oddOnly && used % 2 === 0) return;
      visited += 1;
      if (visit(coeffs, used) === false) aborted = true;
      return;
    }

    const remaining = highOrder - used;
    // Canonical form: before the first non-zero coefficient, only zero or
    // positive values are allowed.
    const lowest = seenNonZero ? -remaining : 0;

    for (let c = lowest; c <= remaining; c += 1) {
      coeffs[index] = c;
      recurse(index + 1, used + Math.abs(c), seenNonZero || c !== 0);
      if (aborted) {
        coeffs[index] = 0;
        return;
      }
    }
    coeffs[index] = 0;
  };

  recurse(0, 0, false);
  return visited;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/enumerate.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/im/enumerate.ts src/im/__tests__/enumerate.test.ts
git commit -m "feat(im): add canonical coefficient vector enumeration

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 3: Product formatting

**Files:**
- Create: `src/im/format.ts`
- Test: `src/im/__tests__/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `carrierLetter(index: number): string` and `formatProduct(coeffs: readonly number[]): string` from `src/im/format.ts`.

Carriers are labelled `A`, `B`, `C` … in input order, matching the notation in the source document. With a 24-carrier maximum, single letters always suffice.

- [ ] **Step 1: Write the failing test**

Create `src/im/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { carrierLetter, formatProduct } from '../format';

describe('carrierLetter', () => {
  it('maps indexes to letters in input order', () => {
    expect(carrierLetter(0)).toBe('A');
    expect(carrierLetter(1)).toBe('B');
    expect(carrierLetter(23)).toBe('X');
  });
});

describe('formatProduct', () => {
  it('formats a third-order two-carrier product', () => {
    expect(formatProduct([2, -1])).toBe('2A − B');
  });

  it('omits the coefficient when it is one', () => {
    expect(formatProduct([1, 1, -1])).toBe('A + B − C');
  });

  it('formats a fifth-order product', () => {
    expect(formatProduct([3, -2])).toBe('3A − 2B');
  });

  it('skips zero coefficients', () => {
    expect(formatProduct([0, 3, 0])).toBe('3B');
  });

  it('prefixes a leading negative term with a minus sign', () => {
    expect(formatProduct([-1, 2])).toBe('−A + 2B');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/format.test.ts`
Expected: FAIL — cannot resolve `../format`.

- [ ] **Step 3: Write the implementation**

Create `src/im/format.ts`:

```ts
const MINUS = '\u2212';

export function carrierLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function formatProduct(coeffs: readonly number[]): string {
  let text = '';
  for (let i = 0; i < coeffs.length; i += 1) {
    const c = coeffs[i];
    if (c === 0) continue;

    const magnitude = Math.abs(c);
    const term = (magnitude === 1 ? '' : String(magnitude)) + carrierLetter(i);

    if (text === '') {
      text = c < 0 ? `${MINUS}${term}` : term;
    } else {
      text += c < 0 ? ` ${MINUS} ${term}` : ` + ${term}`;
    }
  }
  return text;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/format.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/im/format.ts src/im/__tests__/format.test.ts
git commit -m "feat(im): render coefficient vectors as readable expressions

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 4: Analysis engine

**Files:**
- Create: `src/im/analyze.ts`
- Test: `src/im/__tests__/analyze.test.ts`

**Interfaces:**
- Consumes: `enumerateVectors` (Task 2); `Carrier`, `Settings`, `Product`, `Hit`, `Severity`, `AnalysisResult` (Task 1).
- Produces: `severityForOrder(order: number): Severity`, `effectiveWindowKHz(order: number, settings: Settings): number`, and `analyze(carriers: readonly Carrier[], settings: Settings, onProgress?: (fraction: number) => void): AnalysisResult` from `src/im/analyze.ts`.

Rules from spec section 4.2:

- The product frequency is `|Σ nᵢ · fᵢ|`. A zero sum is discarded.
- Products outside `[bandMinKHz, bandMaxKHz]` are discarded — they cannot land on a receiver in this band.
- A hit is `exact` when the offset from a carrier is `0`, otherwise `near` when the offset is within the effective window.
- Effective window is `max(nearHitWindowKHz, order × deviationKHz)`. The deviation term models the fact that a product's swing is the sum of the contributing signals' deviations scaled by their coefficients, so higher-order products sweep proportionally wider.
- Severity: order 3 → `high`, order 5 → `medium`, order ≥ 7 → `low`. Any even order is treated by the same table: 2 and 4 map to `high` and `medium` respectively via the `order <= 3` / `order <= 5` boundaries.
- A hit is `selfInvolving` when the victim carrier's own coefficient in the product is non-zero. These are kept but flagged, since they are usually harmless self-mixing.
- Since all arithmetic is integer kHz, no floating-point epsilon is needed anywhere.

- [ ] **Step 1: Write the failing test**

Create `src/im/__tests__/analyze.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyze, severityForOrder, effectiveWindowKHz } from '../analyze';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000) };
}

// The band bounds are widened to 140-320 MHz so the worked examples from the
// source paper (which uses VHF frequencies) can be reproduced verbatim.
const vhf: Settings = {
  ...DEFAULT_SETTINGS,
  bandMinKHz: 140000,
  bandMaxKHz: 320000,
};

describe('severityForOrder', () => {
  it('ranks lower orders as more severe', () => {
    expect(severityForOrder(3)).toBe('high');
    expect(severityForOrder(5)).toBe('medium');
    expect(severityForOrder(7)).toBe('low');
    expect(severityForOrder(9)).toBe('low');
  });
});

describe('effectiveWindowKHz', () => {
  it('uses the flat window when deviation is disabled', () => {
    expect(effectiveWindowKHz(3, { ...vhf, deviationKHz: 0 })).toBe(25);
  });

  it('scales the deviation term by the product order', () => {
    // Source-document fixture: the fifth-order product 2A + 3B built from two
    // signals each deviating +/-5 kHz swings +/-25 kHz.
    expect(effectiveWindowKHz(5, { ...vhf, deviationKHz: 5 })).toBe(25);
    expect(effectiveWindowKHz(5, { ...vhf, deviationKHz: 10 })).toBe(50);
  });
});

describe('analyze', () => {
  it('finds the third-order products of a two-carrier pair', () => {
    // 150.000 and 151.000 MHz produce 149.000 (2A - B) and 152.000 (2B - A).
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 3, highOrder: 3 });

    const victimHits = result.hitsByCarrierId['victim'] ?? [];
    const exact = victimHits.filter((h) => h.kind === 'exact' && !h.selfInvolving);
    expect(exact.length).toBeGreaterThan(0);
    expect(exact[0]?.product.freqKHz).toBe(149000);
    expect(exact[0]?.product.order).toBe(3);
    expect(exact[0]?.severity).toBe('high');
  });

  it('finds the upper third-order product', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 152),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 3, highOrder: 3 });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits.some((h) => h.product.freqKHz === 152000)).toBe(true);
  });

  it('finds the fifth-order products of the same pair', () => {
    // 148.000 (3A - 2B) and 153.000 (3B - 2A).
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('low', 148),
      carrier('high', 153),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 5, highOrder: 5 });
    expect(
      (result.hitsByCarrierId['low'] ?? []).some(
        (h) => !h.selfInvolving && h.product.order === 5,
      ),
    ).toBe(true);
    expect(
      (result.hitsByCarrierId['high'] ?? []).some(
        (h) => !h.selfInvolving && h.product.order === 5,
      ),
    ).toBe(true);
  });

  it('reproduces the 3A - 2B example at 157.000 MHz', () => {
    const carriers = [
      carrier('a', 155),
      carrier('b', 154),
      carrier('victim', 157),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 5, highOrder: 5 });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits.some((h) => h.product.freqKHz === 157000)).toBe(true);
  });

  it('excludes second-order products that fall outside the band', () => {
    // 155 and 154 MHz give 1.000 and 309.000 MHz; neither is in 140-160.
    const carriers = [carrier('a', 155), carrier('b', 154)];
    const result = analyze(carriers, {
      ...vhf,
      bandMinKHz: 140000,
      bandMaxKHz: 160000,
      lowOrder: 2,
      highOrder: 2,
      oddOnly: false,
    });
    expect(result.hits).toHaveLength(0);
  });

  it('classifies an offset inside the window as a near hit', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149.02),
    ];
    const result = analyze(carriers, {
      ...vhf,
      lowOrder: 3,
      highOrder: 3,
      nearHitWindowKHz: 25,
    });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits[0]?.kind).toBe('near');
    expect(hits[0]?.offsetKHz).toBe(20);
  });

  it('ignores an offset outside the window', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149.2),
    ];
    const result = analyze(carriers, {
      ...vhf,
      lowOrder: 3,
      highOrder: 3,
      nearHitWindowKHz: 25,
    });
    const hits = (result.hitsByCarrierId['victim'] ?? []).filter(
      (h) => !h.selfInvolving,
    );
    expect(hits).toHaveLength(0);
  });

  it('flags products the victim itself contributes to', () => {
    // With A + B = 2C, the fifth-order product 2A + B - 2C lands exactly on A,
    // and A contributes to it, so it is self-mixing rather than a conflict.
    const carriers = [
      carrier('a', 500),
      carrier('b', 520),
      carrier('c', 510),
    ];
    const result = analyze(carriers, {
      ...DEFAULT_SETTINGS,
      lowOrder: 5,
      highOrder: 5,
    });
    const onA = result.hitsByCarrierId['a'] ?? [];
    expect(onA).toHaveLength(1);
    expect(onA[0]?.product.freqKHz).toBe(500000);
    expect(onA[0]?.product.coeffs).toEqual([2, 1, -2]);
    expect(onA[0]?.selfInvolving).toBe(true);
    expect(result.conflictedIds).toEqual([]);
  });

  it('lists conflicted carriers and reports how many vectors it examined', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149),
    ];
    const result = analyze(carriers, { ...vhf, lowOrder: 3, highOrder: 3 });
    expect(result.conflictedIds).toContain('victim');
    expect(result.vectorsExamined).toBeGreaterThan(0);
  });

  it('reports a clean set as having no hits', () => {
    const carriers = [
      carrier('a', 500.1),
      carrier('b', 530.3),
      carrier('c', 570.7),
    ];
    const result = analyze(carriers, DEFAULT_SETTINGS);
    expect(result.hits.filter((h) => !h.selfInvolving)).toHaveLength(0);
  });

  it('produces identical output on repeated runs', () => {
    const carriers = [
      carrier('a', 150),
      carrier('b', 151),
      carrier('victim', 149),
    ];
    const settings = { ...vhf, lowOrder: 3, highOrder: 5 };
    const first = analyze(carriers, settings);
    const second = analyze(carriers, settings);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('reports progress between 0 and 1', () => {
    const fractions: number[] = [];
    analyze(
      [carrier('a', 150), carrier('b', 151), carrier('c', 152)],
      { ...vhf, lowOrder: 3, highOrder: 5 },
      (f) => fractions.push(f),
    );
    expect(fractions.length).toBeGreaterThan(0);
    expect(fractions[fractions.length - 1]).toBe(1);
    for (const f of fractions) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/analyze.test.ts`
Expected: FAIL — cannot resolve `../analyze`.

- [ ] **Step 3: Write the implementation**

Create `src/im/analyze.ts`:

```ts
import { enumerateVectors } from './enumerate';
import type {
  AnalysisResult,
  Carrier,
  Hit,
  Product,
  Settings,
  Severity,
} from './types';

const PROGRESS_INTERVAL = 20000;

export function severityForOrder(order: number): Severity {
  if (order <= 3) return 'high';
  if (order <= 5) return 'medium';
  return 'low';
}

export function effectiveWindowKHz(order: number, settings: Settings): number {
  return Math.max(settings.nearHitWindowKHz, order * settings.deviationKHz);
}

export function analyze(
  carriers: readonly Carrier[],
  settings: Settings,
  onProgress?: (fraction: number) => void,
): AnalysisResult {
  const n = carriers.length;
  const freqs = carriers.map((c) => c.freqKHz);
  const hits: Hit[] = [];
  const hitsByCarrierId: Record<string, Hit[]> = {};
  for (const c of carriers) hitsByCarrierId[c.id] = [];

  let examined = 0;

  // A counting pass with an empty visitor is far cheaper than the evaluation
  // pass, and it gives an exact denominator for honest progress reporting.
  const total =
    onProgress === undefined
      ? 0
      : enumerateVectors(
          n,
          settings.lowOrder,
          settings.highOrder,
          settings.oddOnly,
          () => {},
        );

  const vectorsExamined = enumerateVectors(
    n,
    settings.lowOrder,
    settings.highOrder,
    settings.oddOnly,
    (coeffs, order) => {
      examined += 1;
      if (onProgress && total > 0 && examined % PROGRESS_INTERVAL === 0) {
        onProgress(examined / total);
      }

      let sum = 0;
      for (let i = 0; i < n; i += 1) sum += coeffs[i] * freqs[i];
      if (sum === 0) return;

      const freqKHz = Math.abs(sum);
      if (freqKHz < settings.bandMinKHz || freqKHz > settings.bandMaxKHz) return;

      const window = effectiveWindowKHz(order, settings);
      let product: Product | null = null;

      for (let v = 0; v < n; v += 1) {
        const offset = Math.abs(freqs[v] - freqKHz);
        if (offset > window) continue;

        if (product === null) {
          // Normalise so the stored coefficients produce the positive frequency.
          const stored = sum < 0 ? coeffs.map((c) => -c) : [...coeffs];
          product = { coeffs: stored, order, freqKHz };
        }

        const hit: Hit = {
          victimId: carriers[v].id,
          product,
          kind: offset === 0 ? 'exact' : 'near',
          offsetKHz: offset,
          severity: severityForOrder(order),
          selfInvolving: coeffs[v] !== 0,
        };
        hits.push(hit);
        hitsByCarrierId[carriers[v].id].push(hit);
      }
    },
  );

  const conflictedIds = carriers
    .filter((c) => (hitsByCarrierId[c.id] ?? []).some((h) => !h.selfInvolving))
    .map((c) => c.id);

  onProgress?.(1);

  return { hits, hitsByCarrierId, conflictedIds, vectorsExamined };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/analyze.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/im/analyze.ts src/im/__tests__/analyze.test.ts
git commit -m "feat(im): evaluate intermodulation products against receivers

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 5: Input validation

**Files:**
- Create: `src/im/validate.ts`
- Test: `src/im/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: `Carrier`, `Settings`, `ValidationIssue`, `MIN_CARRIERS`, `MAX_CARRIERS` (Task 1).
- Produces: `validate(carriers: readonly Carrier[], settings: Settings): ValidationIssue[]` from `src/im/validate.ts`. An empty array means the input is analysable.

Validation covers spec section 6: too few or too many carriers, frequencies outside the band, duplicate frequencies, carriers closer together than `minSpacingKHz`, and incoherent settings.

- [ ] **Step 1: Write the failing test**

Create `src/im/__tests__/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000) };
}

const good = [carrier('a', 510), carrier('b', 530), carrier('c', 560)];

describe('validate', () => {
  it('accepts a well-formed set', () => {
    expect(validate(good, DEFAULT_SETTINGS)).toEqual([]);
  });

  it('rejects fewer than two carriers', () => {
    const issues = validate([carrier('a', 510)], DEFAULT_SETTINGS);
    expect(issues.some((i) => i.field === 'carriers')).toBe(true);
  });

  it('rejects more than twenty-four carriers', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      carrier(`c${i}`, 510 + i * 2),
    );
    const issues = validate(many, DEFAULT_SETTINGS);
    expect(issues.some((i) => i.field === 'carriers')).toBe(true);
  });

  it('rejects a frequency below the band', () => {
    const issues = validate([...good, carrier('low', 490)], DEFAULT_SETTINGS);
    const issue = issues.find((i) => i.carrierIds.includes('low'));
    expect(issue?.field).toBe('frequency');
  });

  it('rejects a frequency above the band', () => {
    const issues = validate([...good, carrier('high', 710)], DEFAULT_SETTINGS);
    expect(issues.some((i) => i.carrierIds.includes('high'))).toBe(true);
  });

  it('rejects duplicate frequencies', () => {
    const issues = validate([...good, carrier('dup', 510)], DEFAULT_SETTINGS);
    const issue = issues.find((i) => i.message.toLowerCase().includes('duplicate'));
    expect(issue?.carrierIds).toEqual(expect.arrayContaining(['a', 'dup']));
  });

  it('rejects carriers closer than the minimum spacing', () => {
    const issues = validate(
      [carrier('a', 510), carrier('b', 510.1)],
      DEFAULT_SETTINGS,
    );
    expect(
      issues.some((i) => i.message.toLowerCase().includes('spacing')),
    ).toBe(true);
  });

  it('rejects an inverted band', () => {
    const issues = validate(good, {
      ...DEFAULT_SETTINGS,
      bandMinKHz: 700000,
      bandMaxKHz: 500000,
    });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });

  it('rejects a low order above the high order', () => {
    const issues = validate(good, {
      ...DEFAULT_SETTINGS,
      lowOrder: 7,
      highOrder: 5,
    });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });

  it('rejects an order below two', () => {
    const issues = validate(good, { ...DEFAULT_SETTINGS, lowOrder: 1 });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });

  it('rejects a non-positive suggestion step', () => {
    const issues = validate(good, {
      ...DEFAULT_SETTINGS,
      suggestionStepKHz: 0,
    });
    expect(issues.some((i) => i.field === 'settings')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/validate.test.ts`
Expected: FAIL — cannot resolve `../validate`.

- [ ] **Step 3: Write the implementation**

Create `src/im/validate.ts`:

```ts
import {
  MAX_CARRIERS,
  MIN_CARRIERS,
  type Carrier,
  type Settings,
  type ValidationIssue,
} from './types';

export function validate(
  carriers: readonly Carrier[],
  settings: Settings,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (settings.bandMinKHz >= settings.bandMaxKHz) {
    issues.push({
      field: 'settings',
      message: 'The band start must be lower than the band end.',
      carrierIds: [],
    });
  }
  if (settings.lowOrder < 2) {
    issues.push({
      field: 'settings',
      message: 'The lowest order must be at least 2.',
      carrierIds: [],
    });
  }
  if (settings.lowOrder > settings.highOrder) {
    issues.push({
      field: 'settings',
      message: 'The lowest order must not exceed the highest order.',
      carrierIds: [],
    });
  }
  if (settings.suggestionStepKHz <= 0) {
    issues.push({
      field: 'settings',
      message: 'The suggestion step must be greater than zero.',
      carrierIds: [],
    });
  }
  if (settings.nearHitWindowKHz < 0 || settings.deviationKHz < 0) {
    issues.push({
      field: 'settings',
      message: 'The near-hit window and deviation must not be negative.',
      carrierIds: [],
    });
  }
  if (settings.minSpacingKHz < 0) {
    issues.push({
      field: 'settings',
      message: 'The minimum spacing must not be negative.',
      carrierIds: [],
    });
  }

  if (carriers.length < MIN_CARRIERS) {
    issues.push({
      field: 'carriers',
      message: `Add at least ${MIN_CARRIERS} frequencies to run an analysis.`,
      carrierIds: [],
    });
  }
  if (carriers.length > MAX_CARRIERS) {
    issues.push({
      field: 'carriers',
      message: `Remove frequencies — at most ${MAX_CARRIERS} are supported.`,
      carrierIds: [],
    });
  }

  for (const c of carriers) {
    if (!Number.isInteger(c.freqKHz)) {
      issues.push({
        field: 'frequency',
        message: 'Frequencies must be whole kilohertz.',
        carrierIds: [c.id],
      });
      continue;
    }
    if (c.freqKHz < settings.bandMinKHz || c.freqKHz > settings.bandMaxKHz) {
      issues.push({
        field: 'frequency',
        message: `${(c.freqKHz / 1000).toFixed(3)} MHz is outside the selected band.`,
        carrierIds: [c.id],
      });
    }
  }

  const sorted = [...carriers].sort((a, b) => a.freqKHz - b.freqKHz);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const gap = current.freqKHz - previous.freqKHz;
    if (gap === 0) {
      issues.push({
        field: 'frequency',
        message: 'Duplicate frequency — every transmitter needs its own.',
        carrierIds: [previous.id, current.id],
      });
    } else if (gap < settings.minSpacingKHz) {
      issues.push({
        field: 'frequency',
        message: `Spacing of ${gap} kHz is below the minimum of ${settings.minSpacingKHz} kHz.`,
        carrierIds: [previous.id, current.id],
      });
    }
  }

  return issues;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/validate.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/im/validate.ts src/im/__tests__/validate.test.ts
git commit -m "feat(im): validate carriers and settings before analysis

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 6: Replacement-frequency suggestions

**Files:**
- Create: `src/im/suggest.ts`
- Create: `src/im/index.ts`
- Test: `src/im/__tests__/suggest.test.ts`

**Interfaces:**
- Consumes: `analyze`, `effectiveWindowKHz` (Task 4); `enumerateVectors` (Task 2); `Carrier`, `Settings`, `Suggestion` (Task 1).
- Produces: `suggest(carriers: readonly Carrier[], settings: Settings, onProgress?: (fraction: number) => void): Suggestion[]` from `src/im/suggest.ts`, and re-exports of the whole engine from `src/im/index.ts`.

Algorithm, from spec sections 4.3 and 4.4:

1. Run `analyze` to find the conflicted carriers.
2. Process them **sequentially against a working copy**. Each accepted replacement is written into the working copy before the next conflicted carrier is considered, so applying all suggestions at once yields a genuinely clean set rather than a set of individually-clean-but-mutually-conflicting moves.
3. For each conflicted carrier, walk candidate frequencies outward from the original position in `suggestionStepKHz` increments, alternating below and above, so the nearest clean frequency wins.
4. A candidate is rejected as soon as one qualifying hit is found (`abort on first hit`) — most candidates fail fast, which is what keeps the search affordable.
5. At most `MAX_CANDIDATES = 2000` candidates are examined per carrier. If none is clean, the suggestion carries `toKHz: null` and a `failureReason`.
6. A candidate must also satisfy `minSpacingKHz` against every other carrier in the working copy, and stay inside the band.

- [ ] **Step 1: Write the failing test**

Create `src/im/__tests__/suggest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { suggest } from '../suggest';
import { analyze } from '../analyze';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

function carrier(id: string, mhz: number): Carrier {
  return { id, label: id, freqKHz: Math.round(mhz * 1000) };
}

const settings: Settings = { ...DEFAULT_SETTINGS, lowOrder: 3, highOrder: 3 };

describe('suggest', () => {
  it('returns nothing for a clean set', () => {
    const carriers = [
      carrier('a', 500.1),
      carrier('b', 530.3),
      carrier('c', 570.7),
    ];
    expect(suggest(carriers, settings)).toEqual([]);
  });

  it('proposes a replacement for a conflicted carrier', () => {
    // 2*510 - 511 = 509 MHz, which lands exactly on carrier c.
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    const suggestions = suggest(carriers, settings);
    expect(suggestions.length).toBeGreaterThan(0);
    const s = suggestions[0];
    expect(s.toKHz).not.toBeNull();
    expect(s.fromKHz).not.toBe(s.toKHz);
    expect(s.distanceKHz).toBe(Math.abs((s.toKHz as number) - s.fromKHz));
  });

  it('keeps the replacement inside the band', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    for (const s of suggest(carriers, settings)) {
      if (s.toKHz === null) continue;
      expect(s.toKHz).toBeGreaterThanOrEqual(settings.bandMinKHz);
      expect(s.toKHz).toBeLessThanOrEqual(settings.bandMaxKHz);
    }
  });

  it('snaps replacements to the suggestion step', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    for (const s of suggest(carriers, settings)) {
      if (s.toKHz === null) continue;
      expect(Math.abs(s.toKHz - s.fromKHz) % settings.suggestionStepKHz).toBe(0);
    }
  });

  it('respects the minimum spacing against other carriers', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    for (const s of suggest(carriers, settings)) {
      if (s.toKHz === null) continue;
      for (const other of carriers) {
        if (other.id === s.carrierId) continue;
        expect(Math.abs(other.freqKHz - s.toKHz)).toBeGreaterThanOrEqual(
          settings.minSpacingKHz,
        );
      }
    }
  });

  it('produces a set that is clean once every suggestion is applied', () => {
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
      carrier('d', 512),
    ];
    const suggestions = suggest(carriers, settings);
    const applied = carriers.map((c) => {
      const s = suggestions.find((x) => x.carrierId === c.id);
      return s && s.toKHz !== null ? { ...c, freqKHz: s.toKHz } : c;
    });
    const after = analyze(applied, settings);
    expect(after.conflictedIds).toEqual([]);
  });

  it('reports a failure when no candidate fits', () => {
    // A suggestion step wider than the whole band puts every candidate outside
    // it, so the search must exhaust its budget and report why.
    const impossible: Settings = { ...settings, suggestionStepKHz: 300000 };
    const carriers = [
      carrier('a', 510),
      carrier('b', 511),
      carrier('c', 509),
    ];
    const suggestions = suggest(carriers, impossible);
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.toKHz).toBeNull();
      expect(s.distanceKHz).toBeNull();
      expect(s.failureReason).toBeTruthy();
    }
  });

  it('reports progress ending at one', () => {
    const fractions: number[] = [];
    suggest(
      [carrier('a', 510), carrier('b', 511), carrier('c', 509)],
      settings,
      (f) => fractions.push(f),
    );
    expect(fractions[fractions.length - 1]).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/suggest.test.ts`
Expected: FAIL — cannot resolve `../suggest`.

- [ ] **Step 3: Write the implementation**

Create `src/im/suggest.ts`:

```ts
import { analyze, effectiveWindowKHz } from './analyze';
import { enumerateVectors } from './enumerate';
import type { Carrier, Settings, Suggestion } from './types';

export const MAX_CANDIDATES = 2000;

/**
 * True when `candidateKHz` for `index` produces no qualifying hit against the
 * rest of the working set. Aborts on the first hit found.
 */
function isCandidateClean(
  freqs: number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
): boolean {
  const original = freqs[index];
  freqs[index] = candidateKHz;
  let clean = true;

  enumerateVectors(
    freqs.length,
    settings.lowOrder,
    settings.highOrder,
    settings.oddOnly,
    (coeffs, order) => {
      let sum = 0;
      for (let i = 0; i < freqs.length; i += 1) sum += coeffs[i] * freqs[i];
      if (sum === 0) return;

      const productKHz = Math.abs(sum);
      if (productKHz < settings.bandMinKHz || productKHz > settings.bandMaxKHz) {
        return;
      }

      const window = effectiveWindowKHz(order, settings);
      for (let v = 0; v < freqs.length; v += 1) {
        if (coeffs[v] !== 0) continue; // self-involving products are ignored
        if (Math.abs(freqs[v] - productKHz) <= window) {
          clean = false;
          return false;
        }
      }
    },
  );

  freqs[index] = original;
  return clean;
}

function respectsSpacing(
  freqs: readonly number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
): boolean {
  for (let i = 0; i < freqs.length; i += 1) {
    if (i === index) continue;
    if (Math.abs(freqs[i] - candidateKHz) < settings.minSpacingKHz) return false;
  }
  return true;
}

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
      if (!respectsSpacing(working, index, candidate, settings)) continue;
      if (!isCandidateClean(working, index, candidate, settings)) continue;

      found = candidate;
    }

    if (found === null) {
      suggestions.push({
        carrierId,
        fromKHz,
        toKHz: null,
        distanceKHz: null,
        failureReason: `No interference-free frequency was found within ${examined} candidates. Widen the band, lower the highest order, or reduce the number of transmitters.`,
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

- [ ] **Step 4: Create the engine's public API**

Create `src/im/index.ts`:

```ts
export * from './types';
export * from './units';
export * from './enumerate';
export * from './format';
export * from './analyze';
export * from './validate';
export * from './suggest';
```

- [ ] **Step 5: Run the whole engine suite to verify it passes**

Run: `npx vitest run src/im && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/im/suggest.ts src/im/index.ts src/im/__tests__/suggest.test.ts
git commit -m "feat(im): search for interference-free replacement frequencies

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 7: Web Worker and typed client

**Files:**
- Create: `src/worker/protocol.ts`
- Create: `src/worker/analysis.worker.ts`
- Create: `src/worker/client.ts`

**Interfaces:**
- Consumes: `analyze`, `suggest`, `validate` and the domain types from `src/im/index.ts` (Tasks 1–6).
- Produces:
  - `src/worker/protocol.ts`: `WorkerRequest`, `WorkerResponse` message unions.
  - `src/worker/client.ts`: `class AnalysisClient` with `run(carriers: Carrier[], settings: Settings, onProgress: (p: WorkerProgress) => void): Promise<WorkerRunResult>`, `cancel(): void`, `dispose(): void`; plus the types `WorkerProgress = { phase: 'analyze' | 'suggest'; fraction: number }` and `WorkerRunResult = { result: AnalysisResult; suggestions: Suggestion[] }`.

The client cancels by terminating the worker and spawning a fresh one — the engine runs synchronously inside the worker, so cooperative cancellation would require threading an abort flag through every loop for no practical gain.

No Vitest coverage here: the spec scopes automated tests to `src/im/`, and this module is a thin, DOM-dependent transport shell. Verify it manually in Step 4.

- [ ] **Step 1: Write the protocol**

Create `src/worker/protocol.ts`:

```ts
import type {
  AnalysisResult,
  Carrier,
  Settings,
  Suggestion,
  ValidationIssue,
} from '../im';

export interface RunRequest {
  type: 'run';
  runId: number;
  carriers: Carrier[];
  settings: Settings;
}

export type WorkerRequest = RunRequest;

export interface ProgressResponse {
  type: 'progress';
  runId: number;
  phase: 'analyze' | 'suggest';
  fraction: number;
}

export interface DoneResponse {
  type: 'done';
  runId: number;
  result: AnalysisResult;
  suggestions: Suggestion[];
}

export interface InvalidResponse {
  type: 'invalid';
  runId: number;
  issues: ValidationIssue[];
}

export interface ErrorResponse {
  type: 'error';
  runId: number;
  message: string;
}

export type WorkerResponse =
  | ProgressResponse
  | DoneResponse
  | InvalidResponse
  | ErrorResponse;
```

- [ ] **Step 2: Write the worker**

Create `src/worker/analysis.worker.ts`:

```ts
import { analyze, suggest, validate } from '../im';
import type { WorkerRequest, WorkerResponse } from './protocol';

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type !== 'run') return;

  const { runId, carriers, settings } = request;

  try {
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
  } catch (error) {
    post({
      type: 'error',
      runId,
      message: error instanceof Error ? error.message : 'Analysis failed.',
    });
  }
};
```

- [ ] **Step 3: Write the typed client**

Create `src/worker/client.ts`:

```ts
import type {
  AnalysisResult,
  Carrier,
  Settings,
  Suggestion,
  ValidationIssue,
} from '../im';
import type { WorkerResponse } from './protocol';

export interface WorkerProgress {
  phase: 'analyze' | 'suggest';
  fraction: number;
}

export interface WorkerRunResult {
  result: AnalysisResult;
  suggestions: Suggestion[];
}

export class AnalysisCancelledError extends Error {
  constructor() {
    super('Analysis cancelled.');
    this.name = 'AnalysisCancelledError';
  }
}

export class AnalysisInvalidError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super('The input is not analysable.');
    this.name = 'AnalysisInvalidError';
    this.issues = issues;
  }
}

function createWorker(): Worker {
  return new Worker(new URL('./analysis.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export class AnalysisClient {
  private worker: Worker | null = null;
  private nextRunId = 1;
  private rejectActive: ((reason: Error) => void) | null = null;

  run(
    carriers: Carrier[],
    settings: Settings,
    onProgress: (progress: WorkerProgress) => void,
  ): Promise<WorkerRunResult> {
    this.cancel();

    const worker = createWorker();
    this.worker = worker;
    const runId = this.nextRunId;
    this.nextRunId += 1;

    return new Promise<WorkerRunResult>((resolve, reject) => {
      this.rejectActive = reject;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.runId !== runId) return;

        switch (message.type) {
          case 'progress':
            onProgress({ phase: message.phase, fraction: message.fraction });
            break;
          case 'done':
            this.rejectActive = null;
            resolve({ result: message.result, suggestions: message.suggestions });
            break;
          case 'invalid':
            this.rejectActive = null;
            reject(new AnalysisInvalidError(message.issues));
            break;
          case 'error':
            this.rejectActive = null;
            reject(new Error(message.message));
            break;
        }
      };

      worker.onerror = () => {
        this.rejectActive = null;
        reject(new Error('The analysis worker failed to start.'));
      };

      worker.postMessage({ type: 'run', runId, carriers, settings });
    });
  }

  cancel(): void {
    if (this.worker === null) return;
    this.worker.terminate();
    this.worker = null;
    this.rejectActive?.(new AnalysisCancelledError());
    this.rejectActive = null;
  }

  dispose(): void {
    this.cancel();
  }
}
```

- [ ] **Step 4: Verify it builds and runs**

Run: `npx tsc --noEmit && npx vite build`
Expected: no type errors and a successful build with the worker emitted as its own chunk.

- [ ] **Step 5: Commit**

```bash
git add src/worker
git commit -m "feat(worker): run analysis off the main thread with a typed client

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 8: Stores, persistence, and JSON export/import

**Files:**
- Create: `src/state/projectStore.ts`
- Create: `src/state/analysisStore.ts`
- Test: `src/im/__tests__/project.test.ts`
- Create: `src/im/project.ts`

**Interfaces:**
- Consumes: `Carrier`, `Settings`, `DEFAULT_SETTINGS` (Task 1); `AnalysisClient`, `WorkerProgress`, `AnalysisInvalidError`, `AnalysisCancelledError` (Task 7).
- Produces:
  - `src/im/project.ts` (pure, therefore tested): `PROJECT_VERSION = 1`, `interface ProjectFile { version: number; name: string; carriers: Carrier[]; settings: Settings }`, `serializeProject(name: string, carriers: readonly Carrier[], settings: Settings): string`, `parseProject(json: string): ProjectFile | { error: string }`, `isProjectFile(value: unknown): value is ProjectFile`.
  - `src/state/projectStore.ts`: `useProjectStore` with state `{ name, carriers, settings }` and actions `addCarrier()`, `updateCarrier(id, patch: Partial<Omit<Carrier,'id'>>)`, `removeCarrier(id)`, `setSettings(patch: Partial<Settings>)`, `resetSettings()`, `setName(name)`, `loadProject(file: ProjectFile)`, `applySuggestions(suggestions: Suggestion[])`.
  - `src/state/analysisStore.ts`: `useAnalysisStore` with state `{ status: 'idle' | 'running' | 'done' | 'error'; progress: WorkerProgress | null; result: AnalysisResult | null; suggestions: Suggestion[]; issues: ValidationIssue[]; errorMessage: string | null }` and actions `run(carriers, settings)`, `cancel()`, `clear()`.

The parsing helpers live in `src/im/` precisely because they are pure and worth testing; the zustand stores themselves are thin wiring and are covered by the manual check in Step 6.

- [ ] **Step 1: Write the failing project-file test**

Create `src/im/__tests__/project.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeProject, parseProject, PROJECT_VERSION } from '../project';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

const carriers: Carrier[] = [
  { id: 'a', label: 'Lead vocal', freqKHz: 510000 },
  { id: 'b', label: 'Guitar', freqKHz: 530000 },
];

describe('project files', () => {
  it('round-trips a project', () => {
    const json = serializeProject('Main stage', carriers, DEFAULT_SETTINGS);
    const parsed = parseProject(json);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.version).toBe(PROJECT_VERSION);
    expect(parsed.name).toBe('Main stage');
    expect(parsed.carriers).toEqual(carriers);
    expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects malformed JSON', () => {
    const parsed = parseProject('{not json');
    expect('error' in parsed).toBe(true);
  });

  it('rejects a file that is not a project', () => {
    const parsed = parseProject(JSON.stringify({ hello: 'world' }));
    expect('error' in parsed).toBe(true);
  });

  it('rejects a newer file version', () => {
    const parsed = parseProject(
      JSON.stringify({
        version: PROJECT_VERSION + 1,
        name: 'x',
        carriers,
        settings: DEFAULT_SETTINGS,
      }),
    );
    expect('error' in parsed).toBe(true);
  });

  it('fills in missing settings keys with the defaults', () => {
    const parsed = parseProject(
      JSON.stringify({
        version: PROJECT_VERSION,
        name: 'x',
        carriers,
        settings: { bandMinKHz: 470000 },
      }),
    );
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.settings.bandMinKHz).toBe(470000);
    expect(parsed.settings.highOrder).toBe(DEFAULT_SETTINGS.highOrder);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/project.test.ts`
Expected: FAIL — cannot resolve `../project`.

- [ ] **Step 3: Write `src/im/project.ts`**

```ts
import { DEFAULT_SETTINGS, type Carrier, type Settings } from './types';

export const PROJECT_VERSION = 1;

export interface ProjectFile {
  version: number;
  name: string;
  carriers: Carrier[];
  settings: Settings;
}

function isCarrier(value: unknown): value is Carrier {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.freqKHz === 'number' &&
    Number.isFinite(c.freqKHz)
  );
}

export function serializeProject(
  name: string,
  carriers: readonly Carrier[],
  settings: Settings,
): string {
  const file: ProjectFile = {
    version: PROJECT_VERSION,
    name,
    carriers: carriers.map((c) => ({ ...c })),
    settings: { ...settings },
  };
  return JSON.stringify(file, null, 2);
}

export function parseProject(json: string): ProjectFile | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: 'The file is not valid JSON.' };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { error: 'The file is not a project.' };
  }
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.version !== 'number') {
    return { error: 'The file is not a project.' };
  }
  if (candidate.version > PROJECT_VERSION) {
    return {
      error: 'This project was saved by a newer version of the app.',
    };
  }
  if (!Array.isArray(candidate.carriers) || !candidate.carriers.every(isCarrier)) {
    return { error: 'The project contains no readable frequency list.' };
  }

  const settingsRaw =
    typeof candidate.settings === 'object' && candidate.settings !== null
      ? (candidate.settings as Partial<Settings>)
      : {};

  return {
    version: candidate.version,
    name: typeof candidate.name === 'string' ? candidate.name : 'Untitled',
    carriers: candidate.carriers,
    settings: { ...DEFAULT_SETTINGS, ...settingsRaw },
  };
}
```

Add `export * from './project';` to `src/im/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/project.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the stores**

Create `src/state/projectStore.ts`:

```ts
import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  type Carrier,
  type ProjectFile,
  type Settings,
  type Suggestion,
} from '../im';

const STORAGE_KEY = 'intermod-checker:project:v1';

interface ProjectState {
  name: string;
  carriers: Carrier[];
  settings: Settings;
  setName: (name: string) => void;
  addCarrier: () => void;
  updateCarrier: (id: string, patch: Partial<Omit<Carrier, 'id'>>) => void;
  removeCarrier: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  loadProject: (file: ProjectFile) => void;
  applySuggestions: (suggestions: Suggestion[]) => void;
}

function newId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialCarriers(): Carrier[] {
  return [
    { id: newId(), label: 'Mic 1', freqKHz: 510000 },
    { id: newId(), label: 'Mic 2', freqKHz: 530000 },
  ];
}

function loadFromStorage(): { name: string; carriers: Carrier[]; settings: Settings } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectFile>;
    if (!Array.isArray(parsed.carriers)) return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : 'Untitled',
      carriers: parsed.carriers,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return null;
  }
}

const restored = typeof localStorage === 'undefined' ? null : loadFromStorage();

export const useProjectStore = create<ProjectState>((set, get) => {
  const persist = (): void => {
    if (typeof localStorage === 'undefined') return;
    const { name, carriers, settings } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, name, carriers, settings }),
      );
    } catch {
      // Storage is full or blocked; the in-memory project still works.
    }
  };

  const update = (partial: Partial<ProjectState>): void => {
    set(partial);
    persist();
  };

  return {
    name: restored?.name ?? 'Untitled',
    carriers: restored?.carriers ?? initialCarriers(),
    settings: restored?.settings ?? DEFAULT_SETTINGS,

    setName: (name) => update({ name }),

    addCarrier: () => {
      const carriers = get().carriers;
      update({
        carriers: [
          ...carriers,
          {
            id: newId(),
            label: `Mic ${carriers.length + 1}`,
            freqKHz: get().settings.bandMinKHz,
          },
        ],
      });
    },

    updateCarrier: (id, patch) => {
      update({
        carriers: get().carriers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
    },

    removeCarrier: (id) => {
      update({ carriers: get().carriers.filter((c) => c.id !== id) });
    },

    setSettings: (patch) => update({ settings: { ...get().settings, ...patch } }),

    resetSettings: () => update({ settings: DEFAULT_SETTINGS }),

    loadProject: (file) =>
      update({
        name: file.name,
        carriers: file.carriers,
        settings: file.settings,
      }),

    applySuggestions: (suggestions) => {
      const byId = new Map(
        suggestions
          .filter((s) => s.toKHz !== null)
          .map((s) => [s.carrierId, s.toKHz as number]),
      );
      update({
        carriers: get().carriers.map((c) =>
          byId.has(c.id) ? { ...c, freqKHz: byId.get(c.id) as number } : c,
        ),
      });
    },
  };
});
```

Create `src/state/analysisStore.ts`:

```ts
import { create } from 'zustand';
import type {
  AnalysisResult,
  Carrier,
  Settings,
  Suggestion,
  ValidationIssue,
} from '../im';
import {
  AnalysisCancelledError,
  AnalysisClient,
  AnalysisInvalidError,
  type WorkerProgress,
} from '../worker/client';

const client = new AnalysisClient();

type Status = 'idle' | 'running' | 'done' | 'error';

interface AnalysisState {
  status: Status;
  progress: WorkerProgress | null;
  result: AnalysisResult | null;
  suggestions: Suggestion[];
  issues: ValidationIssue[];
  errorMessage: string | null;
  run: (carriers: Carrier[], settings: Settings) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  status: 'idle',
  progress: null,
  result: null,
  suggestions: [],
  issues: [],
  errorMessage: null,

  run: async (carriers, settings) => {
    set({
      status: 'running',
      progress: { phase: 'analyze', fraction: 0 },
      result: null,
      suggestions: [],
      issues: [],
      errorMessage: null,
    });

    try {
      const { result, suggestions } = await client.run(
        carriers,
        settings,
        (progress) => set({ progress }),
      );
      set({ status: 'done', result, suggestions, progress: null });
    } catch (error) {
      if (error instanceof AnalysisCancelledError) {
        set({ status: 'idle', progress: null });
        return;
      }
      if (error instanceof AnalysisInvalidError) {
        set({ status: 'error', issues: error.issues, progress: null,
              errorMessage: 'Fix the highlighted problems and run again.' });
        return;
      }
      set({
        status: 'error',
        progress: null,
        errorMessage:
          error instanceof Error ? error.message : 'The analysis failed.',
      });
    }
  },

  cancel: () => client.cancel(),

  clear: () =>
    set({
      status: 'idle',
      progress: null,
      result: null,
      suggestions: [],
      issues: [],
      errorMessage: null,
    }),
}));
```

- [ ] **Step 6: Verify types and the engine suite**

Run: `npx vitest run src/im && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/im/project.ts src/im/index.ts src/im/__tests__/project.test.ts src/state
git commit -m "feat(state): add project and analysis stores with local persistence

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 9: Frequency table and settings panel

**Files:**
- Create: `src/ui/FrequencyTable.tsx`
- Create: `src/ui/SettingsPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `useProjectStore` (Task 8); `useAnalysisStore` (Task 8); `parseFrequencyMHz`, `kHzToMHzText`, `mhzToKHz`, `MAX_CARRIERS`, `DEFAULT_SETTINGS` (Task 1).
- Produces: `<FrequencyTable />` and `<SettingsPanel />`, both prop-free — they read the stores directly.

Each frequency input keeps its own draft string so a partially typed value like `61` is never written back as a carrier frequency. The draft commits on blur; invalid drafts are marked and left uncommitted.

- [ ] **Step 1: Write `src/ui/FrequencyTable.tsx`**

```tsx
import { useState } from 'react';
import { kHzToMHzText, mhzToKHz, parseFrequencyMHz, MAX_CARRIERS } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';

function FrequencyInput({
  id,
  freqKHz,
  onCommit,
}: {
  id: string;
  freqKHz: number;
  onCommit: (khz: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const value = draft ?? kHzToMHzText(freqKHz);

  return (
    <input
      className={invalid ? 'freq-input freq-input--invalid' : 'freq-input'}
      inputMode="decimal"
      aria-label={`Frequency for ${id} in megahertz`}
      value={value}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={() => {
        if (draft === null) return;
        const parsed = parseFrequencyMHz(draft);
        if (parsed === null) {
          setInvalid(true);
          return;
        }
        onCommit(mhzToKHz(parsed));
        setDraft(null);
        setInvalid(false);
      }}
    />
  );
}

export function FrequencyTable() {
  const carriers = useProjectStore((s) => s.carriers);
  const addCarrier = useProjectStore((s) => s.addCarrier);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const removeCarrier = useProjectStore((s) => s.removeCarrier);
  const result = useAnalysisStore((s) => s.result);
  const issues = useAnalysisStore((s) => s.issues);

  const conflicted = new Set(result?.conflictedIds ?? []);
  const flagged = new Set(issues.flatMap((i) => i.carrierIds));

  return (
    <section className="panel">
      <h2>Frequencies</h2>
      <table className="freq-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Device</th>
            <th>Frequency (MHz)</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {carriers.map((carrier, index) => (
            <tr
              key={carrier.id}
              className={flagged.has(carrier.id) ? 'row--invalid' : undefined}
            >
              <td>{String.fromCharCode(65 + index)}</td>
              <td>
                <input
                  aria-label={`Device name for carrier ${index + 1}`}
                  value={carrier.label}
                  onChange={(e) =>
                    updateCarrier(carrier.id, { label: e.target.value })
                  }
                />
              </td>
              <td>
                <FrequencyInput
                  id={carrier.label}
                  freqKHz={carrier.freqKHz}
                  onCommit={(khz) => updateCarrier(carrier.id, { freqKHz: khz })}
                />
              </td>
              <td>
                {conflicted.has(carrier.id) ? (
                  <span className="badge badge--bad">Conflict</span>
                ) : result ? (
                  <span className="badge badge--good">Clear</span>
                ) : (
                  <span className="badge">—</span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeCarrier(carrier.id)}
                  aria-label={`Remove carrier ${index + 1}`}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addCarrier}
        disabled={carriers.length >= MAX_CARRIERS}
      >
        Add frequency
      </button>
      {carriers.length >= MAX_CARRIERS && (
        <p className="hint">Maximum of {MAX_CARRIERS} frequencies reached.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Write `src/ui/SettingsPanel.tsx`**

```tsx
import { DEFAULT_SETTINGS, kHzToMHzText, mhzToKHz, parseFrequencyMHz } from '../im';
import { useProjectStore } from '../state/projectStore';

export function SettingsPanel() {
  const settings = useProjectStore((s) => s.settings);
  const setSettings = useProjectStore((s) => s.setSettings);
  const resetSettings = useProjectStore((s) => s.resetSettings);

  const commitMHz = (text: string, key: 'bandMinKHz' | 'bandMaxKHz'): void => {
    const parsed = parseFrequencyMHz(text);
    if (parsed === null) return;
    const khz = mhzToKHz(parsed);
    setSettings(key === 'bandMinKHz' ? { bandMinKHz: khz } : { bandMaxKHz: khz });
  };

  return (
    <section className="panel">
      <h2>Analysis settings</h2>

      <label>
        Band start (MHz)
        <input
          defaultValue={kHzToMHzText(settings.bandMinKHz)}
          onBlur={(e) => commitMHz(e.target.value, 'bandMinKHz')}
        />
      </label>

      <label>
        Band end (MHz)
        <input
          defaultValue={kHzToMHzText(settings.bandMaxKHz)}
          onBlur={(e) => commitMHz(e.target.value, 'bandMaxKHz')}
        />
      </label>

      <label>
        Lowest order
        <select
          value={settings.lowOrder}
          onChange={(e) => setSettings({ lowOrder: Number(e.target.value) })}
        >
          {[2, 3, 5, 7].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <label>
        Highest order
        <select
          value={settings.highOrder}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (
              value >= 7 &&
              !window.confirm(
                'Orders of 7 and above enumerate millions of products and can take a long time. Continue?',
              )
            ) {
              return;
            }
            setSettings({ highOrder: value });
          }}
        >
          {[3, 5, 7, 9].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={settings.oddOnly}
          onChange={(e) => setSettings({ oddOnly: e.target.checked })}
        />
        Odd orders only
      </label>

      <label>
        Near-hit window (kHz)
        <input
          type="number"
          min={0}
          value={settings.nearHitWindowKHz}
          onChange={(e) =>
            setSettings({ nearHitWindowKHz: Number(e.target.value) })
          }
        />
      </label>

      <label>
        Peak deviation (kHz)
        <input
          type="number"
          min={0}
          value={settings.deviationKHz}
          onChange={(e) => setSettings({ deviationKHz: Number(e.target.value) })}
        />
      </label>

      <label>
        Minimum spacing (kHz)
        <input
          type="number"
          min={0}
          value={settings.minSpacingKHz}
          onChange={(e) => setSettings({ minSpacingKHz: Number(e.target.value) })}
        />
      </label>

      <label>
        Suggestion step (kHz)
        <input
          type="number"
          min={1}
          value={settings.suggestionStepKHz}
          onChange={(e) =>
            setSettings({ suggestionStepKHz: Number(e.target.value) })
          }
        />
      </label>

      <button type="button" onClick={resetSettings}>
        Reset to defaults ({DEFAULT_SETTINGS.lowOrder}–{DEFAULT_SETTINGS.highOrder}
        {' '}order, {DEFAULT_SETTINGS.nearHitWindowKHz} kHz window)
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Wire them into `src/App.tsx`**

Replace the generated contents of `src/App.tsx` with:

```tsx
import { FrequencyTable } from './ui/FrequencyTable';
import { SettingsPanel } from './ui/SettingsPanel';
import { useProjectStore } from './state/projectStore';
import { useAnalysisStore } from './state/analysisStore';

export default function App() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const errorMessage = useAnalysisStore((s) => s.errorMessage);
  const issues = useAnalysisStore((s) => s.issues);
  const run = useAnalysisStore((s) => s.run);
  const cancel = useAnalysisStore((s) => s.cancel);

  return (
    <main className="app">
      <h1>Intermodulation Checker</h1>
      <FrequencyTable />
      <SettingsPanel />

      <section className="panel">
        <button
          type="button"
          onClick={() => void run(carriers, settings)}
          disabled={status === 'running'}
        >
          Analyse
        </button>
        {status === 'running' && (
          <>
            <span>
              {progress?.phase === 'suggest' ? 'Finding alternatives' : 'Analysing'}
              {' '}
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
    </main>
  );
}
```

- [ ] **Step 4: Add the styles**

Append to `src/index.css`:

```css
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
.app { max-width: 68rem; margin: 0 auto; padding: 1.5rem; }
.panel { border: 1px solid #8884; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; }
.panel h2 { margin-top: 0; font-size: 1.1rem; }
.freq-table { width: 100%; border-collapse: collapse; }
.freq-table th, .freq-table td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #8883; }
.freq-table input { width: 100%; box-sizing: border-box; padding: 0.3rem; }
.freq-input--invalid { outline: 2px solid #d33; }
.row--invalid { background: #d3333318; }
.badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.8rem; background: #8883; }
.badge--bad { background: #d3333333; }
.badge--good { background: #2a842a33; }
.badge--high { background: #d3333344; }
.badge--medium { background: #d9891044; }
.badge--low { background: #8883; }
.error { color: #d33; }
.hint { color: #888; font-size: 0.85rem; }
label { display: block; margin-bottom: 0.6rem; }
button { margin-right: 0.5rem; }
@media (max-width: 640px) { .app { padding: 0.75rem; } .freq-table th:nth-child(1) { display: none; } .freq-table td:nth-child(1) { display: none; } }
```

- [ ] **Step 5: Verify in the browser**

Run: `npx tsc --noEmit && npm run dev`
Open the printed URL. Confirm: rows can be added, renamed, edited and removed; a bad frequency string is outlined red and does not corrupt the stored value; reloading the page restores the frequencies from `localStorage`; pressing **Analyse** completes and, with 510/511/509 MHz entered, marks carriers as conflicted.

- [ ] **Step 6: Commit**

```bash
git add src/ui src/App.tsx src/index.css
git commit -m "feat(ui): add frequency table and analysis settings panel

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 10: Results summary, conflict list, and spectrum strip

**Files:**
- Create: `src/ui/ResultsSummary.tsx`
- Create: `src/ui/ConflictList.tsx`
- Create: `src/ui/SpectrumStrip.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAnalysisStore`, `useProjectStore` (Task 8); `formatProduct`, `kHzToMHzText`, `type Hit`, `type Severity` (Tasks 1, 3).
- Produces: `<ResultsSummary />`, `<ConflictList />`, `<SpectrumStrip />`, all prop-free.

Self-involving hits are hidden from the headline verdict and shown behind a per-carrier toggle, since a product a carrier contributes to is normally its own harmless self-mixing rather than an external threat.

- [ ] **Step 1: Write `src/ui/ResultsSummary.tsx`**

```tsx
import type { Severity } from '../im';
import { useAnalysisStore } from '../state/analysisStore';

const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function ResultsSummary() {
  const result = useAnalysisStore((s) => s.result);
  const status = useAnalysisStore((s) => s.status);

  if (status !== 'done' || result === null) return null;

  const external = result.hits.filter((h) => !h.selfInvolving);
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const hit of external) counts[hit.severity] += 1;

  return (
    <section className="panel">
      <h2>Result</h2>
      {external.length === 0 ? (
        <p>
          <span className="badge badge--good">No conflicts</span> No
          intermodulation product falls on any of your frequencies with the
          current settings.
        </p>
      ) : (
        <p>
          <span className="badge badge--bad">
            {result.conflictedIds.length} carrier
            {result.conflictedIds.length === 1 ? '' : 's'} affected
          </span>{' '}
          {external.length} product
          {external.length === 1 ? '' : 's'} land on your frequencies.
        </p>
      )}
      <ul>
        {(['high', 'medium', 'low'] as const).map((severity) => (
          <li key={severity}>
            <span className={`badge badge--${severity}`}>
              {SEVERITY_LABEL[severity]}
            </span>{' '}
            {counts[severity]}
          </li>
        ))}
      </ul>
      <p className="hint">
        {result.vectorsExamined.toLocaleString('en-GB')} coefficient combinations
        examined.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Write `src/ui/ConflictList.tsx`**

```tsx
import { useState } from 'react';
import { formatProduct, kHzToMHzText, type Hit } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

function HitRow({ hit }: { hit: Hit }) {
  return (
    <li>
      <code>{formatProduct(hit.product.coeffs)}</code>{' '}
      = {kHzToMHzText(hit.product.freqKHz)} MHz{' '}
      <span className={`badge badge--${hit.severity}`}>
        order {hit.product.order}
      </span>{' '}
      {hit.kind === 'exact'
        ? 'direct hit'
        : `${hit.offsetKHz} kHz away`}
      {hit.selfInvolving && <span className="badge"> self-mixing</span>}
    </li>
  );
}

export function ConflictList() {
  const result = useAnalysisStore((s) => s.result);
  const carriers = useProjectStore((s) => s.carriers);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSelf, setShowSelf] = useState(false);

  if (result === null) return null;

  return (
    <section className="panel">
      <h2>Details</h2>
      <label>
        <input
          type="checkbox"
          checked={showSelf}
          onChange={(e) => setShowSelf(e.target.checked)}
        />
        Show products the carrier itself contributes to
      </label>

      {carriers.map((carrier) => {
        const all = result.hitsByCarrierId[carrier.id] ?? [];
        const hits = showSelf ? all : all.filter((h) => !h.selfInvolving);
        const isOpen = expanded === carrier.id;

        return (
          <div key={carrier.id} className="conflict">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setExpanded(isOpen ? null : carrier.id)}
            >
              {carrier.label} — {kHzToMHzText(carrier.freqKHz)} MHz —{' '}
              {hits.length === 0 ? 'clear' : `${hits.length} product(s)`}
            </button>
            {isOpen && hits.length > 0 && (
              <ul>
                {hits
                  .slice()
                  .sort((a, b) => a.product.order - b.product.order)
                  .slice(0, 100)
                  .map((hit, i) => (
                    <HitRow key={i} hit={hit} />
                  ))}
              </ul>
            )}
            {isOpen && hits.length > 100 && (
              <p className="hint">Showing the 100 lowest-order products.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 3: Write `src/ui/SpectrumStrip.tsx`**

```tsx
import { kHzToMHzText } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

export function SpectrumStrip() {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const result = useAnalysisStore((s) => s.result);

  const span = settings.bandMaxKHz - settings.bandMinKHz;
  if (span <= 0) return null;

  const position = (khz: number): number =>
    ((khz - settings.bandMinKHz) / span) * 100;

  const conflicted = new Set(result?.conflictedIds ?? []);
  const products = (result?.hits ?? [])
    .filter((h) => !h.selfInvolving)
    .slice(0, 400);

  return (
    <section className="panel">
      <h2>Spectrum</h2>
      <div className="spectrum">
        {products.map((hit, i) => (
          <span
            key={`p-${i}`}
            className={`spectrum__product spectrum__product--${hit.severity}`}
            style={{ left: `${position(hit.product.freqKHz)}%` }}
            title={`${kHzToMHzText(hit.product.freqKHz)} MHz, order ${hit.product.order}`}
          />
        ))}
        {carriers.map((carrier) => (
          <span
            key={carrier.id}
            className={
              conflicted.has(carrier.id)
                ? 'spectrum__carrier spectrum__carrier--bad'
                : 'spectrum__carrier'
            }
            style={{ left: `${position(carrier.freqKHz)}%` }}
            title={`${carrier.label} — ${kHzToMHzText(carrier.freqKHz)} MHz`}
          />
        ))}
      </div>
      <div className="spectrum__scale">
        <span>{kHzToMHzText(settings.bandMinKHz)} MHz</span>
        <span>{kHzToMHzText(settings.bandMaxKHz)} MHz</span>
      </div>
    </section>
  );
}
```

Append to `src/index.css`:

```css
.spectrum { position: relative; height: 64px; border: 1px solid #8884; border-radius: 4px; overflow: hidden; }
.spectrum__product { position: absolute; bottom: 0; width: 1px; height: 40%; background: #8886; }
.spectrum__product--high { background: #dd3333aa; }
.spectrum__product--medium { background: #d98910aa; }
.spectrum__product--low { background: #8888; }
.spectrum__carrier { position: absolute; top: 0; width: 2px; height: 100%; background: #2a842a; }
.spectrum__carrier--bad { background: #d33; }
.spectrum__scale { display: flex; justify-content: space-between; font-size: 0.8rem; color: #888; }
.conflict { margin-bottom: 0.5rem; }
```

- [ ] **Step 4: Wire the three components into `src/App.tsx`**

Add the imports and render them after the Analyse panel:

```tsx
import { ResultsSummary } from './ui/ResultsSummary';
import { ConflictList } from './ui/ConflictList';
import { SpectrumStrip } from './ui/SpectrumStrip';
```

and inside `<main className="app">`, after the analyse `<section>`:

```tsx
      <ResultsSummary />
      <SpectrumStrip />
      <ConflictList />
```

- [ ] **Step 5: Verify in the browser**

Run: `npx tsc --noEmit && npm run dev`
Enter 510.000, 511.000 and 509.000 MHz and press **Analyse**. Confirm: the summary reports affected carriers; the spectrum strip shows a red marker on 509 MHz; expanding that carrier in the details list shows `2A − B = 509.000 MHz` with an `order 3` badge; ticking the self-mixing checkbox reveals additional entries.

- [ ] **Step 6: Commit**

```bash
git add src/ui src/App.tsx src/index.css
git commit -m "feat(ui): present the analysis verdict, spectrum and conflict detail

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 11: Suggestions panel and project actions

**Files:**
- Create: `src/ui/SuggestionPanel.tsx`
- Create: `src/ui/ProjectBar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useProjectStore` (`applySuggestions`, `loadProject`, `setName`), `useAnalysisStore` (`suggestions`, `clear`), `serializeProject`, `parseProject`, `kHzToMHzText` (Tasks 1, 8).
- Produces: `<SuggestionPanel />` and `<ProjectBar />`, both prop-free.

Applying a suggestion invalidates the displayed result, so both apply actions call `clear()` on the analysis store — showing stale conflicts against changed frequencies would be worse than showing nothing.

- [ ] **Step 1: Write `src/ui/SuggestionPanel.tsx`**

```tsx
import { kHzToMHzText } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';

export function SuggestionPanel() {
  const suggestions = useAnalysisStore((s) => s.suggestions);
  const clear = useAnalysisStore((s) => s.clear);
  const status = useAnalysisStore((s) => s.status);
  const carriers = useProjectStore((s) => s.carriers);
  const applySuggestions = useProjectStore((s) => s.applySuggestions);

  if (status !== 'done' || suggestions.length === 0) return null;

  const labelFor = (id: string): string =>
    carriers.find((c) => c.id === id)?.label ?? id;

  const applicable = suggestions.filter((s) => s.toKHz !== null);

  return (
    <section className="panel">
      <h2>Suggested changes</h2>
      <p className="hint">
        Each suggestion is calculated with the previous ones already applied, so
        applying them all yields an interference-free set.
      </p>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.carrierId}>
            <strong>{labelFor(suggestion.carrierId)}</strong>{' '}
            {kHzToMHzText(suggestion.fromKHz)} MHz →{' '}
            {suggestion.toKHz === null ? (
              <em>{suggestion.failureReason}</em>
            ) : (
              <>
                <strong>{kHzToMHzText(suggestion.toKHz)} MHz</strong> (
                {suggestion.distanceKHz} kHz away){' '}
                <button
                  type="button"
                  onClick={() => {
                    applySuggestions([suggestion]);
                    clear();
                  }}
                >
                  Apply
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={applicable.length === 0}
        onClick={() => {
          applySuggestions(applicable);
          clear();
        }}
      >
        Apply all ({applicable.length})
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Write `src/ui/ProjectBar.tsx`**

```tsx
import { useRef, useState } from 'react';
import { parseProject, serializeProject } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';

export function ProjectBar() {
  const name = useProjectStore((s) => s.name);
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const setName = useProjectStore((s) => s.setName);
  const loadProject = useProjectStore((s) => s.loadProject);
  const clear = useAnalysisStore((s) => s.clear);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const exportProject = (): void => {
    const json = serializeProject(name, carriers, settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name.replace(/[^\w-]+/g, '-') || 'project'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importProject = async (file: File): Promise<void> => {
    const parsed = parseProject(await file.text());
    if ('error' in parsed) {
      setImportError(parsed.error);
      return;
    }
    setImportError(null);
    loadProject(parsed);
    clear();
  };

  return (
    <section className="panel">
      <label>
        Project name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="button" onClick={exportProject}>
        Export JSON
      </button>
      <button type="button" onClick={() => fileInput.current?.click()}>
        Import JSON
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importProject(file);
          e.target.value = '';
        }}
      />
      {importError !== null && <p className="error">{importError}</p>}
      <p className="hint">
        Your frequencies stay in this browser — nothing is uploaded.
      </p>
    </section>
  );
}
```

- [ ] **Step 3: Wire them into `src/App.tsx`**

Add the imports:

```tsx
import { SuggestionPanel } from './ui/SuggestionPanel';
import { ProjectBar } from './ui/ProjectBar';
```

Render `<ProjectBar />` directly under the `<h1>`, and `<SuggestionPanel />` immediately after `<ResultsSummary />`.

- [ ] **Step 4: Verify in the browser**

Run: `npx tsc --noEmit && npm run dev`
With 510/511/509 MHz: press **Analyse**, confirm a suggestion appears for the conflicted carrier, press **Apply all**, then press **Analyse** again and confirm the result is now "No conflicts". Export the project, reload the page, change a frequency, then import the exported file and confirm the original frequencies return. Import a text file that is not JSON and confirm a readable error appears instead of a crash.

- [ ] **Step 5: Commit**

```bash
git add src/ui src/App.tsx
git commit -m "feat(ui): apply suggested frequencies and export or import projects

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 12: README, disclaimer, and the final gate

**Files:**
- Create: `README.md`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: everything built so far.
- Produces: no code interfaces; this task closes the project out.

- [ ] **Step 1: Add the disclaimer to the UI**

In `src/App.tsx`, add this as the last child of `<main className="app">`:

```tsx
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
```

- [ ] **Step 2: Write `README.md`**

````markdown
# Intermodulation Checker

A browser tool for checking whether a set of wireless microphone frequencies
generates intermodulation products that land on each other, and for proposing
replacement frequencies when they do.

## What it does

- Accepts 2–24 carrier frequencies (designed around a typical 10–12 microphone
  setup) in the 500–700 MHz band.
- Enumerates intermodulation products of the form `n₁A ± n₂B ± n₃C …` up to the
  chosen order and reports every product that falls on one of your own
  receivers.
- Classifies each hit as a direct hit or a near hit within a configurable
  window, and ranks it by order — third order is the most severe, fifth order
  next, seventh and above least.
- Proposes a replacement frequency for each conflicted carrier, computed
  sequentially so that applying every suggestion produces a clean set.

## Running it

```bash
npm install
npm run dev      # development server
npm run build    # production build into dist/
npm test         # engine test suite
npm run typecheck
```

## How the calculation works

Every intermodulation product is a coefficient vector over your carriers. The
tool enumerates each vector once in canonical form — the first non-zero
coefficient is always positive, because a vector and its negation describe the
same product — and evaluates `|Σ nᵢ · fᵢ|`. Products outside the band are
discarded. A product is a conflict when it falls within
`max(near-hit window, order × deviation)` of one of your carriers; the
deviation term reflects that a product's frequency swing is the sum of the
contributing signals' deviations scaled by their coefficients, so higher-order
products sweep proportionally wider.

All arithmetic is done in whole kilohertz, so a direct hit is an exact integer
match rather than a floating-point comparison.

## Privacy

Everything runs in your browser. Projects are stored in `localStorage` and can
be exported to or imported from a JSON file. Nothing is sent to a server.

## Disclaimer

This tool models intermodulation arithmetically. It has no knowledge of
transmitter power, antenna placement, receiver filtering, external
transmitters, or licensing. Treat its output as a planning aid and verify on
site.

## Documentation

- Design: `docs/superpowers/specs/2026-08-09-intermod-checker-design.md`
- Plan: `docs/superpowers/plans/2026-08-09-intermod-checker.md`
````

- [ ] **Step 3: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors, all engine tests pass, and a successful production build.

- [ ] **Step 4: Smoke-test the production build**

Run: `npx vite preview`
Open the printed URL and run one full cycle: enter frequencies, analyse, apply a suggestion, re-analyse, export.

- [ ] **Step 5: Commit**

```bash
git add README.md src/App.tsx
git commit -m "docs: document the tool, its method and its limits

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```
