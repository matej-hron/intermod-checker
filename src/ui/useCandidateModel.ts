import { useMemo } from 'react';
import type { CandidateEvaluation, Carrier, CriterionKey } from '../im';
import { useAnalysisStore } from '../state/analysisStore';
import { useProjectStore } from '../state/projectStore';
import { useTuneStore } from '../state/tuneStore';
import { nearestClearKHz } from './candidateModel';

export interface CandidateModel {
  evaluations: CandidateEvaluation[];
  criteria: CriterionKey[];
  currentKHz: number | null;
  showExclusion: boolean;
  nearestClear: number | null;
  locked: boolean;
  apply: (freqKHz: number) => void;
}

export function useCandidateModel(carrier: Carrier): CandidateModel {
  const settings = useProjectStore((s) => s.settings);
  const updateCarrier = useProjectStore((s) => s.updateCarrier);
  const evaluations = useTuneStore((s) => s.evaluations);
  const criteria = useTuneStore((s) => s.criteria);
  const currentKHz = useTuneStore((s) => s.currentKHz);

  const nearestClear = useMemo(
    () => nearestClearKHz(evaluations, currentKHz),
    [evaluations, currentKHz],
  );

  const apply = (freqKHz: number): void => {
    if (carrier.locked) return;
    updateCarrier(carrier.id, { freqKHz });
    // A displayed verdict must always describe the real configuration, so the
    // analysis is re-run against the frequencies that are now actually set.
    const { carriers, settings: next } = useProjectStore.getState();
    void useAnalysisStore.getState().run(carriers, next);
  };

  return {
    evaluations,
    criteria,
    currentKHz,
    showExclusion: settings.exclusions.length > 0,
    nearestClear,
    locked: carrier.locked,
    apply,
  };
}
