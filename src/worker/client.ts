import type {
  AnalysisResult,
  CandidateEvaluation,
  Carrier,
  CriterionKey,
  Settings,
  Suggestion,
  ValidationIssue,
} from '../im';
import type { WorkerRequest, WorkerResponse } from './protocol';

export interface WorkerProgress {
  phase: 'analyze' | 'suggest' | 'tune';
  fraction: number;
}

export interface WorkerRunResult {
  result: AnalysisResult;
  suggestions: Suggestion[];
}

export interface WorkerTuneResult {
  carrierId: string;
  currentKHz: number;
  criteria: CriterionKey[];
  evaluations: CandidateEvaluation[];
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

  private execute<T>(
    build: (runId: number) => WorkerRequest,
    onProgress: (progress: WorkerProgress) => void,
    extract: (message: WorkerResponse) => T | undefined,
  ): Promise<T> {
    this.cancel();

    const worker = createWorker();
    this.worker = worker;
    const runId = this.nextRunId;
    this.nextRunId += 1;

    return new Promise<T>((resolve, reject) => {
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

        if (message.type === 'progress') {
          onProgress({ phase: message.phase, fraction: message.fraction });
          return;
        }
        if (message.type === 'invalid') {
          finish();
          reject(new AnalysisInvalidError(message.issues));
          return;
        }
        if (message.type === 'error') {
          finish();
          reject(new Error(message.message));
          return;
        }

        const value = extract(message);
        if (value === undefined) return;
        finish();
        resolve(value);
      };

      worker.onerror = () => {
        finish();
        reject(new Error('The analysis worker failed to start.'));
      };

      worker.onmessageerror = () => {
        finish();
        reject(new Error('The analysis worker sent a message that could not be read.'));
      };

      worker.postMessage(build(runId));
    });
  }

  run(
    carriers: Carrier[],
    settings: Settings,
    onProgress: (progress: WorkerProgress) => void,
  ): Promise<WorkerRunResult> {
    return this.execute<WorkerRunResult>(
      (runId) => ({ type: 'run', runId, carriers, settings }),
      onProgress,
      (message) =>
        message.type === 'done'
          ? { result: message.result, suggestions: message.suggestions }
          : undefined,
    );
  }

  tune(
    carriers: Carrier[],
    settings: Settings,
    carrierId: string,
    halfWidthKHz: number,
    onProgress: (progress: WorkerProgress) => void,
  ): Promise<WorkerTuneResult> {
    return this.execute<WorkerTuneResult>(
      (runId) => ({ type: 'tune', runId, carriers, settings, carrierId, halfWidthKHz }),
      onProgress,
      (message) =>
        message.type === 'tune-done'
          ? {
              carrierId: message.carrierId,
              currentKHz: message.currentKHz,
              criteria: message.criteria,
              evaluations: message.evaluations,
            }
          : undefined,
    );
  }

  cancel(): void {
    if (this.worker === null) return;
    detach(this.worker);
    this.worker.terminate();
    this.worker = null;
    this.rejectActive?.(new AnalysisCancelledError());
    this.rejectActive = null;
  }
}
