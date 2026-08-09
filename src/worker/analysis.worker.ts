import { analyze, suggest, validate } from '../im';
import type { WorkerRequest, WorkerResponse } from './protocol';

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type !== 'run') return;

  const { runId, carriers, settings } = request;

  try {
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
  } catch (error) {
    post({
      type: 'error',
      runId,
      message: error instanceof Error ? error.message : 'Analysis failed.',
    });
  }
};
