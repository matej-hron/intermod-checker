import { create } from 'zustand';
import {
  DEFAULT_TUNE_HALF_WIDTH_KHZ,
  widenHalfWidth,
  type CandidateEvaluation,
  type Carrier,
  type CriterionKey,
  type Settings,
  type ValidationIssue,
} from '../im';
import {
  AnalysisCancelledError,
  AnalysisClient,
  AnalysisInvalidError,
} from '../worker/client';

// A dedicated client, not the analysis store's: `AnalysisClient` allows one
// in-flight request, so sharing it would make opening the Tune view cancel a
// running analysis and vice versa.
const client = new AnalysisClient();

type Status = 'idle' | 'running' | 'done' | 'error';

interface TuneState {
  carrierId: string | null;
  halfWidthKHz: number;
  status: Status;
  fraction: number;
  currentKHz: number | null;
  criteria: CriterionKey[];
  evaluations: CandidateEvaluation[];
  issues: ValidationIssue[];
  errorMessage: string | null;
  select: (carrierId: string) => void;
  run: (carriers: Carrier[], settings: Settings) => Promise<void>;
  widen: (carriers: Carrier[], settings: Settings) => Promise<void>;
  clear: () => void;
  reset: () => void;
}

// Same hazard as the analysis store: `client.tune()` cancels the previous
// request synchronously but its rejection lands as a microtask, after the newer
// call has already set `status: 'running'`. The token lets a superseded call
// recognise itself and leave shared state alone.
let runToken = 0;

const EMPTY = {
  status: 'idle' as Status,
  fraction: 0,
  currentKHz: null,
  criteria: [] as CriterionKey[],
  evaluations: [] as CandidateEvaluation[],
  issues: [] as ValidationIssue[],
  errorMessage: null,
};

export const useTuneStore = create<TuneState>((set, get) => ({
  carrierId: null,
  halfWidthKHz: DEFAULT_TUNE_HALF_WIDTH_KHZ,
  ...EMPTY,

  select: (carrierId) => {
    runToken += 1;
    client.cancel();
    set({ carrierId, halfWidthKHz: DEFAULT_TUNE_HALF_WIDTH_KHZ, ...EMPTY });
  },

  run: async (carriers, settings) => {
    const carrierId = get().carrierId;
    if (carrierId === null) return;
    const halfWidthKHz = get().halfWidthKHz;
    const token = (runToken += 1);

    set({ ...EMPTY, status: 'running' });

    try {
      const result = await client.tune(
        carriers,
        settings,
        carrierId,
        halfWidthKHz,
        ({ fraction }) => {
          if (token !== runToken) return;
          set({ fraction });
        },
      );
      if (token !== runToken) return;
      set({
        status: 'done',
        fraction: 1,
        currentKHz: result.currentKHz,
        criteria: result.criteria,
        evaluations: result.evaluations,
      });
    } catch (error) {
      if (token !== runToken) return;
      if (error instanceof AnalysisCancelledError) {
        set({ status: 'idle', fraction: 0 });
        return;
      }
      if (error instanceof AnalysisInvalidError) {
        set({
          status: 'error',
          issues: error.issues,
          errorMessage: 'Fix the highlighted problems before tuning.',
        });
        return;
      }
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Tuning failed.',
      });
    }
  },

  widen: async (carriers, settings) => {
    set({ halfWidthKHz: widenHalfWidth(get().halfWidthKHz, settings) });
    await get().run(carriers, settings);
  },

  // Results describe the frequencies they were computed from. Any edit
  // invalidates them, but the carrier being tuned stays selected so the view
  // can immediately recompute rather than dumping the user back to an
  // empty screen.
  clear: () => {
    runToken += 1;
    client.cancel();
    set({ ...EMPTY });
  },

  reset: () => {
    runToken += 1;
    client.cancel();
    set({ carrierId: null, halfWidthKHz: DEFAULT_TUNE_HALF_WIDTH_KHZ, ...EMPTY });
  },
}));
