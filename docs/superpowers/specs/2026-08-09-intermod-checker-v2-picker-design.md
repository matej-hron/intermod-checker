# Intermodulation Checker — v2 Design: Candidate Picker, Locking, Exclusions

Date: 2026-08-09
Status: approved
Supersedes nothing; extends `2026-08-09-intermod-checker-design.md` (v1).

## 1. Purpose

v1 answers "is this set of frequencies clean, and if not, what should I change
it to?" It answers well but opaquely. When it reports a conflict it names the
victim carrier and the offending product, but the user cannot see **why** a
frequency fails, **which other transmitters** cause the failure, or **what else
was available nearby**. The suggestion engine picks one replacement and discards
every other candidate it evaluated, including the near-misses that a human might
happily accept.

v2 exposes that discarded work. It adds a per-carrier candidate view that shows,
for a range of frequencies around the current one, which interference tests each
candidate passes and which it fails — broken down by contributing transmitter
count and product order, with a plain-language explanation of the worst offender.

It also closes two gaps that make v1 unusable in a real venue:

- **Locking.** v1 assumes every transmitter can move. Real sets contain
  frequencies that cannot change: fixed installs, units already programmed and
  distributed, a presenter's handheld nobody is allowed to touch. v1 will
  cheerfully instruct the user to retune one of these. This is a correctness
  defect, not a convenience gap.
- **Exclusions.** v1 models the band as one contiguous block. Real bands contain
  regions that must be avoided: local TV broadcast, in-ear monitor systems,
  intercom, and statutory exclusion zones. v1 can and does recommend a frequency
  inside one.

### 1.1 Prior art

The design of the candidate view is modelled on the frequency-coordination
screen of a field production tool: a list of candidate frequencies, each with a
row of traffic-light indicators, one per interference test, with the tests
ordered strictest first. Two ideas are taken directly.

First, **discrete candidate rows instead of a zoomed spectrum plot**. v1's
spectrum strip maps a 200 MHz band onto roughly a thousand pixels, about
200 kHz per pixel, while the near-hit window is 25 kHz. The entire decision zone
is under an eighth of one pixel, so an exact hit and a harmless near-miss render
identically. No amount of zooming fixes this at the overview level. Listing
candidates as rows abandons the pixel mapping and the problem disappears.

Second, **splitting tests by contributing transmitter count as well as order**.
Knowing a candidate fails is much less actionable than knowing it fails a
two-transmitter third-order test, because the number of transmitters involved
tells the user how many things they would have to move to fix it.

Deliberately not taken: the measured-spectrum trace, the "free" indicator, and
the signal-level column. All three require a receiver scanning real RF. A
browser has no radio, and presenting a computed result in the visual language of
a measurement would misrepresent it.

## 2. Scope

### 2.1 In scope

1. `locked` flag on carriers, honoured by the suggestion engine and the UI.
2. Exclusion ranges: user-defined frequency spans that carriers may not occupy.
3. A `evaluateCandidate` engine primitive returning per-criterion verdicts.
4. A **Tune** view: pick one carrier, see ranked candidates as a dot grid with a
   plain-language verdict column.
5. Refactoring `suggest()` onto the shared primitive so both paths agree.
6. Project file format version 2, with backward-compatible loading of version 1.

### 2.2 Out of scope

- Measured spectrum, RF level, or any scan-derived data. No radio.
- TV channel occupancy tables. Region-specific, and an ongoing data-maintenance
  commitment rather than a feature.
- Device presets. Still desirable (v1 §8) but independent of this work.
- Automatic assignment of the entire set from scratch. `suggest()` already
  covers the "fix it for me" path.

## 3. Data model changes

### 3.1 Carrier

```ts
interface Carrier {
  id: string;
  label: string;
  freqKHz: number;
  locked: boolean;   // new
}
```

`locked` defaults to `false`. A locked carrier is normal in every respect except
that no automated process may change its frequency.

### 3.2 Exclusions

```ts
interface Exclusion {
  id: string;
  label: string;      // e.g. "Local DTV ch 34", "IEM rack"
  startKHz: number;   // inclusive
  endKHz: number;     // inclusive
}
```

Exclusions live in `Settings` as `exclusions: Exclusion[]`, defaulting to `[]`.

An exclusion constrains **where a carrier may be placed**. It does not constrain
where interference products may land: a product falling inside an excluded range
is irrelevant, because nothing of ours is listening there. Exclusions therefore
participate in candidate evaluation and validation, and play no part in product
enumeration.

Ranges are stored normalized (`startKHz ≤ endKHz`) and may overlap; overlapping
ranges are not merged, since each carries its own label and the user needs to
know which one blocked a frequency.

### 3.3 Persistence and migration

The project file gains `version: 2`. The loader accepts both:

| Field | Missing in v1 file | Behaviour |
|---|---|---|
| `carrier.locked` | yes | defaults to `false` |
| `settings.exclusions` | yes | defaults to `[]` |

Version 1 files must load without error, including from `localStorage`, where
users already have saved state. Files are written as version 2. A version
greater than 2 is rejected with a clear message rather than parsed optimistically.

## 4. Engine

### 4.1 Criteria

A criterion identifies a class of interference product by two properties:

- **transmitter bucket** — the number of distinct carriers with a non-zero
  coefficient in the product's vector, capped at 3, giving buckets `1`
  (harmonics of a single transmitter), `2`, and `3` meaning "three or more".
- **order** — the product's order, `Σ|nᵢ|`, as already defined in v1 §4.1.

A criterion key is written `{bucket}T{order}O`: `2T3O`, `3T5O`, and so on. With
default settings (`lowOrder = 3`, `highOrder = 5`, odd-only) the realizable set
is `1T3O`, `2T3O`, `3T3O`, `1T5O`, `2T5O`, `3T5O`.

Bucketing at 3 rather than enumerating exact transmitter counts is a
deliberate ceiling. The distinction the user acts on is "two transmitters
interacting" versus "a combination of several", and exact counts above three
would multiply columns without changing any decision.

Columns are ordered by increasing order, then increasing bucket, so the
strictest and most consequential test is leftmost. A criterion that no product
in the evaluated range falls into is omitted from the display; an always-green
column is noise. Criteria are computed from settings once per Tune session so
the column set does not shift between candidates.

### 4.2 Verdicts

Each criterion resolves to one of three verdicts, matching the classification
v1 already computes in §4.2 but currently discards at the summary level:

| Verdict | Meaning |
|---|---|
| `clear` | no product of this class falls within the effective window |
| `near` | a product falls inside the window with a non-zero offset |
| `exact` | a product falls exactly on the candidate frequency |

`exact` outranks `near` outranks `clear`; a criterion holds the worst verdict
found for it.

Two non-interference criteria are evaluated alongside these and rendered as
their own columns:

- `spacing` — `exact` when the candidate is closer than `minSpacingKHz` to
  another carrier, otherwise `clear`. Binary; `near` is not used.
- `exclusion` — `exact` when the candidate falls inside an exclusion range,
  otherwise `clear`. Binary.

Band limits are not a criterion. A candidate outside the band is not generated
at all, because offering an out-of-band frequency and then marking it failed
would waste a row on something the user can never choose.

### 4.3 The `evaluateCandidate` primitive

```ts
type Verdict = 'clear' | 'near' | 'exact';
/** e.g. '2T3O', '3T5O', plus the two non-interference keys below. */
type CriterionKey = string;

interface CandidateEvaluation {
  freqKHz: number;
  verdicts: Record<CriterionKey, Verdict>;
  /** The worst verdict across all criteria, including spacing and exclusion. */
  worst: Verdict;
  /** The offending product summarised for the user, or null when fully clear. */
  explanation: {
    order: number;
    verdict: Verdict;
    offsetKHz: number;
    /** Labels of carriers with a non-zero coefficient, excluding the mover. */
    contributors: string[];
  } | null;
}

function evaluateCandidate(
  freqs: number[],
  index: number,
  candidateKHz: number,
  settings: Settings,
  carriers: readonly Carrier[],
  mode?: 'full' | 'first-hit',
): CandidateEvaluation;
```

The `mode` parameter exists so the two callers can share the primitive without
either paying the other's cost. `full` (the default) scans every product to
resolve every criterion, which the grid needs. `first-hit` returns as soon as
any interference criterion becomes non-`clear`, preserving the early abort that
`suggest()` relies on: `suggest()` only asks "is this candidate completely
clean?", and scanning on after the answer is known would make it dramatically
slower for no benefit. In `first-hit` mode the unresolved criteria are left at
`clear` and `worst` reflects only what was examined, so its result must not be
rendered as a grid row.

Semantics follow v1 §4.3 exactly, including the rule that only products the
moved carrier is party to are counted. That rule is load-bearing and its
absence was a defect in the original implementation: judging a candidate on
the whole set's cleanliness rejects every candidate for every carrier as soon as
two independent conflicts exist, because carriers later in the queue are still
unfixed while this one is being searched. Self-involving products are ignored
for the same reason `analyze` keeps them out of `conflictedIds`.

`explanation` describes the single product the user most needs to know about: of
the products holding the worst verdict, the one with the lowest order, since
lower order means stronger interference. When several share that order, the one
with the smallest offset wins, and any remaining tie is broken by the first
encountered so the result is deterministic. Contributors are read from the
coefficient vector.

**Implementation constraint.** `enumerateVectors` reuses a single mutable
coefficient array across visitor calls. `explanation.contributors` is derived
from that array, so it must be built during the callback or copied — retaining
the array itself would produce contributors from an unrelated later vector.

### 4.4 Rebuilding `suggest()` on the primitive

`suggest()` keeps its current contract and observable behaviour, but its
candidate test becomes "every criterion is `clear`" evaluated through the shared
primitive in `first-hit` mode (§4.3), with two additions:

1. Locked carriers are never proposed for movement. They remain in the working
   frequency set as immovable context.
2. Exclusion ranges are respected.

When every conflicted carrier is locked, `suggest()` returns an explicit
explanation rather than an empty result that reads as "nothing to fix".

### 4.5 Candidate range

Evaluating the whole band for every carrier is wasteful: the user wants the
nearest workable frequency, not an exhaustive census. The Tune view evaluates a
window around the carrier's current frequency:

- default half-width **2 MHz**, giving 161 candidates at the default 25 kHz step,
- generated outward from the current frequency, alternating below and above, so
  that the candidate cap and any early termination keep the nearest options
  rather than an arbitrary contiguous slice,
- clipped to the band,
- capped at **500 candidates** regardless of window and step.

Generation order is not display order. The grid is displayed sorted by
**ascending frequency**, which is how a spectrum is read and how the tool this
design draws on presents it; the Δ column carries the distance information that
nearest-first ordering would otherwise convey. `suggest()`, which needs the
nearest clear candidate and not a browsable list, consumes generation order
directly and is unaffected by the display rule.

A "widen search" control doubles the half-width, up to the band edges. When no
candidate in the window is fully clear, the view says so explicitly and offers
the widening control rather than silently showing only failures.

### 4.6 Performance

v1's candidate test aborts on the first hit. A dot grid cannot: it must know
every criterion's verdict, not merely that one failed. With roughly 14,000
in-band products for a twelve-carrier set at default settings, the naive cost is
161 candidates × 14,000 products ≈ 2.3M product evaluations per Tune session —
acceptable in a worker, but it must not be allowed to grow silently.

Mitigations:

- Evaluation runs in the existing Web Worker, reusing the v1 progress and
  cancellation protocol. Selecting a different carrier cancels the in-flight
  evaluation.
- A criterion already at `exact` is skipped for the remainder of the scan.
- The scan stops early once every active criterion is at `exact`.
- The candidate cap in §4.5 bounds total work.
- Evaluation is triggered by carrier selection, not by every keystroke.

The existing `highOrder ≥ 7` workload warning (v1 §4.4) applies to Tune as well.

## 5. User interface

### 5.1 Navigation

The app gains top-level views: **Setup** (frequency table and settings, as
today), **Results** (summary, conflicts, spectrum, suggestions, as today), and
**Tune** (new). v1's single-page layout becomes these three sections; no
existing component's behaviour changes.

### 5.2 Tune view

Full width, because the verdict column is the point of the screen and does not
survive being squeezed into a sidebar.

**Context strip.** Above the grid, a compact read-only row of every other
carrier: label, frequency, lock state, and conflict status, with the carrier
being tuned highlighted. This preserves whole-set awareness while tuning a
single frequency.

**Carrier selector.** Which carrier is being tuned, switchable without leaving
the view. Locked carriers are selectable but shown read-only with an unlock
control; the grid still renders, since seeing why a locked frequency is bad is
useful even when it cannot move.

**Candidate grid.** One row per candidate:

| Column | Content |
|---|---|
| Frequency | candidate in MHz |
| Δ | signed offset from the current frequency, in kHz |
| Spacing | verdict dot |
| Excl. | verdict dot, omitted entirely when no exclusions are defined |
| one per criterion | verdict dot |
| Verdict | plain-language summary of `explanation` |

The current frequency is always present as a row and marked as such, so the
user can see exactly what they have now against the alternatives. The nearest
fully clear candidate is marked. Selecting a row applies that frequency to the
carrier and re-runs the analysis, following the v1 rule that a displayed verdict
always reflects the real configuration.

Verdict text names the mechanism and the culprits, for example
`3rd order · Mic 1 + Mic 5` or `5th order · 18 kHz away · Mic 2 + Mic 7`.

**Accessibility.** Colour is never the sole carrier of meaning. Each dot has a
text label available to assistive technology giving criterion and verdict, and
the three verdicts are additionally distinguished by shape — filled, ring,
hollow — so the grid is readable without colour discrimination. The grid is a
real `<table>` with proper headers, not a div grid.

### 5.3 Relationship to the existing Suggestions panel

The two features overlap and must not disagree. The division:

- **Suggestions** — "fix everything, I trust the tool." Batch, one proposal per
  conflicted carrier.
- **Tune** — "I want to choose myself." One carrier, all options, full reasoning.

Each suggestion gains a link into Tune for that carrier, pre-selected. Because
both paths evaluate candidates through the same primitive under the same
settings, a frequency Suggestions proposes is by construction one Tune shows as
fully clear. Neither is a special case of divergent logic.

### 5.4 Locking and exclusions in Setup

The frequency table gains a lock toggle per row, with the state visible at a
glance. Settings gains an exclusions editor: add, edit, remove, each with a
label and a start/end range reusing the existing `MHzInput` boundary component.

A carrier sitting inside an exclusion range, or a locked carrier that is in
conflict, produces a validation warning — both are situations the user must
resolve by hand, and silence would be misleading.

## 6. Error handling

Consistent with v1: invalid input is reported, never silently coerced.

- Exclusion with `startKHz > endKHz` is normalized on entry rather than rejected.
- Exclusion entirely outside the band is accepted but flagged as having no
  effect, since it may become relevant if the band is later changed.
- Exclusions covering the entire band, or leaving no placeable frequency for a
  carrier, produce an explicit message from the Tune view and from `suggest()`
  rather than an empty candidate list with no explanation.
- Locking every conflicted carrier is reported explicitly (§4.4).
- A project file with a version above 2 is rejected with a clear message.

## 7. Testing

Engine tests, in the established `src/im/__tests__` layout, using integer kHz
and exact expected values:

1. **Criterion bucketing.** A hand-computed product with a known coefficient
   vector lands in the expected `{bucket}T{order}O` criterion; a four-transmitter
   product buckets as `3`.
2. **Verdict precedence.** A candidate with both a `near` and an `exact` product
   in the same criterion reports `exact`.
3. **Only the mover counts.** A set with two independent conflicts still yields
   clear candidates for the first carrier evaluated — the regression that the
   v1 Critical fix addressed, now pinned at the primitive level.
4. **Explanation contents.** Contributors are exactly the non-zero-coefficient
   carriers excluding the mover, and are unaffected by the shared mutable
   coefficient array (asserted by evaluating a set large enough that later
   vectors would corrupt a retained reference).
5. **Spacing and exclusion criteria.** Boundary cases at exactly `minSpacingKHz`
   and exactly on an exclusion edge, which is inclusive.
6. **Locked carriers.** `suggest()` never proposes a new frequency for a locked
   carrier, and treats it as fixed context when solving others.
7. **All-locked.** Explicit failure explanation rather than an empty result.
8. **Candidate range.** Generation is nearest-first and alternates below/above;
   display order is ascending by frequency; the cap is respected; the window
   clips to the band.
9. **`suggest()` parity.** For a set with a known answer, the refactored engine
   returns the same proposals as before the refactor.
10. **Migration.** A version 1 project file loads with `locked = false` and
    `exclusions = []`; a version 2 file round-trips; a version 3 file is
    rejected.

UI behaviour is verified in a real browser against the production build, as
established in v1: selecting a candidate applies it and re-analyses, the context
strip tracks the live set, and the grid is operable and labelled without colour.

## 8. Correction to the v1 specification

v1 §4.3 states that applying all suggestions "yields a clean set". That is not
true and the implementation never guaranteed it. Suggestions are solved
sequentially and each is clean with respect to the carriers already placed, but
a congested band can leave later carriers with no available frequency, so the
applied result may still contain conflicts. The README and the suggestions panel
were corrected when this was found; the v1 spec is corrected in the same commit
as this document.

## 9. Disclaimer

Unchanged from v1 §9. This tool is a planning aid based on published
intermodulation theory. It models products arithmetically and knows nothing
about transmitter power, antenna placement, receiver selectivity, or the local
RF environment. It is not a substitute for a spectrum scan on site.
