// ─────────────────────────────────────────────────────────────────────────────
// Public API — Azure DevOps Integration
// ─────────────────────────────────────────────────────────────────────────────

// Reporter (primary integration point — register in playwright.config.ts)
export { default as AzureIntegrationReporter } from './AzureIntegrationReporter';

// Configuration
export { loadAzureConfig, isAzureConfigured, isAzureIntegrationEnabled, resetAzureConfig } from './AzureConfig';

// Core client
export { AzureDevOpsClient } from './AzureDevOpsClient';

// Services (usable independently)
export { TestCaseResolver, extractTcIdsFromTags } from './TestCaseResolver';
export { ExecutionTracker }        from './ExecutionTracker';
export { FlakyDetector }           from './FlakyDetector';
export { EvidenceCollector }       from './EvidenceCollector';
export { AttachmentService }       from './AttachmentService';
export { TestResultService }       from './TestResultService';
export { ErrorFingerprintService } from './ErrorFingerprintService';
export { ActiveDefectRegistry }    from './ActiveDefectRegistry';
export { DuplicateBugDetector }    from './DuplicateBugDetector';
export { BugManager }              from './BugManager';
export { ResultPublisher }         from './ResultPublisher';

// Types
export type {
  AzureConfiguration,
  TestPoint,
  TestRun,
  TestResultSummary,
  TestResultUpdate,
  WorkItem,
  WorkItemRelation,
  JsonPatchOperation,
  ExistingBug,
  DuplicateCheckResult,
  BugCreationRequest,
  CreatedBug,
  ErrorFingerprint,
  ErrorCategory,
  FlakyAnalysis,
  TestAttemptRecord,
  StepRecord,
  EvidenceAttachment,
  ExecutionContext,
  PublishContext,
  TestOutcome,
  TcRunMapping,
} from './types/azure.types';
