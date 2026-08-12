# Compact carrier rows, a carrier edit sheet, and a project library

Status: draft — awaiting user review
Date: 2026-08-12

## 1. The problem

Two complaints, one cause: everything is on one screen at once.

**Carriers.** Since device presets landed, a single microphone occupies a name
field, a frequency field, a status badge, a lock, two buttons, and up to three
selects — roughly 380 px on a phone. Two mics fill the screen. A twelve-mic
show is a scroll marathon, and the one question the user actually asks at a
glance — *which of my mics is in trouble?* — cannot be answered without
scrolling past nine controls per mic.

**Projects.** The app holds exactly one project. "New project" destroys the
current one; the only way back is a JSON file the user remembered to export.
A sound engineer works the same venues repeatedly and wants last month's setup
back without file management.

## 2. What we are building

1. **A compact carrier row** — two lines, ~64 px, showing only what is read at
   a glance. Tapping it opens an edit sheet.
2. **A carrier edit sheet** — every field for one microphone, full height on a
   phone, with Tune and Delete in reach.
3. **A project library** — several named projects stored on the device, with
   create, rename, duplicate, delete and switch. Import brings a file in as a
   new project instead of overwriting what is open.

## 3. Decisions taken without the user (flag on review)

The user was away when these were settled. Each is reversible.

| Decision | Why | Alternative rejected |
|---|---|---|
| A **library of projects**, not a polished single-project flow | "create new, edit, delete" only means something across a set; one project has nothing to delete *into* | Keep one project, prettier buttons |
| **Autosave, no Save button** | The app already autosaves every keystroke; adding a Save button would introduce unsaved-work traps that do not exist today | Explicit save/dirty state |
| Sheet edits apply **live**, no Cancel | Same reason; a Cancel that silently reverts device+frequency+lock is a new class of surprise | Draft copy with Save/Cancel |
| **Import creates a new project** | Importing today destroys the open project. As a library member it is additive and undoable | Import overwrites |
| **Duplicate** included | The recurring-venue case: copy last week, move two frequencies | Ship without it |

## 4. The carrier row

```
┌──────────────────────────────────────────────┐
│ ● Mic 1                        510.000 MHz 🔒│
│   Wisycom MTP60 · Wide band       [Conflict] │
└──────────────────────────────────────────────┘
```

- **Line 1:** verdict dot, label, frequency (tabular numerals, right-aligned).
- **Line 2:** device summary, or `No device` in muted text; the analysis badge
  sits at the end.
- **Trailing:** the lock toggle, a real 44 px button. Locking is a frequent
  act while tuning and must not cost two taps.

The row is a `<button>` spanning both lines; the lock is a sibling button
outside it (never a button inside a button). The row's accessible name is
`Edit <label>, <frequency> megahertz`. Invalid carriers keep today's red
treatment.

The device summary is a pure function so it can be unit-tested in the node
environment:

```ts
// src/ui/carrierSummary.ts
describeCarrierDevice(carrier: Carrier): string
// 'Wisycom MTP60 · Wide band' — device with several modes
// 'Sound Devices A10'         — single-mode device
// 'No device'                 — none chosen
// power is appended when set: 'Wisycom MTP60 · Wide band · 50 mW'
```

## 5. The carrier edit sheet

A `<dialog>` reusing the existing `.sheet` class (bottom sheet on phones,
centred card from 48 rem up), holding, in order:

1. Name
2. Frequency (`MHzInput`) with the `MHz` suffix
3. `DevicePicker` — unchanged component, now with room to breathe
4. Lock — a labelled checkbox row, not a bare icon
5. **Tune this frequency** — closes the sheet and opens the Tune view
6. **Delete** — destructive, `window.confirm` first, matching the app's
   existing confirm style
7. **Done** — closes

`Add frequency` appends a carrier exactly as today and immediately opens its
sheet, so a new mic is named and configured in one motion. A user who changes
their mind deletes it from the same sheet.

Which carrier is open lives in `viewStore` as `editingCarrierId: string | null`
with `openCarrier(id)` / `closeCarrier()`. Two rules the implementation must
honour:

- If the open carrier disappears (deleted, or a project switch replaces the
  list), the sheet closes. A sheet bound to a carrier that no longer exists
  would render stale values and write them back on the next keystroke.
- Opening Tune closes the sheet, so returning from Tune does not reveal a
  sheet the user forgot about.

## 6. The project library

### Storage

One new key, `intermod-checker:library:v1`:

```ts
interface LibraryFile {
  version: number;          // LIBRARY_VERSION, starts at 1
  activeId: string;
  projects: StoredProject[]; // newest edit first
}

interface StoredProject {
  id: string;
  name: string;
  updatedAt: number;        // epoch ms, for the "edited 2 days ago" line
  carriers: Carrier[];
  settings: Settings;
}
```

Each project's `carriers`/`settings` are validated by the **existing**
`parseProject` machinery, not a second copy of it — a stored project is
exactly a `ProjectFile` plus `id` and `updatedAt`. Concretely, `project.ts`
grows one export, `parseProjectValue(value: unknown): ProjectFile | { error }`,
and today's `parseProject(text)` becomes `JSON.parse` plus a call to it. The
library validates each member through `parseProjectValue`. Duplicating the
carrier and settings sanitizers into `library.ts` is forbidden: the two copies
would drift, and the one in `library.ts` is the one guarding what the app
actually opens. A project that fails validation is dropped from the library
rather than dropping the whole library.

**Migration.** On first load, if the library key is absent and the old
single-project key `intermod-checker:project:v1` is present, that project
becomes the library's only member and the active one. The old key is left in
place, untouched: it costs a few kilobytes and is the only rollback path if
this release is reverted. If neither key exists, the library starts with one
`Untitled` project holding today's two default carriers.

**Cap.** `MAX_PROJECTS = 30`. Beyond that, create/duplicate/import are refused
with a message naming the limit; nothing is silently evicted. localStorage is
typically 5 MB and a twelve-carrier project is under 3 KB, so the cap exists
to keep the list navigable, not to protect storage.

### Pure operations

`src/im/library.ts` holds the whole model as pure functions, testable without
a DOM:

```ts
createProject(lib, name): LibraryFile        // becomes active
renameProject(lib, id, name): LibraryFile
duplicateProject(lib, id): LibraryFile       // "<name> copy", becomes active
deleteProject(lib, id): LibraryFile          // see below
selectProject(lib, id): LibraryFile
touchProject(lib, id, carriers, settings): LibraryFile  // autosave path
parseLibrary(text): LibraryFile | { error }
serializeLibrary(lib): string
migrateSingleProject(text): LibraryFile | null
```

Rules the tests pin:

- Deleting the active project activates the most recently edited survivor.
- Deleting the **last** project leaves a fresh `Untitled` — the app is never
  in a state with no open project.
- Renaming to blank keeps `Untitled` rather than an empty app-bar button.
- Every mutation bumps `updatedAt` on the project it touches, except
  `selectProject`, which only moves `activeId`. Switching to a project must
  not make it look freshly edited.
- Operations on an unknown id return the library unchanged.

### Store integration

`projectStore` keeps its current shape — `name`, `carriers`, `settings` are
still the open project, so no view or component changes because of the
library. It gains `projects: ProjectSummary[]` (id, name, updatedAt, carrier
count) and `activeId`, plus the actions the sheet calls. Its existing
`persist()` becomes: apply `touchProject` to the library, write the library
key. The existing rule that any carrier or settings change clears the analysis
and tune state is unchanged, and switching projects clears them too — results
computed for one show must never be shown against another's frequencies.

The "edited 2 min ago" line is another pure function,
`src/ui/timeAgo.ts: formatTimeAgo(then, now)`, with its own tests: seconds
("just now"), minutes, hours, "yesterday", and an absolute date beyond a week.
It takes `now` as an argument so the tests need no clock mocking.

### The projects sheet

The app-bar button (already showing the project name) opens it:

```
Projects                                  [+ New]
────────────────────────────────────────────────
✓ Divadlo Ponec            8 mics · 2 min ago  ⋯
  Svatba Brno              4 mics · yesterday  ⋯
  Studio                  12 mics · 3 Aug      ⋯
────────────────────────────────────────────────
  Import JSON…            Export current       
  Your frequencies stay in this browser.
```

- Tapping a row switches and closes the sheet.
- `⋯` expands that row into Rename / Duplicate / Delete. Rename swaps the row
  into a text input, committed on blur or Enter — no dialog inside a dialog,
  which is where `<dialog>` focus management goes wrong.
- Delete confirms by name: *Delete "Svatba Brno"? This cannot be undone.*
- Export exports the **active** project in today's unchanged single-project
  format, so files stay interchangeable with the deployed version.
- Import parses with `parseProject` and adds a new project named from the file.

## 7. What does not change

- `ProjectFile` and `PROJECT_VERSION` (3). The exchange format is untouched;
  only the local storage layout changes.
- The intermodulation engine, the device catalogue, and every calculation.
- The Results and Tune views.
- `DevicePicker`, `MHzInput`, and the `.sheet` styling, all reused as-is.

## 8. Testing

The suite runs in `environment: 'node'` with no DOM, so components stay
unit-untested by deliberate project policy. Everything with judgement in it is
therefore a pure function:

- `src/im/__tests__/library.test.ts` — every operation above, the migration
  from a single-project payload, a corrupt payload, a payload with one bad
  project among good ones, the cap, and the delete-the-last-project rule.
- `src/ui/__tests__/carrierSummary.test.ts` — no device, single-mode device,
  multi-mode device, power set and unset.
- `src/ui/__tests__/timeAgo.test.ts` — each bucket and its boundary.

Rendering, focus, and layout are verified in a real browser at 390 px before
merge: rows collapse to two lines, twelve carriers fit in roughly three
screens rather than twelve, the sheet opens and closes, deleting the open
carrier closes the sheet, a project switch replaces the carrier list, and the
tap targets stay at 44 px.

## 9. Limits we are accepting

- Projects live in this browser's localStorage. Clearing site data loses them;
  export is still the only backup. The projects sheet says so.
- No sync, no accounts, no cloud. Out of scope and against the app's offline
  promise.
- No undo for delete beyond the confirm.
- The library is not exported as a whole; export remains one project at a
  time, because that file format is what people already have on disk.
