# Intermodulation Checker

A browser tool for checking whether a set of wireless microphone frequencies
generates intermodulation products that land on each other, and for proposing
replacement frequencies when they do.

> [!WARNING]
> **This tool is a planning aid, not a guarantee.** It models intermodulation
> arithmetic only — it has no knowledge of your transmitter power, antenna
> placement, receiver filtering/selectivity, front-end overload, or local
> broadcast/TV occupancy, and it does not check spectrum licensing or
> regulations. You are responsible for complying with local rules and for
> verifying frequencies with a real-world scan and coordination before a
> performance. See [Disclaimer](#disclaimer) below.

## What it does

- Accepts 2–24 wireless microphone frequencies (designed around a typical
  10–12 microphone setup) in the 500–700 MHz band.
- Enumerates intermodulation products up to a configurable order and reports
  every product that lands on one of your own receivers.
- Classifies each hit as an exact hit or a near hit within a configurable
  window, and ranks it by severity — third order is the most serious, then
  fifth, then seventh and above.
- Proposes a replacement frequency for each conflicted carrier, one at a time,
  so that applying every suggestion in order produces a conflict-free set.
- Runs the whole search on a background worker, so a 12-carrier scan does not
  freeze the page.
- Saves your project to `localStorage` automatically, and can export it to or
  import it from a JSON file.

## The theory, briefly

An intermodulation (IM) product of carriers `A`, `B`, `C`… is any frequency of
the form

```
n1*A ± n2*B ± n3*C ± …
```

Its **order** is `Σ|ni|` — the sum of the absolute values of the
coefficients. Because of how mixing occurs in real transmitters and
receivers, odd orders dominate in practice, and among those, **third order**
products are the most severe (they fall closest to the original carriers and
are generated most strongly), followed by **fifth order**.

Real transmitters deviate slightly from their nominal frequency (FM
deviation). A product built from coefficients `ni` inherits a frequency swing
that is the sum of the contributing carriers' deviations scaled by their
coefficients — so a fifth-order product built from carriers each deviating by
±5 kHz can itself swing by up to ±25 kHz. That is why the checker widens its
match window to `order × deviationKHz` rather than using a single fixed
window: a higher-order product needs a wider net to be caught reliably.

A hit is reported as **self-involving** when the receiver it lands on is one
of the product's own contributing carriers. Self-involving hits are shown but
excluded from the conflict count, since a carrier's own harmonics landing
back on itself is a different (and far more common, far less actionable)
phenomenon than a genuine cross-channel conflict.

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # type-checks, then produces a production build in dist/
npm test           # engine test suite (vitest)
npm run typecheck  # tsc -b --noEmit
```

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `bandMinKHz` | `500000` | Lower edge of the band, in kHz (500 MHz). |
| `bandMaxKHz` | `700000` | Upper edge of the band, in kHz (700 MHz). |
| `lowOrder` | `3` | Lowest IM order to search. |
| `highOrder` | `5` | Highest IM order to search. |
| `oddOnly` | `true` | Only consider odd-order products (the practically significant ones). |
| `nearHitWindowKHz` | `25` | Base match window around a carrier, in kHz. |
| `deviationKHz` | `0` | Per-carrier FM deviation assumption, in kHz; widens the match window by `order × deviationKHz`. |
| `minSpacingKHz` | `250` | Minimum spacing enforced between carriers when validating and suggesting. |
| `suggestionStepKHz` | `25` | Grid step used when searching for a replacement frequency. |

## Privacy

Everything is computed locally in your browser, including the search for
replacement frequencies, which runs on a background worker thread. No project
data, frequency, or setting is sent to any server. Projects persist in
`localStorage` on your own machine and can be exported to or imported from a
JSON file that you control.

## Known limitations

- **This is a mathematical model of IM products only.** It does not model
  transmitter power, antenna placement, receiver filtering/selectivity,
  front-end overload, or local broadcast/TV occupancy — all of which matter
  in a real deployment.
- Self-involving products (where a carrier's own product lands back on
  itself) are reported in the results but are excluded from the conflict
  count.
- Suggestion search is capped at 2000 candidate frequencies per carrier and
  may find nothing if the band is too congested or too narrow.
- Device model presets — a catalogue of microphone models with per-model
  tuning range, channel step, and deviation — are **planned future work**,
  not a current feature. Today, deviation is a single setting shared by every
  carrier.

## Disclaimer

This tool models intermodulation products arithmetically from the
frequencies you enter. It does not know your transmitter power, antenna
placement, receiver filtering, or any signal that is not in your list, and it
does not check licensing or broadcast allocations. **Treat its output as a
planning aid, not a guarantee.** You are responsible for complying with local
spectrum licensing and regulations, and a real-world scan and coordination
with your equipment on site is still required before any performance.

## Documentation

- Design: `docs/superpowers/specs/2026-08-09-intermod-checker-design.md`
- Plan: `docs/superpowers/plans/2026-08-09-intermod-checker.md`
