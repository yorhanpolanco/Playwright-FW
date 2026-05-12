// ─────────────────────────────────────────────────────────────────────────────
// Azure DevOps Integration — Shared Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

// ── Configuration ─────────────────────────────────────────────────────────────

export interface AzureConfiguration {
  org: string;
  project: string;
  pat: string;
  testPlanId: string;
  testSuiteId: string;
  apiVersion: string;
  maxRetries: number;
  enableBugCreation: boolean;
  enableTraceAttachments: boolean;
  tlsRejectUnauthorized: boolean;
}

// ── Azure DevOps REST API shapes ───────────────────────────────────────────────

export interface TestPoint {
  id: number;
  testCase: { id: string; name?: string };
  configuration?: { id: string; name: string };
  testPlan?: { id: string };
  testSuite?: { id: string };
}

export interface TestPointsResponse {
  value: TestPoint[];
  count: number;
}

export interface TestRun {
  id: number;
  name: string;
  state: string;
  url?: string;
}

export interface TestResultSummary {
  id: number;
  testCase: { id: string; name?: string };
  outcome?: string;
  state?: string;
  testRun?: { id: string };
}

export interface TestResultsResponse {
  value: TestResultSummary[];
  count: number;
}

export interface TestResultUpdate {
  id: number;
  state: 'Completed' | 'InProgress' | 'Queued';
  outcome: 'Passed' | 'Failed' | 'NotExecuted' | 'Blocked';
  comment?: string;
  errorMessage?: string;
  durationInMs?: number;
  startedDate?: string;
  completedDate?: string;
}

export interface TestResultAttachment {
  stream: string;   // base64-encoded
  fileName: string;
  comment?: string;
  attachmentType: 'GeneralAttachment' | 'ConsoleLog' | 'CodeCoverage';
}

export interface AttachmentUploadResult {
  id: string;
  url: string;
  fileName?: string;
}

export interface WitAttachmentUploadResult {
  id: string;
  url: string;
}

export interface WorkItem {
  id: number;
  rev?: number;
  fields: Record<string, unknown>;
  relations?: WorkItemRelation[];
  url?: string;
}

export interface WorkItemRelation {
  rel: string;
  url: string;
  attributes: {
    name?: string;
    comment?: string;
    isLocked?: boolean;
    [key: string]: unknown;
  };
}

export interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: unknown;
  from?: string;
}

export interface WiqlQuery {
  query: string;
}

export interface WiqlResult {
  queryType: string;
  workItems: Array<{ id: number; url: string }>;
}

// ── Execution tracking ─────────────────────────────────────────────────────────

export type TestOutcome = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

export interface StepRecord {
  title: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  error?: string;
  startTime: Date;
  duration: number;
  order: number;
}

export interface EvidenceAttachment {
  name: string;
  path?: string;
  body?: Buffer;
  contentType: string;
}

export interface TestAttemptRecord {
  retry: number;
  status: TestOutcome;
  errorMessage?: string;
  stackTrace?: string;
  duration: number;
  steps: StepRecord[];
  evidences: EvidenceAttachment[];
  startTime: Date;
  endTime: Date;
}

export interface ExecutionContext {
  testId: string;
  testTitle: string;
  testFile: string;
  describePath: string;
  tcId?: string;
  runId?: number;
  resultId?: number;
  attempts: TestAttemptRecord[];
  currentStepOrder: number;
  activeSteps: Map<string, StepRecord>;
}

// ── Flaky detection ────────────────────────────────────────────────────────────

export interface FlakyAnalysis {
  isFlaky: boolean;
  confidence: number;
  reason?: string;
  passedOnAttempt?: number;
}

// ── Error fingerprinting ───────────────────────────────────────────────────────

export type ErrorCategory =
  | 'assertion'
  | 'timeout'
  | 'network'
  | 'element-not-found'
  | 'navigation'
  | 'infrastructure'
  | 'unknown';

export interface ErrorFingerprint {
  hash: string;
  normalizedMessage: string;
  errorType: string;
  errorCategory: ErrorCategory;
  stepContext: string[];
  rawMessage: string;
}

// ── Defect / bug tracking ──────────────────────────────────────────────────────

export interface ExistingBug {
  id: number;
  title: string;
  state: string;
  fingerprint?: string;
  testCaseId?: string;
  url?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingBug?: ExistingBug;
  level?: 'cache' | 'azure' | 'similarity';
}

export interface BugCreationRequest {
  title: string;
  description?: string;
  reproSteps: string;
  systemInfo?: string;
  severity: string;
  priority: number;
  testCaseId?: string;
  runId?: number;
  resultId?: number;
  fingerprint: string;
  stackTrace?: string;
}

export interface CreatedBug {
  id: number;
  title: string;
  url: string;
  fingerprint: string;
}

// ── Publisher context ──────────────────────────────────────────────────────────

export interface PublishContext {
  testId: string;
  testTitle: string;
  testFile: string;
  tcId: string;
  runId: number;
  resultId: number;
  status: TestOutcome;
  finalAttempt: TestAttemptRecord;
  allAttempts: TestAttemptRecord[];
  steps: StepRecord[];
  fingerprint?: ErrorFingerprint;
  flakyAnalysis?: FlakyAnalysis;
}

// ── Reporter initialization ────────────────────────────────────────────────────

export interface TcRunMapping {
  tcId: string;
  pointId: number;
  resultId?: number;
}
