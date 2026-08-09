import { create } from 'zustand';
import type {
  AnalysisResult,
  Carrier,
  Settings,
  Suggestion,
  ValidationIssue,
} from '../im';
import {
  AnalysisCancelledError,
  AnalysisClient,
  AnalysisInvalidError,
  type WorkerProgress,
} from '../worker/client';

const client = new AnalysisClient();

type Status = 'idle' | 'running' | 'done' | 'error';

interface AnalysisState {
  status: Status;
  progress: WorkerProgress | null;
  result: AnalysisResult | null;
  suggestions: Suggestion[];
  issues: ValidationIssue[];
  errorMessage: string | null;
  run: (carriers: Carrier[], settings: Settings) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

// `AnalysisClient.run()` synchronously cancels any prior in-flight request,
// which rejects the *previous* call's promise. That rejection is only
// delivered as a queued microtask, so it lands after this (newer) call has
// already set `status: 'running'`. Without a guard, the stale rejection
// handler would then stomp the newer state back to `idle`/`error`. `runToken`
// lets each call recognise when it has been superseded and bail out before
// touching shared state.
let runToken = 0;

export const useAnalysisStore = create<AnalysisState>((set) => ({
  status: 'idle',
  progress: null,
  result: null,
  suggestions: [],
  issues: [],
  errorMessage: null,

  run: async (carriers, settings) => {
    const token = (runToken += 1);

    set({
      status: 'running',
      progress: { phase: 'analyze', fraction: 0 },
      result: null,
      suggestions: [],
      issues: [],
      errorMessage: null,
    });

    try {
      const { result, suggestions } = await client.run(
        carriers,
        settings,
        (progress) => {
          if (token !== runToken) return;
          set({ progress });
        },
      );
      if (token !== runToken) return;
      set({ status: 'done', result, suggestions, progress: null });
    } catch (error) {
      if (token !== runToken) return;
      if (error instanceof AnalysisCancelledError) {
        set({ status: 'idle', progress: null });
        return;
      }
      if (error instanceof AnalysisInvalidError) {
        set({
          status: 'error',
          issues: error.issues,
          progress: null,
          errorMessage: 'Fix the highlighted problems and run again.',
        });
        return;
      }
      set({
        status: 'error',
        progress: null,
        errorMessage:
          error instanceof Error ? error.message : 'The analysis failed.',
      });
    }
  },

  cancel: () => client.cancel(),

  clear: () =>
    set({
      status: 'idle',
      progress: null,
      result: null,
      suggestions: [],
      issues: [],
      errorMessage: null,
    }),
}));
