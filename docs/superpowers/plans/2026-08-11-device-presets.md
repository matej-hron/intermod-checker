# Device Presets and Per-Carrier Deviation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user pick a real transmitter model per carrier so the interference window uses that device's actual modulation width instead of one global number.

**Architecture:** A pure-data catalogue module (`src/im/devices.ts`) holds nine transmitter models, each with power options and one or two band modes carrying a peak deviation in hertz. `Carrier` gains three optional fields naming a device, mode and power. The engine's collision window becomes `max(nearHitWindow, Σ|nᵢ|·devᵢ + dev_victim)` computed in integer hertz, with a fast path that keeps today's arithmetic when every carrier shares one deviation.

**Tech Stack:** React 19, TypeScript, Vite 8, Zustand, Vitest (node environment, no DOM), oxlint.

**Spec:** `docs/superpowers/specs/2026-08-11-device-presets-design.md`

## Global Constraints

- Carrier frequencies stay **integer kilohertz**. Deviations are **integer hertz**. The window threshold is computed in hertz. Never store a fractional kHz frequency.
- MHz appears only at the UI boundary, via the existing `kHzToMHzText` / `mhzToKHz` / `parseFrequencyMHz` / `MHzInput`. Never hand-roll a conversion.
- **No existing test may be modified, with exactly one narrow exception named in Task 5.** The suite is 140 tests across 11 files and must stay green. `effectiveWindowKHz(order, settings)` keeps its current signature and semantics because its test pins them.
- The exception: two assertions in `src/im/__tests__/project.test.ts` hard-code the current project version (`expect(parsed.version).toBe(2)` and the case named `rejects a version 3 file`). They are version pins, not behaviour tests, so they must move when the version legitimately moves. Task 5 states the exact edits. **No other test may be touched, and neither of these may be weakened or deleted — only re-pointed at the new version.**
- Vitest runs in the **node environment with no DOM** and collects only `src/**/__tests__/**/*.test.ts`. Pure functions only. Never add jsdom or a testing library.
- `scanProducts` is the innermost hot loop. **Allocating anything per product visit is a measurable regression.** No new arrays, objects, closures or string building inside the visitor.
- Minimum touch target 44×44 px; every `input`/`select`/`textarea` at a computed font of at least 16 px. `src/styles/base.css` already applies both to bare elements — per-component sizing is unnecessary.
- Breakpoints are `min-width` only, exactly `48rem` and `64rem`. No `max-width` media queries.
- Colour is never the sole carrier of meaning.
- Append new CSS to the **end** of `src/styles/components.css`. Do not modify rules already there.
- Power is stored and displayed but **never enters the maths**.
- Conventional Commits.
- Gate: `npm run typecheck && npm run lint && npm run test && npm run build`

## File Structure

**Create**
- `src/im/devices.ts` — the catalogue, its types, lookups, deviation resolution, width formatting.
- `src/im/window.ts` — the one collision-window formula, in hertz.
- `src/im/__tests__/devices.test.ts`
- `src/im/__tests__/window.test.ts`
- `src/ui/DevicePicker.tsx` — the device / power / mode controls and width readout for one carrier.

**Modify**
- `src/im/types.ts` — three optional `Carrier` fields.
- `src/im/products.ts` — accumulate the deviation spread in the existing loop; pass it to the visitor.
- `src/im/analyze.ts` — use the hertz window with the victim term.
- `src/im/evaluate.ts` — same, inlined, for the candidate path.
- `src/im/project.ts` — version 3 and sanitisation of the new fields.
- `src/im/index.ts` — export the two new modules.
- `src/ui/CarrierList.tsx` — render `DevicePicker` on each card.
- `src/ui/SettingsPanel.tsx` — relabel the global deviation as a fallback.
- `src/styles/components.css` — device picker styles.
- `README.md` — a devices section.

---

### Task 1: The device catalogue

**Files:**
- Create: `src/im/devices.ts`
- Create: `src/im/__tests__/devices.test.ts`
- Modify: `src/im/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Modulation`, `DeviceMode`, `Device`, `DEVICES`, `findDevice(id: string | undefined): Device | null`, `findMode(device: Device, modeId: string | undefined): DeviceMode`, `formatModeWidth(mode: DeviceMode): string`.

- [ ] **Step 1: Write the failing test**

Create `src/im/__tests__/devices.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEVICES, findDevice, findMode, formatModeWidth } from '../devices';

describe('the catalogue', () => {
  it('has a unique id for every device', () => {
    const ids = DEVICES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every device at least one mode and at least one power option', () => {
    for (const device of DEVICES) {
      expect(device.modes.length).toBeGreaterThan(0);
      expect(device.powersMW.length).toBeGreaterThan(0);
    }
  });

  it('quotes a width that is exactly twice the peak deviation', () => {
    for (const device of DEVICES) {
      for (const mode of device.modes) {
        expect(mode.widthHz).toBe(mode.deviationHz * 2);
      }
    }
  });

  it('lists power options in ascending order', () => {
    for (const device of DEVICES) {
      const sorted = [...device.powersMW].sort((a, b) => a - b);
      expect(device.powersMW).toEqual(sorted);
    }
  });

  it('carries the narrow Wisycom mode at a deviation kilohertz cannot express', () => {
    const mtp60 = findDevice('wisycom-mtp60');
    expect(mtp60).not.toBeNull();
    const narrow = mtp60!.modes.find((m) => m.id === 'narrow');
    expect(narrow?.deviationHz).toBe(17500);
  });
});

describe('findDevice', () => {
  it('returns null for an unknown or absent id', () => {
    expect(findDevice('nope')).toBeNull();
    expect(findDevice(undefined)).toBeNull();
  });

  it('finds a device by id', () => {
    expect(findDevice('sound-devices-a10')?.model).toBe('A10');
  });
});

describe('findMode', () => {
  it('falls back to the first mode when the id is unknown or absent', () => {
    const device = findDevice('wisycom-mtp60')!;
    expect(findMode(device, undefined).id).toBe('wide');
    expect(findMode(device, 'nonsense').id).toBe('wide');
  });

  it('finds the named mode', () => {
    const device = findDevice('wisycom-mtp60')!;
    expect(findMode(device, 'narrow').deviationHz).toBe(17500);
  });
});

describe('formatModeWidth', () => {
  it('renders a whole-kilohertz deviation without a decimal point', () => {
    const device = findDevice('wisycom-mtp40')!;
    expect(formatModeWidth(findMode(device, 'wide'))).toBe('±28 kHz · 56 kHz wide');
  });

  it('renders a half-kilohertz deviation with one decimal place', () => {
    const device = findDevice('wisycom-mtp60')!;
    expect(formatModeWidth(findMode(device, 'narrow'))).toBe(
      '±17.5 kHz · 35 kHz wide',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/devices.test.ts`
Expected: FAIL — cannot resolve `../devices`.

- [ ] **Step 3: Write the catalogue**

Create `src/im/devices.ts`:

```ts
export type Modulation = 'fm' | 'digital';

export interface DeviceMode {
  id: string;
  label: string;
  /** Peak deviation: half the quoted modulation width. */
  deviationHz: number;
  /** The width as the manufacturer quotes it. */
  widthHz: number;
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  modulation: Modulation;
  /** Ascending. Recorded and displayed, never used in the calculation. */
  powersMW: number[];
  /** At least one. The first is the default when none is chosen. */
  modes: DeviceMode[];
}

// Deviations are held in hertz because Wisycom's narrow band is ±17.5 kHz,
// which kilohertz cannot express as an integer. Carrier frequencies remain
// integer kilohertz; only the window threshold is computed in hertz.
const WIDE_56: DeviceMode = {
  id: 'wide',
  label: 'Wide band',
  deviationHz: 28000,
  widthHz: 56000,
};

const NARROW_35: DeviceMode = {
  id: 'narrow',
  label: 'Narrow band',
  deviationHz: 17500,
  widthHz: 35000,
};

export const DEVICES: readonly Device[] = [
  {
    id: 'wisycom-mtp40',
    brand: 'Wisycom',
    model: 'MTP40',
    modulation: 'fm',
    powersMW: [10, 50],
    modes: [WIDE_56],
  },
  {
    id: 'wisycom-mtp41',
    brand: 'Wisycom',
    model: 'MTP41',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56],
  },
  {
    id: 'wisycom-mtp60',
    brand: 'Wisycom',
    model: 'MTP60',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56, NARROW_35],
  },
  {
    id: 'wisycom-mtp61',
    brand: 'Wisycom',
    model: 'MTP61',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56, NARROW_35],
  },
  {
    id: 'wisycom-mtb40s',
    brand: 'Wisycom',
    model: 'MTB40s',
    modulation: 'fm',
    powersMW: [10, 50, 100],
    modes: [WIDE_56],
  },
  {
    id: 'sennheiser-5212',
    brand: 'Sennheiser',
    model: '5212',
    modulation: 'fm',
    powersMW: [10, 50],
    modes: [WIDE_56],
  },
  {
    // One entry for four generations: they share a modulation width, and the
    // calculation cannot tell them apart.
    id: 'sennheiser-evolution',
    brand: 'Sennheiser',
    model: 'Evolution G2/G3/G4/2000',
    modulation: 'fm',
    powersMW: [10, 50],
    modes: [
      { id: 'wide', label: 'Wide band', deviationHz: 24000, widthHz: 48000 },
    ],
  },
  {
    id: 'sound-devices-a10',
    brand: 'Sound Devices',
    model: 'A10',
    modulation: 'digital',
    powersMW: [10, 20, 50],
    modes: [
      {
        id: 'digital',
        label: 'Digital',
        deviationHz: 100000,
        widthHz: 200000,
      },
    ],
  },
  {
    id: 'lectrosonics-us',
    brand: 'Lectrosonics',
    model: 'US models',
    modulation: 'fm',
    powersMW: [50],
    modes: [
      { id: 'wide', label: 'Wide band', deviationHz: 70000, widthHz: 140000 },
    ],
  },
];

export function findDevice(id: string | undefined): Device | null {
  if (id === undefined) return null;
  return DEVICES.find((d) => d.id === id) ?? null;
}

/** Falls back to the device's first mode, which is the wide one throughout. */
export function findMode(device: Device, modeId: string | undefined): DeviceMode {
  if (modeId === undefined) return device.modes[0];
  return device.modes.find((m) => m.id === modeId) ?? device.modes[0];
}

function kHzText(hz: number): string {
  const value = hz / 1000;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatModeWidth(mode: DeviceMode): string {
  return `±${kHzText(mode.deviationHz)} kHz · ${kHzText(mode.widthHz)} kHz wide`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/devices.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Export the module from the barrel**

In `src/im/index.ts`, add after the `export * from './types';` line:

```ts
export * from './devices';
```

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS, 151 tests across 12 files.

- [ ] **Step 7: Commit**

```bash
git add src/im/devices.ts src/im/__tests__/devices.test.ts src/im/index.ts
git commit -m "feat(im): add a transmitter catalogue with modulation widths"
```

---

### Task 2: Carrier device fields and deviation resolution

**Files:**
- Modify: `src/im/types.ts`
- Modify: `src/im/devices.ts`
- Modify: `src/im/__tests__/devices.test.ts`

**Interfaces:**
- Consumes: `findDevice`, `findMode` from Task 1; `Carrier` and `Settings` from `src/im/types.ts`.
- Produces: `resolveDeviationHz(carrier: Carrier, settings: Settings): number` and `carrierDeviationsHz(carriers: readonly Carrier[], settings: Settings): number[] | null`. The second returns **`null` when every carrier resolves to the same deviation** — the signal to callers that they may use the cheap uniform arithmetic.

- [ ] **Step 1: Write the failing test**

Append to `src/im/__tests__/devices.test.ts`:

```ts
import { carrierDeviationsHz, resolveDeviationHz } from '../devices';
import { DEFAULT_SETTINGS, type Carrier } from '../types';

function carrier(id: string, extra: Partial<Carrier> = {}): Carrier {
  return { id, label: id, freqKHz: 500000, locked: false, ...extra };
}

describe('resolveDeviationHz', () => {
  it('falls back to the global setting when there is no device', () => {
    const settings = { ...DEFAULT_SETTINGS, deviationKHz: 12 };
    expect(resolveDeviationHz(carrier('a'), settings)).toBe(12000);
  });

  it('is zero by default, which is what keeps existing projects unchanged', () => {
    expect(resolveDeviationHz(carrier('a'), DEFAULT_SETTINGS)).toBe(0);
  });

  it('takes the deviation from the device and mode', () => {
    const c = carrier('a', { deviceId: 'wisycom-mtp60', modeId: 'narrow' });
    expect(resolveDeviationHz(c, DEFAULT_SETTINGS)).toBe(17500);
  });

  it('uses the first mode when none is named', () => {
    const c = carrier('a', { deviceId: 'wisycom-mtp60' });
    expect(resolveDeviationHz(c, DEFAULT_SETTINGS)).toBe(28000);
  });

  it('falls back to the global setting for an unknown device', () => {
    const settings = { ...DEFAULT_SETTINGS, deviationKHz: 9 };
    const c = carrier('a', { deviceId: 'not-a-device' });
    expect(resolveDeviationHz(c, settings)).toBe(9000);
  });

  it('ignores the power option entirely', () => {
    const a = carrier('a', { deviceId: 'wisycom-mtp41', powerMW: 10 });
    const b = carrier('b', { deviceId: 'wisycom-mtp41', powerMW: 100 });
    expect(resolveDeviationHz(a, DEFAULT_SETTINGS)).toBe(
      resolveDeviationHz(b, DEFAULT_SETTINGS),
    );
  });
});

describe('carrierDeviationsHz', () => {
  it('returns null when every carrier shares one deviation', () => {
    const carriers = [carrier('a'), carrier('b')];
    expect(carrierDeviationsHz(carriers, DEFAULT_SETTINGS)).toBeNull();
  });

  it('returns null when every carrier names the same device and mode', () => {
    const carriers = [
      carrier('a', { deviceId: 'wisycom-mtp40' }),
      carrier('b', { deviceId: 'wisycom-mtp40', modeId: 'wide' }),
    ];
    expect(carrierDeviationsHz(carriers, DEFAULT_SETTINGS)).toBeNull();
  });

  it('returns one entry per carrier when the fleet is mixed', () => {
    const carriers = [
      carrier('a', { deviceId: 'wisycom-mtp40' }),
      carrier('b', { deviceId: 'sound-devices-a10' }),
    ];
    expect(carrierDeviationsHz(carriers, DEFAULT_SETTINGS)).toEqual([
      28000, 100000,
    ]);
  });

  it('returns null for an empty fleet', () => {
    expect(carrierDeviationsHz([], DEFAULT_SETTINGS)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/devices.test.ts`
Expected: FAIL — `resolveDeviationHz` is not exported, and `deviceId` is not a property of `Carrier`.

- [ ] **Step 3: Add the carrier fields**

In `src/im/types.ts`, replace the `Carrier` interface with:

```ts
export interface Carrier {
  id: string;
  label: string;
  freqKHz: number;
  /** A locked carrier is never retuned by any automated process. */
  locked: boolean;
  /** Catalogue id. Absent means the global deviation setting applies. */
  deviceId?: string;
  /** Which of the device's modes. Absent means its first. */
  modeId?: string;
  /** Recorded and displayed only; never used in the calculation. */
  powerMW?: number;
}
```

- [ ] **Step 4: Write the resolution functions**

Append to `src/im/devices.ts`:

```ts
import type { Carrier, Settings } from './types';

/**
 * The single place the precedence lives: a carrier's device wins, and the
 * global setting is only a fallback for carriers that name no device.
 */
export function resolveDeviationHz(carrier: Carrier, settings: Settings): number {
  const device = findDevice(carrier.deviceId);
  if (device === null) return settings.deviationKHz * 1000;
  return findMode(device, carrier.modeId).deviationHz;
}

/**
 * Returns null when every carrier resolves to the same deviation. The engine's
 * hot loop reads that as permission to use the cheap `order × deviation`
 * arithmetic, so a fleet of identical devices — and every project saved before
 * this feature existed — costs exactly what it did before.
 */
export function carrierDeviationsHz(
  carriers: readonly Carrier[],
  settings: Settings,
): number[] | null {
  if (carriers.length === 0) return null;
  const out = carriers.map((c) => resolveDeviationHz(c, settings));
  const first = out[0];
  return out.every((hz) => hz === first) ? null : out;
}
```

Move the `import type { Carrier, Settings } from './types';` line to the top of the file with the other imports; TypeScript allows it anywhere, but the project keeps imports at the top.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/devices.test.ts`
Expected: PASS, 21 tests.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS, 161 tests across 12 files. Every pre-existing test still passes because all three carrier fields are optional.

- [ ] **Step 7: Commit**

```bash
git add src/im/types.ts src/im/devices.ts src/im/__tests__/devices.test.ts
git commit -m "feat(im): resolve a deviation per carrier from its device"
```

---

### Task 3: The per-carrier collision window in the analysis

**Files:**
- Create: `src/im/window.ts`
- Create: `src/im/__tests__/window.test.ts`
- Modify: `src/im/products.ts`
- Modify: `src/im/analyze.ts`
- Modify: `src/im/index.ts`

**Interfaces:**
- Consumes: `carrierDeviationsHz` from Task 2.
- Produces: `windowHz(spreadHz: number, victimDevHz: number, nearHitWindowKHz: number): number`; a `ProductVisitor` whose fourth argument is `spreadHz`; `scanProducts(freqs, settings, visit, onVector?, devHz?)` where `devHz` is `readonly number[] | null | undefined`.

- [ ] **Step 1: Write the failing test for the formula**

Create `src/im/__tests__/window.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { windowHz } from '../window';

describe('windowHz', () => {
  it('never falls below the near-hit floor', () => {
    expect(windowHz(0, 0, 25)).toBe(25000);
  });

  it('adds the victim bandwidth to the product spread', () => {
    // Three carriers of ±28 kHz mixing: 84 kHz of spread, and the victim's own
    // 28 kHz on top.
    expect(windowHz(84000, 28000, 25)).toBe(112000);
  });

  it('uses the spread alone when the victim has no width', () => {
    expect(windowHz(84000, 0, 25)).toBe(84000);
  });

  it('prefers the floor when the deviations are small', () => {
    expect(windowHz(3000, 1000, 25)).toBe(25000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/window.test.ts`
Expected: FAIL — cannot resolve `../window`.

- [ ] **Step 3: Write the formula**

Create `src/im/window.ts`:

```ts
/**
 * How close a product must land to count as interference, in hertz.
 *
 * `spreadHz` is the product's own occupied width, the sum of each contributing
 * carrier's deviation weighted by its coefficient. `victimDevHz` is the victim
 * receiver's width: interference happens when the product's skirt overlaps the
 * passband, so a wide digital receiver is a bigger target than a narrow one.
 *
 * Hertz rather than kilohertz because Wisycom's narrow mode deviates ±17.5 kHz
 * and this arithmetic must stay exact.
 */
export function windowHz(
  spreadHz: number,
  victimDevHz: number,
  nearHitWindowKHz: number,
): number {
  const floor = nearHitWindowKHz * 1000;
  const combined = spreadHz + victimDevHz;
  return combined > floor ? combined : floor;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/window.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Teach the product scan to accumulate the spread**

Replace the whole of `src/im/products.ts` with:

```ts
import { enumerateVectors } from './enumerate';
import type { Settings } from './types';

export type ProductVisitor = (
  freqKHz: number,
  coeffs: readonly number[],
  order: number,
  spreadHz: number,
) => boolean | void;

/**
 * Walks every canonical vector, evaluates it against `freqs`, and reports each
 * product that lands inside the band.
 *
 * `devHz` gives each carrier's deviation in hertz. Pass `null` when every
 * carrier shares one deviation: the spread is then `order × deviation` and the
 * per-carrier multiply-add never runs. This is the path every project saved
 * before device presets existed takes.
 *
 * The `coeffs` array is reused between calls — copy it to retain it. Returning
 * `false` from `visit` aborts the scan. Returns the vectors enumerated.
 */
export function scanProducts(
  freqs: readonly number[],
  settings: Settings,
  visit: ProductVisitor,
  onVector?: (enumerated: number) => void,
  devHz?: readonly number[] | null,
): number {
  const n = freqs.length;
  let enumerated = 0;
  const perCarrier = devHz ?? null;
  const uniformHz = settings.deviationKHz * 1000;

  return enumerateVectors(
    n,
    settings.lowOrder,
    settings.highOrder,
    settings.oddOnly,
    (coeffs, order) => {
      enumerated += 1;
      onVector?.(enumerated);

      let sum = 0;
      let spreadHz = 0;
      if (perCarrier === null) {
        for (let i = 0; i < n; i += 1) sum += coeffs[i] * freqs[i];
        spreadHz = order * uniformHz;
      } else {
        // Folded into the frequency loop rather than given a pass of its own.
        for (let i = 0; i < n; i += 1) {
          const c = coeffs[i];
          sum += c * freqs[i];
          spreadHz += (c < 0 ? -c : c) * perCarrier[i];
        }
      }
      if (sum === 0) return;

      const freqKHz = Math.abs(sum);
      if (freqKHz < settings.bandMinKHz || freqKHz > settings.bandMaxKHz) return;

      return visit(freqKHz, coeffs, order, spreadHz);
    },
  );
}
```

- [ ] **Step 6: Write the failing test for the analysis**

Append to `src/im/__tests__/analyze.test.ts`:

```ts
import { carrierDeviationsHz } from '../devices';

describe('per-carrier deviation in analyze', () => {
  // 2A − B lands on 499850, which is 100 kHz from C. C contributes nothing to
  // that product, so it is a genuine conflict rather than self-mixing.
  const settings = {
    ...DEFAULT_SETTINGS,
    bandMinKHz: 400000,
    bandMaxKHz: 700000,
    lowOrder: 3,
    highOrder: 3,
    nearHitWindowKHz: 25,
  };

  const base = [
    { id: 'a', label: 'A', freqKHz: 500000, locked: false },
    { id: 'b', label: 'B', freqKHz: 500150, locked: false },
    { id: 'c', label: 'C', freqKHz: 499750, locked: false },
  ];

  it('leaves the victim clear when no carrier has a width', () => {
    const result = analyze(base, settings);
    expect(result.conflictedIds).not.toContain('c');
  });

  it('finds the conflict once every carrier is a real transmitter', () => {
    const carriers = base.map((c) => ({ ...c, deviceId: 'wisycom-mtp40' }));
    const result = analyze(carriers, settings);
    // Spread 3 × 28 kHz = 84 kHz, plus the victim's own 28 kHz, is 112 kHz —
    // wide enough to reach 100 kHz away. Without the victim term it would not.
    expect(result.conflictedIds).toContain('c');
  });

  it('is unaffected by the power option', () => {
    const carriers = base.map((c) => ({
      ...c,
      deviceId: 'wisycom-mtp40',
      powerMW: 50,
    }));
    expect(analyze(carriers, settings).conflictedIds).toContain('c');
  });

  it('treats a uniform fleet as uniform', () => {
    const carriers = base.map((c) => ({ ...c, deviceId: 'wisycom-mtp40' }));
    expect(carrierDeviationsHz(carriers, settings)).toBeNull();
  });

  // This is the case the whole feature exists for, and it is the only test
  // that drives the mixed per-carrier branch of scanProducts end to end.
  // A narrow-band MTP60 is ±17.5 kHz, so three of them spread 2A − B by only
  // 52.5 kHz and the product stays clear of C, 100 kHz away. Swap C alone for
  // an A10 and nothing about the product changes — but the victim is now
  // 100 kHz wide, so the same product lands inside it.
  it('reports a conflict a uniform narrow-band fleet would miss', () => {
    const narrow = base.map((c) => ({
      ...c,
      deviceId: 'wisycom-mtp60',
      modeId: 'narrow',
    }));
    expect(analyze(narrow, settings).conflictedIds).not.toContain('c');

    const mixed = narrow.map((c) =>
      c.id === 'c' ? { ...c, deviceId: 'sound-devices-a10', modeId: undefined } : c,
    );
    expect(carrierDeviationsHz(mixed, settings)).toEqual([17500, 17500, 100000]);
    expect(analyze(mixed, settings).conflictedIds).toContain('c');
  });
});
```

That file already imports `DEFAULT_SETTINGS` from `'../types'`, so no import change is needed.

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/analyze.test.ts`
Expected: FAIL on "finds the conflict once every carrier is a real transmitter" — the analysis still reads the global deviation, which is 0, so the window stays at the 25 kHz floor.

- [ ] **Step 8: Use the hertz window in the analysis**

In `src/im/analyze.ts`, add to the imports:

```ts
import { carrierDeviationsHz } from './devices';
import { windowHz } from './window';
```

Immediately after `const freqs = carriers.map((c) => c.freqKHz);`, add:

```ts
  const devHz = carrierDeviationsHz(carriers, settings);
  const uniformDevHz = settings.deviationKHz * 1000;
```

Change the visitor signature from `(freqKHz, coeffs, order) => {` to:

```ts
    (freqKHz, coeffs, order, spreadHz) => {
```

Replace `const window = effectiveWindowKHz(order, settings);` with nothing — the window now depends on the victim, so it moves inside the victim loop. Then replace these two lines:

```ts
        const offset = Math.abs(freqs[v] - freqKHz);
        if (offset > window) continue;
```

with:

```ts
        const offset = Math.abs(freqs[v] - freqKHz);
        const victimDevHz = devHz === null ? uniformDevHz : devHz[v];
        if (offset * 1000 > windowHz(spreadHz, victimDevHz, settings.nearHitWindowKHz))
          continue;
```

Finally pass the deviations to the scan. The `scanProducts` call currently ends with the `onVector` callback; add `devHz` as the argument after it:

```ts
    (enumerated) => {
      if (onProgress && total > 0 && enumerated % PROGRESS_INTERVAL === 0) {
        onProgress(enumerated / total);
      }
    },
    devHz,
  );
```

Leave `effectiveWindowKHz` exactly as it is. It is still exported and its test still pins the legacy uniform semantics; nothing in this task may change it.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/im/__tests__/analyze.test.ts src/im/__tests__/window.test.ts`
Expected: PASS.

- [ ] **Step 10: Export the window module**

In `src/im/index.ts`, add:

```ts
export * from './window';
```

- [ ] **Step 11: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS, 170 tests across 13 files. Note that `suggest.test.ts` takes about 1.6 s; if it takes materially longer, the hot loop has regressed — report it rather than continuing.

- [ ] **Step 12: Commit**

```bash
git add src/im/window.ts src/im/__tests__/window.test.ts src/im/products.ts src/im/analyze.ts src/im/index.ts src/im/__tests__/analyze.test.ts
git commit -m "feat(im): widen the collision window by each carrier's own deviation"
```

---

### Task 4: The per-carrier window in the candidate evaluator

**Files:**
- Modify: `src/im/evaluate.ts`
- Modify: `src/im/__tests__/evaluate.test.ts`

**Interfaces:**
- Consumes: `carrierDeviationsHz` (Task 2), the four-argument `ProductVisitor` and the `devHz` parameter of `scanProducts` (Task 3).
- Produces: no new exports. `evaluateCandidate` keeps its present signature — it already receives `carriers`.

This is the path behind the Tune picker and `suggest()`. Leaving it on the global deviation would make the picker recommend frequencies the analysis then calls conflicts.

- [ ] **Step 1: Write the failing test**

Append to `src/im/__tests__/evaluate.test.ts`:

```ts
describe('per-carrier deviation in evaluateCandidate', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    bandMinKHz: 400000,
    bandMaxKHz: 700000,
    lowOrder: 3,
    highOrder: 3,
    nearHitWindowKHz: 25,
    minSpacingKHz: 0,
  };

  const carriers = [
    { id: 'a', label: 'A', freqKHz: 500000, locked: false },
    { id: 'b', label: 'B', freqKHz: 500150, locked: false },
    { id: 'c', label: 'C', freqKHz: 499750, locked: false },
  ];

  it('calls the candidate clear when no carrier has a width', () => {
    const freqs = carriers.map((c) => c.freqKHz);
    const evaluation = evaluateCandidate(freqs, 2, 499750, settings, carriers);
    expect(evaluation.worst).toBe('clear');
  });

  it('sees the same conflict the analysis sees once devices are chosen', () => {
    const withDevices = carriers.map((c) => ({
      ...c,
      deviceId: 'wisycom-mtp40',
    }));
    const freqs = withDevices.map((c) => c.freqKHz);
    const evaluation = evaluateCandidate(
      freqs,
      2,
      499750,
      settings,
      withDevices,
    );
    expect(evaluation.worst).not.toBe('clear');
  });
});
```

That file already imports both `evaluateCandidate` and `DEFAULT_SETTINGS`, so no import change is needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/evaluate.test.ts`
Expected: FAIL on the second case — the evaluator still multiplies the order by the global deviation of 0.

- [ ] **Step 3: Use the per-carrier deviations in the evaluator**

In `src/im/evaluate.ts`, add to the imports:

```ts
import { carrierDeviationsHz } from './devices';
```

Replace these two lines:

```ts
  const nearWindow = settings.nearHitWindowKHz;
  const deviation = settings.deviationKHz;
```

with:

```ts
  const nearWindowHz = settings.nearHitWindowKHz * 1000;
  const devHz = carrierDeviationsHz(carriers, settings);
  const uniformDevHz = settings.deviationKHz * 1000;
```

Change the visitor signature from `(productKHz, coeffs, order) => {` to:

```ts
  scanProducts(freqs, settings, (productKHz, coeffs, order, spreadHz) => {
```

Replace these three lines:

```ts
    // Inlined `effectiveWindowKHz` — a function call in the scan's hottest loop.
    const scaled = order * deviation;
    const window = scaled > nearWindow ? scaled : nearWindow;
```

with:

```ts
    // `windowHz` inlined — a function call in the scan's hottest loop. The
    // victim term is added per victim below, so this is only the floor check
    // the spread can already clear on its own.
    const moverContributes = coeffs[index] !== 0;
```

and delete the now-duplicated `const moverContributes = coeffs[index] !== 0;` line that follows.

Then replace these two lines inside the victim loop:

```ts
      const offset = Math.abs(freqs[v] - productKHz);
      if (offset > window) continue;
```

with:

```ts
      const offset = Math.abs(freqs[v] - productKHz);
      const victimDevHz = devHz === null ? uniformDevHz : devHz[v];
      const combined = spreadHz + victimDevHz;
      const window = combined > nearWindowHz ? combined : nearWindowHz;
      if (offset * 1000 > window) continue;
```

Finally pass the deviations to the scan. The `scanProducts` call in this function has no `onVector` argument, so supply `undefined` for it:

```ts
  }, undefined, devHz);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/im/__tests__/evaluate.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and watch the clock**

Run: `npm run test`
Expected: PASS, 172 tests across 13 files. `suggest.test.ts` should still finish in roughly 1.6 s. This file is the hot path behind thousands of candidate evaluations; if its duration has grown by more than about half, stop and report it rather than continuing.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/im/evaluate.ts src/im/__tests__/evaluate.test.ts
git commit -m "feat(im): use per-carrier deviation when scoring candidates"
```

---

### Task 5: Persisting the device on a carrier

**Files:**
- Modify: `src/im/project.ts`
- Modify: `src/im/__tests__/project.test.ts`

**Interfaces:**
- Consumes: `findDevice`, `findMode` (Task 1); the `Carrier` fields (Task 2).
- Produces: `PROJECT_VERSION` is `3`. Files at version 1 and 2 keep loading.

- [ ] **Step 1: Write the failing test**

Append to `src/im/__tests__/project.test.ts`:

```ts
describe('device fields', () => {
  const carrier = {
    id: 'a',
    label: 'A',
    freqKHz: 500000,
    locked: false,
    deviceId: 'wisycom-mtp60',
    modeId: 'narrow',
    powerMW: 50,
  };

  it('survives a round trip', () => {
    const json = serializeProject('P', [carrier], DEFAULT_SETTINGS);
    const parsed = parseProject(json);
    expect('error' in parsed).toBe(false);
    if ('error' in parsed) return;
    expect(parsed.carriers[0].deviceId).toBe('wisycom-mtp60');
    expect(parsed.carriers[0].modeId).toBe('narrow');
    expect(parsed.carriers[0].powerMW).toBe(50);
  });

  it('drops a device that is not in the catalogue', () => {
    const json = JSON.stringify({
      version: 3,
      name: 'P',
      carriers: [{ ...carrier, deviceId: 'ghost' }],
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.carriers[0].deviceId).toBeUndefined();
    expect(parsed.carriers[0].modeId).toBeUndefined();
  });

  it('drops a mode the device does not have', () => {
    const json = JSON.stringify({
      version: 3,
      name: 'P',
      carriers: [{ ...carrier, deviceId: 'wisycom-mtp40', modeId: 'narrow' }],
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.carriers[0].deviceId).toBe('wisycom-mtp40');
    expect(parsed.carriers[0].modeId).toBeUndefined();
  });

  it('drops a power the device does not offer', () => {
    const json = JSON.stringify({
      version: 3,
      name: 'P',
      carriers: [{ ...carrier, deviceId: 'wisycom-mtp40', powerMW: 999 }],
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.carriers[0].powerMW).toBeUndefined();
  });

  it('still loads a project saved before devices existed', () => {
    const json = JSON.stringify({
      version: 2,
      name: 'P',
      carriers: [{ id: 'a', label: 'A', freqKHz: 500000, locked: false }],
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseProject(json);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.carriers[0].deviceId).toBeUndefined();
  });
});
```

That file already imports `DEFAULT_SETTINGS` from `'../types'`, so no import change is needed.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/im/__tests__/project.test.ts`
Expected: FAIL — `toCarrier` discards the three fields, so the round trip returns `undefined` for each.

- [ ] **Step 3: Sanitise and keep the device fields**

In `src/im/project.ts`, change the version constant:

```ts
export const PROJECT_VERSION = 3;
```

Add to the imports at the top:

```ts
import { findDevice } from './devices';
```

Replace the whole `toCarrier` function with:

```ts
// A device the catalogue does not know cannot yield a deviation, so it is
// dropped rather than kept: the carrier then shows "No device" in Setup, which
// makes the loss visible instead of silently mis-modelling the transmitter.
function toCarrier(value: unknown): Carrier | null {
  if (typeof value !== 'object' || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string') return null;
  if (typeof c.label !== 'string') return null;
  if (typeof c.freqKHz !== 'number' || !Number.isFinite(c.freqKHz)) return null;

  const carrier: Carrier = {
    id: c.id,
    label: c.label,
    freqKHz: c.freqKHz,
    locked: c.locked === true,
  };

  const device = typeof c.deviceId === 'string' ? findDevice(c.deviceId) : null;
  if (device !== null) {
    carrier.deviceId = device.id;
    if (
      typeof c.modeId === 'string' &&
      device.modes.some((m) => m.id === c.modeId)
    ) {
      carrier.modeId = c.modeId;
    }
    if (typeof c.powerMW === 'number' && device.powersMW.includes(c.powerMW)) {
      carrier.powerMW = c.powerMW;
    }
  }

  return carrier;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/im/__tests__/project.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-point the two version pins**

Raising `PROJECT_VERSION` breaks two assertions that hard-code the old number.
They pin the version, not behaviour, so they move with it. These are the **only**
existing assertions this plan may touch, and neither may be weakened.

The bump is worth this: the app is an installed PWA, so a user may be running a
stale service worker. Without a bump, an old copy would open a file containing
devices, silently ignore them, and re-export the project with the devices gone.
With the bump it refuses the file and says why.

In `src/im/__tests__/project.test.ts`, in the case named
`round-trips a version 2 file`, change:

```ts
    expect(parsed.version).toBe(2);
```

to:

```ts
    expect(parsed.version).toBe(PROJECT_VERSION);
```

`PROJECT_VERSION` is already imported at the top of that file. Rename the case
so its title is not stale:

```ts
  it('round-trips a file at the current version', () => {
```

Then, in the case named `rejects a version 3 file`, retarget it one version
above the current one — its point is that a file from a *newer* app is refused:

```ts
  it('rejects a version 4 file', () => {
    const parsed = parseProject(
      JSON.stringify({ version: 4, name: 'Future', carriers: [], settings: {} }),
    );
    expect('error' in parsed).toBe(true);
  });
```

Leave every other `version: 2` in that file alone. Those load a genuinely old
file and must keep passing exactly as they are — they are the regression test
for backward compatibility.

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS, 177 tests across 13 files. If any test other than the two named
above has changed, revert it.

- [ ] **Step 7: Commit**

```bash
git add src/im/project.ts src/im/__tests__/project.test.ts
git commit -m "feat(im): persist the device chosen for each carrier"
```

---

### Task 6: The device picker

**Files:**
- Create: `src/ui/DevicePicker.tsx`
- Modify: `src/ui/CarrierList.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes: `DEVICES`, `findDevice`, `findMode`, `formatModeWidth` (Task 1); the `Carrier` fields (Task 2); `useProjectStore`'s existing `updateCarrier(id, patch)`.
- Produces: `<DevicePicker carrier={carrier} />`.

There are no component tests: Vitest runs with no DOM here by design. This task is verified in a browser.

- [ ] **Step 1: Write the component**

Create `src/ui/DevicePicker.tsx`:

```tsx
import { DEVICES, findDevice, findMode, formatModeWidth, type Carrier } from '../im';
import { useProjectStore } from '../state/projectStore';

const NO_DEVICE = '';

export function DevicePicker({ carrier }: { carrier: Carrier }) {
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const device = findDevice(carrier.deviceId);
  const mode = device === null ? null : findMode(device, carrier.modeId);

  const brands = [...new Set(DEVICES.map((d) => d.brand))];

  return (
    <div className="device">
      <label className="device__field">
        <span className="device__label">Device</span>
        <select
          value={carrier.deviceId ?? NO_DEVICE}
          onChange={(e) => {
            const next = findDevice(e.target.value || undefined);
            // The old power and mode belong to the old device, so they are
            // cleared rather than carried onto gear that may not offer them.
            updateCarrier(carrier.id, {
              deviceId: next?.id,
              modeId: undefined,
              powerMW: undefined,
            });
          }}
        >
          <option value={NO_DEVICE}>No device</option>
          {brands.map((brand) => (
            <optgroup key={brand} label={brand}>
              {DEVICES.filter((d) => d.brand === brand).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.model}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {device !== null && device.powersMW.length > 1 && (
        <label className="device__field">
          <span className="device__label">Power</span>
          <select
            value={carrier.powerMW ?? NO_DEVICE}
            onChange={(e) =>
              updateCarrier(carrier.id, {
                powerMW: e.target.value === NO_DEVICE ? undefined : Number(e.target.value),
              })
            }
          >
            <option value={NO_DEVICE}>Not set</option>
            {device.powersMW.map((mw) => (
              <option key={mw} value={mw}>
                {mw} mW
              </option>
            ))}
          </select>
        </label>
      )}

      {device !== null && device.modes.length > 1 && (
        <label className="device__field">
          <span className="device__label">Mode</span>
          <select
            value={mode!.id}
            onChange={(e) => updateCarrier(carrier.id, { modeId: e.target.value })}
          >
            {device.modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {device !== null && mode !== null && (
        <p className="device__width">
          {formatModeWidth(mode)}
          {device.modulation === 'digital' && (
            <span className="device__note"> · digital, width not FM deviation</span>
          )}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render it on each carrier card**

In `src/ui/CarrierList.tsx`, add to the imports:

```tsx
import { DevicePicker } from './DevicePicker';
```

Then place the picker directly after the closing `</div>` of `carrier__freq` and before the `carrier__lock` label:

```tsx
            <DevicePicker carrier={carrier} />
```

- [ ] **Step 3: Style it**

Append to the **end** of `src/styles/components.css`:

```css
.device {
  grid-column: 1 / -1;
  display: grid;
  gap: var(--space-2);
}
.device__field {
  display: grid;
  gap: var(--space-1);
}
.device__label {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.device__width {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}
.device__note {
  font-style: italic;
}

@media (min-width: 48rem) {
  .device {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    align-items: end;
  }
  .device__width {
    grid-column: 1 / -1;
  }
}
```

Do not add sizing rules to the selects: `src/styles/base.css` already gives every bare `select` a 44 px minimum height and a 16 px font.

- [ ] **Step 4: Verify in a browser**

```bash
npm run build
npx vite preview
```

Read the port Vite prints — it silently falls back when the port is taken. At a 390×844 viewport confirm:

- A carrier with no device shows only the Device select.
- Choosing **Wisycom MTP60** reveals both a Power and a Mode select; choosing **Sennheiser 5212** reveals only Power; choosing **Lectrosonics US models** reveals neither, because it has one power and one mode.
- The width line reads `±28 kHz · 56 kHz wide`, and switching the MTP60 to narrow changes it to `±17.5 kHz · 35 kHz wide`.
- The A10 shows the digital note.
- Changing a device re-runs nothing on its own, but pressing Analyse afterwards produces a result.
- `document.documentElement.scrollWidth === document.documentElement.clientWidth` — report both numbers.
- No console errors.

Stop the preview with `kill <literal numeric pid>`; `kill $(lsof -ti :PORT)` does not work here.

- [ ] **Step 5: Check the layout has not regressed**

Run: `npm run check:viewport -- <the URL vite printed>`
Expected: ALL PASS, including "phone touch targets: none under 44px".

- [ ] **Step 6: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 177 tests across 13 files.

- [ ] **Step 7: Commit**

```bash
git add src/ui/DevicePicker.tsx src/ui/CarrierList.tsx src/styles/components.css
git commit -m "feat(ui): choose a transmitter model for each carrier"
```

---

### Task 7: Settings copy, documentation and release

**Files:**
- Modify: `src/ui/SettingsPanel.tsx`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-11-device-presets-design.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing further.

- [ ] **Step 1: Relabel the global deviation**

In `src/ui/SettingsPanel.tsx`, replace this block:

```tsx
      <label>
        Peak deviation (kHz)
        <input
          type="number"
          min={0}
          value={settings.deviationKHz}
          onChange={(e) => setSettings({ deviationKHz: Number(e.target.value) })}
        />
      </label>
```

with:

```tsx
      <label>
        Peak deviation for carriers with no device (kHz)
        <input
          type="number"
          min={0}
          value={settings.deviationKHz}
          onChange={(e) => setSettings({ deviationKHz: Number(e.target.value) })}
        />
      </label>
      <p className="hint">
        Carriers that name a device take their deviation from it and ignore this
        setting.
      </p>
```

- [ ] **Step 2: Document the feature**

In `README.md`, insert a new section immediately before the `## The theory, briefly` heading:

```markdown
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
```

- [ ] **Step 3: Mark the spec implemented**

In `docs/superpowers/specs/2026-08-11-device-presets-design.md`, change the status line:

```markdown
**Status:** implemented
```

Change nothing else in that file.

- [ ] **Step 4: Verify the end-to-end behaviour in a browser**

```bash
npm run build
npx vite preview
```

Read the port Vite prints. Then, at a 390×844 viewport:

1. Set three frequencies to 500.000, 500.150 and 499.750 MHz, and set the band minimum to 400 MHz so the products are in range.
2. Press Analyse with no devices chosen. The 499.750 carrier should be clear.
3. Set all three to **Wisycom MTP40** and press Analyse again. The 499.750 carrier should now show a conflict — this is the victim-bandwidth term the spec's §5.2 describes, and seeing it change is the point of the whole feature.
4. Export the project to JSON, reload the page, import it back, and confirm the devices survived.

Stop the preview with `kill <literal numeric pid>`.

- [ ] **Step 5: Run the gate**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: PASS, 177 tests across 13 files.

- [ ] **Step 6: Commit**

```bash
git add src/ui/SettingsPanel.tsx README.md docs/superpowers/specs/2026-08-11-device-presets-design.md
git commit -m "docs: document the device catalogue and its limits"
```
