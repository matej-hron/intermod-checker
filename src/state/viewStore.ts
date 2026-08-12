import { create } from 'zustand';
import type { Carrier } from '../im';
import { useTuneStore } from './tuneStore';

export type ViewName = 'setup' | 'results' | 'tune';

export interface PendingDelete {
  carrier: Carrier;
  index: number;
  /** Monotonic, so a second delete restarts the undo timer instead of
   *  inheriting the first one's remaining time. */
  token: number;
}

interface ViewState {
  view: ViewName;
  editingCarrierId: string | null;
  pendingDelete: PendingDelete | null;
  goTo: (view: ViewName) => void;
  openTune: (carrierId: string) => void;
  openCarrier: (carrierId: string) => void;
  closeCarrier: () => void;
  requestUndo: (carrier: Carrier, index: number) => void;
  clearPendingDelete: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'setup',
  editingCarrierId: null,
  pendingDelete: null,
  goTo: (view) => set({ view }),
  openTune: (carrierId) => {
    useTuneStore.getState().select(carrierId);
    // Tune replaces the whole screen, so leaving the sheet open would reveal
    // it again on the way back, over a carrier the user has moved on from.
    set({ view: 'tune', editingCarrierId: null });
  },
  openCarrier: (carrierId) => set({ editingCarrierId: carrierId }),
  closeCarrier: () => set({ editingCarrierId: null }),
  requestUndo: (carrier, index) =>
    set((s) => ({
      pendingDelete: { carrier, index, token: (s.pendingDelete?.token ?? 0) + 1 },
    })),
  clearPendingDelete: () => set({ pendingDelete: null }),
}));
