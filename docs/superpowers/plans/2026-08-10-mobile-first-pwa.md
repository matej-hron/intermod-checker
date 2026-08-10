# Mobile-First Redesign and PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the interface mobile-first so the tool is genuinely usable on a phone on site, and ship it as an installable, offline-capable PWA on GitHub Pages.

**Architecture:** One responsive shell driven by a single design-token layer, with bottom navigation and a sticky primary action on phones that become top tabs and a static button from 48 rem up. Every view reflows, with exactly one deliberate dual rendering — the candidate grid, which is a scored matrix on desktop and a filtered card list on a phone, both consuming one shared model so the logic exists once. A service worker precaches the whole app, including the analysis Web Worker chunk, because every calculation already runs client-side.

**Tech Stack:** React 19, TypeScript, Vite 8, Zustand, `vite-plugin-pwa` 1.3 (`generateSW`/Workbox), plain CSS with custom properties, Vitest (node environment), oxlint.

## Global Constraints

- **The interference engine is untouched.** No file under `src/im/` changes except the new `src/ui/candidateModel.ts` helpers described in Task 5, and no existing test is modified. All 128 tests stay green.
- **Integer kilohertz everywhere** in engine, worker, stores, and persistence. MHz only at the UI boundary, via `kHzToMHzText`, `mhzToKHz`, `parseFrequencyMHz`, and `MHzInput`. Hand-rolled conversion is a defect.
- **Colour is never the sole carrier of meaning.** Verdict dots keep shape *and* colour — hollow = clear, ring = near, filled = exact — and every dot keeps `.visually-hidden` text.
- **Minimum touch target is 44 × 44 px** (`--tap: 2.75rem`) on every interactive element.
- **Every `input`, `select`, and `textarea` renders at a minimum computed font size of 16 px.** Below that, iOS Safari zooms the viewport on focus, which is a primary cause of the current disorientation.
- **No view may exceed the viewport width at any size.** `document.documentElement.scrollWidth === document.documentElement.clientWidth` is the acceptance test.
- **Breakpoints are `min-width` only**, exactly two: `48rem` (768 px) and `64rem` (1024 px). No `max-width` queries. The phone layout is the base.
- `STORAGE_KEY` stays `'intermod-checker:project:v1'`; the project file format and v1 backward compatibility are unchanged.
- Defaults in `src/im/types.ts` unchanged: `bandMinKHz=500000`, `bandMaxKHz=700000`, `lowOrder=3`, `highOrder=5`, `oddOnly=true`, `nearHitWindowKHz=25`, `deviationKHz=0`, `minSpacingKHz=250`, `suggestionStepKHz=25`; `MAX_ORDER=9`, `MIN_CARRIERS=2`, `MAX_CARRIERS=24`.
- The deployed base path is `/intermod-checker/`. The Vite worker URL must stay exactly `new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })`.
- The disclaimer footer text is unchanged.
- Gate for every task: `npm run typecheck && npm run lint && npm run test`, plus `npm run build` for any task touching the build or the UI. The root `tsconfig.json` is references-only, so `npm run typecheck` (`tsc -b`) is required — plain `tsc --noEmit` silently does nothing. Lint is `oxlint`.
- Vitest picks up `src/**/__tests__/**/*.test.ts` in the **node** environment. There is no DOM and no component-test harness: do not add component tests, and do not add a testing library. Test pure functions only.
- Conventional Commits.

## File Structure

**Created**
| File | Responsibility |
|---|---|
| `src/styles/tokens.css` | Colour, spacing, type, radius, shadow, and tap-size custom properties for light and dark |
| `src/styles/base.css` | Reset, element defaults, global control sizing, focus ring, shell layout |
| `src/styles/components.css` | Every component class |
| `src/ui/AppBar.tsx` | Title, project name, and the trigger for project actions |
| `src/ui/ProjectSheet.tsx` | New / Export / Import inside a native `<dialog>` |
| `src/ui/Nav.tsx` | The three view tabs — bottom bar on phones, top tabs from 48 rem |
| `src/ui/ActionBar.tsx` | The sticky Analyse action, its progress, and Cancel |
| `src/ui/CarrierList.tsx` | The carrier cards that replace the frequency table |
| `src/ui/candidateModel.ts` | Pure candidate derivations — `nearestClearKHz`, `filterEvaluations` |
| `src/ui/useCandidateModel.ts` | The React hook both candidate renderings share |
| `src/ui/useMediaQuery.ts` | Subscribes to a media query |
| `src/ui/CandidateList.tsx` | The phone rendering of the candidates |
| `src/ui/UpdatePrompt.tsx` | The dismissible "update available" bar |
| `src/ui/OfflineChip.tsx` | The offline reassurance chip |
| `src/ui/__tests__/candidateModel.test.ts` | Tests for the pure derivations |
| `src/vite-env.d.ts` | Vite and `vite-plugin-pwa` ambient types |

**Deleted**
| File | Why |
|---|---|
| `src/ui/ProjectBar.tsx` | Replaced by `AppBar` + `ProjectSheet` |
| `src/ui/FrequencyTable.tsx` | Replaced by `CarrierList` |

**Modified:** `index.html`, `vite.config.ts`, `package.json`, `src/index.css`, `src/App.tsx`, `src/ui/CandidateGrid.tsx`, `src/ui/TuneView.tsx`, `src/ui/ContextStrip.tsx`, `src/ui/SettingsPanel.tsx`, `src/ui/ExclusionEditor.tsx`, `src/ui/ResultsSummary.tsx`, `src/ui/SuggestionPanel.tsx`, `src/ui/ConflictList.tsx`, `src/ui/SpectrumStrip.tsx`, `src/ui/VerdictDot.tsx`, `README.md`, the design spec's status line.

---

### Task 1: Design tokens, base styles, and the shell

The whole redesign rests on this task. It deletes the project template's leftover stylesheet, establishes the token layer, and — critically — styles the **bare `button`, `input`, and `select` elements globally** so that the 44 px minimum cannot be missed by forgetting a class on one control. That global rule is what stops the "30 of 30 targets too small" defect from recurring.

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css`
- Modify: `src/index.css` (reduce to imports), `index.html`

**Interfaces:**
- Produces: the CSS custom properties and the `.app`, `.app__main`, `.panel`, `.hint`, `.error`, `.badge`, `.visually-hidden` classes every later task uses. Later tasks add classes to `src/styles/components.css`; they never re-declare tokens.

- [ ] **Step 1: Write the token layer**

Create `src/styles/tokens.css`:

```css
:root {
  color-scheme: light dark;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;

  --radius-sm: 0.25rem;
  --radius: 0.5rem;
  --radius-lg: 0.875rem;

  /* Every interactive element is at least this on both axes. */
  --tap: 2.75rem;

  --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Consolas, monospace;

  --text-sm: 0.8125rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.375rem;

  --surface: #ffffff;
  --surface-raised: #f7f7f9;
  --surface-sunken: #eeeef2;
  --border: #d9d9e0;
  --border-strong: #b4b4c0;
  --text: #1b1b21;
  --text-muted: #5f5f6c;
  --accent: #2f6feb;
  --accent-contrast: #ffffff;

  --clear: #1f7a34;
  --near: #a86400;
  --exact: #c62828;
  --clear-bg: rgba(31, 122, 52, 0.12);
  --near-bg: rgba(168, 100, 0, 0.12);
  --exact-bg: rgba(198, 40, 40, 0.12);

  --shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.06);
  --focus: 0 0 0 3px rgba(47, 111, 235, 0.5);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: #15161a;
    --surface-raised: #1d1f25;
    --surface-sunken: #0f1013;
    --border: #2e3038;
    --border-strong: #474b58;
    --text: #eceef3;
    --text-muted: #a3a7b4;
    --accent: #6ea1ff;
    --accent-contrast: #0b1020;

    --clear: #5bc46f;
    --near: #e0a33a;
    --exact: #ff6b6b;
    --clear-bg: rgba(91, 196, 111, 0.16);
    --near-bg: rgba(224, 163, 58, 0.16);
    --exact-bg: rgba(255, 107, 107, 0.16);

    --shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4);
    --focus: 0 0 0 3px rgba(110, 161, 255, 0.55);
  }
}
```

- [ ] **Step 2: Write the base layer**

Create `src/styles/base.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  font: var(--text-base) / 1.5 var(--font);
  color: var(--text);
  background: var(--surface-sunken);
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  margin: 0;
  color: var(--text);
  font-weight: 600;
  line-height: 1.25;
}
h1 { font-size: var(--text-xl); }
h2 { font-size: var(--text-lg); }
h3 { font-size: var(--text-base); }
p { margin: 0; }
ul { margin: 0; }

/* Controls are styled on the bare element so a control can never be shipped
   below the touch minimum by forgetting a class. */
button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

button,
select,
summary,
[role='button'] {
  cursor: pointer;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap);
  min-width: var(--tap);
  padding: 0 var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

/* 16px is the threshold below which iOS Safari zooms the viewport on focus. */
input,
select,
textarea {
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: max(1rem, var(--text-base));
}

input[type='checkbox'] {
  min-height: 0;
  width: 1.375rem;
  height: 1.375rem;
  padding: 0;
  accent-color: var(--accent);
}

:focus-visible {
  outline: none;
  box-shadow: var(--focus);
  border-radius: var(--radius-sm);
}

.btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-contrast);
  font-weight: 600;
}

.btn--ghost {
  border-color: transparent;
  background: transparent;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.hint {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.error {
  color: var(--exact);
}

.badge {
  display: inline-block;
  padding: 0.1rem var(--space-2);
  border-radius: 999px;
  font-size: var(--text-sm);
  background: var(--surface-sunken);
  color: var(--text-muted);
}
.badge--bad { background: var(--exact-bg); color: var(--exact); }
.badge--good { background: var(--clear-bg); color: var(--clear); }
.badge--high { background: var(--exact-bg); color: var(--exact); }
.badge--medium { background: var(--near-bg); color: var(--near); }
.badge--low { background: var(--surface-sunken); color: var(--text-muted); }

/* The shell. The bottom padding clears the fixed action bar and navigation on
   phones; from 48rem both are static and the reservation is dropped. */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  padding-bottom: calc(
    var(--tap) * 2 + var(--space-4) + env(safe-area-inset-bottom)
  );
}

.app__main {
  flex: 1;
  width: 100%;
  padding: 0 var(--space-4);
}

.panel {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.panel > h2 {
  margin-bottom: var(--space-3);
}

.disclaimer {
  padding: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

@media (min-width: 48rem) {
  .app {
    padding-bottom: var(--space-6);
  }
}

@media (min-width: 64rem) {
  .app__main,
  .app__bar {
    max-width: 64rem;
    margin-inline: auto;
  }
}
```

- [ ] **Step 3: Reduce `src/index.css` to imports**

Replace the **entire** contents of `src/index.css` with exactly:

```css
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/components.css';
```

Everything previously in that file is either re-expressed above or deliberately
dropped: `#root { width: 1126px }`, `text-align: center`, the 56 px `h1`, the
purple `--accent`, the `#social` rules, and the `code`/`.counter` rules are all
project-template scaffolding for components this app does not have.

- [ ] **Step 4: Seed the component layer with the styles carried over**

Create `src/styles/components.css` with the component styles that survive from
the old sheet, re-expressed in tokens. Later tasks append to this file.

```css
.freq-input--invalid {
  border-color: var(--exact);
  box-shadow: 0 0 0 2px var(--exact-bg);
}

.spectrum {
  position: relative;
  height: 5rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
  overflow: hidden;
}
/* Markers are centred on their frequency, so the track is inset by half the
   widest marker to keep one sitting exactly on a band edge fully visible. */
.spectrum__track { position: absolute; inset: 0 2px; }
.spectrum__product,
.spectrum__carrier { transform: translateX(-50%); }
.spectrum__product { position: absolute; bottom: 0; width: 1px; height: 35%; background: var(--border-strong); }
.spectrum__product--high { background: var(--exact); height: 100%; width: 2px; }
.spectrum__product--medium { background: var(--near); height: 65%; }
.spectrum__product--low { background: var(--border-strong); height: 35%; }
.spectrum__carrier { position: absolute; top: 0; width: 2px; height: 100%; background: var(--clear); }
.spectrum__carrier--bad { background: var(--exact); width: 3px; }
.spectrum__scale { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--text-muted); }

.dot {
  display: inline-block;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 50%;
  box-sizing: border-box;
  flex: none;
}
.dot--clear { border: 1px solid var(--clear); background: transparent; }
.dot--near { border: 3px solid var(--near); background: transparent; }
.dot--exact { border: 1px solid var(--exact); background: var(--exact); }
```

- [ ] **Step 5: Update the document head**

In `index.html`, replace the `<head>` contents with:

```html
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#15161a" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="Check wireless microphone frequencies for intermodulation interference. Works offline." />
    <title>Intermodulation Checker</title>
```

`viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to real
values on notched devices; without it the bottom navigation sits under the home
indicator. Vite rewrites the leading-slash asset URLs to the configured base at
build time, so these stay root-relative in source.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 128 tests across 10 files.

The app will look unstyled in places at this point — the components still carry
old class names and the layout arrives in Task 2. That is expected; what must be
true is that it builds and the engine is untouched.

- [ ] **Step 7: Commit**

```bash
git add index.html src/index.css src/styles
git commit -m "feat(ui): add design tokens and a mobile-first base layer"
```

---

### Task 2: The application shell

**Files:**
- Create: `src/ui/AppBar.tsx`, `src/ui/ProjectSheet.tsx`, `src/ui/Nav.tsx`, `src/ui/ActionBar.tsx`
- Delete: `src/ui/ProjectBar.tsx`
- Modify: `src/App.tsx`, `src/styles/components.css`

**Interfaces:**
- Consumes: `useProjectStore` (`name`, `setName`, `loadProject`, `newProject`, `carriers`, `settings`), `useAnalysisStore` (`status`, `progress`, `errorMessage`, `issues`, `run`, `cancel`, `clear`), `useViewStore` (`view`, `goTo`), `useTuneStore` (`reset`), and `parseProject` / `serializeProject` from `../im`. `progress` carries a `fraction` field, not `progress`.
- Produces: `<AppBar />`, `<Nav view onNavigate />`, `<ActionBar onNavigate />`, all default-free named exports.

- [ ] **Step 1: Write the navigation**

Create `src/ui/Nav.tsx`:

```tsx
import type { ViewName } from '../state/viewStore';

const VIEWS: { id: ViewName; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'results', label: 'Results' },
  { id: 'tune', label: 'Tune' },
];

export function Nav({
  view,
  onNavigate,
}: {
  view: ViewName;
  onNavigate: (target: ViewName) => void;
}) {
  return (
    <nav className="nav" aria-label="Sections">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className="nav__tab"
          aria-current={view === v.id ? 'page' : undefined}
          onClick={() => onNavigate(v.id)}
        >
          {v.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Write the project sheet**

Create `src/ui/ProjectSheet.tsx`. A native `<dialog>` is used because
`showModal()` provides focus trapping, `Esc` to close, and inertness for the
rest of the page without any of it being written by hand.

```tsx
import { useRef, useState } from 'react';
import { parseProject, serializeProject } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';

export function ProjectSheet() {
  const name = useProjectStore((s) => s.name);
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const setName = useProjectStore((s) => s.setName);
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProject = useProjectStore((s) => s.newProject);
  const clear = useAnalysisStore((s) => s.clear);

  const dialog = useRef<HTMLDialogElement>(null);
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
    <>
      <button
        type="button"
        className="btn--ghost app-bar__project"
        onClick={() => dialog.current?.showModal()}
      >
        <span className="app-bar__name">{name || 'Untitled'}</span>
        <span className="visually-hidden">Open project options</span>
        <span aria-hidden="true">▾</span>
      </button>

      <dialog ref={dialog} className="sheet" aria-label="Project">
        <div className="sheet__body">
          <h2>Project</h2>

          <label className="field">
            Project name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Start a new project? This discards the current one unless you exported it first.',
                )
              ) {
                newProject();
                setImportError(null);
                clear();
              }
            }}
          >
            New project
          </button>
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
            aria-label="Import project JSON file"
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

          <button
            type="button"
            className="btn--primary"
            onClick={() => dialog.current?.close()}
          >
            Done
          </button>
        </div>
      </dialog>
    </>
  );
}
```

- [ ] **Step 3: Write the app bar**

Create `src/ui/AppBar.tsx`:

```tsx
import { OfflineChip } from './OfflineChip';
import { ProjectSheet } from './ProjectSheet';

export function AppBar() {
  return (
    <header className="app-bar">
      <div className="app__bar app-bar__inner">
        <h1 className="app-bar__title">Intermodulation Checker</h1>
        <OfflineChip />
        <ProjectSheet />
      </div>
    </header>
  );
}
```

`OfflineChip` arrives in Task 8. Until then create a placeholder module so this
compiles — `src/ui/OfflineChip.tsx` containing exactly:

```tsx
export function OfflineChip() {
  return null;
}
```

Task 8 replaces its body. Nothing else references it, so this is a one-line
seam, not a scaffold to unpick.

- [ ] **Step 4: Write the action bar**

Create `src/ui/ActionBar.tsx`. Analyse is the action the user always wants next,
so it is present on every view rather than living inside one.

```tsx
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';
import type { ViewName } from '../state/viewStore';

export function ActionBar({
  onNavigate,
}: {
  onNavigate: (target: ViewName) => void;
}) {
  const carriers = useProjectStore((s) => s.carriers);
  const settings = useProjectStore((s) => s.settings);
  const status = useAnalysisStore((s) => s.status);
  const progress = useAnalysisStore((s) => s.progress);
  const errorMessage = useAnalysisStore((s) => s.errorMessage);
  const issues = useAnalysisStore((s) => s.issues);
  const run = useAnalysisStore((s) => s.run);
  const cancel = useAnalysisStore((s) => s.cancel);

  const running = status === 'running';

  return (
    <div className="action-bar">
      <div className="app__bar action-bar__inner">
        <button
          type="button"
          className="btn--primary action-bar__go"
          onClick={() => {
            void run(carriers, settings);
            onNavigate('results');
          }}
          disabled={running}
        >
          Analyse
        </button>

        {running && (
          <>
            <span className="action-bar__progress" aria-live="polite">
              {progress?.phase === 'suggest' ? 'Finding alternatives' : 'Analysing'}{' '}
              {Math.round((progress?.fraction ?? 0) * 100)}%
            </span>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </>
        )}
      </div>

      {(errorMessage !== null || issues.length > 0) && (
        <div className="app__bar action-bar__issues" role="alert">
          {errorMessage !== null && <p className="error">{errorMessage}</p>}
          {issues.length > 0 && (
            <ul className="error">
              {issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `src/App.tsx` around the shell**

Replace the whole file:

```tsx
import { CarrierList } from './ui/CarrierList';
import { SettingsPanel } from './ui/SettingsPanel';
import { ResultsSummary } from './ui/ResultsSummary';
import { ConflictList } from './ui/ConflictList';
import { SpectrumStrip } from './ui/SpectrumStrip';
import { SuggestionPanel } from './ui/SuggestionPanel';
import { TuneView } from './ui/TuneView';
import { AppBar } from './ui/AppBar';
import { Nav } from './ui/Nav';
import { ActionBar } from './ui/ActionBar';
import { UpdatePrompt } from './ui/UpdatePrompt';
import { useViewStore, type ViewName } from './state/viewStore';
import { useTuneStore } from './state/tuneStore';

export default function App() {
  const view = useViewStore((s) => s.view);
  const goTo = useViewStore((s) => s.goTo);
  const resetTune = useTuneStore((s) => s.reset);

  const navigateTo = (target: ViewName) => {
    // Leaving the Tune view tears down tune state so it does not linger if the
    // user returns and picks a different carrier.
    if (view === 'tune' && target !== 'tune') {
      resetTune();
    }
    goTo(target);
  };

  return (
    <div className="app">
      <AppBar />
      <Nav view={view} onNavigate={navigateTo} />
      <ActionBar onNavigate={navigateTo} />

      <main className="app__main">
        {view === 'setup' && (
          <>
            <CarrierList />
            <SettingsPanel />
          </>
        )}

        {view === 'results' && (
          <>
            <ResultsSummary />
            <SuggestionPanel />
            <SpectrumStrip />
            <ConflictList />
          </>
        )}

        {view === 'tune' && <TuneView />}
      </main>

      <footer className="disclaimer">
        <p>
          This tool models intermodulation products arithmetically from the
          frequencies you enter. It does not know your transmitter power,
          antenna placement, receiver filtering, or any signal that is not in
          your list, and it does not check licensing or broadcast allocations.
          Treat its output as a planning aid, not a guarantee — always verify on
          site before a performance.
        </p>
      </footer>

      <UpdatePrompt />
    </div>
  );
}
```

`CarrierList` arrives in Task 3 and `UpdatePrompt` in Task 8. Create both now as
minimal seams so this task compiles and the app runs:

`src/ui/UpdatePrompt.tsx`:

```tsx
export function UpdatePrompt() {
  return null;
}
```

`src/ui/CarrierList.tsx` — for this task only, re-export the existing table so
nothing is lost while Task 3 rewrites it:

```tsx
export { FrequencyTable as CarrierList } from './FrequencyTable';
```

- [ ] **Step 6: Delete the old project bar**

```bash
git rm src/ui/ProjectBar.tsx
```

Nothing imports it after Step 5.

- [ ] **Step 7: Add the shell styles**

Append to `src/styles/components.css`:

```css
.app-bar {
  position: sticky;
  top: 0;
  z-index: 15;
  padding: var(--space-3) var(--space-4);
  padding-top: calc(var(--space-3) + env(safe-area-inset-top));
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.app-bar__inner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.app-bar__title {
  flex: 1;
  min-width: 0;
  font-size: var(--text-lg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.app-bar__project { padding: 0 var(--space-2); }
.app-bar__name {
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
}

.sheet {
  width: 100%;
  max-width: 30rem;
  margin: auto auto 0;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--surface);
  color: var(--text);
}
.sheet::backdrop { background: rgba(0, 0, 0, 0.45); }
.sheet__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
}
@media (min-width: 48rem) {
  .sheet { margin: auto; border-radius: var(--radius-lg); }
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* Bottom bar in the thumb arc on phones; a row of tabs from 48rem up. */
.nav {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 20;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
}
.nav__tab {
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.nav__tab[aria-current='page'] {
  color: var(--accent);
  font-weight: 600;
  box-shadow: inset 0 2px 0 var(--accent);
}

.action-bar {
  position: fixed;
  inset: auto 0 calc(var(--tap) + env(safe-area-inset-bottom)) 0;
  z-index: 19;
  padding: var(--space-2) var(--space-4);
  background: var(--surface);
  border-top: 1px solid var(--border);
}
.action-bar__inner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.action-bar__go { flex: 1; }
.action-bar__progress {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.action-bar__issues { margin-top: var(--space-2); font-size: var(--text-sm); }

@media (min-width: 48rem) {
  .nav {
    position: static;
    grid-auto-columns: max-content;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-4) 0;
    background: transparent;
    border-top: 0;
  }
  .nav__tab {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0 var(--space-4);
    background: var(--surface);
  }
  .nav__tab[aria-current='page'] {
    background: var(--surface-raised);
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  .action-bar {
    position: static;
    padding: var(--space-4) var(--space-4) 0;
    background: transparent;
    border-top: 0;
  }
  .action-bar__go { flex: 0 0 auto; }
}

@media (min-width: 64rem) {
  .nav,
  .action-bar { padding-inline: 0; }
  .nav { max-width: 64rem; margin-inline: auto; }
  .action-bar { max-width: 64rem; margin-inline: auto; }
}
```

- [ ] **Step 8: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 128 tests.

- [ ] **Step 9: Commit**

```bash
git add -A src index.html
git commit -m "feat(ui): add the mobile app shell with bottom navigation"
```

---

### Task 3: The Setup view — carrier cards and collapsible settings

The six-column table of inputs is 446 px wide at a 390 px viewport. It becomes a
list of cards that reflow into columns from 48 rem, so desktop density survives
without a second component. It stops being a `<table>`: a list of labelled form
controls is both more honest semantically and simpler than a responsive-table
hack.

**Files:**
- Create: `src/ui/CarrierList.tsx` (replacing the one-line re-export from Task 2)
- Delete: `src/ui/FrequencyTable.tsx`
- Modify: `src/ui/SettingsPanel.tsx`, `src/ui/ExclusionEditor.tsx`, `src/styles/components.css`

**Interfaces:**
- Consumes: `useProjectStore` (`carriers`, `addCarrier`, `updateCarrier`, `removeCarrier`), `useAnalysisStore` (`result`, `issues`), `useViewStore.openTune(carrierId)`, `MHzInput`, `MAX_CARRIERS`.
- Produces: `<CarrierList />`.

- [ ] **Step 1: Write the carrier list**

Replace the whole contents of `src/ui/CarrierList.tsx`:

```tsx
import { MAX_CARRIERS } from '../im';
import { useProjectStore } from '../state/projectStore';
import { useAnalysisStore } from '../state/analysisStore';
import { useViewStore } from '../state/viewStore';
import { MHzInput } from './MHzInput';

export function CarrierList() {
  const carriers = useProjectStore((s) => s.carriers);
  const addCarrier = useProjectStore((s) => s.addCarrier);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const removeCarrier = useProjectStore((s) => s.removeCarrier);
  const result = useAnalysisStore((s) => s.result);
  const issues = useAnalysisStore((s) => s.issues);
  const openTune = useViewStore((s) => s.openTune);

  const conflicted = new Set(result?.conflictedIds ?? []);
  const flagged = new Set(issues.flatMap((i) => i.carrierIds));

  return (
    <section className="panel">
      <h2>Frequencies</h2>

      <ul className="carrier-list">
        {carriers.map((carrier) => (
          <li
            key={carrier.id}
            className={
              flagged.has(carrier.id) ? 'carrier carrier--invalid' : 'carrier'
            }
          >
            <input
              className="carrier__name"
              aria-label={`Device name for ${carrier.label}`}
              value={carrier.label}
              onChange={(e) => updateCarrier(carrier.id, { label: e.target.value })}
            />

            <span className="carrier__status">
              {conflicted.has(carrier.id) ? (
                <span className="badge badge--bad">Conflict</span>
              ) : result ? (
                <span className="badge badge--good">Clear</span>
              ) : (
                <span className="badge">Not analysed</span>
              )}
            </span>

            <div className="carrier__freq">
              <MHzInput
                label={`Frequency for ${carrier.label} in megahertz`}
                valueKHz={carrier.freqKHz}
                onCommit={(khz) => updateCarrier(carrier.id, { freqKHz: khz })}
              />
              <span className="carrier__unit" aria-hidden="true">
                MHz
              </span>
            </div>

            <label className="carrier__lock">
              <input
                type="checkbox"
                checked={carrier.locked}
                onChange={(e) =>
                  updateCarrier(carrier.id, { locked: e.target.checked })
                }
                aria-label={`Lock the frequency of ${carrier.label}`}
              />
              <span aria-hidden="true">{carrier.locked ? '🔒' : '🔓'}</span>
            </label>

            <div className="carrier__actions">
              <button
                type="button"
                onClick={() => openTune(carrier.id)}
                aria-label={`Tune ${carrier.label}`}
              >
                Tune
              </button>
              <button
                type="button"
                className="btn--ghost"
                onClick={() => removeCarrier(carrier.id)}
                aria-label={`Remove ${carrier.label}`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="carrier-list__add"
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

The `#` column is dropped: the device name already identifies the carrier, and
every accessible name now uses that name rather than a position, which is more
useful when the list is long.

- [ ] **Step 2: Delete the old table**

```bash
git rm src/ui/FrequencyTable.tsx
```

- [ ] **Step 3: Collapse the settings behind a `<details>`**

In `src/ui/SettingsPanel.tsx`, replace the opening `<section className="panel">`
and `<h2>Analysis settings</h2>` with:

```tsx
    <details className="panel settings">
      <summary className="settings__summary">
        <h2>Analysis settings</h2>
        <span className="hint">Band, orders, spacing, excluded ranges</span>
      </summary>
```

and change the closing `</section>` to `</details>`. Then wrap every control
between the summary and `<ExclusionEditor />` in a single
`<div className="settings__body">` so the grid can lay them out. The controls
themselves, their values, and their handlers are unchanged.

These are expert controls; on a phone they should not stand between the user and
their frequencies, so the block is closed by default.

- [ ] **Step 4: Give the exclusion editor room**

In `src/ui/ExclusionEditor.tsx`, wrap each exclusion row's two `MHzInput`s and
its remove button in `<div className="exclusion-row">` so they stack on a phone
and sit in a line from 48 rem. Change its `<h3>` to
`<h3 className="settings__subhead">`. No behaviour changes.

- [ ] **Step 5: Add the styles**

Append to `src/styles/components.css`:

```css
.carrier-list {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  list-style: none;
}

.carrier {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'name    status'
    'freq    lock'
    'actions actions';
  gap: var(--space-2) var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
.carrier--invalid { border-color: var(--exact); background: var(--exact-bg); }
.carrier__name { grid-area: name; min-width: 0; }
.carrier__status { grid-area: status; justify-self: end; }
.carrier__freq {
  grid-area: freq;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.carrier__freq input { font-variant-numeric: tabular-nums; min-width: 0; }
.carrier__unit { color: var(--text-muted); font-size: var(--text-sm); }
.carrier__lock {
  grid-area: lock;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: var(--tap);
  min-height: var(--tap);
  margin: 0;
}
.carrier__actions {
  grid-area: actions;
  display: flex;
  gap: var(--space-2);
}
.carrier__actions button { flex: 1; }
.carrier-list__add { width: 100%; margin-top: var(--space-3); }

.settings__summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-height: var(--tap);
  justify-content: center;
}
.settings__body {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.settings__body label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}
.settings__body label:has(input[type='checkbox']) {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap);
}
.settings__subhead { margin-top: var(--space-4); }
.exclusion-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-2);
  align-items: center;
}

@media (min-width: 48rem) {
  .carrier {
    grid-template-columns: minmax(0, 1fr) 12rem auto auto auto;
    grid-template-areas: 'name freq lock status actions';
  }
  .carrier__actions { flex: none; }
  .carrier__actions button { flex: none; }
  .carrier-list__add { width: auto; }
  .settings__body { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 128 tests.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(ui): rebuild the Setup view as carrier cards"
```

---

### Task 4: Touch pass over the Results view

Results is the only view that already fits 390 px, so this task is about touch
size, wrapping, and the horizontal-scroll hazard in the conflict list — not
restructuring.

**Files:**
- Modify: `src/ui/ResultsSummary.tsx`, `src/ui/SuggestionPanel.tsx`, `src/ui/ConflictList.tsx`, `src/ui/SpectrumStrip.tsx`, `src/ui/VerdictDot.tsx`, `src/ui/ContextStrip.tsx`, `src/styles/components.css`

**Interfaces:**
- Consumes: everything from Task 1's token and base layers. No props change.
- Produces: no new modules.

- [ ] **Step 1: Make the conflict list wrap instead of scroll**

In `src/ui/ConflictList.tsx`, give the outer list `className="conflict-list"`
and each item `className="conflict"`. Split each conflict's rendering into
`<div className="conflict__head">` (order badge, product frequency, verdict) and
`<div className="conflict__detail">` (the contributing carriers and the
arithmetic). Do not change which values are shown or how they are computed.

- [ ] **Step 2: Stack the summary counts**

In `src/ui/ResultsSummary.tsx`, wrap the count figures in
`<div className="summary-grid">` with each figure in
`<div className="summary-grid__cell">`. Keep the existing headline text and the
existing `aria-live` behaviour exactly as they are.

- [ ] **Step 3: Make the suggestion rows tappable**

In `src/ui/SuggestionPanel.tsx`, give each suggestion row
`className="suggestion"` and its Apply control `className="btn--primary"`. Where
several suggestion values sit in a row, wrap them in
`<div className="suggestion__values">`. No logic changes.

- [ ] **Step 4: Let the context strip wrap**

In `src/ui/ContextStrip.tsx`, give the container `className="context-strip"`.
Its items must wrap rather than overflow.

- [ ] **Step 5: Add the styles**

Append to `src/styles/components.css`:

```css
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: var(--space-3);
}
.summary-grid__cell {
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--surface-raised);
  text-align: center;
}

.conflict-list {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.conflict {
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
.conflict--high { border-left-color: var(--exact); }
.conflict--medium { border-left-color: var(--near); }
.conflict__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-variant-numeric: tabular-nums;
}
.conflict__detail {
  margin-top: var(--space-1);
  color: var(--text-muted);
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
}

.suggestion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border);
}
.suggestion__values {
  flex: 1 1 12rem;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  font-variant-numeric: tabular-nums;
}

.context-strip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
```

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 128 tests.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(ui): make the Results view touch-friendly"
```

---

### Task 5: Extract the candidate model

The candidate data currently exists only inside `CandidateGrid`'s render. Two
renderings cannot share it in that shape, and it is untestable there. This task
lifts it out with **no visible change**, which is what makes it safe: the grid
must look and behave identically afterwards.

**Files:**
- Create: `src/ui/candidateModel.ts`, `src/ui/useCandidateModel.ts`, `src/ui/__tests__/candidateModel.test.ts`
- Modify: `src/ui/CandidateGrid.tsx`

**Interfaces:**
- Produces:
  - `nearestClearKHz(evaluations: CandidateEvaluation[], currentKHz: number | null): number | null`
  - `type CandidateFilter = 'all' | 'clear' | 'problem'`
  - `filterEvaluations(evaluations: CandidateEvaluation[], filter: CandidateFilter, currentKHz: number | null): CandidateEvaluation[]`
  - `countByVerdict(evaluations: CandidateEvaluation[]): { all: number; clear: number; problem: number }`
  - `useCandidateModel(carrier: Carrier): CandidateModel` where
    `CandidateModel = { evaluations; criteria; currentKHz; showExclusion; nearestClear: number | null; locked: boolean; apply: (freqKHz: number) => void }`

- [ ] **Step 1: Write the failing tests**

Create `src/ui/__tests__/candidateModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  countByVerdict,
  filterEvaluations,
  nearestClearKHz,
} from '../candidateModel';
import type { CandidateEvaluation, Verdict } from '../../im';

function evaluation(freqKHz: number, worst: Verdict): CandidateEvaluation {
  return {
    freqKHz,
    worst,
    verdicts: {} as CandidateEvaluation['verdicts'],
    explanation: null,
  };
}

describe('nearestClearKHz', () => {
  it('returns null when nothing is clear', () => {
    const evaluations = [evaluation(500000, 'exact'), evaluation(500025, 'near')];
    expect(nearestClearKHz(evaluations, 500000)).toBe(null);
  });

  it('picks the clear candidate closest to the current frequency', () => {
    const evaluations = [
      evaluation(499900, 'clear'),
      evaluation(500000, 'exact'),
      evaluation(500050, 'clear'),
    ];
    expect(nearestClearKHz(evaluations, 500000)).toBe(500050);
  });

  it('never proposes the frequency already in use', () => {
    const evaluations = [evaluation(500000, 'clear'), evaluation(500100, 'clear')];
    expect(nearestClearKHz(evaluations, 500000)).toBe(500100);
  });

  it('falls back to the first clear candidate when there is no current frequency', () => {
    const evaluations = [evaluation(500200, 'clear'), evaluation(500000, 'clear')];
    expect(nearestClearKHz(evaluations, null)).toBe(500200);
  });
});

describe('filterEvaluations', () => {
  const evaluations = [
    evaluation(500000, 'exact'),
    evaluation(500025, 'clear'),
    evaluation(500050, 'near'),
  ];

  it('returns everything for "all"', () => {
    expect(filterEvaluations(evaluations, 'all', null)).toHaveLength(3);
  });

  it('keeps only clear candidates for "clear"', () => {
    expect(filterEvaluations(evaluations, 'clear', null).map((e) => e.freqKHz)).toEqual([
      500025,
    ]);
  });

  it('keeps only non-clear candidates for "problem"', () => {
    expect(
      filterEvaluations(evaluations, 'problem', null).map((e) => e.freqKHz),
    ).toEqual([500000, 500050]);
  });

  it('always keeps the current frequency so the user does not lose their place', () => {
    expect(filterEvaluations(evaluations, 'clear', 500000).map((e) => e.freqKHz)).toEqual(
      [500000, 500025],
    );
  });

  it('preserves ascending frequency order', () => {
    const filtered = filterEvaluations(evaluations, 'all', null);
    expect(filtered.map((e) => e.freqKHz)).toEqual([500000, 500025, 500050]);
  });
});

describe('countByVerdict', () => {
  it('counts each bucket independently of any filter', () => {
    const evaluations = [
      evaluation(500000, 'exact'),
      evaluation(500025, 'clear'),
      evaluation(500050, 'clear'),
    ];
    expect(countByVerdict(evaluations)).toEqual({ all: 3, clear: 2, problem: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/__tests__/candidateModel.test.ts`
Expected: FAIL — cannot resolve `../candidateModel`.

- [ ] **Step 3: Write the model**

Create `src/ui/candidateModel.ts`:

```ts
import type { CandidateEvaluation } from '../im';

export type CandidateFilter = 'all' | 'clear' | 'problem';

/**
 * The clear candidate closest to where the transmitter is now, which is the
 * one answer a user standing at a rack actually wants. The frequency already
 * in use is excluded — proposing it as a move would be nonsense.
 */
export function nearestClearKHz(
  evaluations: CandidateEvaluation[],
  currentKHz: number | null,
): number | null {
  let bestKHz: number | null = null;
  for (const evaluation of evaluations) {
    if (evaluation.worst !== 'clear') continue;
    if (currentKHz !== null && evaluation.freqKHz === currentKHz) continue;
    if (
      bestKHz === null ||
      (currentKHz !== null &&
        Math.abs(evaluation.freqKHz - currentKHz) < Math.abs(bestKHz - currentKHz))
    ) {
      bestKHz = evaluation.freqKHz;
    }
  }
  return bestKHz;
}

/**
 * Filtering never drops the current frequency: hiding where the transmitter
 * actually sits would leave the user without a reference point.
 */
export function filterEvaluations(
  evaluations: CandidateEvaluation[],
  filter: CandidateFilter,
  currentKHz: number | null,
): CandidateEvaluation[] {
  if (filter === 'all') return evaluations;
  return evaluations.filter((evaluation) => {
    if (currentKHz !== null && evaluation.freqKHz === currentKHz) return true;
    return filter === 'clear'
      ? evaluation.worst === 'clear'
      : evaluation.worst !== 'clear';
  });
}

export function countByVerdict(evaluations: CandidateEvaluation[]): {
  all: number;
  clear: number;
  problem: number;
} {
  let clear = 0;
  for (const evaluation of evaluations) {
    if (evaluation.worst === 'clear') clear += 1;
  }
  return { all: evaluations.length, clear, problem: evaluations.length - clear };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui/__tests__/candidateModel.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Write the hook**

Create `src/ui/useCandidateModel.ts`:

```ts
import { useMemo } from 'react';
import type { CandidateEvaluation, Carrier, CriterionKey } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';
import { nearestClearKHz } from './candidateModel';

export interface CandidateModel {
  evaluations: CandidateEvaluation[];
  criteria: CriterionKey[];
  currentKHz: number | null;
  showExclusion: boolean;
  nearestClear: number | null;
  locked: boolean;
  apply: (freqKHz: number) => void;
}

export function useCandidateModel(carrier: Carrier): CandidateModel {
  const settings = useProjectStore((s) => s.settings);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const evaluations = useTuneStore((s) => s.evaluations);
  const criteria = useTuneStore((s) => s.criteria);
  const currentKHz = useTuneStore((s) => s.currentKHz);

  const nearestClear = useMemo(
    () => nearestClearKHz(evaluations, currentKHz),
    [evaluations, currentKHz],
  );

  const apply = (freqKHz: number): void => {
    if (carrier.locked) return;
    updateCarrier(carrier.id, { freqKHz });
    // A displayed verdict must always describe the real configuration, so the
    // analysis is re-run against the frequencies that are now actually set.
    const { carriers, settings: next } = useProjectStore.getState();
    void useAnalysisStore.getState().run(carriers, next);
  };

  return {
    evaluations,
    criteria,
    currentKHz,
    showExclusion: settings.exclusions.length > 0,
    nearestClear,
    locked: carrier.locked,
    apply,
  };
}
```

- [ ] **Step 6: Move `CandidateGrid` onto the hook**

In `src/ui/CandidateGrid.tsx`:

1. Delete the five `useProjectStore` / `useTuneStore` / `useAnalysisStore`
   selector calls, the `showExclusion` line, the whole `bestKHz` loop, and the
   local `apply` function.
2. Add `const { evaluations, criteria, currentKHz, showExclusion, nearestClear, locked, apply } = useCandidateModel(carrier);` as the first line of the component.
3. Replace every use of `bestKHz` with `nearestClear` and every
   `carrier.locked` with `locked`.
4. Delete the now-unused imports of `useAnalysisStore` and `useProjectStore`.

Everything the grid renders is unchanged. This step must produce no visual
difference whatsoever.

- [ ] **Step 7: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 138 tests across 11 files.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "refactor(ui): extract a shared candidate model"
```

---

### Task 6: The phone rendering of the candidates

This is the redesign's centre. The grid is 873 px wide because it answers
"score every candidate on every axis" — a question worth asking on a desktop
while planning. On a phone the question is "where can I put this thing, now",
so the same data is rendered as a filtered list of tap targets, defaulting to
clear candidates only, with the nearest clear one pinned where the thumb is.

**Files:**
- Create: `src/ui/useMediaQuery.ts`, `src/ui/CandidateList.tsx`
- Modify: `src/ui/TuneView.tsx`, `src/styles/components.css`

**Interfaces:**
- Consumes: `useCandidateModel`, `filterEvaluations`, `countByVerdict`, `CandidateFilter` from Task 5.
- Produces: `useMediaQuery(query: string): boolean`, `<CandidateList carrier={carrier} />`.

- [ ] **Step 1: Write the media query hook**

Create `src/ui/useMediaQuery.ts`. `useSyncExternalStore` is used rather than
`useState` + `useEffect` because it gives a correct value on the very first
render, avoiding a flash of the wrong layout.

```ts
import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
```

- [ ] **Step 2: Write the candidate list**

Create `src/ui/CandidateList.tsx`:

```tsx
import { useState } from 'react';
import { explanationText, kHzToMHzText, type Carrier, type Verdict } from '../im';
import {
  countByVerdict,
  filterEvaluations,
  type CandidateFilter,
} from './candidateModel';
import { useCandidateModel } from './useCandidateModel';

// The worst verdict is a summary across every criterion, so it is rendered
// directly rather than through VerdictDot, whose label is per-criterion.
const VERDICT_TEXT: Record<Verdict, string> = {
  clear: 'clear',
  near: 'near miss',
  exact: 'direct hit',
};

const FILTERS: { id: CandidateFilter; label: string }[] = [
  { id: 'clear', label: 'Clear' },
  { id: 'problem', label: 'Problems' },
  { id: 'all', label: 'All' },
];

function deltaText(offsetKHz: number): string {
  if (offsetKHz === 0) return '0';
  return offsetKHz > 0 ? `+${offsetKHz}` : `${offsetKHz}`;
}

export function CandidateList({ carrier }: { carrier: Carrier }) {
  // Clear-only by default: on a phone the useful question is where the
  // transmitter can go, not how badly every other slot scores.
  const [filter, setFilter] = useState<CandidateFilter>('clear');
  const { evaluations, currentKHz, nearestClear, locked, apply } =
    useCandidateModel(carrier);

  if (evaluations.length === 0) {
    return (
      <p className="hint">
        No frequency in this range is inside the band. Widen the band in Setup,
        or reduce the suggestion step.
      </p>
    );
  }

  const counts = countByVerdict(evaluations);
  const shown = filterEvaluations(evaluations, filter, currentKHz);

  return (
    <>
      {nearestClear !== null && (
        <div className="pinned">
          <div>
            <span className="hint">Nearest clear</span>
            <strong className="pinned__freq">{kHzToMHzText(nearestClear)} MHz</strong>
            {currentKHz !== null && (
              <span className="hint"> ({deltaText(nearestClear - currentKHz)} kHz)</span>
            )}
          </div>
          <button
            type="button"
            className="btn--primary"
            disabled={locked}
            onClick={() => apply(nearestClear)}
          >
            Use it
          </button>
        </div>
      )}

      {nearestClear === null && (
        <p className="hint">
          Nothing in this range is completely clear. Widen the search, remove an
          excluded range, or move one of the other transmitters.
        </p>
      )}

      <div className="segmented" role="group" aria-label="Filter candidates">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="segmented__option"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label} <span className="hint">{counts[option.id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="hint">No candidate matches this filter.</p>
      )}

      <ul className="candidate-list">
        {shown.map((evaluation) => {
          const isCurrent = evaluation.freqKHz === currentKHz;
          const isBest = evaluation.freqKHz === nearestClear;
          const classes = ['candidate'];
          if (isCurrent) classes.push('candidate--current');
          if (isBest) classes.push('candidate--best');

          return (
            <li key={evaluation.freqKHz} className={classes.join(' ')}>
              <button
                type="button"
                className="candidate__pick"
                disabled={locked || isCurrent}
                onClick={() => apply(evaluation.freqKHz)}
              >
                <span className="candidate__freq">
                  {kHzToMHzText(evaluation.freqKHz)}
                  <span className="candidate__unit"> MHz</span>
                </span>
                <span className="candidate__delta">
                  {currentKHz === null
                    ? ''
                    : `${deltaText(evaluation.freqKHz - currentKHz)} kHz`}
                </span>
                <span className="candidate__verdict">
                  <span className={`dot dot--${evaluation.worst}`} aria-hidden="true" />
                  <span className="visually-hidden">
                    {VERDICT_TEXT[evaluation.worst]}:{' '}
                  </span>
                  {explanationText(evaluation.explanation)}
                </span>
              </button>
              <span className="candidate__tags">
                {isCurrent && <span className="badge">current</span>}
                {isBest && <span className="badge badge--good">nearest clear</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
```

- [ ] **Step 3: Choose the rendering in `TuneView`**

In `src/ui/TuneView.tsx`, add:

```tsx
import { CandidateList } from './CandidateList';
import { useMediaQuery } from './useMediaQuery';
```

and inside the component:

```tsx
  const wide = useMediaQuery('(min-width: 48rem)');
```

Then replace `<CandidateGrid carrier={carrier} />` with:

```tsx
  {wide ? <CandidateGrid carrier={carrier} /> : <CandidateList carrier={carrier} />}
```

A JavaScript branch is used rather than a CSS `display` toggle so a 161-row
table is never built on a phone at all. Everything else in `TuneView` —
including the effect that guards on the resolved `carrier`, and the
`aria-live="polite"` region around progress and errors — is unchanged.

- [ ] **Step 4: Add the styles**

Append to `src/styles/components.css`:

```css
.pinned {
  position: sticky;
  top: calc(var(--tap) + var(--space-4));
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--clear);
  border-radius: var(--radius);
  background: var(--clear-bg);
}
.pinned__freq {
  display: block;
  font-size: var(--text-lg);
  font-variant-numeric: tabular-nums;
}

.segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  padding: var(--space-1);
  border-radius: var(--radius);
  background: var(--surface-sunken);
}
.segmented__option {
  min-height: calc(var(--tap) - var(--space-2));
  padding: 0 var(--space-2);
  border: 0;
  background: transparent;
  font-size: var(--text-sm);
}
.segmented__option[aria-pressed='true'] {
  background: var(--surface);
  box-shadow: var(--shadow);
  font-weight: 600;
}

.candidate-list {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.candidate {
  position: relative;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
.candidate--current { border-color: var(--accent); }
.candidate--best { border-color: var(--clear); }
.candidate__pick {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-1) var(--space-3);
  width: 100%;
  min-height: 3.5rem;
  padding: var(--space-3);
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
}
.candidate__pick:disabled { opacity: 1; }
.candidate__freq {
  font-size: var(--text-lg);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.candidate__unit { font-size: var(--text-sm); font-weight: 400; color: var(--text-muted); }
.candidate__delta {
  justify-self: end;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.candidate__verdict {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.candidate__tags {
  position: absolute;
  top: var(--space-2);
  right: var(--space-3);
  display: flex;
  gap: var(--space-1);
}

/* The desktop matrix scrolls inside its own panel rather than the page, so a
   wide table can never push the whole layout sideways. */
.candidate-grid { width: 100%; border-collapse: collapse; }
.candidate-grid th,
.candidate-grid td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}
.candidate-grid td.num { text-align: right; font-variant-numeric: tabular-nums; }
.candidate-row--current { background: var(--surface-raised); }
.candidate-row--best { background: var(--clear-bg); }
.candidate-pick {
  min-height: var(--tap);
  border: 0;
  background: transparent;
  padding: 0 var(--space-2);
  font-variant-numeric: tabular-nums;
}
```

Wrap the `<table className="candidate-grid">` in `CandidateGrid.tsx` in
`<div className="grid-scroll">` and add:

```css
.grid-scroll { overflow-x: auto; }
```

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 138 tests.

- [ ] **Step 6: Verify both renderings in a browser**

```bash
npm run build && npx vite preview --port 4173 &
```

Open `http://localhost:4173/`, add three frequencies, run Analyse, open Tune on
one carrier, and confirm:
- at a 390 px viewport the card list renders, the Clear filter is preselected, the pinned nearest-clear bar is present, and `document.documentElement.scrollWidth === document.documentElement.clientWidth`
- at 1280 px the table renders and is visually identical to before this task
- tapping a card changes the carrier's frequency and re-runs the analysis

Stop the preview with `kill <pid>` using the literal numeric PID.

- [ ] **Step 7: Commit**

```bash
git add -A src
git commit -m "feat(ui): add a filtered candidate list for phones"
```

---

### Task 7: Make it an installable, offline-capable app

The app already computes everything client-side and persists to
`localStorage`, so it is *functionally* offline already — the only thing
standing between it and working in a basement with no signal is fetching its
own assets. A service worker closes that gap. The single largest hazard is the
non-root base `/intermod-checker/`: if `start_url`, `scope`, or the icon URLs
lose it, the browser rejects the manifest or the worker outright, and that
cannot reproduce in local preview.

**Files:**
- Create: `src/vite-env.d.ts`
- Modify: `vite.config.ts`, `package.json`

**Interfaces:**
- Produces: a generated `manifest.webmanifest`, a generated `sw.js`, and the `virtual:pwa-register/react` module Task 8 consumes.

- [ ] **Step 1: Install the plugin**

```bash
npm install -D vite-plugin-pwa@^1.3.0
```

Version 1.3 declares `vite: ^8.0.0` in its peer dependencies, so it matches the
installed Vite 8 without an override.

- [ ] **Step 2: Add the ambient types**

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
```

Without the second line, `virtual:pwa-register/react` has no declaration and
Task 8 fails `tsc -b`.

- [ ] **Step 3: Configure the plugin**

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves a project site from /<repo>/, so assets must be
// requested from that subpath. Local dev and preview stay at the root.
const base = process.env.GITHUB_PAGES === 'true' ? '/intermod-checker/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // 'prompt', never 'autoUpdate': a new worker taking control reloads the
      // page, and this app can be open on a phone mid-show. The user decides.
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Intermodulation Checker',
        short_name: 'Intermod',
        description:
          'Check wireless microphone frequencies for intermodulation interference. Works offline.',
        // These must carry the deployment base or the manifest is rejected.
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#15161a',
        theme_color: '#15161a',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The analysis Web Worker is emitted as its own chunk. If it is not
        // precached the installed app opens and then cannot compute anything,
        // which is the worst possible offline failure.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Build and inspect the generated manifest**

```bash
GITHUB_PAGES=true npm run build
cat dist/manifest.webmanifest
grep -o 'assets/[^"]*worker[^"]*' dist/sw.js | head
```

Expected, and each is a hard requirement — do not proceed if any fails:
- `start_url` and `scope` are both `"/intermod-checker/"`
- every icon `src` begins with `/intermod-checker/`
- the precache manifest inside `dist/sw.js` contains the analysis worker chunk
- `dist/sw.js` and `dist/registerSW.js` exist

If an icon `src` lacks the prefix, write the icons' `src` values as
`` `${base}pwa-192.png` `` and so on, and re-verify.

- [ ] **Step 5: Confirm the plain build still works**

```bash
npm run build
```

Expected: PASS, with `start_url` `"/"` in `dist/manifest.webmanifest`.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 138 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(pwa): precache the app for offline use"
```

---

### Task 8: Update prompt and offline reassurance

**Files:**
- Modify: `src/ui/UpdatePrompt.tsx`, `src/ui/OfflineChip.tsx` (both created as
  seams in Task 2), `src/styles/components.css`

**Interfaces:**
- Consumes: `useRegisterSW` from `virtual:pwa-register/react` (Task 7).
- Produces: no new exports — both component names already exist.

- [ ] **Step 1: Write the update prompt**

Replace the whole contents of `src/ui/UpdatePrompt.tsx`:

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      <span>A new version is ready.</span>
      <button
        type="button"
        className="btn--primary"
        onClick={() => void updateServiceWorker(true)}
      >
        Reload
      </button>
      <button type="button" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </div>
  );
}
```

Reloading is never automatic. "Later" genuinely means later: the new worker
stays waiting and takes over on the next cold start.

- [ ] **Step 2: Write the offline chip**

Replace the whole contents of `src/ui/OfflineChip.tsx`:

```tsx
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function OfflineChip() {
  const online = useSyncExternalStore(
    subscribe,
    () => window.navigator.onLine,
    () => true,
  );

  if (online) return null;

  // Reassurance, not a warning: every calculation runs in this browser, so
  // losing signal changes nothing about what the tool can do.
  return (
    <span className="badge badge--good" role="status">
      Offline — still works
    </span>
  );
}
```

- [ ] **Step 3: Add the styles**

Append to `src/styles/components.css`:

```css
.update-prompt {
  position: fixed;
  inset: auto var(--space-4)
    calc(var(--tap) * 2 + var(--space-4) + env(safe-area-inset-bottom)) var(--space-4);
  z-index: 30;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

@media (min-width: 48rem) {
  .update-prompt {
    inset: auto var(--space-4) var(--space-4) auto;
    max-width: 24rem;
  }
}
```

- [ ] **Step 4: Verify against a real service worker**

A service worker only runs over HTTPS or on `localhost`, and never in `vite dev`
with `devOptions.enabled: false`. So:

```bash
npm run build && npx vite preview --port 4173 &
```

In the browser at `http://localhost:4173/`:
1. DevTools → Application → Service Workers shows one activated worker.
2. DevTools → Network → check "Offline", then hard-reload. The app must still
   load, and Analyse must still produce results — that last part is the proof
   the worker chunk was precached.
3. The "Offline — still works" chip appears in the app bar while offline and
   disappears when the network returns.

Stop the preview with `kill <pid>` using the literal numeric PID.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 138 tests.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "feat(pwa): add an update prompt and an offline indicator"
```

---

### Task 9: Verification across viewports, documentation, release

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-08-10-mobile-first-pwa-design.md`

**Interfaces:**
- Consumes: everything.
- Produces: the release.

- [ ] **Step 1: Write the viewport assertion harness**

Create `scripts/viewport-check.cjs` (this directory may not exist; create it):

```js
// Asserts that no view overflows its viewport at any of the three widths.
// Horizontal overflow was the headline defect this redesign exists to fix, so
// it gets an executable check rather than an eyeball.
const { chromium } = require('playwright-core');

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  let failures = 0;

  for (const size of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
    });
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

    for (const view of ['Setup', 'Results', 'Tune']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.waitForTimeout(250);
      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      const ok = scrollWidth <= clientWidth;
      if (!ok) failures += 1;
      console.log(
        `${ok ? 'PASS' : 'FAIL'} ${size.name} ${view}: scroll ${scrollWidth} / client ${clientWidth}`,
      );
    }

    const small = await page.evaluate(() => {
      const targets = document.querySelectorAll(
        'button, a, input, select, summary, [role="button"]',
      );
      return [...targets]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.height < 44 || r.width < 44);
        })
        .map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().height)}px`);
    });
    if (size.name === 'phone' && small.length > 0) {
      failures += 1;
      console.log(`FAIL phone touch targets under 44px:\n  ${small.join('\n  ')}`);
    } else if (size.name === 'phone') {
      console.log('PASS phone touch targets: none under 44px');
    }

    await page.close();
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
})();
```

- [ ] **Step 2: Run it**

```bash
npm run build && npx vite preview --port 4173 &
sleep 3
node scripts/viewport-check.cjs
```

`playwright-core` is already installed at `~/.cache/mobile-audit/node_modules`.
Run the script from that directory with an absolute path to it, or install
`playwright-core` as a dev dependency if that is cleaner. **Note: `/tmp` writes
are blocked in this environment — use `~/.cache/…` for any scratch files.**

Expected: `ALL PASS`. Before running Tune, add at least three frequencies and
press Analyse so the Tune view has something to render; extend the script with
those steps if the default project does not already provide them.

Fix anything that fails, then re-run until it passes.

Then check by hand, in the same browser, the four assertions a script cannot
make:

3. At a 390 px viewport, focusing a frequency input does **not** change the
   visual viewport scale — `window.visualViewport.scale` stays `1`. This is the
   16 px input font rule paying off.
4. At 390 px the Tune view shows the filtered card list with the pinned
   nearest-clear bar; at 1280 px it shows the scored matrix.
5. Applying a candidate updates the carrier's frequency and re-runs the
   analysis, at both sizes.
6. With the OS in dark mode, every surface, border, badge, and verdict dot is
   legible, and the three verdict shapes remain distinguishable.

Stop the preview with `kill <pid>` using the literal numeric PID.

- [ ] **Step 3: Document the change**

In `README.md`, add a section after the existing feature list:

```markdown
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
```

- [ ] **Step 4: Mark the spec implemented**

In `docs/superpowers/specs/2026-08-10-mobile-first-pwa-design.md`, change the
status line to `**Status:** implemented`.

- [ ] **Step 5: Run the full gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 138 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: document the mobile layout and installation"
```

- [ ] **Step 7: Merge and release**

```bash
git checkout main
git merge --no-ff feat/mobile-pwa -m "feat: mobile-first interface and offline PWA"
gh auth switch --user matej-hron
git push origin main
```

The corporate GitHub account cannot push to this repository — the `gh auth
switch` is required, not optional.

- [ ] **Step 8: Verify the deployment**

Wait for the Pages workflow to finish, then load
`https://matej-hron.github.io/intermod-checker/` and confirm:
- `navigator.serviceWorker.getRegistrations()` returns one registration whose
  scope is `https://matej-hron.github.io/intermod-checker/`
- `/intermod-checker/manifest.webmanifest` returns 200 and its `start_url` is
  `/intermod-checker/`
- the console is clean and no request 404s
- with the network disabled, a cold reload still loads the app **and Analyse
  still returns results**

A base-path mistake cannot reproduce locally, so this step is the only place
the deployment is actually proven.
