# Field Notebook Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing mobile-first Intermodulation Checker as the approved Field Notebook design and release it through the existing GitHub Pages workflow without changing application behaviour.

**Architecture:** Keep stores, analysis modules, routes, and component boundaries intact. Establish the visual language in CSS tokens and a dependency-free inline SVG icon component, then apply targeted semantic markup and class changes screen by screen. Validate each independently reviewable surface before running the complete repository and viewport gates.

**Tech Stack:** React 19, TypeScript 6, Zustand 5, CSS, Vite 8, Vitest 4, oxlint, Playwright viewport script, GitHub Actions Pages deployment

## Global Constraints

- Do not modify `src/im/**`, worker messages, analysis algorithms, or recommendation logic.
- Do not add application features, screens, routes, onboarding, accounts, or persistence migrations.
- Do not add font, icon, animation, charting, or UI framework dependencies.
- Use only local system font stacks; the PWA must remain fully offline.
- Preserve Setup, Results, and Tune navigation destinations and existing state transitions.
- Preserve 44 px minimum interactive targets and prevent page-level horizontal overflow at 390, 768, and 1280 px.
- Preserve text/shape indicators so colour is never the sole carrier of meaning.
- Support light mode, dark mode, and `prefers-reduced-motion`.
- Keep exact existing user-visible behaviour for projects, analysis, tuning, undo, live checks, updates, and offline operation.

---

## File map

| File | Responsibility in this redesign |
| --- | --- |
| `src/styles/tokens.css` | Field Notebook colour, type, spacing, shape, shadow, focus, and motion tokens |
| `src/styles/base.css` | Global controls, typography, page canvas, panels, shared buttons and badges |
| `src/styles/components.css` | Shell and screen-specific presentation |
| `src/ui/Icon.tsx` | Small inline SVG icon set with a typed name API |
| `src/ui/__tests__/Icon.test.tsx` | Server-rendered icon contract tests without a DOM dependency |
| `src/ui/AppBar.tsx` | Brand lockup and utility-header markup |
| `src/ui/Nav.tsx` | Index-tab labels and icons |
| `src/ui/ActionBar.tsx` | Analyse and Cancel icon treatment and responsive label |
| `src/ui/CarrierList.tsx` | Fieldbook entry markup, heading metadata, icon actions |
| `src/ui/CarrierSheet.tsx` | Grouped editor sections and icon actions |
| `src/ui/SettingsPanel.tsx` | Human-readable current-settings summary and grouped classes |
| `src/ui/ResultsSummary.tsx` | Lead verdict card and ledger cells |
| `src/ui/SuggestionPanel.tsx` | Retune rows and action hierarchy |
| `src/ui/SpectrumStrip.tsx` | Plot heading and grid treatment hooks |
| `src/ui/ConflictList.tsx` | Severity classes and expandable entry treatment |
| `src/ui/ContextStrip.tsx` | Field-guide carrier switcher treatment hooks |
| `src/ui/CandidateList.tsx` | Pinned choice, notebook tabs, explicit state labels |
| `src/ui/CandidateGrid.tsx` | Sticky desktop ledger header and explicit state labels |
| `src/ui/TuneView.tsx` | Field-guide heading and selected-carrier context |
| `README.md` | Screenshot-free description of the refreshed visual system |

---

### Task 1: Establish the Field Notebook foundation

**Files:**
- Create: `src/ui/Icon.tsx`
- Create: `src/ui/__tests__/Icon.test.tsx`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/base.css`

**Interfaces:**
- Produces: `Icon({ name, size?, className? }: IconProps): JSX.Element`
- Produces: `IconName = 'lock' | 'unlock' | 'delete' | 'add' | 'analyse' | 'tune' | 'project' | 'close' | 'more'`
- Consumes: no application state

- [ ] **Step 1: Write the icon contract test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon, type IconName } from '../Icon';

describe('Icon', () => {
  it('renders every supported icon as a hidden SVG that inherits colour', () => {
    const names: IconName[] = [
      'lock', 'unlock', 'delete', 'add', 'analyse',
      'tune', 'project', 'close', 'more',
    ];

    for (const name of names) {
      const html = renderToStaticMarkup(<Icon name={name} />);
      expect(html).toContain('<svg');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('stroke="currentColor"');
      expect(html).not.toContain('<title');
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/ui/__tests__/Icon.test.tsx`

Expected: FAIL because `src/ui/Icon.tsx` does not exist.

- [ ] **Step 3: Implement the typed inline icon component**

Create one 24 × 24 SVG wrapper with `fill="none"`, `stroke="currentColor"`,
`strokeWidth={1.9}`, rounded line caps/joins, and a switch that returns only the
paths needed by each `IconName`. Set `aria-hidden="true"` and
`focusable="false"` on the SVG; accessible names remain on the parent buttons.

```tsx
export type IconName =
  | 'lock' | 'unlock' | 'delete' | 'add' | 'analyse'
  | 'tune' | 'project' | 'close' | 'more';

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}
```

- [ ] **Step 4: Replace the token palette and shared primitives**

In `tokens.css`, add `--font-display`, `--forest`, `--orange`,
`--orange-pressed`, `--paper-grain`, `--shadow-offset`, and
`--motion-fast: 160ms`. Set the light values exactly from the approved spec:
canvas `#E8EBDD`, paper `#FFFDF4`, raised paper `#F3F5E9`, ink `#17251E`,
muted ink `#5D695F`, rule `#B8C1AD`, forest `#244B37`, orange `#E05C35`,
orange pressed `#A93E22`, clear `#277254`, near `#A36516`, conflict `#B43D2C`.

Define the dark palette as near-black green canvas, dark olive paper, warm
off-white ink, sage borders, brighter orange, and AA-contrast verdict colours.
Change the base radius to 8 px, buttons to 6 px, and use a 4 px offset paper
shadow. Keep `--tap: 2.75rem`.

In `base.css`, apply the serif stack only to the app title and headings, preserve
the native sans stack for controls/body, keep monospace frequencies, add subtle
CSS-only paper grain, define pressed button feedback, forest secondary buttons,
orange primary buttons, ledger-style badges, and a distinct focus ring that
does not depend on the offset shadow.

- [ ] **Step 5: Add reduced-motion overrides**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 6: Run targeted validation**

Run: `npm test -- src/ui/__tests__/Icon.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/Icon.tsx src/ui/__tests__/Icon.test.tsx src/styles/tokens.css src/styles/base.css
git commit -m "feat: establish Field Notebook visual system"
```

---

### Task 2: Redesign the application shell

**Files:**
- Modify: `src/ui/AppBar.tsx`
- Modify: `src/ui/Nav.tsx`
- Modify: `src/ui/ActionBar.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `Icon` from Task 1
- Produces: unchanged `AppBar`, `Nav`, and `ActionBar` props and state behaviour

- [ ] **Step 1: Add semantic shell markup**

Update `AppBar` to wrap the title in `.app-brand`, split
`Intermodulation Checker` into a display line and a small `Frequency fieldbook`
descriptor, and retain `OfflineChip` plus `ProjectSheet`.

Add icons to the existing navigation labels and action buttons without changing
their callbacks. Wrap the long and short Analyse labels:

```tsx
<Icon name="analyse" />
<span className="action-bar__label-long">Analyse frequencies</span>
<span className="action-bar__label-short">Analyse</span>
```

The short label is hidden by default and shown only where the long label cannot
fit. Cancel remains text and secondary.

- [ ] **Step 2: Style the utility header and index tabs**

In `components.css`, give `.app-bar` the forest background and warm ink, make
project/offline controls inherit the high-contrast header palette, and align
the desktop inner container.

Render mobile `.nav` as cream notebook index tabs with an orange active top
rule and visible active marker. At 48 rem, keep the existing top position and
render outlined horizontal tabs. Preserve fixed-bar safe-area offsets and
z-index ordering.

Restyle `.action-bar` as a raised paper action shelf with one orange primary
button. Running progress must fit without increasing page width.

- [ ] **Step 3: Verify shell responsiveness**

Run: `npm run typecheck && npm run build`

Expected: PASS with no TypeScript or Vite errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/AppBar.tsx src/ui/Nav.tsx src/ui/ActionBar.tsx src/styles/components.css
git commit -m "feat: redesign the application shell"
```

---

### Task 3: Redesign Setup and carrier editing

**Files:**
- Modify: `src/ui/CarrierList.tsx`
- Modify: `src/ui/CarrierSheet.tsx`
- Modify: `src/ui/SettingsPanel.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `Icon` from Task 1
- Produces: unchanged carrier add/edit/delete/lock/tune behaviour

- [ ] **Step 1: Add the Frequency plan heading block**

In `CarrierList`, replace the bare heading with:

```tsx
<div className="panel__heading">
  <div>
    <span className="eyebrow">Setup</span>
    <h2>Frequency plan</h2>
    <p className="hint">{carriers.length} active frequencies</p>
  </div>
</div>
```

Keep Add frequency after the list but add `<Icon name="add" />`. Replace emoji
lock/delete glyphs with `Icon`, preserving exact `aria-label` and
`aria-pressed` attributes.

- [ ] **Step 2: Add explicit entry state classes**

Build each carrier class list from invalid, conflicted, and analysed state:

```ts
const classes = ['carrier'];
if (flagged.has(carrier.id)) classes.push('carrier--invalid');
if (conflicted.has(carrier.id)) classes.push('carrier--conflict');
if (result && !conflicted.has(carrier.id)) classes.push('carrier--clear');
```

Add a decorative `.carrier__state-mark` with `aria-hidden="true"`; the existing
badge remains the textual status.

- [ ] **Step 3: Group the carrier sheet**

Add a `.sheet__header` with **Edit frequency** and an icon Close button that
calls `dialog.current?.close()`. Group fields beneath eyebrow labels:
`.sheet__section--frequency`, `.sheet__section--device`, and
`.sheet__section--actions`. Remove inline style objects by replacing them with
named classes. Add Tune and Delete icons while preserving callbacks.

- [ ] **Step 4: Make the settings summary reflect current values**

Change the summary hint to:

```tsx
<span className="hint">
  {kHzToMHzText(settings.bandMinKHz)}–{kHzToMHzText(settings.bandMaxKHz)} MHz
  {' · '}orders {settings.lowOrder}–{settings.highOrder}
  {' · '}{settings.minSpacingKHz} kHz spacing
</span>
```

Import `kHzToMHzText` from `../im`. Add `field-group` classes around related
band, order, and spacing controls without changing input values or handlers.

- [ ] **Step 5: Style fieldbook entries and grouped editor sections**

Use paper entries with a visible offset shadow, compact rule dividers, a left
state marker, prominent monospace frequency, labelled status stamp, and an
isolated icon-action column. Preserve the existing three-column mobile grid and
44 px icon controls.

Style expanded settings as a ledger grid and the live check as a verdict note.
Do not hide device details from the closed carrier row.

- [ ] **Step 6: Run Setup validation**

Run: `npm run typecheck && npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/CarrierList.tsx src/ui/CarrierSheet.tsx src/ui/SettingsPanel.tsx src/styles/components.css
git commit -m "feat: redesign frequency setup"
```

---

### Task 4: Redesign Results as a readable field report

**Files:**
- Modify: `src/ui/ResultsSummary.tsx`
- Modify: `src/ui/SuggestionPanel.tsx`
- Modify: `src/ui/SpectrumStrip.tsx`
- Modify: `src/ui/ConflictList.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: existing analysis and project stores; `Icon` from Task 1
- Produces: unchanged result, suggestion apply, tune navigation, and conflict expansion behaviour

- [ ] **Step 1: Create the lead verdict card**

In `ResultsSummary`, assign:

```ts
const clear = external.length === 0;
```

Render `.result-lead result-lead--clear` or `--conflict` with eyebrow
**Analysis result**, headline **Plan is clear** or
`{conflictedIds.length} carriers need attention`, and the existing exact
supporting counts. Keep the three severity totals but render each cell with a
verdict dot, label, and large numeric count.

- [ ] **Step 2: Restyle suggestions as before/after retune lines**

Add `suggestion__from`, `suggestion__arrow`, and `suggestion__to` spans around
existing values. Add analyse/tune icons to Apply and Choose myself. Preserve
the exact sequential-suggestion warning and Apply all logic.

- [ ] **Step 3: Add plotting and severity hooks**

Add an eyebrow and field-guide subtitle to `SpectrumStrip`; add an
`spectrum__grid` decorative element inside the chart with `aria-hidden="true"`.
It must not alter marker positioning or the chart's accessible label.

Pass `hit.severity` into each `HitRow` root class:

```tsx
<li className={`conflict conflict--${hit.severity}`}>
```

For carrier summary entries, compute the worst visible hit and add the same
modifier while keeping the existing button and expansion state.

- [ ] **Step 4: Style the field report**

Create pale green/terracotta lead cards, ledger summary cells, prominent
before/after suggestion values, a cream spectrum with faint CSS grid rules,
forest carrier markers, terracotta conflict markers, and severity-led conflict
entries. Avoid hiding any existing content.

- [ ] **Step 5: Run Results validation**

Run: `npm run typecheck && npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ResultsSummary.tsx src/ui/SuggestionPanel.tsx src/ui/SpectrumStrip.tsx src/ui/ConflictList.tsx src/styles/components.css
git commit -m "feat: redesign analysis results"
```

---

### Task 5: Redesign Tune as a frequency field guide

**Files:**
- Modify: `src/ui/TuneView.tsx`
- Modify: `src/ui/ContextStrip.tsx`
- Modify: `src/ui/CandidateList.tsx`
- Modify: `src/ui/CandidateGrid.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: existing `useCandidateModel`, tune/project stores, `Icon`
- Produces: unchanged candidate filtering, selection, apply, lock, and widen behaviour

- [ ] **Step 1: Add Tune heading and current-carrier summary**

Wrap the title in `.panel__heading`, add eyebrow **Frequency field guide**, and
render current carrier/frequency/search width in `.tune-context`. Add a tune
icon only to the section heading or action, never as the sole label.

- [ ] **Step 2: Make mobile candidate states explicit**

Keep the existing textual `current` and `nearest clear` badges. Change the
pinned action label to **Apply frequency**, add a tune icon, and preserve lock
disabling. Add `candidate--near` and `candidate--exact` classes from
`evaluation.worst`; the verdict sentence and dot remain.

Do not change `CandidateFilter`, count logic, sorting, or the default clear
filter.

- [ ] **Step 3: Add desktop ledger table hooks**

Wrap the table header labels in concise spans only where needed for styling.
Keep all `<th scope>` values. Add explicit `candidate-row--near` and
`candidate-row--exact` classes in addition to current/best classes. Keep the
grid in one horizontal scroll container and make only its header sticky.

- [ ] **Step 4: Style field-guide controls and candidates**

Render context chips as compact labelled stamps, the selected chip with a
forest inset marker, filter controls as outlined notebook tabs, the pinned
choice as a forest card, mobile candidates as paper entries, and desktop rows
as a ledger with right-aligned tabular numbers.

- [ ] **Step 5: Run Tune validation**

Run: `npm test -- src/ui/__tests__/candidateModel.test.ts && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TuneView.tsx src/ui/ContextStrip.tsx src/ui/CandidateList.tsx src/ui/CandidateGrid.tsx src/styles/components.css
git commit -m "feat: redesign frequency tuning"
```

---

### Task 6: Complete responsive, dark-mode, and documentation polish

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/base.css`
- Modify: `src/styles/components.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: all markup and classes introduced in Tasks 1–5
- Produces: complete Field Notebook presentation at all supported viewports

- [ ] **Step 1: Audit every component state in both colour schemes**

Cover clear, near, exact, locked, selected, current, best, invalid, loading,
empty, error, offline, update, undo, and dialog states. Ensure every foreground
and border remains legible in dark mode and no component falls back to a light
literal.

- [ ] **Step 2: Resolve fixed-surface stacking and responsive limits**

Verify `.undo-bar`, `.update-prompt`, `.sheet`, `.action-bar`, `.nav`, and
`.app-bar` z-index and safe-area offsets. Keep base/48 rem/64 rem breakpoints;
increase the desktop cap only to 72 rem if the Tune matrix needs it, while
keeping Setup panels readable.

- [ ] **Step 3: Run the production viewport check**

Run:

```bash
npm run build
npx vite preview --host 127.0.0.1
```

In a second shell, using the printed port:

```bash
npm run check:viewport -- http://127.0.0.1:4173/
```

Expected: all views pass at 390, 768, and 1280 px; no page overflow and no
interactive target below 44 px. If Vite selects a different port, pass that
exact URL.

- [ ] **Step 4: Perform a Playwright visual state pass**

At 390 and 1280 px, inspect Setup, Results, Tune, Carrier sheet, Project sheet,
Settings, About sheet, undo bar, update prompt where reproducible, light mode,
dark mode, and reduced motion. Check that essential digits do not truncate and
that fixed bars do not cover content.

- [ ] **Step 5: Update README**

Add a short **Interface** paragraph under **On a phone**:

```markdown
The Field Notebook interface uses warm paper surfaces, high-contrast field
labels, and tabular frequency typography. Verdicts always combine colour with
text and shape, and the complete interface supports light and dark mode without
loading remote fonts or icons.
```

- [ ] **Step 6: Run the complete repository gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

Expected: all commands PASS.

- [ ] **Step 7: Commit**

```bash
git add src/styles/tokens.css src/styles/base.css src/styles/components.css README.md
git commit -m "docs: document Field Notebook interface"
```

---

### Task 7: Review and release

**Files:**
- Review: all changes since `1453b13`
- Modify only if review or release validation finds a defect

**Interfaces:**
- Consumes: completed redesign and repository gates
- Produces: deployed GitHub Pages release from `main`

- [ ] **Step 1: Review the complete branch diff**

Run:

```bash
git --no-pager diff --check 1453b13..HEAD
git --no-pager diff --stat 1453b13..HEAD
```

Inspect for behaviour changes, missing states, hard-coded palette literals
outside token definitions, inaccessible icon-only controls, and unrelated
edits.

- [ ] **Step 2: Re-run the release gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

Expected: all commands PASS immediately before release.

- [ ] **Step 3: Confirm the branch is clean and push**

Run:

```bash
git status --short
git push origin main
```

Expected: clean status before push; push updates `main`.

- [ ] **Step 4: Watch the Pages workflow**

Run:

```bash
gh run list --workflow deploy.yml --branch main --limit 1
gh run watch <run-id> --exit-status
```

Expected: build and deploy jobs complete successfully.

- [ ] **Step 5: Verify the deployed application**

Read the deployment URL from:

```bash
gh run view <run-id> --json url,conclusion
gh api repos/matej-hron/intermod-checker/pages --jq '.html_url'
```

Open the Pages URL and verify that the Field Notebook header, Setup entries,
Results lead card, and Tune field guide load from the deployed build. Confirm
the service worker remains scoped to `/intermod-checker/` and an offline reload
still starts the app.
