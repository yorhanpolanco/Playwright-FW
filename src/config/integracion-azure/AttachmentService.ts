import Logs from '../logConfig';
import type { AzureDevOpsClient } from './AzureDevOpsClient';
import type { EvidenceAttachment, AttachmentUploadResult } from './types/azure.types';
import type { EvidenceCollector } from './EvidenceCollector';

// ─────────────────────────────────────────────────────────────────────────────
// AttachmentService
//
// Uploads evidence files to Azure DevOps using two distinct endpoints:
//
//  1. Test Result attachments:
//     POST /_apis/test/Runs/{runId}/Results/{resultId}/attachments
//     Body: { stream: base64, fileName, comment, attachmentType }
//
//  2. Work Item (Bug) attachments:
//     POST /_apis/wit/attachments?fileName=xxx         → returns { url }
//     PATCH /_apis/wit/workitems/{bugId}               → links the file
// ─────────────────────────────────────────────────────────────────────────────

export class AttachmentService {
  // Tracks filenames already uploaded per resultId to prevent duplicate uploads
  // when multiple Playwright test instances (projects / data iterations) share
  // the same TC ID → resultId. Without this Azure DevOps appends a UUID to the
  // filename of every subsequent upload with the same name.
  private readonly uploadedNames = new Map<number, Set<string>>();

  constructor(
    private readonly client: AzureDevOpsClient,
    private readonly evidenceCollector: EvidenceCollector,
  ) {}

  // ── Test Result Attachments ────────────────────────────────────────────────

  async uploadEvidencesToTestResult(
    runId: number,
    resultId: number,
    evidences: EvidenceAttachment[],
    status: 'passed' | 'failed',
  ): Promise<void> {
    for (const evidence of evidences) {
      await this.uploadSingleToTestResult(runId, resultId, evidence, status);
    }
  }

  private async uploadSingleToTestResult(
    runId: number,
    resultId: number,
    evidence: EvidenceAttachment,
    status: string,
  ): Promise<void> {
    const buffer = evidence.body;
    if (!buffer || buffer.byteLength === 0) {
      await Logs.agregarLineaAlLog(
        `[Azure] Adjunto vacío omitido: ${evidence.name}`,
      );
      return;
    }

    const fileName = this.evidenceCollector.safeFileName(evidence.name, evidence.contentType);

    // Skip if this filename was already uploaded to this resultId.
    // Multiple Playwright tests mapping to the same TC (multi-project or
    // data-driven iterations) share the same resultId. Without this guard,
    // Azure DevOps appends a UUID to each duplicate filename.
    const uploaded = this.uploadedNames.get(resultId) ?? new Set<string>();
    if (uploaded.has(fileName)) {
      await Logs.agregarLineaAlLog(
        `[Azure] Adjunto omitido (ya subido al resultado ${resultId}): ${fileName}`,
      );
      return;
    }
    uploaded.add(fileName);
    this.uploadedNames.set(resultId, uploaded);

    const comment = this.buildComment(evidence.name, status);

    try {
      await this.client.uploadTestResultAttachment(runId, resultId, {
        stream:         buffer.toString('base64'),
        fileName,
        comment,
        attachmentType: 'GeneralAttachment',
      });

      await Logs.agregarLineaAlLogHeader(
        `[Azure] Adjunto cargado al resultado ${resultId}: ${fileName}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(
        `[Azure] Error al cargar adjunto "${fileName}" al resultado: ${msg}`,
      );
    }
  }

  // ── Work Item (Bug) Attachments ────────────────────────────────────────────

  async uploadEvidencesToBug(
    bugId: number,
    evidences: EvidenceAttachment[],
  ): Promise<void> {
    for (const evidence of evidences) {
      await this.uploadSingleToBug(bugId, evidence);
    }
  }

  private async uploadSingleToBug(
    bugId: number,
    evidence: EvidenceAttachment,
  ): Promise<void> {
    const buffer = evidence.body;
    if (!buffer || buffer.byteLength === 0) return;

    const fileName = this.evidenceCollector.safeFileName(evidence.name, evidence.contentType);

    try {
      // Step 1: Upload the raw binary and obtain the blob URL
      const uploadResult = await this.client.uploadWorkItemAttachment(fileName, buffer);

      // Step 2: Link the blob URL to the bug work item
      await this.client.updateWorkItem(bugId, [
        {
          op:    'add',
          path:  '/relations/-',
          value: {
            rel: 'AttachedFile',
            url: uploadResult.url,
            attributes: { comment: `Evidencia automática — ${fileName}` },
          },
        },
      ]);

      await Logs.agregarLineaAlLog(
        `[Azure] Adjunto vinculado al bug #${bugId}: ${fileName}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(
        `[Azure] Error al adjuntar "${fileName}" al bug #${bugId}: ${msg}`,
      );
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private buildComment(name: string, status: string): string {
    const n = name.toLowerCase();
    const label =
      n.includes('trace')           ? 'Trace de Playwright'
      : n.includes('video')         ? 'Grabación de vídeo'
      : n.includes('dataapiresponse') ? 'Response del API (dataApiResponse)'
      : n.includes('datajson')       ? 'Data de prueba utilizada (dataJson)'
      : 'Captura de pantalla';

    return `${label} — estado: ${status}`;
  }
}
