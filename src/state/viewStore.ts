import { create } from 'zustand';
import { useTuneStore } from './tuneStore';

export type ViewName = 'setup' | 'results' | 'tune';

interface ViewState {
  view: ViewName;
  editingCarrierId: string | null;
  goTo: (view: ViewName) => void;
  openTune: (carrierId: string) => void;
  openCarrier: (carrierId: string) => void;
  closeCarrier: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'setup',
  editingCarrierId: null,
  goTo: (view) => set({ view }),
  openTune: (carrierId) => {
    useTuneStore.getState().select(carrierId);
    // Tune replaces the whole screen, so leaving the sheet open would reveal
    // it again on the way back, over a carrier the user has moved on from.
    set({ view: 'tune', editingCarrierId: null });
  },
  openCarrier: (carrierId) => set({ editingCarrierId: carrierId }),
  closeCarrier: () => set({ editingCarrierId: null }),
}));
