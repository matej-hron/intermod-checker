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
  each calculated with the previous replacements already applied. A carrier for
  which no clean frequency exists is reported as such and left alone; in a
  congested band the later carriers can run out of room, so re-run the analysis
  to confirm the final set.
- Lets you lock any transmitter whose frequency cannot change, so nothing ever
  proposes moving it and the suggestion engine works around it.
- Lets you define excluded frequency ranges to keep clear (local TV, in-ear
  monitors, intercom); no frequency inside one is ever offered.
- Includes a Tune view for picking one transmitter and browsing every frequency
  available to it, each rated against the interference tests that apply.
- Runs the whole search on a background worker, so a 12-carrier scan does not
  freeze the page.
- Saves your project to `localStorage` automatically, and can export it to or
  import it from a JSON file.

## On a phone

The interface is built mobile-first. On a phone the three sections sit in a
bottom bar within thumb reach, Analyse is always one tap away in a sticky bar
above it, and the Tune view shows candidate frequencies as a filtered list of
large tap targets — defaulting to the clear ones, with the nearest clear
frequency pinned at the top. From 768 px the same views expand: the tabs move
to the top and Tune shows the full scored matrix.

## Installing it

The app is a PWA. Every calculation already runs in your browser, so once
installed it works with no network at all — useful backstage, in a basement, or
anywhere signal is poor.

- **Android / desktop Chrome:** use the install prompt in the address bar.
- **iOS:** Safari does not offer a prompt. Use Share → *Add to Home Screen*.

Two things worth knowing:

- An installed iOS app gets its own storage. A project saved in Safari will not
  appear inside the installed app. Use **Export JSON** and **Import JSON** to
  move a project between them.
- When a new version is available the app shows a *Reload* bar rather than
  updating itself. It will never reload underneath you mid-show.

## Devices

Each frequency can name the transmitter that will use it. The device decides how
much spectrum that transmitter occupies, which is what the interference
calculation actually needs.

| Brand | Model | Power | Width |
| --- | --- | --- | --- |
| Wisycom | MTP40 | 10, 50 mW | ±28 kHz |
| Wisycom | MTP41 | 10, 50, 100 mW | ±28 kHz |
| Wisycom | MTP60 | 10, 50, 100 mW | ±28 kHz wide, ±17.5 kHz narrow |
| Wisycom | MTP61 | 10, 50, 100 mW | ±28 kHz wide, ±17.5 kHz narrow |
| Wisycom | MTB40s | 10, 50, 100 mW | ±28 kHz |
| Sennheiser | 5212 | 10, 50 mW | ±28 kHz |
| Sennheiser | Evolution G2/G3/G4/2000 | 10, 50 mW | ±24 kHz |
| Sound Devices | A10 | 10, 20, 50 mW | ±100 kHz (digital) |
| Lectrosonics | US models | 50 mW | ±70 kHz |

Power is recorded for your own reference. It does not affect the calculation —
modelling it properly needs transmitter placement and receiver sensitivity,
which this tool does not know.

For gear that is not listed, leave the device unset and use the **peak deviation
for carriers with no device** setting instead.

Two honest limits. The A10's 200 kHz is digital channel bandwidth rather than FM
deviation; the arithmetic treats the two alike. And the quoted deviation
understates true occupied bandwidth for every FM device, because Carson's rule
adds the audio bandwidth on top — so results are optimistic by roughly the same
margin for all of them.

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

## Running it

```bash
npm install
npm run dev        # development server
npm run build      # type-checks, then produces a production build in dist/
npm test           # engine test suite (vitest)
npm run typecheck  # tsc -b --noEmit
```

To re-check the mobile layout, serve the production build and point the viewport
check at it. It asserts that no view overflows at 390, 768 or 1280 px and that
nothing on a phone is smaller than a 44 px touch target:

```bash
npm run build
npx vite preview                                  # note the port it prints
npm run check:viewport -- http://localhost:4173/  # pass that port
```

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `bandMinKHz` | `500000` | Lower edge of the band, in kHz (500 MHz). |
| `bandMaxKHz` | `700000` | Upper edge of the band, in kHz (700 MHz). |
| `lowOrder` | `3` | Lowest IM order to search. |
| `highOrder` | `5` | Highest IM order to search (maximum 9). |
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
