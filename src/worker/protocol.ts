import type {
  AnalysisResult,
  Carrier,
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

export type WorkerRequest = RunRequest;

export interface ProgressResponse {
  type: 'progress';
  runId: number;
  phase: 'analyze' | 'suggest';
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

export type WorkerResponse =
  | ProgressResponse
  | DoneResponse
  | InvalidResponse
  | ErrorResponse;
