import { create } from 'zustand';
import { useAnalysisStore } from './analysisStore';
import { useTuneStore } from './tuneStore';
import { useViewStore } from './viewStore';
import {
  DEFAULT_SETTINGS,
  normalizeExclusion,
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
  type Exclusion,
  type Library,
  type ProjectFile,
  type Settings,
  type Suggestion,
} from '../im';

const STORAGE_KEY = 'intermod-checker:project:v1'; // legacy, read once, never written
const LIBRARY_KEY = 'intermod-checker:library:v1';

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  carrierCount: number;
}

interface ProjectState {
  library: Library;
  projects: ProjectSummary[];
  activeProjectId: string;
  libraryFull: boolean;
  name: string;
  carriers: Carrier[];
  settings: Settings;
  setName: (name: string) => void;
  addCarrier: () => string;
  updateCarrier: (id: string, patch: Partial<Omit<Carrier, 'id'>>) => void;
  removeCarrier: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  loadProject: (file: ProjectFile) => void;
  applySuggestions: (suggestions: Suggestion[]) => void;
  newProject: () => void;
  selectProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  importAsProject: (file: ProjectFile) => void;
  addExclusion: () => void;
  updateExclusion: (id: string, patch: Partial<Omit<Exclusion, 'id'>>) => void;
  removeExclusion: (id: string) => void;
}

function newId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialCarriers(): Carrier[] {
  return [
    { id: newId(), label: 'Mic 1', freqKHz: 510000, locked: false },
    { id: newId(), label: 'Mic 2', freqKHz: 530000, locked: false },
  ];
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

function summarize(lib: Library): ProjectSummary[] {
  return [...lib.projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((p) => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, carrierCount: p.carriers.length }));
}

const writeLibrary = (lib: Library): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LIBRARY_KEY, serializeLibrary(lib));
  } catch {
    // Storage is full or blocked; the in-memory library still works.
  }
};

const initialLibrary = loadLibrary();
const initialActive = activeProject(initialLibrary);

export const useProjectStore = create<ProjectState>((set, get) => {
  const persist = (): void => {
    const { library, activeProjectId, name, carriers, settings } = get();
    const next = touchProject(library, activeProjectId, name, carriers, settings, Date.now());
    set({ library: next, projects: summarize(next) });
    writeLibrary(next);
  };

  // Any change to the carriers or settings invalidates the last analysis: the
  // results describe the frequencies they were computed from, and rendering
  // them beside edited ones produces confident statements that were never true
  // (a conflict verdict attached to a frequency it was never computed for).
  const update = (partial: Partial<ProjectState>): void => {
    set(partial);
    persist();
    useAnalysisStore.getState().clear();
    useTuneStore.getState().clear();
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

  // Renaming changes nothing the analysis depends on, so it must not discard
  // a result the user is still reading.
  const updateMeta = (partial: Partial<ProjectState>): void => {
    set(partial);
    persist();
  };

  return {
    library: initialLibrary,
    projects: summarize(initialLibrary),
    activeProjectId: initialActive.id,
    libraryFull: isFull(initialLibrary),
    name: initialActive.name,
    carriers: initialActive.carriers,
    settings: initialActive.settings,

    setName: (name) => {
      const { activeProjectId, library } = get();
      const next = renameProject(library, activeProjectId, name, Date.now());
      updateMeta({ name, library: next, projects: summarize(next) });
    },

    addCarrier: () => {
      const carriers = get().carriers;
      const id = newId();
      update({
        carriers: [
          ...carriers,
          {
            id,
            label: `Mic ${carriers.length + 1}`,
            freqKHz: get().settings.bandMinKHz,
            locked: false,
          },
        ],
      });
      return id;
    },

    updateCarrier: (id, patch) => {
      update({
        carriers: get().carriers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
    },

    removeCarrier: (id) => {
      update({ carriers: get().carriers.filter((c) => c.id !== id) });
    },

    setSettings: (patch) => update({ settings: { ...get().settings, ...patch } }),

    resetSettings: () => update({ settings: DEFAULT_SETTINGS }),

    loadProject: (file) =>
      update({
        name: file.name,
        carriers: file.carriers,
        settings: file.settings,
      }),

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

    deleteProject: (id) =>
      openFromLibrary(deleteProject(get().library, id, Date.now(), newId(), initialCarriers())),

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

    applySuggestions: (suggestions) => {
      const byId = new Map(
        suggestions
          .filter((s) => s.toKHz !== null)
          .map((s) => [s.carrierId, s.toKHz as number]),
      );
      update({
        carriers: get().carriers.map((c) =>
          byId.has(c.id) ? { ...c, freqKHz: byId.get(c.id) as number } : c,
        ),
      });
    },

    addExclusion: () => {
      const { settings } = get();
      const middle = Math.round((settings.bandMinKHz + settings.bandMaxKHz) / 2);
      update({
        settings: {
          ...settings,
          exclusions: [
            ...settings.exclusions,
            {
              id: newId(),
              label: `Excluded range ${settings.exclusions.length + 1}`,
              startKHz: middle,
              endKHz: middle + 1000,
            },
          ],
        },
      });
    },

    updateExclusion: (id, patch) => {
      const { settings } = get();
      update({
        settings: {
          ...settings,
          exclusions: settings.exclusions.map((e) =>
            e.id === id ? normalizeExclusion({ ...e, ...patch }) : e,
          ),
        },
      });
    },

    removeExclusion: (id) => {
      const { settings } = get();
      update({
        settings: {
          ...settings,
          exclusions: settings.exclusions.filter((e) => e.id !== id),
        },
      });
    },
  };
});
