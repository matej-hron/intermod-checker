import {
  analyze,
  evaluateCandidate,
  generateCandidates,
  realizableCriteria,
  suggest,
  validate,
} from '../im';
import type { RunRequest, TuneRequest, WorkerRequest, WorkerResponse } from './protocol';

const TUNE_PROGRESS_INTERVAL = 8;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function handleRun(request: RunRequest): void {
  const { runId, carriers, settings } = request;
  const issues = validate(carriers, settings);
  if (issues.length > 0) {
    post({ type: 'invalid', runId, issues });
    return;
  }

  const result = analyze(carriers, settings, (fraction) => {
    post({ type: 'progress', runId, phase: 'analyze', fraction });
  });

  const suggestions = suggest(carriers, settings, (fraction) => {
    post({ type: 'progress', runId, phase: 'suggest', fraction });
  });

  post({ type: 'done', runId, result, suggestions });
}

function handleTune(request: TuneRequest): void {
  const { runId, carriers, settings, carrierId, halfWidthKHz } = request;
  const issues = validate(carriers, settings);
  if (issues.length > 0) {
    post({ type: 'invalid', runId, issues });
    return;
  }

  const index = carriers.findIndex((c) => c.id === carrierId);
  if (index === -1) {
    post({ type: 'error', runId, message: 'That transmitter is no longer in the list.' });
    return;
  }

  const freqs = carriers.map((c) => c.freqKHz);
  const currentKHz = freqs[index];
  const candidates = generateCandidates(currentKHz, settings, halfWidthKHz);

  const evaluations = candidates.map((candidateKHz, i) => {
    const evaluation = evaluateCandidate(
      freqs,
      index,
      candidateKHz,
      settings,
      carriers,
      'full',
    );
    if ((i + 1) % TUNE_PROGRESS_INTERVAL === 0) {
      post({
        type: 'progress',
        runId,
        phase: 'tune',
        fraction: (i + 1) / candidates.length,
      });
    }
    return evaluation;
  });

  // Generation is nearest-first; display is ascending by frequency (spec §4.5).
  evaluations.sort((a, b) => a.freqKHz - b.freqKHz);

  // An always-clear column is noise, so only criteria something actually fell
  // into get a column (spec §4.1). Computed here, once, so the column set does
  // not shift as the user scrolls.
  const criteria = realizableCriteria(settings).filter((key) =>
    evaluations.some((e) => e.verdicts[key] !== 'clear'),
  );

  post({ type: 'tune-done', runId, carrierId, currentKHz, criteria, evaluations });
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'run') handleRun(request);
    else if (request.type === 'tune') handleTune(request);
  } catch (error) {
    post({
      type: 'error',
      runId: request.runId,
      message: error instanceof Error ? error.message : 'Analysis failed.',
    });
  }
};
