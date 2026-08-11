# Device presets and per-carrier deviation — design

**Status:** proposed
**Date:** 2026-08-11
**Supersedes:** the "future work" note in `2026-08-09-intermod-checker-design.md` §8

## 1. The problem

Every radio microphone occupies a different amount of spectrum. A Wisycom
MTP40 in wide band deviates ±28 kHz; the same maker's MTP60 in narrow band
deviates ±17.5 kHz; a Sound Devices A10 is a digital transmitter 200 kHz wide.
The app currently models all of them with **one global number**,
`settings.deviationKHz`, defaulting to 0.

That single number is wrong in both directions at once. A user with A10s
understates their spectrum by a factor of four; a user with narrow-band Wisycoms
who raises the setting to cover them overstates every other transmitter. Neither
user can describe a mixed bag of gear, which is the normal case on a real job.

So the user picks a device per carrier, and the deviation comes from the device.

## 2. Scope

**In scope**

- A built-in catalogue of transmitter models with their power options and
  modulation widths.
- Per-carrier device, power and band-mode selection in Setup.
- Per-carrier deviation feeding the interference window, replacing the global
  setting for any carrier that has a device.

**Out of scope** (deliberately, and each for a reason)

- **Power in the calculation.** Stored and shown, but it does not affect the
  maths. Modelling it properly needs path loss and receiver sensitivity, which
  is a different feature. The user asked for this explicitly.
- **User-defined devices.** The global deviation setting already serves gear
  that is not in the catalogue: leave the device as "No device" and set the
  fallback. No new UI is needed for the escape hatch.
- **Tuning ranges and channel steps.** The v1 spec anticipated these alongside
  presets. They constrain *which frequencies are legal*, which is a separate
  concern from *how wide a signal is*. Not needed to make deviation correct.
- **Carson's rule.** See §8.

## 3. The catalogue

A new pure-data module, `src/im/devices.ts`. No React, no state, no I/O — a
table plus lookups, so it is trivially testable and cheap to extend.

```ts
export type Modulation = 'fm' | 'digital';

export interface DeviceMode {
  id: string;          // 'wide' | 'narrow'
  label: string;       // 'Wide band'
  deviationHz: number; // peak deviation: half the quoted width
  widthHz: number;     // the quoted modulation width
}

export interface Device {
  id: string;            // 'wisycom-mtp40'
  brand: string;         // 'Wisycom'
  model: string;         // 'MTP40'
  modulation: Modulation;
  powersMW: number[];    // ascending
  modes: DeviceMode[];   // at least one; first is the default
}
```

### 3.1 Why deviation is stored in hertz

The project's standing invariant is that **frequencies are integer kilohertz**.
Wisycom narrow band is 35 kHz wide — a peak deviation of ±17.5 kHz, which is
not an integer number of kilohertz. Rounding it to 17 or 18 would silently
falsify the one device whose narrow mode is the reason the feature exists.

Storing deviation in hertz keeps every catalogue figure exact and integral. The
invariant is unharmed: carrier frequencies remain integer kHz. Only the
*window threshold* — a comparison value, never a frequency — is computed in Hz.

### 3.2 The catalogue contents

All entries are belt-pack transmitters using quarter-wave antennas.

| id | Brand / model | Power (mW) | Modes (peak deviation) |
| --- | --- | --- | --- |
| `wisycom-mtp40` | Wisycom MTP40 | 10, 50 | wide ±28 kHz (56 kHz) |
| `wisycom-mtp41` | Wisycom MTP41 | 10, 50, 100 | wide ±28 kHz (56 kHz) |
| `wisycom-mtp60` | Wisycom MTP60 | 10, 50, 100 | wide ±28 kHz (56 kHz); narrow ±17.5 kHz (35 kHz) |
| `wisycom-mtp61` | Wisycom MTP61 | 10, 50, 100 | wide ±28 kHz (56 kHz); narrow ±17.5 kHz (35 kHz) |
| `wisycom-mtb40s` | Wisycom MTB40s | 10, 50, 100 | wide ±28 kHz (56 kHz) |
| `sennheiser-5212` | Sennheiser 5212 | 10, 50 | wide ±28 kHz (56 kHz) |
| `sennheiser-evolution` | Sennheiser Evolution G2/G3/G4/2000 | 10, 50 | wide ±24 kHz (48 kHz) |
| `sound-devices-a10` | Sound Devices A10 | 10, 20, 50 | digital ±100 kHz (200 kHz) |
| `lectrosonics-us` | Lectrosonics (US models) | 50 | wide ±70 kHz (140 kHz) |

Two notes on the source data, carried here so they are not lost:

- The four Sennheiser Evolution generations share one entry because they share
  one modulation width. An engineer picking "G3" finds it under the combined
  label; splitting them would add three rows that differ in nothing the
  calculation can see.
- **`lectrosonics-us` needs confirmation.** The source said "Lectrosonics us",
  which is most likely the US-market models. The label is provisional; the
  numbers (50 mW, 140 kHz) are as given.

## 4. The carrier

`Carrier` gains three optional fields:

```ts
deviceId?: string;   // catalogue id
modeId?: string;     // which of the device's modes
powerMW?: number;    // display and export only; never used in the maths
```

All three are optional, so an existing carrier is already a valid new carrier.

Resolution is a single pure function, the only place the precedence lives:

```ts
resolveDeviationHz(carrier: Carrier, settings: Settings): number
```

- Known `deviceId` → the deviation of the named mode; if `modeId` is missing or
  unknown, the device's **first** mode (wide, for every device that has two).
- No device, or an unknown `deviceId` → `settings.deviationKHz * 1000`.

## 5. The window formula

### 5.1 Today

```
window = max(nearHitWindowKHz, order × deviationKHz)
```

Since `order = Σ|nᵢ|`, that is already `Σ|nᵢ|·dev` with a single shared `dev`.
The generalisation is therefore natural rather than a rewrite.

### 5.2 New

All terms in hertz, all integers:

```
spreadHz  = Σ |nᵢ| · devᵢ                       (over carriers in the product)
windowHz  = max(nearHitWindowKHz × 1000, spreadHz + dev_victim)
```

Two changes: the spread is summed per carrier rather than scaled by order, and
**the victim's own bandwidth widens the window**.

When the victim also contributes to the product — the self-involving case the
engine already flags — its deviation is counted **twice**: once in the spread,
because it genuinely widens the product, and once as the victim, because its
receiver passband is genuinely that wide. These are two different physical
effects that happen to share a number, so double-counting is correct here.

The victim term is the physically meaningful part. Interference happens when
the product's skirt overlaps the receiver's passband, so a 200 kHz-wide A10 is
a bigger target than a 56 kHz Wisycom. Without this term a product landing
90 kHz from an A10 reads "clear", which is false.

### 5.3 The behaviour change, stated plainly

For a uniform fleet the window grows from `order × d` to `(order + 1) × d`.
Results become stricter: some frequency sets that read clear today will show
conflicts.

This matters far less than it sounds, because **`deviationKHz` defaults to 0**.
With `d = 0` the formula collapses to `max(nearHitWindow, 0)` — exactly today's
behaviour. Every existing project is bit-identical until the user assigns a
device. Only a user who manually raised the global deviation sees a change, and
that user's previous result was optimistic.

This is called out in the release notes rather than hidden behind a
compatibility toggle. A configurable physics model would be a worse product
than a correct one.

## 6. Engine plumbing and performance

`scanProducts` is the innermost hot loop of the whole app; the v2 work
established that allocating anything per product visit is a measurable
regression. The design respects that.

- `scanProducts` already walks all carriers to sum `coeffs[i] * freqs[i]`. The
  deviation sum folds into that **same loop** as one extra abs-multiply-add. No
  new pass, no allocation.
- The visitor signature gains `spreadHz`, computed by the scan rather than
  recomputed by each of its two callers.
- `carrierDeviationsHz(carriers, settings)` returns **`null` when every carrier
  resolves to the same deviation**, and an array otherwise. On the uniform path
  — which includes every project that exists today — the loop computes
  `order × d` exactly as it does now, and the extra arithmetic never runs.

`evaluateCandidate` already receives `carriers`, so the per-candidate path
needs no signature change.

`effectiveWindowKHz(order, settings)` is retained with its present semantics.
Its existing test pins the legacy uniform behaviour, and no existing test is to
be modified.

## 7. User interface

All changes are on the Setup carrier card. Nothing else moves.

- A **Device** `<select>`, options grouped by brand with `<optgroup>`, first
  option "No device". Native selects inherit `min-height: var(--tap)` and the
  ≥16 px font from `base.css`, so the 44 px rule is satisfied structurally.
- A **Power** select, rendered only when the device offers more than one; a
  single option is shown as static text.
- A **Mode** select, rendered only when the device has more than one mode.
- The resolved width is **always visible**, as `±28 kHz · 56 kHz wide`. This is
  the requirement that it be clear what width is in use, and it is what makes
  the narrow/wide choice meaningful rather than a label.
- A digital device is marked as such, so its ±100 kHz is not mistaken for FM
  deviation.

In the Settings panel, "Peak deviation (kHz)" is relabelled to say it applies
only to carriers with no device, so the two mechanisms cannot be confused.

## 8. Assumptions and honest limits

- **Deviation is used as occupied half-width.** For the A10 this is an
  approximation: 200 kHz is digital channel bandwidth, not FM deviation. The
  arithmetic treats them alike, and the UI labels the device as digital so the
  user can judge.
- **Carson's rule is not applied.** True FM occupied bandwidth is roughly
  `2(Δf + f_max)` — a ±28 kHz transmitter with 15 kHz audio occupies about
  86 kHz, not 56 kHz. Using the quoted deviation, as the source data does,
  understates real occupied width for every FM device. This is deliberate: the
  figures the user supplied are deviations, and inventing an audio bandwidth
  per device would be a guess dressed as precision. A future refinement.
- **Receiver IF bandwidth is approximated by the transmitter's deviation.**
  Real receivers are wider. The victim term is therefore conservative-low.

## 9. Persistence

`PROJECT_VERSION` goes to 3. The file gains the three optional carrier fields.

- A version 1 or 2 file loads unchanged: no device fields, global fallback.
- A version 3 file with an unknown `deviceId` has the device dropped during
  sanitisation and falls back to the global setting. The carrier then shows
  "No device", so the loss is visible in the UI rather than silent.
- `powerMW` not offered by the device, or a `modeId` the device lacks, are
  dropped the same way.

Sanitisation follows the existing pattern in `project.ts`: unknown or
wrong-typed values are dropped rather than trusted, because a hand-edited file
must never reach the engine's arithmetic as `NaN`.

## 10. Testing

Pure functions only — Vitest runs in the node environment with no DOM.

- `resolveDeviationHz`: device+mode, device with missing mode, unknown device,
  no device, each against the global fallback.
- `carrierDeviationsHz`: returns `null` for a uniform fleet (the fast path),
  an array for a mixed one.
- The window: a mixed-deviation product produces a different window than a
  uniform one of the same order; the victim term widens it; the near-hit floor
  still applies.
- Catalogue integrity: every device has at least one mode, ascending powers,
  unique ids, and every `widthHz` is exactly twice its `deviationHz`.
- Round-trip: a project with devices exports and re-imports identically; a v2
  file still loads; an unknown device id is dropped.

## 11. Success criteria

1. A user can select any of the nine devices on any carrier, choose its power,
   and choose wide or narrow where the device offers both.
2. The width in use is visible on every carrier that has a device.
3. Analysis and the Tune picker both use the per-carrier deviation; neither
   consults the global setting for a carrier that has a device.
4. A project with no devices and the default global deviation of 0 produces
   byte-identical results to today. A project with no devices but a non-zero
   global deviation becomes stricter by exactly the victim term, per §5.3.
5. A mixed fleet of an A10 and a narrow-band MTP60 produces a different, and
   stricter, result than either alone would.
6. The uniform-deviation path performs no worse than today.
