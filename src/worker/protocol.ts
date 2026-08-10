import type {
  AnalysisResult,
  CandidateEvaluation,
  Carrier,
  CriterionKey,
  Settings,
  Suggestion,
  ValidationIssue,
} from '../im';

export interface RunRequest {
  type: 'run';
  runId: number;
  carriers: Carrier[];
  settings: Settings;
}

export interface TuneRequest {
  type: 'tune';
  runId: number;
  carriers: Carrier[];
  settings: Settings;
  carrierId: string;
  halfWidthKHz: number;
}

export type WorkerRequest = RunRequest | TuneRequest;

export interface ProgressResponse {
  type: 'progress';
  runId: number;
  phase: 'analyze' | 'suggest' | 'tune';
  fraction: number;
}

export interface DoneResponse {
  type: 'done';
  runId: number;
  result: AnalysisResult;
  suggestions: Suggestion[];
}

export interface InvalidResponse {
  type: 'invalid';
  runId: number;
  issues: ValidationIssue[];
}

export interface ErrorResponse {
  type: 'error';
  runId: number;
  message: string;
}

export interface TuneDoneResponse {
  type: 'tune-done';
  runId: number;
  carrierId: string;
  currentKHz: number;
  /** Interference criteria worth a column, already filtered and ordered. */
  criteria: CriterionKey[];
  /** Sorted by ascending frequency, ready to render. */
  evaluations: CandidateEvaluation[];
}

export type WorkerResponse =
  | ProgressResponse
  | DoneResponse
  | InvalidResponse
  | ErrorResponse
  | TuneDoneResponse;
