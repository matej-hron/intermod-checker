# Row Delete + Live Conflict Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user delete a mic straight from the frequency list (with a 5-second undo) and see, while editing a frequency, whether it conflicts — with tappable nearest-clear alternatives.

**Architecture:** All judgment for the conflict check goes into a new pure module `src/im/liveCheck.ts` that wraps the existing `evaluateCandidate` and `generateCandidates`, so the sheet can never disagree with the Tune view. Delete-with-undo is a single store action pairing `projectStore.deleteCarrierWithUndo` with a `viewStore.pendingDelete` record, and a new `UndoBar` component owns the 5-second timer.

**Tech Stack:** React 19, TypeScript, Vite 8, Zustand, Vitest (node environment), oxlint.

Spec: `docs/superpowers/specs/2026-08-12-row-delete-and-live-conflict-check-design.md`

## Global Constraints

These apply to **every** task. Read them before starting any task.

- **Vitest is `environment: 'node'`** with `include: ['src/**/__tests__/**/*.test.ts']` — **`.ts` only, no `.tsx`, no DOM, no jsdom.** React components are **not** unit-testable in this repo *by design*. Do not add jsdom, do not add Testing Library, do not write `.test.tsx`. Component behaviour is verified in a real browser. Put all judgment in pure `.ts` modules.
- **`src/styles/base.css` already gives bare `button`, `input`, and `select` a 44 px min-height and a ≥16 px font size.** A plain `<button>` is already tap-sized — do not add redundant sizing rules.
- **The Chrome grid-`<button>` trap:** a `<button>` with `display: grid` or `display: flex` inherits the UA stylesheet's `justify-content: center`, so its grid shrink-wraps to a content-sized column and text renders centred and truncated. Any such button needs `grid-template-columns: minmax(0, 1fr)` + `justify-content: stretch` + `justify-items: stretch` + `width: 100%`. This bug shipped twice already.
- **`PROJECT_VERSION` stays 3.** Do not bump it. Nothing in this plan changes the persisted schema.
- **The legacy key `intermod-checker:project:v1`** is read once at boot and **never written or removed**. Do not touch it.
- **Typecheck is `npm run typecheck`** (`tsc -b --noEmit`); the root `tsconfig.json` is references-only, so `npx tsc` on a file alone proves nothing. Lint is `npm run lint` (oxlint). Tests are `npm test`.
- **Colour is never the only signal.** Verdicts use `<VerdictDot>`, which encodes verdict as shape (hollow / ring / filled) and carries a visually-hidden text label.
- **Commit style:** Conventional Commits. Every commit message must end with both trailers:
  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f
  ```
- **Existing defaults** (`src/im/types.ts`): `bandMinKHz: 500000`, `bandMaxKHz: 700000`, `lowOrder: 3`, `highOrder: 5`, `oddOnly: true`, `nearHitWindowKHz: 25`, `deviationKHz: 0`, `minSpacingKHz: 250`, `suggestionStepKHz: 25`, `exclusions: []`. `MAX_CARRIERS = 24`.
- **Do not "fix" unrelated code.** `setName` and `loadProject` in `projectStore.ts` are known dead code, deliberately left alone.

---

### Task 1: The `liveCheck` pure module

**Files:**
- Create: `src/im/liveCheck.ts`
- Create: `src/im/__tests__/liveCheck.test.ts`
- Modify: `src/im/index.ts` (add one export line)

**Interfaces:**
- Consumes: `evaluateCandidate(freqs, index, candidateKHz, settings, carriers, mode)` from `./evaluate`, returning `{ freqKHz, verdicts, worst, explanation }`; `explanationText(explanation)` from `./evaluate`; `generateCandidates(fromKHz, settings, halfWidthKHz)` from `./candidates`; `type Carrier`, `type Settings`, `type Verdict` from `./types` / `./criteria`.
- Produces:
  ```ts
  export const LIVE_CHECK_HALF_WIDTH_KHZ = 500;
  export const LIVE_CHECK_MAX_ALTERNATIVES = 3;
  export interface LiveCheckResult {
    verdict: Verdict;
    explanation: string;
    alternatives: number[];
    searched: boolean;
  }
  export function liveCheck(
    carriers: readonly Carrier[],
    settings: Settings,
    carrierId: string,
    candidateKHz: number,
    maxAlternatives?: number,
    halfWidthKHz?: number,
  ): LiveCheckResult;
  ```
  Task 4 consumes `liveCheck` and the `LiveCheckResult` type. The two constants are exported for the tests and for future callers.

- [ ] **Step 1: Write the failing test**

Create `src/im/__tests__/liveCheck.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { liveCheck, LIVE_CHECK_HALF_WIDTH_KHZ } from '../liveCheck';
import { evaluateCandidate } from '../evaluate';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from '../types';

const settings: Settings = { ...DEFAULT_SETTINGS };

function carrier(id: string, freqKHz: number, locked = false): Carrier {
  return { id, label: id, freqKHz, locked };
}

// 600.000 and 601.000 make a 3rd-order product at 2*601000 - 600000 = 602000.
const THIRD_ORDER = [carrier('a', 600000), carrier('b', 601000), carrier('c', 602000)];

describe('liveCheck', () => {
  it('reports clear and does not search when nothing lands on the frequency', () => {
    const spread = [carrier('a', 510000), carrier('b', 530000), carrier('c', 551000)];
    const r = liveCheck(spread, settings, 'c', 551000);
    expect(r.verdict).toBe('clear');
    expect(r.alternatives).toEqual([]);
    expect(r.searched).toBe(false);
  });

  it('catches a carrier sitting on a 3rd-order product', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000);
    expect(r.verdict).toBe('exact');
    expect(r.explanation).not.toBe('');
    expect(r.explanation).not.toBe('Clear');
    expect(r.searched).toBe(true);
  });

  it('returns alternatives nearest first, and every one really is clear', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000);
    expect(r.alternatives.length).toBeGreaterThan(0);

    const distances = r.alternatives.map((f) => Math.abs(f - 602000));
    expect([...distances].sort((x, y) => x - y)).toEqual(distances);

    const freqs = THIRD_ORDER.map((c) => c.freqKHz);
    for (const alt of r.alternatives) {
      expect(Math.abs(alt - 602000)).toBeLessThanOrEqual(LIVE_CHECK_HALF_WIDTH_KHZ);
      expect(evaluateCandidate(freqs, 2, alt, settings, THIRD_ORDER, 'full').worst).toBe('clear');
    }
  });

  it('never offers the conflicting frequency itself as an alternative', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000);
    expect(r.alternatives).not.toContain(602000);
  });

  it('respects maxAlternatives', () => {
    expect(liveCheck(THIRD_ORDER, settings, 'c', 602000, 1).alternatives).toHaveLength(1);
    expect(liveCheck(THIRD_ORDER, settings, 'c', 602000, 3).alternatives.length).toBeLessThanOrEqual(3);
  });

  it('catches a minimum-spacing violation', () => {
    const tight = [carrier('a', 600000), carrier('b', 600100)];
    // 100 kHz apart, under the 250 kHz minimum.
    const r = liveCheck(tight, settings, 'b', 600100);
    expect(r.verdict).toBe('exact');
    expect(r.searched).toBe(true);
  });

  it('catches an excluded range', () => {
    const excluded: Settings = {
      ...settings,
      exclusions: [{ id: 'x', startKHz: 599000, endKHz: 601000, label: 'DTV' }],
    };
    const r = liveCheck([carrier('a', 600000)], excluded, 'a', 600000);
    expect(r.verdict).toBe('exact');
  });

  it('returns fewer than the maximum rather than padding when the window is exhausted', () => {
    // A 25 kHz window at a 25 kHz step offers one alternative either side at most.
    const r = liveCheck(THIRD_ORDER, settings, 'c', 602000, 3, 25);
    expect(r.alternatives.length).toBeLessThanOrEqual(2);
    expect(r.searched).toBe(true);
  });

  it('returns a cleared result without throwing for an unknown carrier id', () => {
    const r = liveCheck(THIRD_ORDER, settings, 'nope', 602000);
    expect(r.verdict).toBe('clear');
    expect(r.alternatives).toEqual([]);
    expect(r.searched).toBe(false);
  });

  it('judges a locked carrier normally', () => {
    const locked = [carrier('a', 600000), carrier('b', 601000), carrier('c', 602000, true)];
    expect(liveCheck(locked, settings, 'c', 602000).verdict).toBe('exact');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/im/__tests__/liveCheck.test.ts`

Expected: FAIL — cannot resolve `../liveCheck`.

- [ ] **Step 3: Write the implementation**

Create `src/im/liveCheck.ts`:

```ts
import { generateCandidates } from './candidates';
import { evaluateCandidate, explanationText } from './evaluate';
import type { Verdict } from './criteria';
import type { Carrier, Settings } from './types';

/** How far either side of the typed frequency the live check will look. */
export const LIVE_CHECK_HALF_WIDTH_KHZ = 500;

/** How many clear alternatives the sheet offers as chips. */
export const LIVE_CHECK_MAX_ALTERNATIVES = 3;

export interface LiveCheckResult {
  verdict: Verdict;
  /** `explanationText()` of the worst hit; empty when clear. */
  explanation: string;
  /** Clear frequencies in kHz, nearest first, at most `maxAlternatives`. */
  alternatives: number[];
  /** False when no search was run — either the frequency is clear or unknown. */
  searched: boolean;
}

const CLEAR: LiveCheckResult = {
  verdict: 'clear',
  explanation: '',
  alternatives: [],
  searched: false,
};

/**
 * Answers "is this frequency usable, and if not, what is nearby?" for a single
 * carrier being edited.
 *
 * It delegates the verdict to `evaluateCandidate`, the same function the Tune
 * grid uses, so the edit sheet can never contradict Tune. The search is skipped
 * entirely when the frequency is already clear, which is the common case.
 *
 * Pure: no clock, no randomness, no storage. Every input is a parameter.
 */
export function liveCheck(
  carriers: readonly Carrier[],
  settings: Settings,
  carrierId: string,
  candidateKHz: number,
  maxAlternatives: number = LIVE_CHECK_MAX_ALTERNATIVES,
  halfWidthKHz: number = LIVE_CHECK_HALF_WIDTH_KHZ,
): LiveCheckResult {
  const index = carriers.findIndex((c) => c.id === carrierId);
  // A carrier can vanish between a debounce firing and this call — deleted, or
  // the project switched. Saying "clear" is wrong, but there is nothing to be
  // right about, and throwing would take the sheet down with it.
  if (index === -1) return CLEAR;

  const freqs = carriers.map((c) => c.freqKHz);
  const evaluation = evaluateCandidate(freqs, index, candidateKHz, settings, carriers, 'full');

  if (evaluation.worst === 'clear') return CLEAR;

  const alternatives: number[] = [];
  if (maxAlternatives > 0) {
    // Nearest-first by construction, so the first clear hits are the closest.
    for (const freq of generateCandidates(candidateKHz, settings, halfWidthKHz)) {
      if (freq === candidateKHz) continue;
      const alt = evaluateCandidate(freqs, index, freq, settings, carriers, 'first-hit');
      if (alt.worst !== 'clear') continue;
      alternatives.push(freq);
      if (alternatives.length >= maxAlternatives) break;
    }
  }

  return {
    verdict: evaluation.worst,
    explanation: explanationText(evaluation.explanation),
    alternatives,
    searched: true,
  };
}
```

- [ ] **Step 4: Export it from the barrel**

In `src/im/index.ts`, add after the `export * from './candidates';` line:

```ts
export * from './liveCheck';
```

- [ ] **Step 5: Run the tests and the gate**

Run: `npm test -- src/im/__tests__/liveCheck.test.ts`
Expected: PASS, 9 tests.

Then run the full gate: `npm test && npm run typecheck && npm run lint`
Expected: all green, no new failures.

If a test fails because the arithmetic assumption in the fixture is wrong (for example `602000` is not actually a hit for that set), **fix the fixture, not the assertion's intent** — pick real numbers by checking `evaluateCandidate` directly, and keep the test's meaning.

**These fixtures were verified against the real `evaluateCandidate` before this plan was written.** The confirmed values, for reference if a test surprises you:

| Fixture | Result |
| --- | --- |
| `[600000, 601000, 602000]`, index 2 at 602000 | `worst: 'exact'`, explanation `3rd order · b` (`2×601000 − 600000 = 602000`) |
| alternatives for the above, ±500 kHz | `[601950, 602050, 601925]` — distances 50, 50, 75 kHz |
| alternatives for the above, ±25 kHz | `[]` — the window is too narrow, so `alternatives` comes back empty |
| `[510000, 530000, 551000]`, index 2 at 551000 | `worst: 'clear'` |
| `[600000, 600100]`, index 1 at 600100 | `worst: 'exact'` (100 kHz < the 250 kHz minimum) |
| `[600000]` with exclusion 599000–601000, index 0 | `worst: 'exact'` |
| the 3rd-order set with carrier `c` locked | `worst: 'exact'` — the lock does not suppress the verdict |

If your implementation produces these, it is correct.

- [ ] **Step 6: Commit**

```bash
git add src/im/liveCheck.ts src/im/__tests__/liveCheck.test.ts src/im/index.ts
git commit -m "feat: add liveCheck for per-carrier conflict verdicts and alternatives

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 2: Delete-with-undo store plumbing

**Files:**
- Modify: `src/state/viewStore.ts`
- Modify: `src/state/projectStore.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  ```ts
  // viewStore
  pendingDelete: PendingDelete | null;   // { carrier: Carrier; index: number; token: number }
  requestUndo: (carrier: Carrier, index: number) => void;
  clearPendingDelete: () => void;

  // projectStore
  deleteCarrierWithUndo: (id: string) => void;
  restoreCarrier: (carrier: Carrier, index: number) => void;
  ```
  Task 3 consumes all of these.

**Context you need:** `viewStore.ts` is a small Zustand store with `view`, `editingCarrierId`, `goTo`, `openTune`, `openCarrier`, `closeCarrier`. `projectStore.ts` already imports `useViewStore` (it calls `useViewStore.getState().closeCarrier()` inside `openFromLibrary`), so calling into it is an established pattern and creates no new cycle. `projectStore` has an internal `update(partial)` helper that sets state, persists, and clears the analysis and tune stores — every carrier change must go through it.

- [ ] **Step 1: Add the pending-delete slice to `viewStore.ts`**

Add the `Carrier` type import at the top:

```ts
import type { Carrier } from '../im';
```

Add above the `ViewState` interface:

```ts
export interface PendingDelete {
  carrier: Carrier;
  index: number;
  /** Monotonic, so a second delete restarts the undo timer instead of
   *  inheriting the first one's remaining time. */
  token: number;
}
```

Add to the `ViewState` interface:

```ts
  pendingDelete: PendingDelete | null;
  requestUndo: (carrier: Carrier, index: number) => void;
  clearPendingDelete: () => void;
```

Add to the store body, alongside the existing actions:

```ts
  pendingDelete: null,
  requestUndo: (carrier, index) =>
    set((s) => ({
      pendingDelete: { carrier, index, token: (s.pendingDelete?.token ?? 0) + 1 },
    })),
  clearPendingDelete: () => set({ pendingDelete: null }),
```

Note this requires the store's `create` callback to expose `set` in the `(set) => ({...})` form it already uses — the functional `set((s) => ...)` overload works there unchanged.

Also add `pendingDelete: null` to the state cleared by `openTune`? **No** — leave `openTune` alone. Tune is reached from the sheet, not from a delete, and clearing there would silently discard an undo the user can still see.

- [ ] **Step 2: Add `deleteCarrierWithUndo` and `restoreCarrier` to `projectStore.ts`**

Add to the `ProjectState` interface, right after `removeCarrier`:

```ts
  deleteCarrierWithUndo: (id: string) => void;
  restoreCarrier: (carrier: Carrier, index: number) => void;
```

Add to the returned store object, right after the existing `removeCarrier` implementation:

```ts
    // Pairs removal with the undo record in one action, so no caller can
    // delete a carrier and forget to offer the way back.
    deleteCarrierWithUndo: (id) => {
      const carriers = get().carriers;
      const index = carriers.findIndex((c) => c.id === id);
      if (index === -1) return;
      const carrier = carriers[index];
      update({ carriers: carriers.filter((c) => c.id !== id) });
      useViewStore.getState().requestUndo(carrier, index);
    },

    restoreCarrier: (carrier, index) => {
      const carriers = get().carriers;
      if (carriers.length >= MAX_CARRIERS) return;
      if (carriers.some((c) => c.id === carrier.id)) return;
      const next = [...carriers];
      // The list may have shrunk while the undo bar was up.
      next.splice(Math.min(Math.max(index, 0), next.length), 0, carrier);
      update({ carriers: next });
    },
```

Add `MAX_CARRIERS` to the existing import from `'../im'` (the big multi-line `import { ... } from '../im'` block near the top — add it in alphabetical position among the value imports, before `migrateSingleProject`).

- [ ] **Step 3: Clear the pending delete when the project switches**

In `openFromLibrary`, next to the existing `useViewStore.getState().closeCarrier();`, add:

```ts
    // A pending undo must never survive into a different project: its index
    // means nothing there and restoring would inject a mic the user never made.
    useViewStore.getState().clearPendingDelete();
```

- [ ] **Step 4: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green — 233+ tests pass, no type errors, no lint errors.

There are no new unit tests in this task: both stores are Zustand singletons that touch `localStorage`, and this repo's node-only Vitest setup does not test them (there is no existing store test file). The behaviour is verified in the browser during Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/state/viewStore.ts src/state/projectStore.ts
git commit -m "feat: add delete-with-undo state to the view and project stores

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 3: The row delete button and the undo bar

**Files:**
- Create: `src/ui/UndoBar.tsx`
- Modify: `src/ui/CarrierList.tsx`
- Modify: `src/ui/CarrierSheet.tsx` (delete without `confirm`)
- Modify: `src/App.tsx` (render `<UndoBar />`)
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `useViewStore` → `pendingDelete`, `clearPendingDelete`; `useProjectStore` → `deleteCarrierWithUndo`, `restoreCarrier` (all from Task 2).
- Produces: `export function UndoBar()` from `src/ui/UndoBar.tsx`.

**Context you need:** `CarrierList.tsx` renders each carrier as an `<li className="carrier">` containing **two sibling buttons** — `.carrier__open` (the two-line body) and `.carrier__lock`. Buttons are never nested. The `.carrier` grid is currently `grid-template-columns: minmax(0, 1fr) var(--tap)`. `--tap` is the 44 px tap target variable.

- [ ] **Step 1: Create `src/ui/UndoBar.tsx`**

```tsx
import { useEffect } from 'react';
import { useProjectStore } from '../state/projectStore';
import { useViewStore } from '../state/viewStore';

/** How long the user has to change their mind, in milliseconds. */
const UNDO_WINDOW_MS = 5000;

/**
 * The way back from a deletion.
 *
 * A confirmation dialog would tax every deletion to protect against the rare
 * mistaken one; this taxes none and still covers the mistake. It is a
 * `role="status"` region so screen readers announce it without stealing focus
 * from wherever the user is.
 */
export function UndoBar() {
  const pending = useViewStore((s) => s.pendingDelete);
  const clearPendingDelete = useViewStore((s) => s.clearPendingDelete);
  const restoreCarrier = useProjectStore((s) => s.restoreCarrier);

  const token = pending?.token ?? null;

  useEffect(() => {
    if (token === null) return;
    // Keyed on `token`, not on `pending`: deleting a second mic restarts the
    // full window rather than inheriting what was left of the first.
    const timer = setTimeout(clearPendingDelete, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [token, clearPendingDelete]);

  if (pending === null) return null;

  return (
    <div className="undo-bar" role="status">
      <span className="undo-bar__text">Deleted {pending.carrier.label}</span>
      <button
        type="button"
        className="undo-bar__action"
        onClick={() => {
          restoreCarrier(pending.carrier, pending.index);
          clearPendingDelete();
        }}
      >
        Undo
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add the delete button to `CarrierList.tsx`**

Replace the `updateCarrier` selector line's neighbourhood so the component also pulls the delete action. Add this selector alongside the existing ones:

```tsx
  const deleteCarrier = useProjectStore((s) => s.deleteCarrierWithUndo);
```

Then, immediately **after** the closing `</button>` of `.carrier__lock` and **before** the `</li>`, add a third sibling:

```tsx
            <button
              type="button"
              className="carrier__delete"
              aria-label={`Delete ${carrier.label}`}
              onClick={() => deleteCarrier(carrier.id)}
            >
              <span aria-hidden="true">🗑</span>
            </button>
```

- [ ] **Step 3: Drop the `confirm` from `CarrierSheet.tsx`**

Replace the `removeCarrier` selector:

```tsx
  const removeCarrier = useProjectStore((s) => s.removeCarrier);
```

with:

```tsx
  const deleteCarrier = useProjectStore((s) => s.deleteCarrierWithUndo);
```

and replace the Delete button's `onClick` body:

```tsx
          onClick={() => {
            if (window.confirm(`Delete ${carrier.label}? This cannot be undone.`)) {
              removeCarrier(carrier.id);
            }
          }}
```

with:

```tsx
          // The sheet closes on its own: the carrier it is bound to is gone,
          // which trips the existing `carrier === null` return.
          onClick={() => deleteCarrier(carrier.id)}
```

- [ ] **Step 4: Render the bar in `App.tsx`**

Add the import beside the other `./ui/` imports:

```tsx
import { UndoBar } from './ui/UndoBar';
```

and render it immediately **before** `<UpdatePrompt />` near the end of the tree:

```tsx
      <UndoBar />
      <UpdatePrompt />
```

- [ ] **Step 5: Add the CSS**

In `src/styles/components.css`, change the `.carrier` grid to make room for the third column:

```css
.carrier {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--tap) var(--tap);
  align-items: stretch;
  gap: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
```

Add after the existing `.carrier__lock` rule:

```css
.carrier__delete {
  align-self: center;
  min-width: var(--tap);
  background: none;
  border: 0;
}
```

`.carrier__delete` is a plain centred glyph button — no `display: grid` — so the Chrome grid-`<button>` trap does not apply. **Do not give it `display: grid` or `display: flex`.**

Add at the end of the file:

```css
.undo-bar {
  position: fixed;
  left: var(--space-3);
  right: var(--space-3);
  /* The nav is --tap tall at the very bottom; the action bar sits directly on
     top of it and is roughly another --tap plus its own padding. Clearing both
     keeps Undo reachable without covering Analyse. */
  bottom: calc(var(--tap) * 2 + var(--space-4) + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--text);
  color: var(--surface);
  box-shadow: var(--shadow);
}
.undo-bar__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.undo-bar__action {
  flex: 0 0 auto;
  background: none;
  border: 0;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
}
```

All of `--tap` (2.75rem), `--space-2`, `--space-3`, `--space-4`, `--radius`,
`--shadow`, `--text`, and `--surface` are real tokens in
`src/styles/tokens.css` — no fallbacks needed. There is **no**
`--action-bar-height` token; the offset above is computed from the layout
instead. `.action-bar` is `position: fixed; inset: auto 0 calc(var(--tap) +
env(safe-area-inset-bottom)) 0;` with `z-index: 19`, so the undo bar's
`z-index: 20` puts it above.

Note `background: var(--text)` and `color: var(--surface)` deliberately invert
the page colours, and both tokens flip in the dark-mode block, so the bar stays
legible in both themes. **Verify the contrast in dark mode in step 7.**

- [ ] **Step 6: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 7: Verify in a real browser at 390 px**

Run `npm run build && npx vite preview --port 0` and **read the port it prints** — it is random. Then check, at a 390 × 844 viewport:

1. Every row shows three controls; tapping 🗑 removes the row immediately.
2. The undo bar appears, reads `Deleted <name>`, and does not cover the Analyse button.
3. Undo puts the mic back **at its original position** (delete the middle of three, undo, confirm the order is unchanged).
4. Without pressing Undo, the bar disappears after ~5 seconds and the mic stays gone.
5. Deleting a second mic while the first bar is still up restarts the 5-second window.
6. Opening the projects sheet and switching projects while a bar is up: the bar disappears and no mic is injected into the new project.
7. Deleting from inside the edit sheet closes the sheet and raises the bar.
8. No horizontal overflow: `document.documentElement.scrollWidth === 390`.
9. All three row controls measure ≥ 44 px in both dimensions.
10. Zero console errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/UndoBar.tsx src/ui/CarrierList.tsx src/ui/CarrierSheet.tsx src/App.tsx src/styles/components.css
git commit -m "feat: delete a frequency from the list with a five-second undo

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 4: The live conflict check in the edit sheet

**Files:**
- Modify: `src/ui/CarrierSheet.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `liveCheck`, `type LiveCheckResult` from `../im` (Task 1); `kHzToMHzText` from `../im`. It does **not** use `LIVE_CHECK_HALF_WIDTH_KHZ` — see step 2.
- Produces: nothing consumed by later tasks.

**Context you need:** `CarrierSheet.tsx` calls its hooks (`useProjectStore`, `useViewStore`, `useRef`, `useEffect`) **before** the `if (carrier === null) return null;` early return — any new hook must go in that same block, above the early return, and must not read `carrier` unconditionally in a way that crashes when it is null. `VerdictDot` takes `{ verdict: Verdict; criterion: CriterionKey }` and renders a shape-coded dot plus a visually-hidden label. `MHzInput` keeps half-typed text in local state and only calls `onCommit` with a parsed, valid value, so `carrier.freqKHz` is never a partial number.

- [ ] **Step 1: Add the debounced check to `CarrierSheet.tsx`**

Extend the imports:

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  kHzToMHzText,
  liveCheck,
  type LiveCheckResult,
} from '../im';
```

**Do not import `VerdictDot`.** It takes a `CriterionKey` and renders
`criterionLabel(criterion)` into its hidden label, so the only keys it can
describe are `'spacing'`, `'exclusion'`, and `NTMO` product keys. The live
check reports a single worst verdict across *all* criteria and does not know
which one produced it, so any key passed would be a guess — and a screen
reader would read "Minimum spacing: direct hit" over an intermodulation hit.
This block renders the dot directly with an honest label instead, reusing the
same `.dot`/`.dot--*` classes so the shape coding is identical.

Add these selectors alongside the existing ones:

```tsx
  const settings = useProjectStore((s) => s.settings);
```

Add this hook **after** the existing `useEffect` and **before** `if (carrier === null) return null;`:

```tsx
  const [check, setCheck] = useState<LiveCheckResult | null>(null);

  const carrierId = carrier?.id ?? null;
  const freqKHz = carrier?.freqKHz ?? null;

  useEffect(() => {
    if (carrierId === null || freqKHz === null) {
      setCheck(null);
      return;
    }
    // Debounced so a burst of store updates — or a run of chip taps — costs one
    // search, not one per change. The previous verdict stays on screen
    // meanwhile: at this size the work takes a frame, and a spinner that
    // flashed for it would be pure noise.
    const timer = setTimeout(() => {
      setCheck(liveCheck(carriers, settings, carrierId, freqKHz));
    }, 200);
    return () => clearTimeout(timer);
  }, [carriers, settings, carrierId, freqKHz]);

  if (carrier === null) return null;
```

Note the existing `if (carrier === null) return null;` line is **replaced** by the one at the end of that block — do not end up with two.

- [ ] **Step 2: Render the verdict block**

Immediately after the closing `</label>` of the Frequency field, insert:

```tsx
        {check !== null && (
          <div className="live-check">
            {check.verdict === 'clear' ? (
              <p className="live-check__line">
                <span className="dot dot--clear">
                  <span className="visually-hidden">Clear</span>
                </span>
                Clear — nothing lands here.
              </p>
            ) : (
              <>
                <p className="live-check__line">
                  <span className={`dot dot--${check.verdict}`}>
                    <span className="visually-hidden">
                      {check.verdict === 'exact' ? 'Direct hit' : 'Near miss'}
                    </span>
                  </span>
                  Conflicts: {check.explanation}
                </p>
                {check.alternatives.length > 0 ? (
                  <p className="live-check__alts">
                    <span className="live-check__alts-label">Nearest clear:</span>
                    {check.alternatives.map((khz) => (
                      <button
                        key={khz}
                        type="button"
                        className="live-check__chip"
                        aria-label={`Use ${kHzToMHzText(khz)} megahertz`}
                        onClick={() => updateCarrier(carrier.id, { freqKHz: khz })}
                      >
                        {kHzToMHzText(khz)}
                      </button>
                    ))}
                  </p>
                ) : (
                  <p className="live-check__none">
                    No clear frequency within 0.5 MHz — open Tune to search wider.
                  </p>
                )}
              </>
            )}
          </div>
        )}
```

Two things to confirm before moving on, both quick greps:

- `.dot`, `.dot--clear`, `.dot--near`, and `.dot--exact` exist in the
  stylesheets (they back `VerdictDot`), and `.visually-hidden` exists. If any
  is missing under that exact name, use whatever the codebase actually calls it.
- The width in the "no clear frequency" sentence is hardcoded as `0.5` on
  purpose: `kHzToMHzText` is `(khz / 1000).toFixed(3)`, so it would render
  `LIVE_CHECK_HALF_WIDTH_KHZ` as `0.500`, which reads as a frequency rather
  than a distance. Do not "fix" this by calling the formatter.

- [ ] **Step 3: Add the CSS**

Append to `src/styles/components.css`:

```css
.live-check {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
.live-check__line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}
.live-check__alts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}
.live-check__alts-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.live-check__chip {
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
.live-check__none {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
```

As in Task 3, all of these tokens are real (`--space-2`, `--space-3`,
`--radius`, `--surface`, `--surface-raised`, `--border`, `--text-sm`,
`--text-muted`, `--mono`). No fallbacks needed.

- [ ] **Step 4: Run the gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 5: Verify in a real browser at 390 px**

`npm run build && npx vite preview --port 0` — **read the printed port**. At 390 × 844:

1. Open a mic whose frequency is clear: the block reads `Clear — nothing lands here.`
2. Type a frequency 100 kHz from another mic and blur: the block flips to a conflict with a non-empty explanation, within a fraction of a second.
3. Chips appear; tapping one sets the frequency field to that value and the verdict turns clear.
4. Set two mics 25 kHz apart in a crowded set and confirm the "no clear frequency within 0.5 MHz" message can be reached (or accept that alternatives are always found — note which).
5. The block does not push the Done button off-screen; the sheet still scrolls.
6. No horizontal overflow at 390 px; `scrollWidth === 390`.
7. Zero console errors.
8. Deleting the carrier from the sheet while the check is showing does not throw.

- [ ] **Step 6: Commit**

```bash
git add src/ui/CarrierSheet.tsx src/styles/components.css
git commit -m "feat: show a live conflict verdict and nearest clear frequencies while editing

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

### Task 5: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-12-row-delete-and-live-conflict-check-design.md` (status line only)

**Interfaces:** none.

- [ ] **Step 1: Document both features in `README.md`**

Find the section describing the frequency list and the edit sheet (added by the carrier-sheet release). Add, in the established voice and heading level:

```markdown
### Deleting a frequency

Each row in the frequency list has a delete button. Deleting takes effect
immediately and raises an undo bar for five seconds — there is no confirmation
dialog. Undo puts the mic back in its original position. The undo expires when
the five seconds pass, when you press Undo, or when you switch projects.

### Live conflict check

While you are editing a frequency, the sheet says whether that frequency is
clear or conflicts, using the same analysis the Tune view uses. When it
conflicts, it names the interference — for example `3rd order · Mic 1 + Mic 2` —
and offers up to three of the nearest clear frequencies within 0.5 MHz as
tappable chips. If nothing within that window is clear, it says so and points
you at Tune, which searches wider.
```

Match the surrounding heading level: if the neighbouring sections use `##`, use `##`.

- [ ] **Step 2: Flip the spec's status line**

In `docs/superpowers/specs/2026-08-12-row-delete-and-live-conflict-check-design.md`, change the status line from `draft — awaiting user review` to `implemented`.

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: green. (Documentation is not otherwise built or tested in this repo.)

Read back the README diff and confirm no heading level, list style, or voice inconsistency with the surrounding text.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-08-12-row-delete-and-live-conflict-check-design.md
git commit -m "docs: document row delete with undo and the live conflict check

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f"
```

---

## Verification of the whole plan

After Task 5, on the branch, run the full gate once more and verify the two
invariants the spec cares about:

1. `npm test && npm run typecheck && npm run lint && npm run build` — all green.
2. **No pending undo can cross a project boundary.** Delete a mic in project A,
   switch to project B before the bar expires, and confirm B is unchanged.
3. **The sheet never disagrees with Tune.** Pick a conflicted mic, note the
   sheet's verdict, open Tune for the same mic, and confirm the current
   frequency's row carries the same verdict.
