import { DEFAULT_SETTINGS, type Carrier, type Settings } from './types';

export const PROJECT_VERSION = 1;

export interface ProjectFile {
  version: number;
  name: string;
  carriers: Carrier[];
  settings: Settings;
}

function isCarrier(value: unknown): value is Carrier {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.freqKHz === 'number' &&
    Number.isFinite(c.freqKHz)
  );
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
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const key of SETTINGS_NUMERIC_KEYS) {
    const v = s[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  if (typeof s.oddOnly === 'boolean') out.oddOnly = s.oddOnly;
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
  if (candidate.version > PROJECT_VERSION) {
    return {
      error: 'This project was saved by a newer version of the app.',
    };
  }
  if (!Array.isArray(candidate.carriers) || !candidate.carriers.every(isCarrier)) {
    return { error: 'The project contains no readable frequency list.' };
  }

  // Carrier ids key the per-carrier hit map in the engine, so a repeat would
  // silently discard one carrier's results rather than fail loudly.
  const ids = new Set<string>();
  for (const c of candidate.carriers) {
    if (ids.has(c.id)) {
      return { error: 'The project contains duplicate frequency identifiers.' };
    }
    ids.add(c.id);
  }

  return {
    version: candidate.version,
    name: typeof candidate.name === 'string' ? candidate.name : 'Untitled',
    carriers: candidate.carriers,
    settings: sanitizeSettings(candidate.settings),
  };
}
