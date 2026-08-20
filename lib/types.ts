// Hand-written row shapes for the tables the UI actually reads.
//
// Deliberately not the full generated Database type: this is the read surface,
// and keeping it small means a schema change that matters shows up as a type
// error somewhere meaningful rather than being absorbed by a giant any-ish blob.

export type JobStatus =
  | 'queued'
  | 'planning'
  | 'generating'
  | 'validating'
  | 'repairing'
  | 'packaging'
  | 'ready'
  | 'failed'
  | 'canceled';

/** Statuses that never change again. Used to stop polling and stop spinners. */
export const TERMINAL_STATUSES: JobStatus[] = ['ready', 'failed', 'canceled'];

export const isTerminal = (s: JobStatus) => TERMINAL_STATUSES.includes(s);

/** Display order of the happy path, for the progress rail. */
export const STAGE_ORDER: JobStatus[] = [
  'queued',
  'planning',
  'generating',
  'validating',
  'packaging',
  'ready',
];

export interface Job {
  id: string;
  owner: string;
  project_id: string | null;
  prompt: string;
  targets: string[];
  status: JobStatus;
  progress_note: string | null;
  error: string | null;
  ext_name: string | null;
  ext_slug: string | null;
  permissions: string[];
  host_permissions: string[];
  zip_path: string | null;
  zip_bytes: number | null;
  repo_url: string | null;
  n8n_execution_id: string | null;
  model: string | null;
  prompt_tokens: number | null;
  output_tokens: number | null;
  repair_attempts: number;
  validation_errors: string[] | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: number;
  job_id: string;
  stage: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface GeneratedFile {
  id: number;
  job_id: string;
  path: string;
  content: string;
  bytes: number;
  language: string | null;
  created_at: string;
}
