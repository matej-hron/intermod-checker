# Compact Carrier Rows, Carrier Edit Sheet, and Project Library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse each microphone in Setup to a two-line row backed by an edit sheet, and turn the single stored project into a library of named projects the user can create, rename, duplicate, delete and switch between.

**Architecture:** All judgement moves into pure modules that the node-environment test suite can reach: `src/im/library.ts` owns the library model, `src/ui/carrierSummary.ts` and `src/ui/timeAgo.ts` own the row's two text lines. `projectStore` keeps its current public shape (`name`, `carriers`, `settings`) so no view changes because of the library; it merely gains the library alongside. React components stay thin and are verified in a real browser, not in tests.

**Tech Stack:** React 19, TypeScript (strict), Zustand, Vite 8, Vitest (`environment: 'node'`), plain CSS with design tokens, `<dialog>` for sheets.

Spec: `docs/superpowers/specs/2026-08-12-carrier-sheet-and-projects-design.md`

## Global Constraints

- **The test environment has no DOM.** `vite.config.ts` sets `test.environment: 'node'` and `include: ['src/**/__tests__/**/*.test.ts']` (`.ts` only, never `.tsx`). Do not add jsdom, testing-library, or any dependency. Do not write component tests. Put logic worth testing in a `.ts` module and test that.
- **No new runtime dependencies.** Nothing may be added to `package.json`.
- `src/styles/base.css` already gives every bare `button`, `input`, `select` and `textarea` `min-height: var(--tap)` (2.75 rem = 44 px) and a font size of at least 16 px. Do not re-declare those properties on plain controls. Only a control that is *not* a bare element (an `<li>` acting as a row, an icon-only button that must also be 44 px **wide**) needs explicit sizing.
- **Colours and spacing come from `src/styles/tokens.css`.** Never write a hex colour or a pixel gap; use `var(--space-3)`, `var(--text-muted)`, `var(--exact)` and friends.
- **The exchange format does not change.** `PROJECT_VERSION` stays `3`; `ProjectFile` keeps exactly its current fields. Exported files must remain loadable by the currently deployed build.
- **Mobile first.** The reference viewport is 390 × 844. Every interactive target is at least 44 × 44 px. Nothing may overflow horizontally.
- **Accessible names must be unique per carrier and per project.** A control repeated per row carries the row's name: `Edit Mic 1`, `Lock Mic 1`, `Rename Divadlo Ponec`. Two controls with the same accessible name on one screen is a defect.
- **Never nest a `<button>` inside a `<button>`.** Row-plus-trailing-action layouts put the two buttons side by side in a grid.
- **Comments explain why, never what.** Match the existing house style: short prose paragraphs above non-obvious code, no restating the line below.
- **The gate is `npm run typecheck && npm run lint && npm run test && npm run build`,** and all four must pass before any commit is considered done. `npm run typecheck` is `tsc -b --noEmit`; lint is `oxlint`.
- **Commit style:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`), imperative subject under 72 characters, and every commit message ends with these two trailers on their own lines:

  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  Copilot-Session: f68abad6-3aab-47c2-8f07-f42d1ba8022f
  ```

- **Baseline:** 185 tests across 13 files pass before this plan starts. Never delete or weaken an existing test. Adding to an existing test file is fine; rewriting it is not.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/im/project.ts` (modify) | Gains `parseProjectValue(value: unknown)`; `parseProject` becomes a thin JSON wrapper over it |
| `src/im/library.ts` (create) | The whole project-library model as pure functions: types, operations, parse, serialize, migrate |
| `src/im/index.ts` (modify) | Re-exports `./library` |
| `src/ui/carrierSummary.ts` (create) | `describeCarrierDevice(carrier)` — the row's second line |
| `src/ui/timeAgo.ts` (create) | `formatTimeAgo(then, now)` — the projects list's relative time |
| `src/state/projectStore.ts` (modify) | Holds the library beside the open project; project actions; migration on boot |
| `src/state/viewStore.ts` (modify) | `editingCarrierId` plus `openCarrier` / `closeCarrier` |
| `src/ui/CarrierList.tsx` (rewrite) | Compact two-line rows only |
| `src/ui/CarrierSheet.tsx` (create) | The per-carrier edit dialog |
| `src/ui/ProjectSheet.tsx` (rewrite) | The projects library dialog |
| `src/styles/components.css` (modify) | Row, sheet and project-list styles |
| `README.md` (modify) | Document projects and the edit sheet |

---

### Task 1: `parseProjectValue` — one validator, two callers

**Files:**
- Modify: `src/im/project.ts` (the `parseProject` function, currently the last function in the file)
- Test: `src/im/__tests__/project.test.ts` (append only)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `parseProjectValue(value: unknown): ProjectFile | { error: string }`, exported from `src/im/project.ts` and therefore from `src/im` (which already re-exports `./project`). Task 2 uses it to validate each stored project.

**Why:** `library.ts` must validate every stored project with exactly the sanitizers `parseProject` uses. Those sanitizers take a parsed value, but `parseProject` only accepts a JSON string. Rather than have the library `JSON.stringify` a value just to parse it back, split the string handling from the validation.

- [ ] **Step 1: Write the failing tests**

Append to `src/im/__tests__/project.test.ts` (inside the existing top-level `describe`, or as a new `describe` at the end — match whatever the file already does):

```ts
describe('parseProjectValue', () => {
  it('validates an already-parsed value', () => {
    const parsed = parseProjectValue({
      version: PROJECT_VERSION,
      name: 'Ponec',
      carriers: [{ id: 'a', label: 'Mic 1', freqKHz: 510000, locked: false }],
      settings: {},
    });
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.name).toBe('Ponec');
    expect(parsed.carriers).toHaveLength(1);
  });

  it('rejects a value that is not an object', () => {
    expect(parseProjectValue('nope')).toEqual({ error: expect.any(String) });
    expect(parseProjectValue(null)).toEqual({ error: expect.any(String) });
  });

  it('rejects a version from a newer app', () => {
    const parsed = parseProjectValue({
      version: PROJECT_VERSION + 1,
      name: 'x',
      carriers: [],
      settings: {},
    });
    expect('error' in parsed).toBe(true);
  });

  it('reaches the same verdict as parseProject on the same payload', () => {
    const payload = {
      version: PROJECT_VERSION,
      name: 'Same',
      carriers: [
        { id: 'a', label: 'Mic 1', freqKHz: 510000, locked: true, deviceId: 'wisycom-mtp60' },
      ],
      settings: { nearHitWindowKHz: 42 },
    };
    expect(parseProjectValue(payload)).toEqual(parseProject(JSON.stringify(payload)));
  });
});
```

Add `parseProjectValue` to the file's existing import from `'../project'` (or `'../index'` — use whatever that file already imports from).

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm run test -- src/im/__tests__/project.test.ts`
Expected: FAIL — `parseProjectValue is not a function` / TypeScript cannot find the export.

- [ ] **Step 3: Split the function**

In `src/im/project.ts`, rename the body of `parseProject` that runs *after* `JSON.parse` into a new exported function, and leave `parseProject` as the JSON wrapper. The result must read exactly like this — no other behaviour change, and the existing error strings must be preserved character for character:

```ts
export function parseProject(json: string): ProjectFile | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: 'The file is not valid JSON.' };
  }
  return parseProjectValue(raw);
}

// Storage and files carry the same untrusted shape, so both go through this
// one validator. A second copy of these checks would drift from this one, and
// the copy guarding what the app opens is the one that matters.
export function parseProjectValue(value: unknown): ProjectFile | { error: string } {
  if (typeof value !== 'object' || value === null) {
    return { error: 'The file is not a project.' };
  }
  const candidate = value as Record<string, unknown>;
  // ...the rest of today's body, unchanged...
}
```

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS — 185 existing tests plus the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/im/project.ts src/im/__tests__/project.test.ts
git commit -m "refactor(im): validate parsed project values through one entry point"
```

---

### Task 2: The library model

**Files:**
- Create: `src/im/library.ts`
- Modify: `src/im/index.ts` (add `export * from './library';` after the `./project` line)
- Test: `src/im/__tests__/library.test.ts` (create)

**Interfaces:**
- Consumes: `parseProjectValue`, `ProjectFile`, `PROJECT_VERSION` from Task 1 / `./project`; `Carrier`, `Settings`, `DEFAULT_SETTINGS` from `./types`.
- Produces — Task 4 (the store) calls all of these:

```ts
export const LIBRARY_VERSION = 1;
export const MAX_PROJECTS = 30;

export interface StoredProject {
  id: string;
  name: string;
  updatedAt: number;
  carriers: Carrier[];
  settings: Settings;
}

export interface Library {
  version: number;
  activeId: string;
  projects: StoredProject[];
}

export function activeProject(lib: Library): StoredProject;
export function createProject(lib: Library, name: string, now: number, id: string, carriers: Carrier[]): Library;
export function renameProject(lib: Library, id: string, name: string, now: number): Library;
export function duplicateProject(lib: Library, id: string, now: number, newId: string): Library;
export function deleteProject(lib: Library, id: string, now: number, fallbackId: string, fallbackCarriers: Carrier[]): Library;
export function selectProject(lib: Library, id: string): Library;
export function touchProject(lib: Library, id: string, name: string, carriers: Carrier[], settings: Settings, now: number): Library;
export function addProject(lib: Library, project: StoredProject): Library;
export function isFull(lib: Library): boolean;
export function newLibrary(id: string, carriers: Carrier[], now: number): Library;
export function serializeLibrary(lib: Library): string;
export function parseLibrary(json: string): Library | null;
export function migrateSingleProject(json: string, id: string, now: number): Library | null;
```

Ids and timestamps are **parameters, never generated inside these functions**: pure functions with no clock and no randomness are the reason this module is testable at all.

- [ ] **Step 1: Write the failing tests**

Create `src/im/__tests__/library.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  LIBRARY_VERSION,
  MAX_PROJECTS,
  PROJECT_VERSION,
  activeProject,
  addProject,
  createProject,
  deleteProject,
  duplicateProject,
  isFull,
  migrateSingleProject,
  newLibrary,
  parseLibrary,
  renameProject,
  selectProject,
  serializeLibrary,
  touchProject,
  type Carrier,
  type Library,
} from '../index';

function carriers(label = 'Mic 1'): Carrier[] {
  return [{ id: 'c1', label, freqKHz: 510000, locked: false }];
}

function base(): Library {
  return newLibrary('p1', carriers(), 1000);
}

describe('newLibrary', () => {
  it('starts with one active Untitled project', () => {
    const lib = base();
    expect(lib.version).toBe(LIBRARY_VERSION);
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('p1');
    expect(activeProject(lib).name).toBe('Untitled');
    expect(activeProject(lib).updatedAt).toBe(1000);
  });
});

describe('createProject', () => {
  it('adds a project and makes it active', () => {
    const lib = createProject(base(), 'Ponec', 2000, 'p2', carriers());
    expect(lib.projects).toHaveLength(2);
    expect(lib.activeId).toBe('p2');
    expect(activeProject(lib).name).toBe('Ponec');
  });

  it('falls back to Untitled for a blank name', () => {
    const lib = createProject(base(), '   ', 2000, 'p2', carriers());
    expect(activeProject(lib).name).toBe('Untitled');
  });

  it('refuses to exceed the cap', () => {
    let lib = base();
    for (let i = 2; i <= MAX_PROJECTS; i += 1) {
      lib = createProject(lib, `p${i}`, 1000 + i, `id${i}`, carriers());
    }
    expect(isFull(lib)).toBe(true);
    const same = createProject(lib, 'one too many', 9999, 'overflow', carriers());
    expect(same).toBe(lib);
  });
});

describe('renameProject', () => {
  it('renames and stamps the edit', () => {
    const lib = renameProject(base(), 'p1', 'Svatba', 5000);
    expect(lib.projects[0].name).toBe('Svatba');
    expect(lib.projects[0].updatedAt).toBe(5000);
  });

  it('keeps Untitled for a blank name', () => {
    expect(renameProject(base(), 'p1', '  ', 5000).projects[0].name).toBe('Untitled');
  });

  it('ignores an unknown id', () => {
    const lib = base();
    expect(renameProject(lib, 'nope', 'x', 5000)).toBe(lib);
  });
});

describe('duplicateProject', () => {
  it('copies the carriers under a copy name and activates it', () => {
    const lib = duplicateProject(renameProject(base(), 'p1', 'Ponec', 1000), 'p1', 3000, 'p2');
    expect(lib.projects).toHaveLength(2);
    expect(lib.activeId).toBe('p2');
    expect(activeProject(lib).name).toBe('Ponec copy');
    expect(activeProject(lib).carriers).toEqual(carriers());
  });

  it('does not share carrier objects with the original', () => {
    const lib = duplicateProject(base(), 'p1', 3000, 'p2');
    const original = lib.projects.find((p) => p.id === 'p1')!;
    const copy = lib.projects.find((p) => p.id === 'p2')!;
    expect(copy.carriers[0]).not.toBe(original.carriers[0]);
    expect(copy.settings).not.toBe(original.settings);
  });

  it('refuses to exceed the cap', () => {
    let lib = base();
    for (let i = 2; i <= MAX_PROJECTS; i += 1) {
      lib = createProject(lib, `p${i}`, 1000 + i, `id${i}`, carriers());
    }
    expect(duplicateProject(lib, 'p1', 9999, 'overflow')).toBe(lib);
  });
});

describe('deleteProject', () => {
  it('removes a project and keeps the active one', () => {
    const lib = deleteProject(
      createProject(base(), 'second', 2000, 'p2', carriers()),
      'p1',
      3000,
      'fresh',
      carriers(),
    );
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('p2');
  });

  it('activates the most recently edited survivor when the active one goes', () => {
    let lib = base();
    lib = createProject(lib, 'older', 2000, 'p2', carriers());
    lib = createProject(lib, 'newest', 4000, 'p3', carriers());
    lib = touchProject(lib, 'p2', 'older', carriers(), DEFAULT_SETTINGS, 9000);
    lib = selectProject(lib, 'p3');
    const after = deleteProject(lib, 'p3', 10000, 'fresh', carriers());
    expect(after.activeId).toBe('p2');
  });

  it('leaves a fresh Untitled when the last project is deleted', () => {
    const lib = deleteProject(base(), 'p1', 3000, 'fresh', carriers('Mic 1'));
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('fresh');
    expect(activeProject(lib).name).toBe('Untitled');
    expect(activeProject(lib).carriers).toHaveLength(1);
  });

  it('ignores an unknown id', () => {
    const lib = base();
    expect(deleteProject(lib, 'nope', 3000, 'fresh', carriers())).toBe(lib);
  });
});

describe('selectProject', () => {
  it('moves the active id without stamping an edit', () => {
    const lib = selectProject(createProject(base(), 'b', 2000, 'p2', carriers()), 'p1');
    expect(lib.activeId).toBe('p1');
    expect(lib.projects.find((p) => p.id === 'p1')!.updatedAt).toBe(1000);
  });

  it('ignores an unknown id', () => {
    const lib = base();
    expect(selectProject(lib, 'nope')).toBe(lib);
  });
});

describe('touchProject', () => {
  it('writes the open project back and stamps it', () => {
    const next = carriers('Renamed');
    const lib = touchProject(base(), 'p1', 'Ponec', next, DEFAULT_SETTINGS, 7000);
    expect(activeProject(lib).name).toBe('Ponec');
    expect(activeProject(lib).carriers).toEqual(next);
    expect(activeProject(lib).updatedAt).toBe(7000);
  });
});

describe('serialize and parse', () => {
  it('round-trips', () => {
    const lib = createProject(base(), 'Ponec', 2000, 'p2', carriers());
    expect(parseLibrary(serializeLibrary(lib))).toEqual(lib);
  });

  it('returns null for junk', () => {
    expect(parseLibrary('not json')).toBeNull();
    expect(parseLibrary('[]')).toBeNull();
    expect(parseLibrary('{"version":1}')).toBeNull();
  });

  it('returns null for a library from a newer app', () => {
    const lib = base();
    expect(parseLibrary(JSON.stringify({ ...lib, version: LIBRARY_VERSION + 1 }))).toBeNull();
  });

  it('drops one unreadable project and keeps the rest', () => {
    const lib = createProject(base(), 'good', 2000, 'p2', carriers());
    const raw = JSON.parse(serializeLibrary(lib)) as Record<string, unknown>;
    (raw.projects as unknown[])[0] = { id: 'p1', name: 'broken', updatedAt: 1, carriers: 'not a list' };
    const parsed = parseLibrary(JSON.stringify(raw));
    expect(parsed).not.toBeNull();
    expect(parsed!.projects).toHaveLength(1);
    expect(parsed!.projects[0].id).toBe('p2');
  });

  it('returns null when every project is unreadable', () => {
    expect(
      parseLibrary(JSON.stringify({ version: LIBRARY_VERSION, activeId: 'p1', projects: [{ id: 'p1' }] })),
    ).toBeNull();
  });

  it('repairs an activeId that names no project', () => {
    const lib = { ...base(), activeId: 'ghost' };
    const parsed = parseLibrary(JSON.stringify(lib));
    expect(parsed!.activeId).toBe('p1');
  });
});

describe('migrateSingleProject', () => {
  it('wraps a v3 single project as the only library member', () => {
    const single = JSON.stringify({
      version: PROJECT_VERSION,
      name: 'Ponec',
      carriers: carriers(),
      settings: DEFAULT_SETTINGS,
    });
    const lib = migrateSingleProject(single, 'p1', 4242)!;
    expect(lib.projects).toHaveLength(1);
    expect(lib.activeId).toBe('p1');
    expect(activeProject(lib).name).toBe('Ponec');
    expect(activeProject(lib).updatedAt).toBe(4242);
  });

  it('returns null when the old payload is unreadable', () => {
    expect(migrateSingleProject('junk', 'p1', 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm run test -- src/im/__tests__/library.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/im/library.ts`**

```ts
import { parseProjectValue, PROJECT_VERSION, type ProjectFile } from './project';
import { DEFAULT_SETTINGS, type Carrier, type Settings } from './types';

export const LIBRARY_VERSION = 1;

// localStorage holds roughly 5 MB and a twelve-carrier project is under 3 KB,
// so this cap is about keeping the list scannable, not about storage. Nothing
// is ever evicted silently: past the cap the app refuses and says so.
export const MAX_PROJECTS = 30;

export interface StoredProject {
  id: string;
  name: string;
  updatedAt: number;
  carriers: Carrier[];
  settings: Settings;
}

export interface Library {
  version: number;
  activeId: string;
  projects: StoredProject[];
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? 'Untitled' : trimmed;
}

function copyCarriers(carriers: readonly Carrier[]): Carrier[] {
  return carriers.map((c) => ({ ...c }));
}

export function newLibrary(id: string, carriers: Carrier[], now: number): Library {
  return {
    version: LIBRARY_VERSION,
    activeId: id,
    projects: [
      {
        id,
        name: 'Untitled',
        updatedAt: now,
        carriers: copyCarriers(carriers),
        settings: { ...DEFAULT_SETTINGS, exclusions: [] },
      },
    ],
  };
}

export function activeProject(lib: Library): StoredProject {
  const found = lib.projects.find((p) => p.id === lib.activeId);
  // parseLibrary repairs a dangling activeId, and every operation keeps one
  // project alive, so this fallback is a belt for an impossible state rather
  // than a case the UI has to think about.
  return found ?? lib.projects[0];
}

export function isFull(lib: Library): boolean {
  return lib.projects.length >= MAX_PROJECTS;
}

export function addProject(lib: Library, project: StoredProject): Library {
  if (isFull(lib)) return lib;
  return { ...lib, activeId: project.id, projects: [project, ...lib.projects] };
}

export function createProject(
  lib: Library,
  name: string,
  now: number,
  id: string,
  carriers: Carrier[],
): Library {
  return addProject(lib, {
    id,
    name: cleanName(name),
    updatedAt: now,
    carriers: copyCarriers(carriers),
    settings: { ...DEFAULT_SETTINGS, exclusions: [] },
  });
}

export function renameProject(lib: Library, id: string, name: string, now: number): Library {
  if (!lib.projects.some((p) => p.id === id)) return lib;
  return {
    ...lib,
    projects: lib.projects.map((p) =>
      p.id === id ? { ...p, name: cleanName(name), updatedAt: now } : p,
    ),
  };
}

export function duplicateProject(
  lib: Library,
  id: string,
  now: number,
  newId: string,
): Library {
  const source = lib.projects.find((p) => p.id === id);
  if (source === undefined) return lib;
  return addProject(lib, {
    id: newId,
    name: cleanName(`${source.name} copy`),
    updatedAt: now,
    carriers: copyCarriers(source.carriers),
    settings: { ...source.settings, exclusions: source.settings.exclusions.map((e) => ({ ...e })) },
  });
}

export function deleteProject(
  lib: Library,
  id: string,
  now: number,
  fallbackId: string,
  fallbackCarriers: Carrier[],
): Library {
  if (!lib.projects.some((p) => p.id === id)) return lib;

  const projects = lib.projects.filter((p) => p.id !== id);
  // The app is never in a state with no open project: deleting the last one
  // hands back an empty desk rather than a blank screen.
  if (projects.length === 0) return newLibrary(fallbackId, fallbackCarriers, now);

  if (lib.activeId !== id) return { ...lib, projects };

  const mostRecent = projects.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  return { ...lib, activeId: mostRecent.id, projects };
}

export function selectProject(lib: Library, id: string): Library {
  if (!lib.projects.some((p) => p.id === id)) return lib;
  return { ...lib, activeId: id };
}

export function touchProject(
  lib: Library,
  id: string,
  name: string,
  carriers: Carrier[],
  settings: Settings,
  now: number,
): Library {
  if (!lib.projects.some((p) => p.id === id)) return lib;
  return {
    ...lib,
    projects: lib.projects.map((p) =>
      p.id === id
        ? { ...p, name: cleanName(name), carriers: copyCarriers(carriers), settings, updatedAt: now }
        : p,
    ),
  };
}

export function serializeLibrary(lib: Library): string {
  return JSON.stringify(lib);
}

function toStoredProject(value: unknown): StoredProject | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || raw.id === '') return null;

  // A stored project is a ProjectFile with two extra fields, so it is checked
  // by the same validator that guards imported files. Storage is no more
  // trustworthy than a file: it can hold a half-written record or a shape from
  // an older build.
  const parsed = parseProjectValue({
    version: PROJECT_VERSION,
    name: raw.name,
    carriers: raw.carriers,
    settings: raw.settings,
  });
  if ('error' in parsed) return null;

  return {
    id: raw.id,
    name: parsed.name,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    carriers: parsed.carriers,
    settings: parsed.settings,
  };
}

export function parseLibrary(json: string): Library | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.version !== 'number') return null;
  if (candidate.version > LIBRARY_VERSION) return null;
  if (!Array.isArray(candidate.projects)) return null;

  const projects: StoredProject[] = [];
  const seen = new Set<string>();
  for (const value of candidate.projects) {
    const project = toStoredProject(value);
    // One corrupt project costs the user that project, not the whole library.
    if (project === null || seen.has(project.id)) continue;
    seen.add(project.id);
    projects.push(project);
  }
  if (projects.length === 0) return null;

  const activeId =
    typeof candidate.activeId === 'string' && seen.has(candidate.activeId)
      ? candidate.activeId
      : projects[0].id;

  return { version: LIBRARY_VERSION, activeId, projects };
}

export function migrateSingleProject(json: string, id: string, now: number): Library | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed: ProjectFile | { error: string } = parseProjectValue(raw);
  if ('error' in parsed) return null;

  return {
    version: LIBRARY_VERSION,
    activeId: id,
    projects: [
      {
        id,
        name: parsed.name,
        updatedAt: now,
        carriers: parsed.carriers,
        settings: parsed.settings,
      },
    ],
  };
}
```

- [ ] **Step 4: Export it**

In `src/im/index.ts`, add `export * from './library';` as the last line.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS, with roughly 24 new tests in `library.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/im/library.ts src/im/index.ts src/im/__tests__/library.test.ts
git commit -m "feat(im): add a pure project library model"
```

---

### Task 3: The row's two text lines

**Files:**
- Create: `src/ui/carrierSummary.ts`, `src/ui/timeAgo.ts`
- Test: `src/ui/__tests__/carrierSummary.test.ts`, `src/ui/__tests__/timeAgo.test.ts`

**Interfaces:**
- Consumes: `findDevice`, `findMode`, `type Carrier` from `../im`.
- Produces: `describeCarrierDevice(carrier: Carrier): string` and `formatTimeAgo(then: number, now: number): string`. Task 5 uses the first; Task 6 uses the second.

`formatTimeAgo` takes `now` as an argument so tests need no clock mocking.

- [ ] **Step 1: Write the failing tests**

`src/ui/__tests__/carrierSummary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Carrier } from '../../im';
import { describeCarrierDevice } from '../carrierSummary';

function carrier(patch: Partial<Carrier> = {}): Carrier {
  return { id: 'c1', label: 'Mic 1', freqKHz: 510000, locked: false, ...patch };
}

describe('describeCarrierDevice', () => {
  it('says so when no device is chosen', () => {
    expect(describeCarrierDevice(carrier())).toBe('No device');
  });

  it('names brand and model', () => {
    expect(describeCarrierDevice(carrier({ deviceId: 'sound-devices-a10' }))).toBe(
      'Sound Devices A10',
    );
  });

  it('appends the mode only when the device offers a choice', () => {
    expect(describeCarrierDevice(carrier({ deviceId: 'wisycom-mtp60' }))).toContain('Wide band');
    expect(describeCarrierDevice(carrier({ deviceId: 'sound-devices-a10' }))).not.toContain('·');
  });

  it('follows the selected mode', () => {
    const narrow = carrier({ deviceId: 'wisycom-mtp60', modeId: 'narrow' });
    expect(describeCarrierDevice(narrow)).toContain('Narrow band');
  });

  it('appends power when it is set', () => {
    const c = carrier({ deviceId: 'wisycom-mtp60', powerMW: 50 });
    expect(describeCarrierDevice(c)).toBe('Wisycom MTP60 · Wide band · 50 mW');
  });

  it('ignores a device the catalogue does not know', () => {
    expect(describeCarrierDevice(carrier({ deviceId: 'nope' }))).toBe('No device');
  });
});
```

Before writing the assertions above, confirm the exact device ids, brands, model names and mode labels in `src/im/devices.ts` and use those verbatim. They are, at time of writing: `wisycom-mtp60` is `Wisycom` / `MTP60` with modes `wide` ("Wide band") and `narrow` ("Narrow band"); `sound-devices-a10` is `Sound Devices` / `A10` with the single mode `digital` ("Digital"). If anything differs, fix the **test** to match the catalogue — never the catalogue to match the test.

`src/ui/__tests__/timeAgo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatTimeAgo } from '../timeAgo';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatTimeAgo', () => {
  it('calls anything under a minute "just now"', () => {
    expect(formatTimeAgo(1000, 1000)).toBe('just now');
    expect(formatTimeAgo(0, MIN - 1)).toBe('just now');
  });

  it('counts whole minutes', () => {
    expect(formatTimeAgo(0, MIN)).toBe('1 min ago');
    expect(formatTimeAgo(0, 45 * MIN)).toBe('45 min ago');
  });

  it('counts whole hours', () => {
    expect(formatTimeAgo(0, HOUR)).toBe('1 hour ago');
    expect(formatTimeAgo(0, 5 * HOUR)).toBe('5 hours ago');
  });

  it('says yesterday for one day back', () => {
    expect(formatTimeAgo(0, DAY)).toBe('yesterday');
  });

  it('counts days up to a week', () => {
    expect(formatTimeAgo(0, 3 * DAY)).toBe('3 days ago');
    expect(formatTimeAgo(0, 6 * DAY)).toBe('6 days ago');
  });

  it('falls back to a date beyond a week', () => {
    expect(formatTimeAgo(0, 30 * DAY)).toBe(new Date(0).toLocaleDateString());
  });

  it('never reports the future as elapsed time', () => {
    expect(formatTimeAgo(10 * MIN, 0)).toBe('just now');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm run test -- src/ui/__tests__/carrierSummary.test.ts src/ui/__tests__/timeAgo.test.ts`
Expected: FAIL — neither module exists.

- [ ] **Step 3: Implement both modules**

`src/ui/carrierSummary.ts`:

```ts
import { findDevice, findMode, type Carrier } from '../im';

const SEP = ' · ';

/**
 * The second line of a carrier row: what this microphone is, in the fewest
 * words that stay unambiguous. The mode appears only where the device offers a
 * choice, because "A10 · Digital" would suggest a setting the user could have
 * got wrong.
 */
export function describeCarrierDevice(carrier: Carrier): string {
  const device = findDevice(carrier.deviceId);
  if (device === null) return 'No device';

  const parts = [`${device.brand} ${device.model}`];

  if (device.modes.length > 1) {
    // findMode never returns null — it falls back to the device's first mode —
    // so the caller must not test for one.
    parts.push(findMode(device, carrier.modeId).label);
  }
  if (carrier.powerMW !== undefined) parts.push(`${carrier.powerMW} mW`);

  return parts.join(SEP);
}
```

`src/ui/timeAgo.ts`:

```ts
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * "Edited 5 min ago" for the projects list. `now` is a parameter rather than a
 * `Date.now()` call so the function is pure and its tests need no clock.
 * A negative elapsed time means a clock change, not the future, so it reads as
 * "just now" instead of a nonsense count.
 */
export function formatTimeAgo(then: number, now: number): string {
  const elapsed = now - then;
  if (elapsed < MINUTE) return 'just now';

  if (elapsed < HOUR) {
    const mins = Math.floor(elapsed / MINUTE);
    return `${mins} min ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (elapsed < WEEK) {
    const days = Math.floor(elapsed / DAY);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return new Date(then).toLocaleDateString();
}
```

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/carrierSummary.ts src/ui/timeAgo.ts src/ui/__tests__/carrierSummary.test.ts src/ui/__tests__/timeAgo.test.ts
git commit -m "feat(ui): summarise a carrier's device and a project's last edit"
```

---

### Task 4: The store holds the library

**Files:**
- Modify: `src/state/projectStore.ts`
- Modify: `src/state/viewStore.ts`

**Interfaces:**
- Consumes: everything Task 2 produced.
- Produces — Tasks 5 and 6 read these off `useProjectStore`:

```ts
projects: ProjectSummary[];   // {id, name, updatedAt, carrierCount}, newest edit first
activeProjectId: string;
libraryFull: boolean;
newProject: () => void;            // replaces today's destructive version
selectProject: (id: string) => void;
renameProject: (id: string, name: string) => void;
duplicateProject: (id: string) => void;
deleteProject: (id: string) => void;
importAsProject: (file: ProjectFile) => void;
```

and off `useViewStore`:

```ts
editingCarrierId: string | null;
openCarrier: (id: string) => void;
closeCarrier: () => void;
```

`setName` keeps its current signature and now renames the active project.
`name`, `carriers`, `settings`, `addCarrier`, `updateCarrier`, `removeCarrier`, `setSettings`, `resetSettings`, `applySuggestions`, `loadProject` and the exclusion actions all keep their current signatures and behaviour.

**Behaviour this task must get right:**

- Boot order: read `intermod-checker:library:v1`; if absent, `migrateSingleProject` the old `intermod-checker:project:v1`; if that is absent too, `newLibrary` with today's two default carriers. **Do not delete the old key** — it is the rollback path.
- `persist()` writes the library, having first folded the open project in with `touchProject`.
- Switching, creating, duplicating, deleting and importing all clear the analysis and tune state, exactly as carrier edits already do — results computed for one show must never render against another's frequencies.
- Renaming does **not** clear the analysis (today's `updateMeta` path).
- `addCarrier` returns the new carrier's id so Task 5 can open its sheet.

- [ ] **Step 1: Extend the view store**

```ts
// src/state/viewStore.ts
interface ViewState {
  view: ViewName;
  editingCarrierId: string | null;
  goTo: (view: ViewName) => void;
  openTune: (carrierId: string) => void;
  openCarrier: (carrierId: string) => void;
  closeCarrier: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'setup',
  editingCarrierId: null,
  goTo: (view) => set({ view }),
  openTune: (carrierId) => {
    useTuneStore.getState().select(carrierId);
    // Tune replaces the whole screen, so leaving the sheet open would reveal
    // it again on the way back, over a carrier the user has moved on from.
    set({ view: 'tune', editingCarrierId: null });
  },
  openCarrier: (carrierId) => set({ editingCarrierId: carrierId }),
  closeCarrier: () => set({ editingCarrierId: null }),
}));
```

- [ ] **Step 2: Rework the project store's boot and persist**

Replace the storage section at the top of `src/state/projectStore.ts`:

```ts
const STORAGE_KEY = 'intermod-checker:project:v1';   // legacy, read once, never written
const LIBRARY_KEY = 'intermod-checker:library:v1';

function newId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// The old single-project key is read but never written or removed: if this
// release is rolled back, that key is the user's project.
function loadLibrary(): Library {
  if (typeof localStorage === 'undefined') return newLibrary(newId(), initialCarriers(), Date.now());

  const stored = read(LIBRARY_KEY);
  if (stored !== null) {
    const parsed = parseLibrary(stored);
    if (parsed !== null) return parsed;
  }

  const legacy = read(STORAGE_KEY);
  if (legacy !== null) {
    const migrated = migrateSingleProject(legacy, newId(), Date.now());
    if (migrated !== null) return migrated;
  }

  return newLibrary(newId(), initialCarriers(), Date.now());
}
```

The store's state gains `library: Library`, and `projects` / `activeProjectId` / `libraryFull` are derived from it on every write so components can subscribe to them directly:

```ts
function summarize(lib: Library): ProjectSummary[] {
  return [...lib.projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, carrierCount: p.carriers.length }));
}
```

`persist()` becomes:

```ts
const persist = (): void => {
  const { library, activeProjectId, name, carriers, settings } = get();
  const next = touchProject(library, activeProjectId, name, carriers, settings, Date.now());
  set({ library: next, projects: summarize(next) });
  writeLibrary(next);
};
```

`ProjectSummary` is declared and exported next to the store's interface, since the projects sheet imports it:

```ts
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  carrierCount: number;
}
```

`addCarrier` changes its return type so Task 5 can open the new carrier's sheet; nothing else about it moves:

```ts
addCarrier: () => {
  const carriers = get().carriers;
  const id = newId();
  update({
    carriers: [
      ...carriers,
      { id, label: `Mic ${carriers.length + 1}`, freqKHz: get().settings.bandMinKHz, locked: false },
    ],
  });
  return id;
},
```

with the interface reading `addCarrier: () => string;`.

Switching projects follows one shape, used by select / create / duplicate / delete / import. Both it and `renameProject` write through one helper:

```ts
const writeLibrary = (lib: Library): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LIBRARY_KEY, serializeLibrary(lib));
  } catch {
    // Storage is full or blocked; the in-memory library still works.
  }
};

// Opening a different project replaces every frequency on screen, so the
// analysis and tune state that described the old one must go with it.
const openFromLibrary = (lib: Library): void => {
  const project = activeProject(lib);
  set({
    library: lib,
    projects: summarize(lib),
    activeProjectId: project.id,
    libraryFull: isFull(lib),
    name: project.name,
    carriers: project.carriers,
    settings: project.settings,
  });
  writeLibrary(lib);
  useAnalysisStore.getState().clear();
  useTuneStore.getState().clear();
  useViewStore.getState().closeCarrier();
};
```

Watch for an import cycle: `viewStore` already imports `tuneStore`, and `projectStore` importing `viewStore` is new. If TypeScript or Vite reports a cycle, move `closeCarrier()` out of the store and into the components — the sheet must close on a project switch either way (Task 5's guard covers it, since the open carrier disappears).

Then the actions, each one line over the library:

```ts
newProject: () => {
  const { library } = get();
  if (isFull(library)) return;
  openFromLibrary(createProject(library, 'Untitled', Date.now(), newId(), initialCarriers()));
},
selectProject: (id) => openFromLibrary(selectProject(get().library, id)),
duplicateProject: (id) => {
  const { library } = get();
  if (isFull(library)) return;
  openFromLibrary(duplicateProject(library, id, Date.now(), newId()));
},
deleteProject: (id) => openFromLibrary(deleteProject(get().library, id, Date.now(), newId(), initialCarriers())),
renameProject: (id, name) => {
  const next = renameProject(get().library, id, name, Date.now());
  const patch: Partial<ProjectState> = { library: next, projects: summarize(next) };
  // Renaming the open project must also move the app-bar title, but it changes
  // nothing the analysis depends on, so the result on screen stays.
  if (id === get().activeProjectId) patch.name = activeProject(next).name;
  set(patch);
  writeLibrary(next);
},
importAsProject: (file) => {
  const { library } = get();
  if (isFull(library)) return;
  openFromLibrary(
    addProject(library, {
      id: newId(),
      name: file.name,
      updatedAt: Date.now(),
      carriers: file.carriers,
      settings: file.settings,
    }),
  );
},
```

`setName` renames the active project through the same path as `renameProject`, so the two can never disagree. `loadProject` keeps working for any caller that still uses it, writing into the active project.

Delete today's `newProject` implementation that resets in place — it is replaced, not kept.

- [ ] **Step 3: Verify by hand in the browser**

Vitest cannot see any of this. Run `npm run dev` and, in the browser console:

```js
localStorage.getItem('intermod-checker:library:v1')
```

Confirm: on a fresh profile a library appears with one project; after editing a frequency, `updatedAt` moves and the carrier is in the stored project; after a reload the same project opens.

Then test the migration explicitly: clear both keys, set only the legacy one to an exported project's JSON, reload, and confirm the project appears with its name and carriers and that the legacy key is still present afterwards.

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS with the existing test count — this task adds no tests, because everything worth testing was tested in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/state/projectStore.ts src/state/viewStore.ts
git commit -m "feat(state): keep a library of projects behind the open one"
```

---

### Task 5: Compact rows and the carrier edit sheet

**Files:**
- Rewrite: `src/ui/CarrierList.tsx`
- Create: `src/ui/CarrierSheet.tsx`
- Modify: `src/styles/components.css` (replace the `.carrier*` block, roughly lines 183–233 and the `@media (min-width: 48rem)` override around line 276)
- Modify: `src/App.tsx` (render `<CarrierSheet />` inside the `setup` view)

**Interfaces:**
- Consumes: `describeCarrierDevice` (Task 3), `editingCarrierId` / `openCarrier` / `closeCarrier` (Task 4), the existing `DevicePicker`, `MHzInput`, `kHzToMHzText` and `MAX_CARRIERS`.
- Produces: nothing later tasks depend on.

**The row:**

```
┌──────────────────────────────────────────────┐
│ ● Mic 1                        510.000 MHz  🔒│
│   Wisycom MTP60 · Wide band       [Conflict] │
└──────────────────────────────────────────────┘
```

- One `<li>` per carrier containing exactly two siblings: a full-height `<button class="carrier__open">` holding both text lines, and a `<button class="carrier__lock">`. Never nest them.
- The open button's accessible name is `Edit ${label}, ${kHzToMHzText(freqKHz)} megahertz`; the lock button's is `Lock ${label}` / `Unlock ${label}` depending on state, with `aria-pressed={carrier.locked}`.
- The status badge keeps today's three states (`Conflict` / `Clear` / `Not analysed`) and today's classes.
- A carrier flagged by validation keeps `carrier--invalid`.
- Frequency renders with `kHzToMHzText` in `var(--mono)` with `font-variant-numeric: tabular-nums`.

**The sheet** is a `<dialog class="sheet">` whose open state follows `editingCarrierId`:

```tsx
const carrier = carriers.find((c) => c.id === editingId) ?? null;

useEffect(() => {
  const el = dialog.current;
  if (el === null) return;
  if (carrier !== null && !el.open) el.showModal();
  if (carrier === null && el.open) el.close();
}, [carrier]);
```

That single effect delivers the spec's rule for free: when the open carrier is deleted, or a project switch replaces the list, `carrier` becomes `null` and the sheet closes. Also wire `onClose={closeCarrier}` so the Escape key and the backdrop keep the store in step with the dialog.

Render nothing (`return null` after the hooks — never before them) when `carrier === null`, so the sheet's fields never read a stale carrier.

Sheet contents, in this order: Name, Frequency + `MHz`, `<DevicePicker carrier={carrier} />`, a Lock checkbox row, `Tune this frequency`, `Delete`, `Done`.

- Delete confirms first: `window.confirm(\`Delete ${carrier.label}? This cannot be undone.\`)`, then `removeCarrier(carrier.id)` — the effect above closes the sheet.
- `Tune this frequency` calls `openTune(carrier.id)`, which Task 4 already made close the sheet.
- Add: `Add frequency` calls `addCarrier()` and passes its returned id to `openCarrier`, so a new mic opens straight into its sheet.

- [ ] **Step 1: Write `src/ui/CarrierList.tsx`**

Keep the `Add frequency` button, the `MAX_CARRIERS` guard and its hint exactly as they are today. Replace only the row.

- [ ] **Step 2: Write `src/ui/CarrierSheet.tsx`**

- [ ] **Step 3: Render the sheet**

In `src/App.tsx`, inside the `view === 'setup'` fragment, after `<SettingsPanel />`, add `<CarrierSheet />`.

- [ ] **Step 4: Style it**

Replace the `.carrier*` rules in `src/styles/components.css`. The row:

```css
.carrier {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--tap);
  align-items: stretch;
  gap: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
.carrier--invalid { border-color: var(--exact); background: var(--exact-bg); }

.carrier__open {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  text-align: left;
  background: none;
  border: 0;
  min-width: 0;
}
.carrier__line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.carrier__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.carrier__freq { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.carrier__device {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.carrier__lock {
  align-self: center;
  min-width: var(--tap);
  background: none;
  border: 0;
}
```

Delete the old `@media (min-width: 48rem)` `.carrier` grid override — the two-line row is right at every width, and a five-column desktop variant of a row that now opens a sheet would be a second layout to maintain for no gain. Leave every other rule in that media query untouched.

Add a modifier so the carrier sheet can fill the phone screen, since it holds far more than the project sheet:

```css
.sheet--tall .sheet__body { max-height: 85vh; overflow-y: auto; }
```

- [ ] **Step 5: Verify in a real browser at 390 px**

Run `npm run build && npx vite preview --port 0` (read the port it prints — never assume 4173). Then, at a 390 × 844 viewport, confirm each of these and fix anything that fails:

1. Two carriers occupy roughly 130 px in total, not 760 px.
2. Tapping a row opens the sheet; Escape closes it; `Done` closes it.
3. Editing the name in the sheet updates the row's first line live.
4. Changing the device updates the row's second line.
5. `Add frequency` appends a row **and** opens its sheet.
6. Delete inside the sheet removes the row and closes the sheet.
7. `Tune this frequency` lands on the Tune view with no sheet behind it.
8. The lock button toggles without opening the sheet.
9. `document.documentElement.scrollWidth - clientWidth === 0`.
10. No duplicate accessible names: run this in the console and expect `[]`.

```js
const names = [...document.querySelectorAll('button, input, select')]
  .map((el) => el.getAttribute('aria-label') ?? el.textContent.trim())
  .filter(Boolean);
names.filter((n, i) => names.indexOf(n) !== i);
```

11. Every interactive element is at least 44 px on both axes:

```js
[...document.querySelectorAll('button, select, input')]
  .map((el) => [el.getAttribute('aria-label') ?? el.textContent.trim(), el.getBoundingClientRect()])
  .filter(([, r]) => r.width < 44 || r.height < 44);
```

Pre-existing 22 px checkboxes in `SettingsPanel` and `ConflictList` are known and out of scope; anything new is not.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/CarrierList.tsx src/ui/CarrierSheet.tsx src/App.tsx src/styles/components.css
git commit -m "feat(ui): collapse carriers to two-line rows with an edit sheet"
```

---

### Task 6: The projects sheet

**Files:**
- Rewrite: `src/ui/ProjectSheet.tsx`
- Modify: `src/styles/components.css` (add a `.projects*` block near the existing `.sheet` rules)

**Interfaces:**
- Consumes: `projects`, `activeProjectId`, `libraryFull`, `selectProject`, `renameProject`, `duplicateProject`, `deleteProject`, `importAsProject`, `newProject` (Task 4); `formatTimeAgo` (Task 3); `parseProject` and `serializeProject` (already imported by today's file).
- Produces: nothing.

Keep from today's file, unchanged: the app-bar trigger button, `exportProject`, the hidden file input, the import error paragraph, and the "Your frequencies stay in this browser" hint.

**The sheet:**

```
Projects                                  [+ New]
────────────────────────────────────────────────
✓ Divadlo Ponec            8 mics · 2 min ago  ⋯
  Svatba Brno              4 mics · yesterday  ⋯
────────────────────────────────────────────────
  Import JSON…            Export current
```

- Each project is an `<li>` with two sibling buttons — an open button and a `⋯` button (`aria-label={\`More actions for ${p.name}\`}`, `aria-expanded`). Same rule as the carrier row: never nested.
- The open button's accessible name is `Open ${p.name}`; the active project also renders a `✓` and `aria-current="true"`.
- The subtitle is `${carrierCount} ${carrierCount === 1 ? 'mic' : 'mics'} · ${formatTimeAgo(p.updatedAt, now)}`, where `now` is captured once per render (`const now = Date.now()`), not per row.
- `⋯` expands that row (one row at a time, tracked by `const [menuId, setMenuId] = useState<string | null>(null)`) into three buttons: Rename, Duplicate, Delete.
  - **Rename** swaps the row into an `<input>` seeded with the current name, committed on Enter or blur, abandoned on Escape. No nested dialog: a `<dialog>` inside a `<dialog>` breaks focus return.
  - **Duplicate** calls `duplicateProject(p.id)` and closes the sheet — the copy is now open.
  - **Delete** confirms by name — `window.confirm(\`Delete "${p.name}"? This cannot be undone.\`)` — then calls `deleteProject(p.id)`. If the deleted project was active the sheet stays open so the user sees where they landed.
- `+ New` calls `newProject()` and closes the sheet.
- When `libraryFull` is true, `+ New`, Duplicate and Import are `disabled`, and a hint reads: `You have reached the limit of 30 projects. Delete one to add another.` Import the number from `MAX_PROJECTS` rather than typing `30` into the string.
- **Import** parses with `parseProject` as today, but calls `importAsProject(parsed)` instead of `loadProject`, then closes the sheet. Update the surrounding copy: importing no longer replaces the open project.
- Add one line under the privacy hint: `Projects are stored in this browser. Export a project to keep a copy.`

- [ ] **Step 1: Rewrite the component**

- [ ] **Step 2: Style the list**

```css
.projects { display: grid; gap: var(--space-2); padding: 0; list-style: none; }
.project {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--tap);
  gap: var(--space-2);
  align-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
.project--active { border-color: var(--accent); }
.project__open {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  text-align: left;
  background: none;
  border: 0;
  min-width: 0;
}
.project__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project__meta { font-size: var(--text-sm); color: var(--text-muted); }
.project__menu { grid-column: 1 / -1; display: flex; gap: var(--space-2); padding: 0 var(--space-3) var(--space-3); }
.project__menu button { flex: 1; }
.projects__file { display: flex; gap: var(--space-2); }
.projects__file button { flex: 1; }
```

- [ ] **Step 3: Verify in a real browser at 390 px**

Build and preview as in Task 5, then confirm:

1. `+ New` creates a project, closes the sheet, and the carrier list resets to the two defaults.
2. Reopening the sheet lists both projects, newest first, with the active one ticked.
3. Switching projects replaces the carrier list and clears any analysis result.
4. Rename updates both the row and the app-bar title; Escape abandons the edit.
5. Duplicate produces `<name> copy`, opens it, and the original is untouched.
6. Delete asks by name; deleting the active project opens another one; deleting the only project leaves a fresh `Untitled`.
7. Export downloads a file; importing that file adds a **new** project and leaves the previous one in the list.
8. After a reload, every project is still there and the same one is open.
9. No horizontal overflow, no duplicate accessible names, no sub-44 px targets — same three console checks as Task 5.

- [ ] **Step 4: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ProjectSheet.tsx src/styles/components.css
git commit -m "feat(ui): manage a library of projects from the app bar"
```

---

### Task 7: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-12-carrier-sheet-and-projects-design.md` (status line only)

- [ ] **Step 1: Update the README**

Find the section describing the Setup screen and the project controls. Rewrite so it matches what shipped, covering:

- A carrier row shows name, frequency, device and status; tapping it opens the editor.
- Projects are kept in the browser: create, rename, duplicate, delete, switch. The limit is `MAX_PROJECTS` (state the number).
- Import adds a project rather than replacing the open one; export writes the open project in the same format as before, still readable by older builds.
- Projects live in this browser's storage only. Clearing site data loses them; export is the backup.

Read the file first and match its voice and heading depth. Do not restate the device catalogue or the limits sections — they are already correct.

- [ ] **Step 2: Flip the spec status**

Change the spec's `Status:` line from `draft — awaiting user review` to `implemented`.

- [ ] **Step 3: Verify the claims**

Every number and behaviour written in Step 1 must be checked against the code, not against this plan. In particular confirm the project limit in `src/im/library.ts` and that the exported format still carries `version: 3`.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-08-12-carrier-sheet-and-projects-design.md
git commit -m "docs: document the carrier editor and the project library"
```

---

## Self-Review

**Spec coverage:** §4 compact row → Tasks 3 and 5. §5 edit sheet → Task 5. §6 storage, migration, cap, pure operations → Task 2; store integration → Task 4; the sheet → Task 6; `parseProjectValue` → Task 1. §7 "what does not change" → Global Constraints. §8 testing → Tasks 1, 2, 3 for units, Tasks 5 and 6 for the browser checks. §9 limits → Task 7.

**Placeholders:** none. Every code step carries its code; every verification step carries its command and its expected result.

**Type consistency:** `parseProjectValue` (Task 1) is consumed with that exact name in Task 2. `Library`, `StoredProject`, `MAX_PROJECTS`, and all eleven operations are declared in Task 2's interface block with the signatures Task 4 calls. `describeCarrierDevice` and `formatTimeAgo` (Task 3) are consumed in Tasks 5 and 6 respectively. `editingCarrierId` / `openCarrier` / `closeCarrier` (Task 4) are consumed in Task 5. `ProjectSummary` is defined in Task 4's interface block and consumed in Task 6.

**One known risk, flagged for the implementer of Task 4:** `projectStore` importing `viewStore` is a new edge in the module graph. Task 4 Step 2 names the symptom and the fallback.
