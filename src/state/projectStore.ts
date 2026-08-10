import { create } from 'zustand';
import { useAnalysisStore } from './analysisStore';
import { useTuneStore } from './tuneStore';
import {
  DEFAULT_SETTINGS,
  PROJECT_VERSION,
  normalizeExclusion,
  parseProject,
  type Carrier,
  type Exclusion,
  type ProjectFile,
  type Settings,
  type Suggestion,
} from '../im';

const STORAGE_KEY = 'intermod-checker:project:v1';

interface ProjectState {
  name: string;
  carriers: Carrier[];
  settings: Settings;
  setName: (name: string) => void;
  addCarrier: () => void;
  updateCarrier: (id: string, patch: Partial<Omit<Carrier, 'id'>>) => void;
  removeCarrier: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
  loadProject: (file: ProjectFile) => void;
  applySuggestions: (suggestions: Suggestion[]) => void;
  newProject: () => void;
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

function loadFromStorage(): { name: string; carriers: Carrier[]; settings: Settings } | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  // Restored storage is as untrusted as an imported file: it can be a partial
  // write or a schema from an older build. Reuse the same parser so both paths
  // enforce identical guarantees.
  const parsed = parseProject(raw);
  if ('error' in parsed) return null;
  return { name: parsed.name, carriers: parsed.carriers, settings: parsed.settings };
}

const restored = typeof localStorage === 'undefined' ? null : loadFromStorage();

export const useProjectStore = create<ProjectState>((set, get) => {
  const persist = (): void => {
    if (typeof localStorage === 'undefined') return;
    const { name, carriers, settings } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: PROJECT_VERSION, name, carriers, settings }),
      );
    } catch {
      // Storage is full or blocked; the in-memory project still works.
    }
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

  // Renaming changes nothing the analysis depends on, so it must not discard
  // a result the user is still reading.
  const updateMeta = (partial: Partial<ProjectState>): void => {
    set(partial);
    persist();
  };

  return {
    name: restored?.name ?? 'Untitled',
    carriers: restored?.carriers ?? initialCarriers(),
    settings: restored?.settings ?? { ...DEFAULT_SETTINGS, exclusions: [] },

    setName: (name) => updateMeta({ name }),

    addCarrier: () => {
      const carriers = get().carriers;
      update({
        carriers: [
          ...carriers,
          {
            id: newId(),
            label: `Mic ${carriers.length + 1}`,
            freqKHz: get().settings.bandMinKHz,
            locked: false,
          },
        ],
      });
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

    newProject: () =>
      update({
        name: 'Untitled',
        carriers: initialCarriers(),
        settings: DEFAULT_SETTINGS,
      }),

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
