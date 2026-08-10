# Mobile-first redesign and PWA — design

**Status:** implemented
Date: 2026-08-10
Supersedes: nothing. Extends the v1 and v2 designs; the interference engine is untouched.

## 1. Why

The tool is correct and useful, and unusable on a phone. Measured on the live
site at a 390 px viewport (iPhone 14):

| Symptom | Measurement |
|---|---|
| Tune view forces the whole page sideways | document is **932 px** wide in a 390 px viewport |
| Setup view forces the whole page sideways | **446 px** wide |
| Touch targets below the 44 px minimum | **30 of 30** interactive elements |
| Smallest target | lock checkbox, **13 × 13 px** |
| Candidate table | 161 rows × 8 `white-space: nowrap` columns = 873 px |

Page-level horizontal scroll is the headline defect: on the Tune view the
header and the navigation slide off-screen, so the user cannot even see where
they are. This is not a media-query fix.

The stylesheet also still carries unused scaffolding from the project template
— `#root { width: 1126px }` fighting `.app { max-width: 68rem }`, a 56 px `h1`,
a purple accent, `#social` rules for a component that does not exist. It is
removed here rather than adapted.

## 2. Who this is for, and where they are

The assumed primary scenario, stated so it can be challenged: **a sound
engineer on site**, standing, one-handed, often in a backstage or basement
area with no usable signal, who has a transmitter misbehaving and needs a clean
frequency now. The secondary scenario is planning a set beforehand on a sofa or
a train.

Both are served by the same design. The on-site case is the one that must feel
good, and it is the case that decides the PWA question.

Desktop must not regress: laying out 24 carriers is still comfortable at a
desk, and the dense candidate matrix is the v2 feature the tool is built
around.

## 3. Approaches considered

**A. Containment only.** Wrap the wide tables in horizontally scrollable
divs, raise the touch targets, delete the dead CSS. Cheapest, and it does fix
the page-level scroll. Rejected as the whole answer: it leaves the user
swiping a 873 px wall of numbers sideways on a 390 px screen to answer "which
frequency should I pick?", which is a bad way to ask a good question.

**B. A separate mobile application shell.** Distinct routes and components per
form factor. Rejected: it doubles the surface area of a tool with no component
test harness, and most of the app (project bar, settings, results, suggestions)
genuinely wants the same structure at both sizes.

**C. Mobile-first rebuild of the shell, with one deliberate dual rendering
(chosen).** One responsive shell, one set of design tokens, targets sized for
thumbs, bottom navigation on phones. Every view is a single component that
reflows — *except* the candidate grid, where the mobile and desktop mental
models genuinely differ, and which therefore gets two renderings over one
shared model hook.

C is chosen because the candidate grid is the only place where "the same
content, reflowed" is the wrong answer, and paying for a second rendering
exactly once is cheaper than either compromising it or forking the whole app.

## 4. The candidate grid — the real design problem

The desktop grid answers "show me the spectrum around this transmitter, scored
on every axis". 161 rows × 8 columns is the right shape for that question on a
wide screen, and it stays.

On a phone that question is unanswerable and, more importantly, it is not the
question being asked. Standing in a venue, the user is asking **"where can I
put this thing?"** So the mobile rendering is a filtered, vertical list:

- **Default filter is "Clear only"**, which typically cuts 161 candidates to a
  few dozen. A segmented control switches to **All**.
- **Order stays ascending by frequency** — unchanged from the worker, which
  already sorts. Frequency order is how a spectrum reads and keeps the mobile
  and desktop views mutually intelligible; the Δ column carries distance.
- **Each candidate is a card**, a single ~56 px tap target that applies the
  frequency: the frequency in large type, the signed Δ in kHz, the verdict
  sentence, and the row of criterion dots with their short labels beneath.
- **The nearest clear candidate is pinned** in a sticky header above the list
  with a one-tap apply, so the most likely action never requires scrolling.
- The current frequency's card is marked and its apply control disabled, as on
  desktop.

Both renderings consume one `useCandidateModel(carrier)` hook holding every
piece of derived state and behaviour they share — the nearest-clear
computation, the apply-and-re-analyse handler, the visible criterion list.
The components differ in markup only. This is the mechanism that keeps a dual
rendering from becoming a dual implementation.

Selection between them is a `useMediaQuery('(min-width: 48rem)')` hook, not a
CSS `display` toggle, so 161 rows are never rendered twice into the DOM.

## 5. Layout and navigation

**Shell.** A mobile-first container: full-bleed at phone width with a 1 rem
gutter, capped and centred from the tablet breakpoint up. `#root`'s fixed width
and `text-align: center` are deleted.

**Navigation.** On phones, a fixed **bottom tab bar** — Setup, Results, Tune —
in the thumb arc, respecting `env(safe-area-inset-bottom)`. From 48 rem up it
becomes the existing top tab row. The tab bar carries the current view via
`aria-current`, as today.

**The primary action.** Analyse is the one thing the user always wants next. It
becomes a **sticky action bar** sitting directly above the bottom navigation,
showing its own progress and a Cancel while running. It is present on every
view, so the user never hunts for it.

**Header.** The 56 px title is replaced by a compact app bar: the title at
body-heading size plus the project name, which doubles as the entry point to
project actions. Project actions (New / Export / Import) move behind a
**"Project" sheet** rather than occupying three buttons of vertical space on
every screen.

**Setup.** The six-column frequency table becomes a **card list**: one card per
carrier with the device name and the frequency as full-size fields, the lock as
a proper switch-sized control, the status badge, and Tune / Remove actions.
From 48 rem up, CSS Grid lines the same cards' fields into columns so the
desktop density is preserved. It stops being a `<table>`: it is a list of
labelled form controls, which is both more honest semantically and simpler than
a responsive-table hack.

**Analysis settings** collapse into a `<details>` block, closed by default.
They are expert controls; on a phone they should not stand between the user and
their frequencies. The exclusion editor stays inside it.

**Results** already fits (390 px, no overflow). It gets touch-sized targets,
card-shaped suggestions with the actions on their own line, and the spectrum
strip grows a taller touch-friendly form.

## 6. Design tokens and visual system

**Breakpoints**, defined once and used everywhere. Base styles are the phone
layout; there are exactly two `min-width` breakpoints:

| Name | Width | What changes |
|---|---|---|
| base | < 48 rem | bottom navigation, card renderings, single column |
| `md` | **48 rem (768 px)** | top tabs, candidate matrix, cards reflow into columns |
| `lg` | **64 rem (1024 px)** | container caps and centres |

No `max-width` queries are introduced: every rule adds capability as the
viewport grows, so the phone layout is what remains when a rule does not match.
`index.html` gains `viewport-fit=cover` so `env(safe-area-inset-*)` resolves to
real values on notched devices.

A single token layer replaces the ad-hoc `#8884`/`#d33` literals:

- **Colour**: surface, surface-raised, border, text, text-muted, accent, and
  the three verdict colours, each defined for light and dark under the existing
  `prefers-color-scheme` block. Dark mode becomes real rather than partial.
- **Spacing**: a 4 px scale.
- **Type**: 16 px base. **Every input is at least 16 px**, which is what stops
  iOS zooming the viewport on focus — a significant cause of the current
  disorientation.
- **Targets**: a `--tap: 2.75rem` (44 px) minimum applied to every control.
- **Radius, shadow, and a single focus-visible ring** applied globally, so
  keyboard focus survives the redesign.

Verdict dots keep shape-plus-colour (hollow / ring / filled) and their
`.visually-hidden` text, and grow to a legible size on touch.

## 7. PWA

### Is it worth it?

**Yes, and unusually so**, because of a property this app already has: it is
**entirely client-side**. Every calculation runs in a Web Worker in the
browser, there is no API, and projects persist to `localStorage`. The app is
already functionally offline-capable — the only thing missing is that the
browser must fetch the assets. A service worker closes that last gap, so
offline support here is not a feature to build but a capability to unlock.

What it gives us, in order of value for the on-site scenario:

1. **Works with no signal.** Backstage and basement areas are signal dead
   zones. This is the whole argument.
2. **Standalone display.** An installed PWA loses the browser's URL and tab
   bars, which returns roughly 90–110 px of vertical space on a phone — a
   large gain for a data-dense tool.
3. **Home-screen presence.** It becomes a tool the engineer has, not a URL
   they must remember at the moment they need it.
4. **Instant launch** from the precache, and a `theme_color` that makes the
   system UI match the app.

We explicitly do **not** want push notifications, background sync, or a share
target. There is no server and nothing to notify about.

### Is it compatible with GitHub Pages?

**Fully.** Service workers require HTTPS and a same-origin script; Pages
provides HTTPS on `*.github.io`, and the worker is served from our own origin.
No server configuration is needed, which is fortunate because Pages offers
none.

The one real hazard is the **non-root base path** `/intermod-checker/`. The
manifest's `start_url` and `scope`, the service worker's registration scope,
and every icon URL must all carry it. A root-scoped service worker would be
rejected outright. This is the same class of bug that the Web Worker URL
already presented in v2, so it is verified on the deployed site, not merely in
local preview.

Two consequences to document honestly rather than hide:

- **iOS has no install prompt.** Installation is Safari's "Add to Home Screen".
  The app will explain this once, dismissibly, on iOS Safari.
- **An installed iOS PWA gets its own storage.** A project saved in Safari does
  not appear in the installed app. The existing Export / Import JSON is the
  bridge, and the README will say so.

### How

`vite-plugin-pwa` (v1.3, which supports Vite 8) in `generateSW` mode:

- `registerType: 'prompt'`, **not** `autoUpdate`. Auto-update reloads the page
  when a new worker takes control, which can land in the middle of someone
  tuning a transmitter on a live stage. Instead a dismissible "Update
  available" bar offers the reload.
- The precache covers the JS, CSS, HTML, and the **analysis worker chunk** —
  without the worker the installed app would load and then fail to compute,
  which is the worst possible failure.
- Manifest: `name`, `short_name` "Intermod", `start_url` and `scope` at the
  deployed base, `display: standalone`, `theme_color`, `background_color`,
  and 192 px, 512 px, and maskable icons rasterised from the existing
  `favicon.svg`.
- An **offline indicator**: when `navigator.onLine` is false, a chip states
  that everything still works offline. Reassurance is the point — a user whose
  phone shows no bars needs to know the tool has not silently degraded.

## 8. What is explicitly not changing

- The interference engine (`src/im/**`), the Web Worker protocol, and every one
  of the 128 tests. This redesign is presentation and packaging only.
- Integer kilohertz everywhere, MHz only at the UI boundary.
- The project file format, the `localStorage` key, and v1 backward compatibility.
- Colour never being the sole carrier of meaning.
- The disclaimer footer.

## 9. Verification

The engine tests are untouched and must stay green. Because there is no
component test harness, the user-visible work is verified in a real browser at
three viewports — 390 px (phone), 768 px (tablet), 1280 px (desktop) — against
these assertions:

1. **`document.scrollWidth === clientWidth` on every view at every viewport.**
   This is the direct regression test for the headline defect and is the single
   most important check.
2. Every interactive element measures at least 44 px on its smaller axis.
3. Focusing a frequency input on an iOS-sized viewport does not change the
   visual viewport scale.
4. The Tune view on a phone shows the filtered card list and the pinned
   nearest-clear candidate; the desktop viewport shows the matrix.
5. Applying a candidate still updates the carrier and re-runs the analysis, at
   both sizes.
6. Dark mode renders every surface, border, and verdict legibly.
7. **On the deployed site:** the service worker registers under
   `/intermod-checker/`, the manifest is valid and reachable, and after one
   load the app starts and computes with the network disabled.

Assertion 7 runs against the real deployment, because base-path errors cannot
reproduce in local preview.
