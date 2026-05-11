import Logs from '../logConfig';
import type { TestResultService } from './TestResultService';
import type { AttachmentService } from './AttachmentService';
import type { BugManager } from './BugManager';
import type { ErrorFingerprintService } from './ErrorFingerprintService';
import type { FlakyDetector } from './FlakyDetector';
import type {
  TestAttemptRecord,
  EvidenceAttachment,
  StepRecord,
} from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// ResultPublisher
//
// Orchestrates the full "publish to Azure DevOps" flow for a completed test.
// Called once per test, only after the FINAL attempt has been recorded.
//
// Responsibilities:
//  - Update Azure Test Result outcome.
//  - Upload evidence to the Test Result.
//  - For definitive failures: check flakiness, fingerprint error, create/reuse bug.
// ─────────────────────────────────────────────────────────────────────────────

export class ResultPublisher {
  constructor(
    private readonly resultService:  TestResultService,
    private readonly attachments:    AttachmentService,
    private readonly bugManager:     BugManager,
    private readonly fingerprinter:  ErrorFingerprintService,
    private readonly flakyDetector:  FlakyDetector,
  ) {}

  // ── PASS ───────────────────────────────────────────────────────────────────

  async publishPass(params: {
    tcId:         string;
    testTitle:    string;
    finalAttempt: TestAttemptRecord;
    allAttempts:  TestAttemptRecord[];
    evidences:    EvidenceAttachment[];
  }): Promise<void> {
    const { tcId, testTitle, finalAttempt, allAttempts, evidences } = params;

    const ids = await this.resultService.updateResult(tcId, 'Passed', {
      comment:       `Test pasado ✅ — ${testTitle}`,
      durationInMs:  finalAttempt.duration,
      startedDate:   finalAttempt.startTime,
      completedDate: finalAttempt.endTime,
    });

    if (!ids) return;

    const { runId, resultId } = ids;

    await this.safeUpload(() =>
      this.attachments.uploadEvidencesToTestResult(runId, resultId, evidences, 'passed'),
    );

    await Logs.agregarLineaAlLogHeader(
      `[Azure] PASS publicado para TC${tcId} — "${testTitle}"` +
      (allAttempts.length > 1 ? ` (${allAttempts.length} intentos)` : ''),
    );
  }

  // ── FLAKY ──────────────────────────────────────────────────────────────────

  async publishFlaky(params: {
    tcId:         string;
    testTitle:    string;
    finalAttempt: TestAttemptRecord;
    allAttempts:  TestAttemptRecord[];
    evidences:    EvidenceAttachment[];
    flakyReason:  string;
  }): Promise<void> {
    const { tcId, testTitle, finalAttempt, evidences, flakyReason } = params;

    const ids = await this.resultService.updateResult(tcId, 'Passed', {
      comment:       `Test flaky ⚠️ — pasó en reintento. ${flakyReason}`,
      durationInMs:  finalAttempt.duration,
      startedDate:   finalAttempt.startTime,
      completedDate: finalAttempt.endTime,
    });

    if (!ids) return;

    // Upload all evidences: screenshots + videos from every attempt, plus traces
    // from any failed attempts. EvidenceCollector already omits traces for
    // passed attempts, so allEvidences will only carry failure-attempt traces —
    // the most useful artifacts for understanding flaky behavior.
    await this.safeUpload(() =>
      this.attachments.uploadEvidencesToTestResult(ids.runId, ids.resultId, evidences, 'passed'),
    );

    await Logs.agregarLineaAlLog(
      `[Azure] FLAKY publicado para TC${tcId} — "${testTitle}" — ${flakyReason}`,
    );
  }

  // ── FAIL ───────────────────────────────────────────────────────────────────

  async publishFail(params: {
    tcId:         string;
    testTitle:    string;
    steps:        StepRecord[];
    finalAttempt: TestAttemptRecord;
    allAttempts:  TestAttemptRecord[];
    /** All retry attempts' evidences (retry-N_ prefixed) — uploaded to Test Result. */
    evidences:    EvidenceAttachment[];
    /** Final retry evidences only — attached to Bug Work Item to avoid noise. */
    bugEvidences: EvidenceAttachment[];
  }): Promise<void> {
    const { tcId, testTitle, steps, finalAttempt, allAttempts, evidences, bugEvidences } = params;

    const errorMessage = finalAttempt.errorMessage ?? 'Error desconocido';

    const ids = await this.resultService.updateResult(tcId, 'Failed', {
      comment:       `Test fallido ❌ — ${testTitle} (${allAttempts.length} reintentos)`,
      errorMessage,
      durationInMs:  finalAttempt.duration,
      startedDate:   finalAttempt.startTime,
      completedDate: finalAttempt.endTime,
    });

    if (!ids) return;

    const { runId, resultId } = ids;

    // Upload all evidences including trace on FAIL
    await this.safeUpload(() =>
      this.attachments.uploadEvidencesToTestResult(runId, resultId, evidences, 'failed'),
    );

    // Flakiness check before bug creation
    const flakyAnalysis = this.flakyDetector.analyze(allAttempts);
    if (flakyAnalysis.isFlaky) {
      await Logs.agregarLineaAlLog(
        `[Azure] Test flaky detectado (confianza=${(flakyAnalysis.confidence * 100).toFixed(0)}%) — no se creará bug para TC${tcId}`,
      );
      return;
    }

    // Generate error fingerprint for deduplication and bug title
    const fingerprint = this.fingerprinter.generate(
      errorMessage,
      finalAttempt.stackTrace,
      steps,
      testTitle,
    );

    await Logs.agregarLineaAlLog(
      `[Azure] Fingerprint del error: ${fingerprint.hash} (${fingerprint.errorCategory})`,
    );

    // Create or reuse bug (5-call flow).
    // bugEvidences contains only the final retry's artifacts so the Bug Work
    // Item stays clean — no duplicate screenshots/traces from prior attempts.
    await this.safeUpload(() =>
      this.bugManager.handleFailure({
        fingerprint,
        tcId,
        testTitle,
        steps,
        evidences:    bugEvidences,
        runId,
        resultId,
        errorMessage,
        stackTrace:   finalAttempt.stackTrace,
        durationInMs: finalAttempt.duration,
      }),
    );

    await Logs.agregarLineaAlLog(
      `[Azure] FAIL publicado para TC${tcId} — "${testTitle}"`,
    );
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async safeUpload<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(`[Azure] Error en operación de upload: ${msg}`);
      return null;
    }
  }
}
