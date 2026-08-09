import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  type Carrier,
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
}

function newId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialCarriers(): Carrier[] {
  return [
    { id: newId(), label: 'Mic 1', freqKHz: 510000 },
    { id: newId(), label: 'Mic 2', freqKHz: 530000 },
  ];
}

function loadFromStorage(): { name: string; carriers: Carrier[]; settings: Settings } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectFile>;
    if (!Array.isArray(parsed.carriers)) return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : 'Untitled',
      carriers: parsed.carriers,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return null;
  }
}

const restored = typeof localStorage === 'undefined' ? null : loadFromStorage();

export const useProjectStore = create<ProjectState>((set, get) => {
  const persist = (): void => {
    if (typeof localStorage === 'undefined') return;
    const { name, carriers, settings } = get();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, name, carriers, settings }),
      );
    } catch {
      // Storage is full or blocked; the in-memory project still works.
    }
  };

  const update = (partial: Partial<ProjectState>): void => {
    set(partial);
    persist();
  };

  return {
    name: restored?.name ?? 'Untitled',
    carriers: restored?.carriers ?? initialCarriers(),
    settings: restored?.settings ?? DEFAULT_SETTINGS,

    setName: (name) => update({ name }),

    addCarrier: () => {
      const carriers = get().carriers;
      update({
        carriers: [
          ...carriers,
          {
            id: newId(),
            label: `Mic ${carriers.length + 1}`,
            freqKHz: get().settings.bandMinKHz,
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
  };
});
