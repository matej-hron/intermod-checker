# Delete from the list, and a live conflict check while tuning

Status: draft — awaiting user review
Date: 2026-08-12

## 1. The problem

Two gaps the user hit while using the app on a phone:

1. **Deleting a microphone takes four taps** — open the row's sheet, scroll to
   Delete, dismiss a `window.confirm`, close the sheet. Removing a mic from a
   list is a list-level action and should live on the list.

2. **You only learn a frequency is bad after you commit to it.** Today you type
   a frequency, close the sheet, press Analyse, read the Results tab, and only
   then discover the mic you just added lands on a 3rd-order product. The tool
   knows the answer the moment the digits are entered; it just never says so.

## 2. What we are building

**Delete from the row.** Each carrier row grows a third control — a delete
button beside the existing lock — that removes the mic immediately and raises
an undo bar for five seconds.

**A live verdict in the editor.** The carrier sheet shows, directly under the
frequency field, whether the frequency currently in the field is clear, and if
it is not, why — plus up to three nearest clear frequencies as one-tap chips.

## 3. Decisions made without the user

The user was away when this was designed. These are my calls, listed here so
they are easy to overturn:

1. **A delete button, not a swipe gesture.** The user asked "maybe swipe?".
   I did not use swipe. The row is already a `<button>` that opens the editor,
   so a horizontal drag must be disambiguated from a tap and from the page's
   vertical scroll — custom touch handling with no affordance on screen, no
   keyboard or screen-reader equivalent, and no desktop story at all. A visible
   44 px button is discoverable, works everywhere, and is one tap rather than
   a drag plus a tap. Swipe can be added later as a shortcut on top of it; it
   is a bad thing to have as the *only* route.

2. **Undo instead of a confirmation dialog.** Deleting is immediate; a bar
   offers Undo for five seconds. On a phone this is faster than a modal and
   strictly safer: a mis-tap costs one tap to reverse, where a `confirm()`
   costs a tap every single time and is routinely dismissed on autopilot.

3. **The sheet's Delete button uses the same path**, losing its `window.confirm`.
   Two different delete behaviours for the same object is worse than either one.

4. **The live check runs on every frequency edit**, not only for newly added
   mics. The user framed it as "when adding new frequency", but the same
   uncertainty applies when retuning an existing one, and a rule that fires
   only for new mics is one the user has to remember.

5. **The live check runs on the main thread, synchronously, debounced.** It
   evaluates one frequency plus a narrow ±500 kHz search — roughly forty
   candidates, against the Tune view's five hundred. Sending it to the worker
   would mean a third client, a third set of race tokens, and a progress model,
   for work that should complete in a few milliseconds. §9 sets the budget that
   holds us to that.

## 4. Deleting from the list

### 4.1 The control

`src/ui/CarrierList.tsx` — each `<li class="carrier">` becomes three siblings:
the existing `.carrier__open` button, the existing `.carrier__lock` button, and
a new `.carrier__delete` button. Never nested — the same rule the lock follows.

- Accessible name: `Delete ${carrier.label}`.
- Content: a `🗑` glyph, `aria-hidden="true"`.
- 44 × 44 px, like the lock.

The row grid becomes `minmax(0, 1fr) var(--tap) var(--tap)`. At 390 px that
leaves the text column ~200 px, which still fits `Lead Vocal Wireless` plus a
frequency on line 1.

The delete button must carry the same Chrome grid-`<button>` guard the other row
buttons needed: a `display: grid` or `display: flex` button inherits the UA's
`justify-content: center` and shrink-wraps. If it is a plain centred glyph
button this does not arise; if it is not, it needs `width: 100%` like its
siblings.

### 4.2 Undo

Deleting removes the carrier immediately and records what was removed, so it can
be put back exactly where it was.

**One store action does both halves**, so no caller can remove a carrier and
forget to offer the undo:

```ts
// projectStore
deleteCarrierWithUndo: (id: string) => void;
restoreCarrier: (carrier: Carrier, index: number) => void;
```

`deleteCarrierWithUndo` captures the carrier and its index *before* removing it,
removes it through the existing `update()`, and then records:

```ts
// viewStore
pendingDelete: { carrier: Carrier; index: number; token: number } | null;
requestUndo: (carrier: Carrier, index: number) => void;   // sets it, token += 1
clearPendingDelete: () => void;
```

The existing `removeCarrier` stays as it is — `deleteCarrierWithUndo` is a
wrapper around it, not a replacement — so nothing else in the app changes
behaviour by accident.

`src/ui/UndoBar.tsx` renders when `pendingDelete !== null`:

> Deleted Lead Vox&nbsp;&nbsp;&nbsp;**Undo**

- It sits above the action bar, spans the width, and is a `role="status"` region
  so screen readers announce it without stealing focus.
- The Undo control is a bare `<button>` (44 px from `base.css`).
- It clears itself after **5000 ms** via a `setTimeout` owned by the component,
  cancelled on unmount and re-armed whenever `token` changes. `token` is a
  monotonic counter so deleting twice in a row restarts the timer rather than
  inheriting the first deletion's remaining time.
- Undo calls `projectStore.restoreCarrier(carrier, index)` and clears
  `pendingDelete`.

**`restoreCarrier(carrier, index)`** splices the carrier back at `index`
(clamped to the current length, which may have shrunk), refuses when the project
is already at `MAX_CARRIERS`, and goes through the store's existing `update()`
so the analysis and tune state are invalidated exactly as any other frequency
change is.

`pendingDelete` is cleared — the deletion made permanent — when: the timer
expires, Undo is pressed, or the project is switched. Switching projects already
funnels through `openFromLibrary`; it clears this too. A pending undo must never
survive into a different project, where its `index` means nothing and restoring
it would inject a mic the user never put there.

### 4.3 The sheet's Delete button

`src/ui/CarrierSheet.tsx` drops its `window.confirm` and calls the same delete
path. The sheet then closes on its own, because the open carrier disappears —
the existing `carrier === null` rule. The undo bar is visible behind it.

## 5. The live conflict check

### 5.1 The pure module

New file `src/im/liveCheck.ts`. All judgment lives here so it is testable in the
repo's node-only Vitest:

```ts
export interface LiveCheckResult {
  verdict: Verdict;               // 'clear' | 'near' | 'exact'
  explanation: string;            // explanationText() of the worst hit
  alternatives: number[];         // up to 3 clear frequencies, nearest first
  searched: boolean;              // false when no search was run
}

export function liveCheck(
  carriers: readonly Carrier[],
  settings: Settings,
  carrierId: string,
  candidateKHz: number,
  maxAlternatives?: number,       // default 3
  halfWidthKHz?: number,          // default 500
): LiveCheckResult;
```

Behaviour:

- Resolve the carrier's index. If the id is not in `carriers`, return a cleared
  result with `searched: false` — never throw.
- Evaluate `candidateKHz` for that index with the existing
  `evaluateCandidate(..., 'full')`. That single call already accounts for
  intermodulation products, minimum spacing, and excluded ranges, and it is the
  same function the Tune grid uses — so the sheet cannot disagree with Tune.
- If `worst === 'clear'`, return with `alternatives: []`. **No search runs when
  the frequency is already clear** — the common case costs one evaluation.
- Otherwise generate candidates with `generateCandidates(candidateKHz, settings,
  halfWidthKHz)` — which is nearest-first by construction — and evaluate each in
  `'first-hit'` mode, collecting frequencies whose `worst` is `clear` until
  `maxAlternatives` are found or the list is exhausted. `searched: true`.
- A locked carrier is evaluated normally: the user is looking at the number, and
  refusing to judge it because of a lock would be silence exactly where the user
  asked a question. The lock governs whether `suggest()` may *move* it, not
  whether we may *describe* it.

`liveCheck` takes no clock, no randomness, and no storage; every input is a
parameter. Same contract as `library.ts` and `carrierSummary.ts`.

### 5.2 In the sheet

`src/ui/CarrierSheet.tsx`, immediately below the frequency field:

- **Clear:** `<VerdictDot verdict="clear">` and `Clear — nothing lands here.`
- **Conflict:** `<VerdictDot>` carrying the *actual* verdict — `near` for a near
  miss, `exact` for a direct hit, so the sheet uses the same three-shape,
  never-colour-alone scale as the rest of the app — then `Conflicts: ` and the
  explanation string (`3rd order · Mic 1 + Mic 2`), then the alternatives as
  chips:

  > Nearest clear: `509.750` `510.250` `510.500`

  Each chip is a bare `<button>` labelled `Use ${text} megahertz` that sets the
  frequency, after which the verdict re-renders as clear.
- **No alternatives found within ±500 kHz:** say so —
  `No clear frequency within 0.5 MHz — open Tune to search wider.` Silence
  would read as "no suggestions exist".

The check is **debounced 200 ms** on the frequency value and recomputed when
the carrier's device, the settings, or any other carrier changes. It reads the
committed `carrier.freqKHz`, not the raw input text: `MHzInput` keeps
half-typed keystrokes in a local `draft` and only calls `onCommit` on blur or
Enter with a value that parsed, so the store — and therefore this check —
never sees `51`.

Because the value only lands on blur or Enter, the debounce is not there to
survive keystrokes; it is there to collapse the burst of store updates a commit
triggers, and to keep a rapid sequence of chip taps from running the search
three times.

While the debounce is pending the previous verdict stays on screen; it is never
replaced by a spinner. At this size the work finishes in one frame and a
flashing spinner would be noise.

## 6. What this does not do

- No swipe gesture (§3.1).
- No undo for anything other than carrier deletion. Project deletion keeps its
  `confirm()` — it destroys far more, and it is a rarer, more deliberate act.
- No auto-picking a frequency for new mics. The tool advises; the user decides.
  A mic that silently lands somewhere the user did not choose is worse than one
  that is obviously wrong.
- The live check does not widen its search. That is what Tune is for, and the
  message says so.

## 7. Files

| File | Change |
| --- | --- |
| `src/im/liveCheck.ts` | new — the pure check |
| `src/im/index.ts` | export it |
| `src/im/__tests__/liveCheck.test.ts` | new |
| `src/state/viewStore.ts` | `pendingDelete`, `requestUndo`, `clearPendingDelete` |
| `src/state/projectStore.ts` | `deleteCarrierWithUndo`, `restoreCarrier`; clear `pendingDelete` on project switch |
| `src/ui/CarrierList.tsx` | the delete button |
| `src/ui/CarrierSheet.tsx` | the verdict block; delete without `confirm` |
| `src/ui/UndoBar.tsx` | new |
| `src/App.tsx` | render `<UndoBar />` |
| `src/styles/components.css` | `.carrier__delete`, `.undo-bar`, `.live-check` |
| `README.md` | document both |

## 8. Testing

Vitest is `environment: 'node'`, `src/**/__tests__/**/*.test.ts`, no DOM.
Component behaviour is verified in a real browser at 390 px, not in unit tests.

`liveCheck.test.ts` covers: a clear frequency returns `clear` with no
alternatives and does not search; a frequency sitting on a known 3rd-order
product returns `exact` with a non-empty explanation; alternatives come back
nearest-first and every one of them evaluates clear; a frequency violating
minimum spacing is caught; an excluded range is caught; `maxAlternatives` is
respected; an exhausted search returns fewer than the maximum rather than
padding; and an unknown `carrierId` returns `searched: false` without throwing.

Browser checks: delete removes the row and raises the bar; Undo restores the mic
at its original position; the bar disappears after five seconds; switching
projects mid-undo does not resurrect anything; the sheet's verdict flips live as
digits are typed; a chip applies its frequency and the verdict turns clear; all
three row controls are >= 44 px and there is no horizontal overflow at 390 px.

## 9. Budgets and limits

- `liveCheck` with a clear frequency: **one** `evaluateCandidate` call.
- `liveCheck` with a conflict: at most `2 × halfWidthKHz / suggestionStepKHz`
  candidates — 40 at the defaults, versus Tune's 500.
- If the conflicting path ever exceeds **50 ms** for 12 carriers, it moves to
  the worker. That is the trigger; until it fires, main-thread is correct.
- Undo window: 5000 ms, one deletion deep. No stack.
