import Logs from '../logConfig';
import type { AzureDevOpsClient } from './AzureDevOpsClient';
import type { ActiveDefectRegistry } from './ActiveDefectRegistry';
import type { DuplicateBugDetector } from './DuplicateBugDetector';
import type { AttachmentService } from './AttachmentService';
import type { ErrorFingerprintService } from './ErrorFingerprintService';
import type {
  AzureConfiguration,
  BugCreationRequest,
  CreatedBug,
  EvidenceAttachment,
  ErrorFingerprint,
  ExistingBug,
  StepRecord,
} from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// BugManager
//
// Orchestrates the full bug lifecycle (5 API calls):
//  1. Check pre-conditions (bug creation enabled).
//  2. Run duplicate detection (3 levels).
//  3a. Duplicate found → reuse: add comment + upload evidence + link result.
//  3b. No duplicate  → create Bug work item, then:
//       - Upload evidence to bug
//       - Link bug to test case (TestedBy relation)
//       - Link bug to test result (associatedBugs)
//  4. Register in cache to prevent duplicates within this run.
//
// ENABLE_BUG_CREATION=true is required for any of this to run.
// ─────────────────────────────────────────────────────────────────────────────

export class BugManager {
  constructor(
    private readonly client:        AzureDevOpsClient,
    private readonly cfg:           AzureConfiguration,
    private readonly registry:      ActiveDefectRegistry,
    private readonly detector:      DuplicateBugDetector,
    private readonly attachments:   AttachmentService,
    private readonly fingerprinter: ErrorFingerprintService,
  ) {}

  // ── Main entry point ───────────────────────────────────────────────────────

  async handleFailure(params: {
    fingerprint:  ErrorFingerprint;
    tcId:         string;
    testTitle:    string;
    steps:        StepRecord[];
    evidences:    EvidenceAttachment[];
    runId:        number;
    resultId:     number;
    errorMessage: string;
    stackTrace?:  string;
    durationInMs: number;
  }): Promise<CreatedBug | null> {
    const { fingerprint, tcId, testTitle, steps, evidences, runId, resultId } = params;

    if (!this.cfg.enableBugCreation) {
      await Logs.agregarLineaAlLog('[Azure] Creación de bugs deshabilitada (ENABLE_BUG_CREATION=false)');
      return null;
    }

    // ── Duplicate detection ────────────────────────────────────────────────
    const dupResult = await this.detector.check(fingerprint, tcId);

    if (dupResult.isDuplicate && dupResult.existingBug) {
      await this.reuseExistingBug(
        dupResult.existingBug,
        evidences,
        testTitle,
        tcId,
        runId,
        resultId,
      );
      return null;
    }

    // ── Create new Bug work item ───────────────────────────────────────────
    const bugRequest: BugCreationRequest = {
      title:       this.fingerprinter.buildBugTitle(fingerprint, testTitle),
      description: this.buildDescription(fingerprint, testTitle, tcId, params.stackTrace),
      reproSteps:  this.buildReproSteps(steps, params.errorMessage, params.stackTrace),
      systemInfo:  this.buildSystemInfo(testTitle, tcId),
      severity:    '2 - High',
      priority:    2,
      testCaseId:  tcId,
      runId,
      resultId,
      fingerprint: fingerprint.hash,
      stackTrace:  params.stackTrace,
    };

    const created = await this.createBug(bugRequest);
    if (!created) return null;

    // ── Post-creation: upload evidence → link test case → link test result ─
    // Sequential execution is required: uploadEvidencesToBug and
    // linkBugToTestCase both PATCH the same Bug work item. Azure DevOps uses
    // revision-based concurrency (ETag), so concurrent PATCHes to the same
    // work item will fail with a version conflict.
    await this.attachments.uploadEvidencesToBug(created.id, evidences);
    await this.linkBugToTestCase(created.id, tcId);
    await this.linkBugToTestResult(runId, resultId, created.id);

    // ── Register to prevent duplicates within this run ─────────────────────
    this.registry.register({
      id:          created.id,
      title:       created.title,
      state:       'Active',
      fingerprint: fingerprint.hash,
      testCaseId:  tcId,
      url:         created.url,
    });

    await Logs.agregarLineaAlLog(
      `[Azure] Bug creado: #${created.id} "${created.title}"`,
    );

    return created;
  }

  // ── Repro Steps Builder ────────────────────────────────────────────────────

  buildReproSteps(steps: StepRecord[], errorMessage: string, stackTrace?: string): string {
    const userSteps = steps
      .filter((s) => s.category === 'test.step')
      .sort((a, b) => a.order - b.order);

    let html = '<ol>';
    for (const step of userSteps) {
      const status = step.status === 'failed' ? ' ❌' : '';
      html += `<li>${this.escapeHtml(step.title)}${status}</li>`;
      if (step.error) {
        html += `<ul><li><code>${this.escapeHtml(step.error.slice(0, 300))}</code></li></ul>`;
      }
    }
    html += '</ol>';

    if (errorMessage) {
      html +=
        `<br/><b>Error final:</b><br/>` +
        `<pre>${this.escapeHtml(errorMessage.slice(0, 2000))}</pre>`;
    }

    if (stackTrace) {
      html +=
        `<br/><b>Stack trace:</b><br/>` +
        `<pre>${this.escapeHtml(stackTrace.slice(0, 3000))}</pre>`;
    }

    return html;
  }

  // ── Description Builder ────────────────────────────────────────────────────

  private buildDescription(
    fingerprint: ErrorFingerprint,
    testTitle:   string,
    tcId:        string,
    stackTrace?: string,
  ): string {
    const env     = process.env.ENV     ?? 'desconocido';
    const browser = process.env.BROWSER ?? 'desconocido';

    let html =
      `<b>Defecto detectado por ejecución automatizada Playwright</b><br/><br/>` +
      `<b>Test Case:</b> ${this.escapeHtml(testTitle)} (TC${tcId})<br/>` +
      `<b>Categoría:</b> ${fingerprint.errorCategory}<br/>` +
      `<b>Tipo de error:</b> ${fingerprint.errorType}<br/>` +
      `<b>Ambiente:</b> ${env}<br/>` +
      `<b>Browser:</b> ${browser}<br/>` +
      `<b>Node.js:</b> ${process.version}<br/>` +
      `<b>Fingerprint:</b> ${fingerprint.hash}<br/>` +
      `<b>Fecha:</b> ${new Date().toISOString()}<br/><br/>` +
      `<b>Mensaje de error (normalizado):</b><br/>` +
      `<pre>${this.escapeHtml(fingerprint.normalizedMessage.slice(0, 1000))}</pre>`;

    if (stackTrace) {
      html +=
        `<br/><b>Stack trace:</b><br/>` +
        `<pre>${this.escapeHtml(stackTrace.slice(0, 3000))}</pre>`;
    }

    html += `<br/><i>Se adjuntan evidencias: capturas de pantalla, video de grabación, trace.zip, datos de prueba.</i>`;

    return html;
  }

  // ── Bug reuse (duplicate found) ────────────────────────────────────────────

  private async reuseExistingBug(
    existingBug: ExistingBug,
    evidences:   EvidenceAttachment[],
    testTitle:   string,
    tcId:        string,
    runId:       number,
    resultId:    number,
  ): Promise<void> {
    try {
      await this.addReuseComment(existingBug.id, testTitle, tcId);
      await this.attachments.uploadEvidencesToBug(existingBug.id, evidences);
      await this.client.associateBugWithResult(runId, resultId, existingBug.id);
      await Logs.agregarLineaAlLog(
        `[Azure] Bug #${existingBug.id} reutilizado para TC${tcId} — "${testTitle}"`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(
        `[Azure] Error al reutilizar bug #${existingBug.id}: ${msg}`,
      );
    }
  }

  private async addReuseComment(bugId: number, testTitle: string, tcId: string): Promise<void> {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const comment   =
      `<b>Nueva falla detectada — ${timestamp}</b><br/>` +
      `Test: <i>${this.escapeHtml(testTitle)}</i> (TC${tcId})<br/>` +
      `Ejecución automática de Playwright — se adjuntan evidencias actualizadas.`;

    await this.client.updateWorkItem(bugId, [
      { op: 'add', path: '/fields/System.History', value: comment },
    ]);
  }

  // ── Bug creation ───────────────────────────────────────────────────────────

  private async createBug(req: BugCreationRequest): Promise<CreatedBug | null> {
    try {
      const operations = [
        { op: 'add' as const, path: '/fields/System.Title',                   value: req.title },
        { op: 'add' as const, path: '/fields/System.Description',             value: req.description ?? '' },
        { op: 'add' as const, path: '/fields/Microsoft.VSTS.TCM.ReproSteps',  value: req.reproSteps },
        { op: 'add' as const, path: '/fields/Microsoft.VSTS.Common.Severity', value: req.severity },
        { op: 'add' as const, path: '/fields/Microsoft.VSTS.Common.Priority', value: req.priority },
        { op: 'add' as const, path: '/fields/System.Tags',                    value: `automated;playwright;TC${req.testCaseId};` },
      ];

      if (req.systemInfo) {
        operations.push({
          op: 'add' as const,
          path: '/fields/Microsoft.VSTS.TCM.SystemInfo',
          value: req.systemInfo,
        });
      }

      const workItem = await this.client.createWorkItem('Bug', operations);

      return {
        id:          workItem.id,
        title:       req.title,
        url:         workItem.url ?? `https://dev.azure.com/${this.cfg.org}/${encodeURIComponent(this.cfg.project)}/_workitems/edit/${workItem.id}`,
        fingerprint: req.fingerprint,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(`[Azure] Error al crear bug: ${msg}`);
      return null;
    }
  }

  private async linkBugToTestCase(bugId: number, tcId: string): Promise<void> {
    try {
      const tcUrl = `https://dev.azure.com/${this.cfg.org}/${encodeURIComponent(this.cfg.project)}/_apis/wit/workitems/${tcId}`;
      await this.client.updateWorkItem(bugId, [
        {
          op:    'add',
          path:  '/relations/-',
          value: {
            rel:        'Microsoft.VSTS.Common.TestedBy-Reverse',
            url:        tcUrl,
            attributes: { comment: 'Linked automated Playwright Test Case' },
          },
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(`[Azure] Error al vincular bug #${bugId} con TC${tcId}: ${msg}`);
    }
  }

  private async linkBugToTestResult(runId: number, resultId: number, bugId: number): Promise<void> {
    try {
      await this.client.associateBugWithResult(runId, resultId, bugId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(
        `[Azure] Error al asociar bug #${bugId} con resultado ${resultId}: ${msg}`,
      );
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildSystemInfo(testTitle: string, tcId: string): string {
    const env     = process.env.ENV     ?? 'desconocido';
    const browser = process.env.BROWSER ?? 'desconocido';

    return [
      `<b>Test:</b> ${this.escapeHtml(testTitle)} (TC${tcId})`,
      `<b>Ambiente:</b> ${env}`,
      `<b>Browser:</b> ${browser}`,
      `<b>Node.js:</b> ${process.version}`,
      `<b>Fecha:</b> ${new Date().toISOString()}`,
    ].join('<br/>');
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
