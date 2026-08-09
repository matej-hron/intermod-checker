import type {
  AnalysisResult,
  Carrier,
  Settings,
  Suggestion,
  ValidationIssue,
} from '../im';
import type { WorkerResponse } from './protocol';

export interface WorkerProgress {
  phase: 'analyze' | 'suggest';
  fraction: number;
}

export interface WorkerRunResult {
  result: AnalysisResult;
  suggestions: Suggestion[];
}

export class AnalysisCancelledError extends Error {
  constructor() {
    super('Analysis cancelled.');
    this.name = 'AnalysisCancelledError';
  }
}

export class AnalysisInvalidError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super('The input is not analysable.');
    this.name = 'AnalysisInvalidError';
    this.issues = issues;
  }
}

function detach(worker: Worker): void {
  worker.onmessage = null;
  worker.onerror = null;
  worker.onmessageerror = null;
}

function createWorker(): Worker {
  return new Worker(new URL('./analysis.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export class AnalysisClient {
  private worker: Worker | null = null;
  private nextRunId = 1;
  private rejectActive: ((reason: Error) => void) | null = null;

  run(
    carriers: Carrier[],
    settings: Settings,
    onProgress: (progress: WorkerProgress) => void,
  ): Promise<WorkerRunResult> {
    this.cancel();

    const worker = createWorker();
    this.worker = worker;
    const runId = this.nextRunId;
    this.nextRunId += 1;

    return new Promise<WorkerRunResult>((resolve, reject) => {
      this.rejectActive = reject;

      // Called on every settling path so a terminated worker can never deliver
      // a late progress tick to a caller that has already moved on.
      const finish = () => {
        detach(worker);
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        this.rejectActive = null;
      };

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.runId !== runId) return;

        switch (message.type) {
          case 'progress':
            onProgress({ phase: message.phase, fraction: message.fraction });
            break;
          case 'done':
            finish();
            resolve({ result: message.result, suggestions: message.suggestions });
            break;
          case 'invalid':
            finish();
            reject(new AnalysisInvalidError(message.issues));
            break;
          case 'error':
            finish();
            reject(new Error(message.message));
            break;
        }
      };

      worker.onerror = () => {
        finish();
        reject(new Error('The analysis worker failed to start.'));
      };

      worker.onmessageerror = () => {
        finish();
        reject(new Error('The analysis worker sent a message that could not be read.'));
      };

      worker.postMessage({ type: 'run', runId, carriers, settings });
    });
  }

  cancel(): void {
    if (this.worker === null) return;
    detach(this.worker);
    this.worker.terminate();
    this.worker = null;
    this.rejectActive?.(new AnalysisCancelledError());
    this.rejectActive = null;
  }

  dispose(): void {
    this.cancel();
  }
}
