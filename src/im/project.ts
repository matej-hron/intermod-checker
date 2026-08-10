import { DEFAULT_SETTINGS, normalizeExclusion, type Carrier, type Exclusion, type Settings } from './types';

export const PROJECT_VERSION = 2;

export interface ProjectFile {
  version: number;
  name: string;
  carriers: Carrier[];
  settings: Settings;
}

function toCarrier(value: unknown): Carrier | null {
  if (typeof value !== 'object' || value === null) return null;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string') return null;
  if (typeof c.label !== 'string') return null;
  if (typeof c.freqKHz !== 'number' || !Number.isFinite(c.freqKHz)) return null;
  return {
    id: c.id,
    label: c.label,
    freqKHz: c.freqKHz,
    locked: c.locked === true,
  };
}

function sanitizeExclusions(raw: unknown): Exclusion[] {
  if (!Array.isArray(raw)) return [];
  const out: Exclusion[] = [];
  for (const value of raw) {
    if (typeof value !== 'object' || value === null) continue;
    const e = value as Record<string, unknown>;
    if (typeof e.id !== 'string') continue;
    if (typeof e.label !== 'string') continue;
    if (typeof e.startKHz !== 'number' || !Number.isFinite(e.startKHz)) continue;
    if (typeof e.endKHz !== 'number' || !Number.isFinite(e.endKHz)) continue;
    out.push(
      normalizeExclusion({
        id: e.id,
        label: e.label,
        startKHz: e.startKHz,
        endKHz: e.endKHz,
      }),
    );
  }
  return out;
}

const SETTINGS_NUMERIC_KEYS = [
  'bandMinKHz',
  'bandMaxKHz',
  'lowOrder',
  'highOrder',
  'nearHitWindowKHz',
  'deviationKHz',
  'minSpacingKHz',
  'suggestionStepKHz',
] as const satisfies readonly (keyof Settings)[];

// A hand-edited file can carry a string where a number belongs. JavaScript
// compares those loosely rather than throwing, so an unchecked value would slip
// past validation and reach the engine's arithmetic as NaN. Drop any field that
// is not a finite number and fall back to the default.
function sanitizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const s = raw as Record<string, unknown>;
  const out: Settings = { ...DEFAULT_SETTINGS, exclusions: [] };
  for (const key of SETTINGS_NUMERIC_KEYS) {
    const v = s[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  if (typeof s.oddOnly === 'boolean') out.oddOnly = s.oddOnly;
  out.exclusions = sanitizeExclusions(s.exclusions);
  return out;
}

export function serializeProject(
  name: string,
  carriers: readonly Carrier[],
  settings: Settings,
): string {
  const file: ProjectFile = {
    version: PROJECT_VERSION,
    name,
    carriers: carriers.map((c) => ({ ...c })),
    settings: { ...settings },
  };
  return JSON.stringify(file, null, 2);
}

export function parseProject(json: string): ProjectFile | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: 'The file is not valid JSON.' };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { error: 'The file is not a project.' };
  }
  const candidate = raw as Record<string, unknown>;

  if (typeof candidate.version !== 'number') {
    return { error: 'The file is not a project.' };
  }
  if (candidate.version < 1) {
    return { error: 'The file is not a project.' };
  }
  if (candidate.version > PROJECT_VERSION) {
    return {
      error: 'This project was saved by a newer version of the app.',
    };
  }
  if (!Array.isArray(candidate.carriers)) {
    return { error: 'The project contains no readable frequency list.' };
  }
  const carriers: Carrier[] = [];
  for (const raw of candidate.carriers) {
    const c = toCarrier(raw);
    if (c === null) {
      return { error: 'The project contains no readable frequency list.' };
    }
    carriers.push(c);
  }

  // Carrier ids key the per-carrier hit map in the engine, so a repeat would
  // silently discard one carrier's results rather than fail loudly.
  const ids = new Set<string>();
  for (const c of carriers) {
    if (ids.has(c.id)) {
      return { error: 'The project contains duplicate frequency identifiers.' };
    }
    ids.add(c.id);
  }

  return {
    version: candidate.version,
    name: typeof candidate.name === 'string' ? candidate.name : 'Untitled',
    carriers,
    settings: sanitizeSettings(candidate.settings),
  };
}
