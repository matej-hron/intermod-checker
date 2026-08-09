# Intermodulation Checker — v1 Design

**Date:** 2026-08-09
**Status:** Approved

## 1. Purpose

Wireless microphone operators running 10–12 transmitters simultaneously in the
500–700 MHz band need to know whether their chosen carrier frequencies produce
intermodulation products that land on their own receivers. This app checks a set
of frequencies, explains every collision it finds, and proposes replacement
frequencies for the carriers that cause them.

Source theory: *What is Intermodulation Interference?* — intermodulation is the
undesired combining of several signals in a nonlinear device, producing new
frequencies. The general product is

```
IM = n₁A ± n₂B ± n₃C ± …
```

where `A, B, C…` are the mixing frequencies and the order of the product is the
sum of the coefficients `n₁ + n₂ + n₃ + …`. Odd orders (3rd and 5th above all)
dominate in practice, because even-order products usually fall far outside the
band of interest and higher odd orders are formed at power levels too low to
interfere.

## 2. Scope

**In scope for v1**

- 2–24 carrier frequencies (10–12 is the target case), each with an optional
  free-text device label.
- Collisions between the entered microphones only.
- Configurable order range, odd-only filtering, near-hit window, minimum carrier
  spacing, band limits, and per-signal deviation.
- Replacement suggestions for conflicting carriers.
- Local project persistence plus JSON export/import.
- English user interface.
- Ordinary responsive web app; no offline/PWA requirement.

**Out of scope for v1**

- External occupancy data (TV channels, local transmitters, location databases).
- Device model presets with tuning ranges and channel steps. Device identity is
  metadata only in v1; a preset catalogue is planned as follow-up work (see
  section 8).
- Accounts, server-side storage, and any backend at all.
- Generating a complete frequency plan from scratch.

## 3. Architecture

A static single-page application. Nothing leaves the browser.

```
frequency list + settings
        │
        ▼
   Web Worker ── im/enumerate ── im/analyze ──► AnalysisResult
        │                     └─ im/suggest ──► Suggestion[]
        ▼
   React UI (table, settings, results, spectrum, suggestions)
        │
        ▼
   localStorage / JSON file
```

**Stack:** React 19, TypeScript (strict), Vite, Vitest, zustand for state.

**Layering rule:** `src/im/` is pure TypeScript with no React, no DOM, and no
storage imports. It is the only place where intermodulation mathematics lives,
and it is independently testable. The worker wraps it, the UI consumes the
worker.

### 3.1 Modules

| Path | Responsibility |
|---|---|
| `src/im/types.ts` | `Carrier`, `Settings`, `Product`, `Hit`, `AnalysisResult`, `Suggestion` |
| `src/im/enumerate.ts` | Generate coefficient vectors for the configured order range |
| `src/im/analyze.ts` | Evaluate vectors into products and match them against receivers |
| `src/im/suggest.ts` | Search replacement frequencies for conflicting carriers |
| `src/im/format.ts` | Render a coefficient vector as human-readable text (`2A − B`) |
| `src/worker/analysis.worker.ts` | Runs analysis and suggestion off the main thread |
| `src/worker/client.ts` | Typed promise/progress wrapper around the worker |
| `src/state/projectStore.ts` | Carriers, settings, persistence, export/import |
| `src/state/analysisStore.ts` | Run status, progress, results, cancellation |
| `src/ui/*` | Presentational components; no calculation logic |

## 4. Calculation engine

### 4.1 Enumeration

For `N` carriers the engine enumerates integer coefficient vectors
`(n₁ … n_N)` with `lowOrder ≤ Σ|nᵢ| ≤ highOrder`. When odd-only is enabled, only
vectors whose order is odd are produced.

Enumerating **vectors** rather than term sequences is deliberate: it makes
degenerate expressions such as `A + B − A` collapse to the vector for `B` before
evaluation, so no duplicate products can be emitted and no post-hoc
deduplication is needed. Each distinct vector appears exactly once.

Negation symmetry is handled by canonical enumeration: only vectors whose first
non-zero coefficient is positive are generated, and the product frequency is
taken as the absolute value of `Σ nᵢ·fᵢ`. Since a vector and its negation yield
`+f` and `−f`, this emits exactly one of each pair and halves the search space.
Products evaluating to exactly zero are discarded.

### 4.2 Product evaluation and hit matching

For each vector the product frequency is `Σ nᵢ·fᵢ`. A product is discarded when
it is non-positive or falls outside the configured band. A surviving product is
compared against every carrier, since every carrier is also a receiver tuning.

The effective window for a product is

```
window = max(settings.nearHitWindowKHz, order × settings.deviationKHz)
```

The deviation term comes directly from the source: the deviation of an
intermodulation product equals the sum of each contributing signal's deviation
multiplied by its coefficient, so a 5th-order product built from two ±5 kHz
signals swings ±25 kHz and can sweep across a receiver passband it does not
directly sit on. Setting `deviationKHz` to 0 disables that term.

A match inside the window is a `Hit`, classified as:

- **exact** — offset of zero,
- **near** — non-zero offset inside the window.

All engine arithmetic is done in **integer kilohertz**, so products are computed
exactly and no floating-point epsilon is needed anywhere. The UI converts
between MHz and kHz at its boundary.

Severity is derived from order: 3 = high, 5 = medium, 7 and above = low. When
several products hit the same receiver, the lowest order wins for the summary
status, and all of them are listed in the detail view.

A product may involve the same carrier it lands on; that is genuine interference
and is kept, but flagged as self-involving so the user understands the
relationship.

### 4.3 Suggestions

For each carrier that participates in at least one hit, the engine scans
candidate frequencies across the band on a fixed grid (default 25 kHz step),
ordered by increasing distance from the original frequency. A candidate is
accepted when, with that single carrier replaced:

1. it stays inside the band limits,
2. it keeps at least `minSpacingKHz` from every other carrier,
3. it introduces no hit at any order up to `highOrder`.

The first accepted candidate is proposed. Suggestions are computed sequentially
against a working copy of the set: once a carrier's replacement is accepted it is
applied to that working copy before the next conflicted carrier is processed, so
the proposals are mutually consistent and applying all of them yields a clean
set. After the user applies any suggestion the full set is re-analyzed, so the
displayed verdict always reflects the real configuration rather than an assumed
one. When no candidate satisfies the constraints within the candidate budget,
the engine reports that explicitly for that carrier instead of returning the
original frequency as if it were a fix.

### 4.4 Performance

Vector count grows steeply with order and carrier count: 12 carriers at 9th
order is on the order of millions of vectors. Mitigations:

- All analysis and suggestion work runs in a Web Worker; the UI never blocks.
- The worker emits progress and honours a cancellation message.
- Before running with `highOrder ≥ 7` the UI shows an estimated workload warning
  and requires confirmation.
- Candidate evaluation during suggestion aborts on the first hit found, and the
  candidate scan is capped at 2000 candidates per carrier so a hopeless search
  terminates and reports failure rather than running unbounded.
- Defaults are `lowOrder = 3`, `highOrder = 5`, odd-only enabled, which keeps the
  target case comfortably interactive.

### 4.5 Default settings

`bandMinMHz = 500`, `bandMaxMHz = 700`, `lowOrder = 3`, `highOrder = 5`,
`oddOnly = true`, `nearHitWindowKHz = 25`, `deviationKHz = 0`,
`minSpacingKHz = 250`, `suggestionStepKHz = 25`.

## 5. User interface

A single screen, English strings, responsive down to tablet width.

- **Frequency table** — add/remove rows, per-row label and frequency in MHz,
  inline validation, and a per-row status badge once results exist.
- **Settings panel** — order range, odd-only toggle, near-hit window, deviation,
  minimum spacing, band limits, suggestion grid step.
- **Results summary** — clean/conflicted verdict with counts by severity.
- **Conflict detail** — expandable per carrier, listing each offending product as
  a readable expression with its computed frequency, order, and offset in kHz.
- **Spectrum strip** — linear band view marking carriers and colliding products.
- **Suggestions panel** — proposed replacement per conflicting carrier with the
  distance moved, an *Apply* action per row, and an *Apply all* action.
- **Project actions** — save/load from `localStorage`, export and import JSON.

## 6. Error handling

Validation runs before analysis and blocks it with a specific message:

| Condition | Behaviour |
|---|---|
| Fewer than 2 carriers | Analysis disabled with an explanation |
| More than 24 carriers | Rejected with the limit stated |
| Duplicate frequency | Both rows flagged |
| Frequency outside band limits | Row flagged |
| Spacing below `minSpacingKHz` | Both rows flagged |
| `lowOrder > highOrder`, or order < 2 | Settings field flagged |

Worker errors and cancellations resolve into a recoverable UI state with a retry
action, never a blank screen. Import of a malformed JSON project is rejected
with a parse error and leaves the current project untouched.

## 7. Testing

Vitest, targeting `src/im/` directly. Fixtures are taken from the source
document so the engine is verified against published results:

- 150.00 and 151.00 MHz produce 149.00 and 152.00 MHz at 3rd order, and 148.00
  and 153.00 MHz at 5th order.
- 155.00 and 154.00 MHz produce `3A − 2B = 157.00 MHz` at 5th order.
- A 5th-order product `2A + 3B` from two ±5 kHz signals yields ±25 kHz peak
  deviation.
- An even 2nd-order mix of 155.00 and 154.00 MHz yields 1.00 MHz and 309.00 MHz,
  both correctly excluded from a 150 MHz band of interest.

Additional coverage: enumeration counts for small `N` and order, absence of
duplicate vectors, negation-symmetry filtering, near-hit boundary conditions on
both sides of the window, odd-only filtering, determinism of output ordering,
validation rules, and a property test asserting that a fully applied suggestion
set re-analyzes with zero hits or reports its failure explicitly.

The static gate is `tsc --noEmit` plus `vitest run`.

## 8. Future work

Device model presets are the expected next step: a built-in catalogue of
microphone models, each carrying its tuning range, channel step, and deviation,
so selecting a model constrains the valid frequencies for that row and feeds a
per-carrier deviation into the window calculation instead of the single global
setting.

To keep that migration cheap, v1 already stores each carrier as an object with
an optional free-text `label`. The catalogue lands as an added optional
`modelId` field on the same object plus a lookup table; existing saved projects
stay valid, and the analysis engine only needs deviation to become per-carrier
rather than global. Nothing in the v1 design should assume the label is the only
device-related field a carrier will ever have.

## 9. Disclaimer

The tool is a planning aid. It models intermodulation arithmetic only; it does
not account for site-specific nonlinearities, antenna placement, filtering,
external occupancy, or local regulation. Users must verify frequencies against
local rules and on-site conditions.
