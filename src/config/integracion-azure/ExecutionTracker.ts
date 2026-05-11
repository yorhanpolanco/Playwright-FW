import type { TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import type {
  ExecutionContext,
  StepRecord,
  TestAttemptRecord,
  EvidenceAttachment,
  TestOutcome,
} from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// ExecutionTracker
//
// Maintains per-test execution state across all retry attempts.
// Collects step records for repro-steps generation and evidences per attempt.
// Thread-safe via Map keyed by testId — each worker writes its own entry.
// ─────────────────────────────────────────────────────────────────────────────

export class ExecutionTracker {
  private readonly contexts = new Map<string, ExecutionContext>();

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  initTest(test: TestCase, tcId?: string): void {
    const key = this.key(test.id, 0);   // base slot for all retries
    if (this.contexts.has(key)) return;

    const describePath = test.titlePath().slice(0, -1).join(' > ');

    this.contexts.set(key, {
      testId:          test.id,
      testTitle:       test.title,
      testFile:        test.location?.file ?? '',
      describePath,
      tcId,
      attempts:        [],
      currentStepOrder: 0,
      activeSteps:     new Map(),
    });
  }

  beginAttempt(test: TestCase, result: TestResult): void {
    const ctx = this.getCtx(test.id);
    if (!ctx) return;

    // Reset per-attempt state
    ctx.currentStepOrder = 0;
    ctx.activeSteps      = new Map();
  }

  // ── Step tracking ──────────────────────────────────────────────────────────

  trackStep(test: TestCase, step: TestStep): void {
    const ctx = this.getCtx(test.id);
    if (!ctx || step.category !== 'test.step') return;

    ctx.currentStepOrder += 1;
    const stepId = step.title + ctx.currentStepOrder;

    const record: StepRecord = {
      title:     step.title,
      category:  step.category,
      status:    'running',
      startTime: step.startTime,
      duration:  0,
      order:     ctx.currentStepOrder,
    };

    ctx.activeSteps.set(stepId, record);
  }

  completeStep(test: TestCase, step: TestStep): void {
    const ctx = this.getCtx(test.id);
    if (!ctx || step.category !== 'test.step') return;

    const stepId = step.title + ctx.currentStepOrder;
    const record = ctx.activeSteps.get(stepId);
    if (!record) return;

    record.status   = step.error ? 'failed' : 'passed';
    record.duration = step.duration;
    record.error    = ExecutionTracker.stripAnsi(step.error?.message);
  }

  // ── Result recording ───────────────────────────────────────────────────────

  recordAttempt(
    test: TestCase,
    result: TestResult,
    evidences: EvidenceAttachment[],
  ): void {
    const ctx = this.getCtx(test.id);
    if (!ctx) return;

    const steps = this.drainActiveSteps(ctx);

    const attempt: TestAttemptRecord = {
      retry:        result.retry,
      status:       result.status as TestOutcome,
      errorMessage: ExecutionTracker.stripAnsi(result.error?.message),
      stackTrace:   ExecutionTracker.stripAnsi(result.error?.stack),
      duration:     result.duration,
      steps,
      evidences,
      startTime:    result.startTime,
      endTime:      new Date(result.startTime.getTime() + result.duration),
    };

    ctx.attempts.push(attempt);
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  getContext(testId: string): ExecutionContext | undefined {
    return this.contexts.get(this.key(testId, 0));
  }

  getFinalAttempt(testId: string): TestAttemptRecord | undefined {
    const ctx = this.getContext(testId);
    if (!ctx || ctx.attempts.length === 0) return undefined;
    return ctx.attempts[ctx.attempts.length - 1];
  }

  getAllAttempts(testId: string): TestAttemptRecord[] {
    return this.getContext(testId)?.attempts ?? [];
  }

  getStepsForAttempt(testId: string, retry: number): StepRecord[] {
    const ctx = this.getContext(testId);
    if (!ctx) return [];
    const attempt = ctx.attempts.find((a) => a.retry === retry);
    return attempt?.steps ?? [];
  }

  setResultId(testId: string, resultId: number): void {
    const ctx = this.getContext(testId);
    if (ctx) ctx.resultId = resultId;
  }

  setRunId(testId: string, runId: number): void {
    const ctx = this.getContext(testId);
    if (ctx) ctx.runId = runId;
  }

  cleanup(testId: string): void {
    this.contexts.delete(this.key(testId, 0));
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  // Removes ANSI escape codes that Playwright injects for terminal colorization.
  // Azure DevOps renders these as literal characters, making errors unreadable.
  private static stripAnsi(s: string | undefined): string | undefined {
    return s?.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  }

  private key(testId: string, _retry: number): string {
    return testId;
  }

  private getCtx(testId: string): ExecutionContext | undefined {
    return this.contexts.get(this.key(testId, 0));
  }

  private drainActiveSteps(ctx: ExecutionContext): StepRecord[] {
    const steps = [...ctx.activeSteps.values()].sort((a, b) => a.order - b.order);
    ctx.activeSteps = new Map();
    return steps;
  }
}
