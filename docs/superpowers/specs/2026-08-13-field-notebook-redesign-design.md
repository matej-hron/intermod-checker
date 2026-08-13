# Field Notebook visual redesign

**Status:** approved for planning  
Date: 2026-08-13  
Extends: `2026-08-10-mobile-first-pwa-design.md`

## 1. Goal

Redesign the existing application into a colourful, distinctive tool that feels
at home in a sound engineer's field kit rather than like a generic SaaS
dashboard.

The selected direction is **Field Notebook**: a modern production notebook with
warm paper surfaces, dark forest-green structure, orange action accents, and
technical data set apart in monospace type. The redesign must remain fast,
mobile-first, accessible, and trustworthy under backstage conditions.

This is a balanced redesign. It may improve visual hierarchy and responsive
layout, but it does not change the application's feature set, state model,
analysis engine, project format, or navigation destinations.

## 2. User and design principles

The primary user remains a sound engineer working one-handed on a phone in a
venue. Desktop planning is the secondary scenario.

Five principles guide every decision:

1. **Glanceable under pressure.** Frequency, carrier name, and verdict must be
   readable before decoration.
2. **Warm, not whimsical.** The notebook metaphor creates personality but never
   makes the tool resemble a toy.
3. **Colour reinforces meaning.** Every status also has text, shape, or icon
   treatment.
4. **One obvious next action.** Primary actions use the orange accent; routine
   navigation and secondary controls do not compete with them.
5. **Density without clutter.** Desktop keeps its useful data density, while
   mobile preserves large tap targets and a single-column flow.

## 3. Directions considered

### A. Signal Lab

A dark mission-control interface with navy surfaces and cyan/pink signal
accents. It strongly matches technical work and looks dramatic, but extended
use in bright environments is less comfortable and the neon treatment risks
overpowering verdict colours.

### B. Spectrum Studio

A light creative-tool interface with purple and magenta accents, rounded cards,
and polished depth. It is approachable and professional, but closer to familiar
creative SaaS products and therefore less distinctive.

### C. Field Notebook — selected

A warm, tactile interface based on a production notebook: cream paper, forest
green, safety orange, restrained shadows, and slightly squarer controls. It is
unusual without reducing legibility and works naturally in both light and dark
environments.

## 4. Visual system

### 4.1 Colour

The token layer remains the only source of colour. Existing semantic token
names stay where practical so components do not learn palette details.

Light palette:

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#E8EBDD` | Page background |
| Paper | `#FFFDF4` | Main panels and sheets |
| Raised paper | `#F3F5E9` | Rows, grouped controls, inactive tabs |
| Ink | `#17251E` | Primary text |
| Muted ink | `#5D695F` | Supporting text |
| Rule | `#B8C1AD` | Borders and dividers |
| Forest | `#244B37` | Header, strong secondary actions, selected structure |
| Orange | `#E05C35` | Primary actions and active navigation |
| Orange dark | `#A93E22` | Hover/pressed orange |
| Clear | `#277254` | Clear verdict |
| Near | `#A36516` | Near verdict |
| Conflict | `#B43D2C` | Exact/conflict verdict |

Dark mode is not a hue inversion. It becomes a night fieldbook: near-black
green canvas, dark olive paper, warm off-white ink, muted sage rules, a brighter
orange action, and raised verdict luminance. Contrast must meet WCAG AA for
normal text and visible focus states.

The interface may use a very subtle paper grain created with CSS gradients. It
must not use image assets, reduce text contrast, or create visible repetition.

### 4.2 Typography

Use a three-part type system:

- **Display and section headings:** a characterful, sturdy serif stack,
  `Iowan Old Style`, `Palatino Linotype`, `Book Antiqua`, `Georgia`, serif.
- **Interface and body:** the existing native sans-serif system stack for
  speed, language coverage, and familiar controls.
- **Frequencies and measurements:** the existing monospace stack with tabular
  numerals.

The app name uses the serif face. Section titles use the serif face at a
moderate size rather than oversized marketing typography. Labels and eyebrow
text use the sans-serif stack, uppercase, with restrained tracking. Frequency
values remain the strongest typographic element inside data rows.

No remote web font is introduced. The PWA remains fully offline without an
additional font payload or flash of unstyled text.

### 4.3 Shape, borders, and elevation

- Panels use an 8 px radius rather than the current generic rounded-card look.
- Buttons use 6–8 px radii; pills are reserved for status and compact metadata.
- Borders are visible and slightly darker than typical SaaS hairlines.
- Main panels use a small offset shadow, approximately `4px 4px 0`, to evoke
  stacked paper without imitating torn paper or skeuomorphic stationery.
- Modal sheets keep larger top corners on mobile because they need to read as a
  draggable layer, not as paper cards.
- Focus rings are explicit, high contrast, and independent of box shadows.

### 4.4 Icons

Replace emoji action glyphs with a small, consistent inline SVG icon set.
Required icons are lock/unlock, delete, add, analyse, tune, project, close, and
overflow. Icons use `currentColor`, a 1.75–2 px stroke, and accessible button
labels. No icon library dependency is needed for this set.

## 5. Application shell

### 5.1 Header

The app bar becomes a forest-coloured utility header:

- App name on the first line in the display serif.
- Current project as compact secondary text or a project button.
- Offline state as a low-emphasis sage/cream stamp.
- Project control remains on the right and preserves its existing sheet.

The bar remains sticky. On desktop it aligns with the content container; on
mobile it stays compact enough not to consume working space.

### 5.2 Navigation

The three destinations remain Setup, Results, and Tune.

On mobile, the bottom bar adopts a notebook index-tab treatment. The active tab
uses an orange top edge, stronger ink, and a small filled marker; inactive tabs
stay neutral. On tablet and desktop, navigation becomes a horizontal row of
outlined index tabs beneath the header.

Navigation labels and state management do not change. The treatment must still
use `aria-current="page"` and meet the 44 px target minimum.

### 5.3 Primary action

Analyse remains globally available and visually dominant:

- Solid orange background, cream text, analyse icon.
- Label becomes **Analyse frequencies** where width permits and **Analyse** on
  narrow phones.
- Running state displays progress within the same action region without
  shifting the rest of the layout.
- Cancel is a secondary outlined control, never another orange button.

## 6. Screen designs

### 6.1 Setup

The section starts with a compact heading block:

- Serif title **Frequency plan**.
- Metadata line with carrier count and analysis freshness.
- Add frequency as a secondary forest-outline action.

Carrier rows become compact fieldbook entries:

- Left accent strip carries verdict colour and shape.
- Carrier name is the leading label.
- Frequency is prominent monospace text aligned for scanning.
- Device information is muted but remains visible without opening the row.
- Verdict is a small labelled stamp: Clear, Conflict, or Not analysed.
- Lock and delete are icon buttons in a dedicated action area.

Opening a carrier retains the existing sheet and functionality. Inside the
sheet, related controls are grouped under short eyebrow labels such as
Frequency, Device, and Actions. The live conflict block adopts the same verdict
stamp and paper grouping as the list.

Settings remain collapsed by default. Their summary reads like a plan note,
showing the current band, order range, and spacing in one line. Expanded
settings use aligned field groups rather than a flat sequence of controls.

### 6.2 Results

Results lead with a single verdict card:

- Clear state: calm pale-green paper, strong **Plan is clear** headline.
- Conflict state: pale terracotta paper, affected carrier count as the headline.
- Supporting sentence retains the exact product count and scope.

Severity totals become three ledger cells rather than generic cards. Each cell
uses a shape marker, label, and count. The product count and coefficient
combination count remain available but visually subordinate.

Suggestions are promoted above the spectrum when action is possible. Each
suggestion reads as a before/after retune line with a single orange Apply
action. Locked and unavailable cases keep their explicit text.

The spectrum becomes the visual signature of this screen:

- A cream plotting strip with visible baseline and band labels.
- Carrier markers use forest; conflicted carriers use terracotta.
- Product markers retain severity differentiation.
- Optional faint vertical grid rules support scanning without resembling a
  charting dashboard.

Conflict entries use a left severity rule, compact formula typography, and
plain-language cause beneath it. They must remain expandable only if the
existing content genuinely exceeds a comfortable mobile card; no new hidden
interaction is introduced merely for visual cleanliness.

### 6.3 Tune

Tune is treated as a frequency field guide.

The selected carrier context appears in a sticky paper strip with carrier name,
current frequency, lock state, and search width. Carrier chips use labelled
verdict stamps and remain horizontally wrapping rather than becoming a hidden
carousel.

On mobile:

- The clear/all segmented control becomes two outlined notebook tabs.
- The pinned nearest-clear candidate uses a forest background with cream text
  and one orange or cream Apply control, depending on contrast.
- Candidate cards emphasize frequency first, delta second, and verdict third.
- Current and best candidates have text labels in addition to border treatment.

On desktop, the matrix remains a table. Its header becomes sticky within the
scroll container, rows use subtle ledger rules, numeric columns remain
right-aligned, and clear/current/best states remain readable without colour.

## 7. Components and implementation boundaries

This redesign should primarily change tokens and CSS, then make targeted markup
changes where visual semantics require them.

Expected component responsibilities:

| Area | Responsibility |
| --- | --- |
| `AppBar` | Brand lockup, project control, offline stamp |
| `Nav` | Existing navigation with index-tab presentation |
| `ActionBar` | Primary analyse action and progress |
| `CarrierList` | Fieldbook rows and icon actions |
| `CarrierSheet` | Grouped editor sections and live verdict styling |
| `ResultsSummary` | Lead verdict card and ledger totals |
| `SpectrumStrip` | Field-guide plotting treatment |
| `SuggestionPanel` | Before/after action rows |
| `ConflictList` | Severity-led conflict entries |
| `TuneView` and candidate components | Context strip, pinned choice, cards, matrix |

A reusable `Icon` module may centralize the small inline SVG set. Avoid a broad
generic component library or a new design-system abstraction layer. Existing
class names should be retained when their semantic role remains unchanged;
add modifiers rather than rebuilding every component.

## 8. Interaction and motion

Motion is functional and restrained:

- Buttons move down by 1 px or reduce their offset shadow while pressed.
- Sheets use the browser dialog behaviour plus a short opacity/translate
  transition where supported.
- Verdict updates may use a 120–180 ms colour and background transition.
- The analysis progress state may animate a narrow rule, not a decorative
  spinner.

All transitions are disabled or reduced under `prefers-reduced-motion: reduce`.
There are no looping decorative animations, parallax, cursor effects, or sound.

## 9. Responsive behaviour

Existing breakpoints remain:

- Base: phone, single column, bottom navigation.
- 48 rem: top navigation, denser layouts, Tune matrix.
- 64 rem: capped and centred content.

The redesign does not introduce a separate mobile component tree except for the
existing candidate list/matrix split. At 390 px, no page-level horizontal
overflow is permitted, controls remain at least 44 px, and the fixed action and
navigation bars must not cover sheets, undo, update prompts, or footer content.

Desktop may use a wider cap of up to 72 rem only if the Tune matrix and Results
screen measurably benefit. Setup text lines must not become excessively long;
individual panels may retain a narrower internal measure.

## 10. Accessibility and reliability

- Preserve semantic headings, lists, tables, buttons, labels, live regions,
  dialog semantics, and `aria-current`.
- Colour is never the only indication of verdict, selection, lock state, or
  action priority.
- All body text meets WCAG AA contrast in light and dark mode.
- Focus remains visible on every interactive element.
- Status labels use actual text, not text embedded in icons.
- Frequencies retain tabular numerals and do not truncate essential digits.
- The redesign introduces no remote assets and does not weaken offline support.
- Error, invalid, and empty states receive the same visual treatment quality as
  successful states.

## 11. Testing and acceptance criteria

The redesign is complete when:

1. Setup, Results, and Tune visibly share the Field Notebook system in light
   and dark mode.
2. The interface reads as warm, colourful, and distinctive without reducing
   the prominence of frequencies or verdicts.
3. Existing behaviour, state transitions, project persistence, import/export,
   analysis, tuning, undo, live checks, update prompt, and offline mode remain
   unchanged.
4. Existing unit tests, lint, typecheck, and production build pass.
5. The viewport check passes at 390, 768, and 1280 px with no page-level
   horizontal overflow and no undersized interactive target.
6. A browser pass covers every screen plus carrier, project, settings, and
   About sheets in light and dark mode.
7. Clear, near, exact, locked, selected, current, best, invalid, loading, empty,
   and error states are identifiable without relying on colour alone.
8. `prefers-reduced-motion` removes nonessential transitions.
9. The production bundle contains no remote font or icon dependency.

## 12. Explicit non-goals

- No changes to `src/im/**`, worker messages, analysis algorithms, or frequency
  recommendation logic.
- No new application features, screens, routes, onboarding, or account system.
- No navigation redesign beyond presentation of the existing three views.
- No project file or local-storage migration.
- No charting, icon, animation, or UI framework dependency.
- No imitation of torn paper, handwriting, tape, coffee stains, or other
  skeuomorphic decoration that would compromise trust or readability.
