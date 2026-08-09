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

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.runId !== runId) return;

        switch (message.type) {
          case 'progress':
            onProgress({ phase: message.phase, fraction: message.fraction });
            break;
          case 'done':
            this.rejectActive = null;
            resolve({ result: message.result, suggestions: message.suggestions });
            break;
          case 'invalid':
            this.rejectActive = null;
            reject(new AnalysisInvalidError(message.issues));
            break;
          case 'error':
            this.rejectActive = null;
            reject(new Error(message.message));
            break;
        }
      };

      worker.onerror = () => {
        this.rejectActive = null;
        reject(new Error('The analysis worker failed to start.'));
      };

      worker.postMessage({ type: 'run', runId, carriers, settings });
    });
  }

  cancel(): void {
    if (this.worker === null) return;
    this.worker.terminate();
    this.worker = null;
    this.rejectActive?.(new AnalysisCancelledError());
    this.rejectActive = null;
  }

  dispose(): void {
    this.cancel();
  }
}
