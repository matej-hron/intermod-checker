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
