import { create } from 'zustand';
import { useTuneStore } from './tuneStore';

export type ViewName = 'setup' | 'results' | 'tune';

interface ViewState {
  view: ViewName;
  goTo: (view: ViewName) => void;
  openTune: (carrierId: string) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'setup',
  goTo: (view) => set({ view }),
  openTune: (carrierId) => {
    useTuneStore.getState().select(carrierId);
    set({ view: 'tune' });
  },
}));
