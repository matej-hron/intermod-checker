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

export function isProjectFile(value: unknown): value is ProjectFile {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.version === 'number' &&
    typeof c.name === 'string' &&
    Array.isArray(c.carriers) &&
    c.carriers.every(isCarrier) &&
    typeof c.settings === 'object' &&
    c.settings !== null
  );
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

  const settingsRaw =
    typeof candidate.settings === 'object' && candidate.settings !== null
      ? (candidate.settings as Partial<Settings>)
      : {};

  return {
    version: candidate.version,
    name: typeof candidate.name === 'string' ? candidate.name : 'Untitled',
    carriers: candidate.carriers,
    settings: { ...DEFAULT_SETTINGS, ...settingsRaw },
  };
}
