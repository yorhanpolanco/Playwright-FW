import type {
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
  FullConfig,
  FullResult,
} from '@playwright/test/reporter';

import Logs from '../logConfig';
import { loadAzureConfig, isAzureConfigured, isAzureIntegrationEnabled } from './AzureConfig';
import { AzureDevOpsClient }       from './AzureDevOpsClient';
import { TestCaseResolver }        from './TestCaseResolver';
import { ExecutionTracker }        from './ExecutionTracker';
import { FlakyDetector }           from './FlakyDetector';
import { EvidenceCollector }       from './EvidenceCollector';
import { AttachmentService }       from './AttachmentService';
import { TestResultService }       from './TestResultService';
import { ErrorFingerprintService } from './ErrorFingerprintService';
import { ActiveDefectRegistry }    from './ActiveDefectRegistry';
import { DuplicateBugDetector }    from './DuplicateBugDetector';
import { BugManager }              from './BugManager';
import { ResultPublisher }         from './ResultPublisher';

// ─────────────────────────────────────────────────────────────────────────────
// AzureIntegrationReporter
//
// Playwright Reporter that integrates the full test run with Azure DevOps
// Test Plans. All Azure operations are fail-safe: any exception is caught and
// logged so the test runner is never blocked by Azure failures.
//
// Lifecycle hooks:
//  onBegin(config, suite)    → build TC mapping (sync), kick off run creation
//  onTestBegin(test, result) → init tracking for this test/attempt
//  onStepBegin(...)          → record step start  (sync hook → void Logs)
//  onStepEnd(...)            → record step end    (sync hook → void Logs)
//  onTestEnd(test, result)   → async → await Logs, publish on final attempt
//  onEnd(suite, result)      → async → close run
//
// Note on void vs await for Logs calls:
//   Sync hooks (onTestBegin, onStepBegin, onStepEnd) CANNOT return a Promise,
//   so void is unavoidable there. Async methods use await to preserve ordering.
// ─────────────────────────────────────────────────────────────────────────────

export default class AzureIntegrationReporter implements Reporter {

  private client!:        AzureDevOpsClient;
  private resolver!:      TestCaseResolver;
  private tracker!:       ExecutionTracker;
  private flakyDetector!: FlakyDetector;
  private evidence!:      EvidenceCollector;
  private attachSvc!:     AttachmentService;
  private resultSvc!:     TestResultService;
  private fingerprinter!: ErrorFingerprintService;
  private registry!:      ActiveDefectRegistry;
  private dupDetector!:   DuplicateBugDetector;
  private bugMgr!:        BugManager;
  private publisher!:     ResultPublisher;

  private initPromise: Promise<void> | null = null;
  private enabled = false;

  // ── onBegin ────────────────────────────────────────────────────────────────

  onBegin(_config: FullConfig, suite: Suite): void {
    if (!isAzureIntegrationEnabled()) {
      void Logs.agregarLineaAlLog(
        '[Azure] Integración deshabilitada (AZURE_DEVOPS_INTEGRATION_ENABLED=false) — ' +
        'no se ejecutarán operaciones Azure DevOps',
      );
      return;
    }

    if (!isAzureConfigured()) {
      void Logs.agregarLineaAlLog(
        '[Azure] Variables de entorno no configuradas — integración deshabilitada',
      );
      return;
    }

    this.enabled = true;
    this.bootstrapServices();

    // Sync: builds the entire testId→tcId + iterationIndex maps
    this.resolver.buildMapping(suite);

    const allTcIds = this.resolver.getAllTcIds();
    void Logs.agregarLineaAlLogHeader(
      `[Azure] Integración iniciada — ${allTcIds.length} Test Case(s): TC${allTcIds.join(', TC')}`,
    );

    // Async init runs in background; onTestEnd awaits before publishing
    this.initPromise = this.resultSvc
      .initialize(allTcIds)
      .catch((err) => {
        void Logs.agregarLineaAlLog(
          `[Azure] Error crítico en init: ${err instanceof Error ? err.message : err}`,
        );
      });
  }

  // ── onTestBegin ────────────────────────────────────────────────────────────
  // Sync hook — void is required; cannot return Promise.

  onTestBegin(test: TestCase, result: TestResult): void {
    if (!this.enabled) return;
    const tcId = this.resolver.resolveTcId(test.id);
    this.tracker.initTest(test, tcId);
    this.tracker.beginAttempt(test, result);
  }

  // ── onStepBegin ────────────────────────────────────────────────────────────
  // Sync hook — void is required.

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep): void {
    if (!this.enabled) return;
    this.tracker.trackStep(test, step);
  }

  // ── onStepEnd ─────────────────────────────────────────────────────────────
  // Sync hook — void is required.

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    if (!this.enabled) return;
    this.tracker.completeStep(test, step);
  }

  // ── onTestEnd ─────────────────────────────────────────────────────────────

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    if (!this.enabled) return;

    // Resolve TC ID and execution index (data-driven iteration, 1-based).
    // executionIndex is undefined for single-iteration TCs so that names stay clean.
    const tcId           = this.resolver.resolveTcId(test.id);
    const executionIndex = (tcId && this.resolver.isMultiIteration(tcId))
      ? this.resolver.getIterationIndex(test.id) + 1   // 1-based
      : undefined;

    // Collect evidences for THIS attempt with original names.
    // Retry indexing (_1, _2, _3) is applied at publish time only when multiple
    // attempts exist, so single-attempt tests keep clean filenames (screenshot.png).
    const evidences = this.evidence.collect(result);

    // Record attempt in the tracker
    this.tracker.recordAttempt(test, result, evidences);

    // Skip if more retries will follow
    if (!AzureIntegrationReporter.isLastAttempt(test, result)) {
      await Logs.agregarLineaAlLog(
        `[Azure] ${AzureIntegrationReporter.attemptLabel(test, result)} para "${test.title}" — esperando reintento`,
      );
      return;
    }

    // Wait for Test Run to be ready
    await this.initPromise;

    if (!this.resultSvc.isReady()) {
      await Logs.agregarLineaAlLog(
        `[Azure] Test Run no disponible — resultado para TC${tcId ?? '?'} no publicado`,
      );
      return;
    }

    if (!tcId) {
      await Logs.agregarLineaAlLog(
        `[Azure] Sin TC ID para "${test.title}" — resultado no publicado`,
      );
      return;
    }

    const allAttempts = this.tracker.getAllAttempts(test.id);
    const finalAtt    = this.tracker.getFinalAttempt(test.id);
    if (!finalAtt) return;

    const steps = finalAtt.steps;

    // Stamp artifact names with execution index and/or retry index.
    //
    // retryIndex uses Playwright's result.retry directly (0 = first attempt, 1 = first retry…).
    // The first attempt (retry=0) never gets a retry suffix so its evidence is always
    // distinguishable from actual retry attempts regardless of how many retries follow.
    //
    // Full naming matrix (centralised in EvidenceCollector.stampNames):
    //   single-iteration, no retries         → {name}               dataJson.json
    //   single-iteration, 1st attempt+retries → {name}              dataJson.json
    //   single-iteration, retry N            → {name}_{N}           dataJson_1.json
    //   multi-iteration,  no retries         → {name}_{exec}        dataJson_2.json
    //   multi-iteration,  1st attempt+retries → {name}_{exec}       dataJson_2.json
    //   multi-iteration,  retry N            → {name}_{exec}_{N}    dataJson_2_1.json
    //
    // Bug evidences keep original names: a bug represents one error fingerprint
    // and does not need iteration/retry disambiguation.
    const allEvidences   = allAttempts.flatMap((a) => {
      const retryIndex = a.retry > 0 ? a.retry : undefined;   // undefined for the first attempt
      return EvidenceCollector.stampNames(a.evidences, executionIndex, retryIndex);
    });
    const finalEvidences = finalAtt.evidences;

    if (executionIndex !== undefined) {
      await Logs.agregarLineaAlLogHeader(
        `[Azure] Procesando iteración ${executionIndex} para TC${tcId} — "${test.title}"`,
      );
    }

    await this.safePublish(async () => {

      if (result.status === 'passed') {
        const priorFails = allAttempts.filter((a) => a.status !== 'passed');
        if (priorFails.length > 0) {
          const flaky = this.flakyDetector.analyze(allAttempts);
          await this.publisher.publishFlaky({
            tcId,
            testTitle:    test.title,
            finalAttempt: finalAtt,
            allAttempts,
            evidences:    allEvidences,
            flakyReason:  flaky.reason ?? 'Pasó en reintento',
          });
        } else {
          await this.publisher.publishPass({
            tcId,
            testTitle:    test.title,
            finalAttempt: finalAtt,
            allAttempts,
            evidences:    allEvidences,
          });
        }

      } else if (result.status === 'skipped') {
        await Logs.agregarLineaAlLog(
          `[Azure] Test omitido: "${test.title}" — TC${tcId} no actualizado`,
        );

      } else {
        // FAIL definitivo — fail-wins en TestResultService descarta PASSes posteriores
        await this.publisher.publishFail({
          tcId,
          testTitle:    test.title,
          steps,
          finalAttempt: finalAtt,
          allAttempts,
          evidences:    allEvidences,    // all retries → Test Result
          bugEvidences: finalEvidences,  // final retry only → Bug Work Item
        });
      }
    });
  }

  // ── onEnd ──────────────────────────────────────────────────────────────────

  async onEnd(_suite: FullResult): Promise<void> {
    if (!this.enabled) return;
    await this.initPromise;
    await this.safePublish(() => this.resultSvc.finalize());
    await Logs.agregarLineaAlLogHeader(
      `[Azure] Integración finalizada — ${this.registry.size()} defecto(s) registrado(s)`,
    );
  }

  // ── Service bootstrap ──────────────────────────────────────────────────────

  private bootstrapServices(): void {
    const cfg = loadAzureConfig();

    this.client        = new AzureDevOpsClient(cfg);
    this.resolver      = new TestCaseResolver();
    this.tracker       = new ExecutionTracker();
    this.flakyDetector = new FlakyDetector();
    this.fingerprinter = new ErrorFingerprintService();
    this.registry      = new ActiveDefectRegistry();
    this.evidence      = new EvidenceCollector(cfg);
    this.attachSvc     = new AttachmentService(this.client, this.evidence);
    this.resultSvc     = new TestResultService(this.client, cfg);
    this.dupDetector   = new DuplicateBugDetector(this.registry, this.client, this.fingerprinter);
    this.bugMgr        = new BugManager(
      this.client, cfg, this.registry,
      this.dupDetector, this.attachSvc, this.fingerprinter,
    );
    this.publisher = new ResultPublisher(
      this.resultSvc, this.attachSvc, this.bugMgr,
      this.fingerprinter, this.flakyDetector,
    );
  }

  // ── Retry helpers (stateless) ──────────────────────────────────────────────

  private static isLastAttempt(test: TestCase, result: TestResult): boolean {
    if (result.status === 'passed')      return true;
    if (result.status === 'skipped')     return true;
    if (result.status === 'interrupted') return true;
    return result.retry >= test.retries;
  }

  private static attemptLabel(test: TestCase, result: TestResult): string {
    const max = test.retries + 1;
    const cur = result.retry + 1;
    return `Intento ${cur} de ${max}`;
  }

  // ── Fail-safe wrapper ──────────────────────────────────────────────────────

  private async safePublish(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      await Logs.agregarLineaAlLog(
        `[Azure] Error inesperado en publisher: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
