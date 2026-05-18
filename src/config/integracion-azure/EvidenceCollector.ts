import fs from 'node:fs';
import path from 'path';
import type { TestResult } from '@playwright/test/reporter';
import type { EvidenceAttachment, AzureConfiguration } from './types/azure.types';
import Logs from '../logConfig';

// ─────────────────────────────────────────────────────────────────────────────
// EvidenceCollector
//
// Extracts Playwright test artifacts from a TestResult and returns them as
// EvidenceAttachment objects ready for upload to Azure DevOps.
//
// Evidence matrix:
//   PASS  → screenshot ✅  video ✅  trace ❌  dataJson ✅  dataApiResponse ✅*
//   FAIL  → screenshot ✅  video ✅  trace ✅  dataJson ✅  dataApiResponse ✅*
//
// * dataApiResponse solo está presente cuando el fixture worldData lo popula,
//   lo que ocurre exclusivamente en tests de API tras ejecutarRequest().
//   La lógica aquí es idéntica al fixture: se adjunta si existe contenido.
// ─────────────────────────────────────────────────────────────────────────────

const SCREENSHOT_NAMES  = new Set(['screenshot', 'screenshot-on-failure']);
const VIDEO_NAMES       = new Set(['video']);
const TRACE_NAMES       = new Set(['trace']);
const DATA_JSON_NAMES   = new Set(['datajson']);
const DATA_API_NAMES    = new Set(['dataApiResponse'.toLowerCase()]);

type AttachmentSpec = { mime: string; outputName?: string; onlyOnFailure?: boolean };

const ATTACHMENT_SPECS: [Set<string>, AttachmentSpec][] = [
  [SCREENSHOT_NAMES, { mime: 'image/png' }],
  [VIDEO_NAMES,      { mime: 'video/webm' }],
  [TRACE_NAMES,      { mime: 'application/zip', onlyOnFailure: true }],
  [DATA_JSON_NAMES,  { mime: 'application/json', outputName: 'dataJson' }],
  [DATA_API_NAMES,   { mime: 'application/json', outputName: 'dataApiResponse' }],
];

export class EvidenceCollector {
  constructor(private readonly cfg: AzureConfiguration) {}

  /**
   * Collects all relevant attachments from a Playwright TestResult.
   * Evidences are stored with their original names — no index suffix is applied
   * here. Call {@link EvidenceCollector.stampNames} at publish time to stamp
   * each attempt's artifacts with execution and/or retry indices.
   *
   * @param result - Playwright TestResult for this attempt.
   */
  collect(result: TestResult): EvidenceAttachment[] {
    const isPassed  = result.status === 'passed';
    const evidences: EvidenceAttachment[] = [];

    for (const attachment of result.attachments) {
      const evidence = this.resolveAttachment(attachment, isPassed);
      if (evidence) evidences.push(evidence);
    }

    void Logs.agregarLineaAlLog(
      `[Azure] Evidencias recopiladas: ${evidences.map((e) => e.name).join(', ') || 'ninguna'}`,
    );

    return evidences;
  }

  private resolveAttachment(
    attachment: TestResult['attachments'][number],
    isPassed: boolean,
  ): EvidenceAttachment | undefined {
    const nameLower = attachment.name.toLowerCase();

    for (const [names, spec] of ATTACHMENT_SPECS) {
      if (!names.has(nameLower)) continue;
      if (spec.onlyOnFailure && (isPassed || !this.cfg.enableTraceAttachments)) return undefined;
      return this.buildEvidence(attachment.path, attachment.body, spec.outputName ?? attachment.name, spec.mime);
    }

    return undefined;
  }

  /**
   * Reads a file from disk into a Buffer.
   * Returns undefined when the file is absent or unreadable.
   */
  readFileBuffer(filePath: string): Buffer | undefined {
    try {
      if (!fs.existsSync(filePath)) return undefined;
      return fs.readFileSync(filePath);
    } catch {
      return undefined;
    }
  }

  /**
   * Returns a safe filename for an attachment by stripping path separators
   * and appending the appropriate extension when missing.
   */
  safeFileName(originalName: string, contentType: string): string {
    const base = path.basename(originalName).replace(/[^\w.\-]/g, '_');

    if (contentType.includes('zip')  && !base.endsWith('.zip'))  return `${base}.zip`;
    if (contentType.includes('webm') && !base.endsWith('.webm')) return `${base}.webm`;
    if (contentType.includes('png')  && !base.endsWith('.png'))  return `${base}.png`;
    if (contentType.includes('jpeg') && !base.endsWith('.jpg'))  return `${base}.jpg`;
    if (contentType.includes('json') && !base.endsWith('.json')) return `${base}.json`;

    return base;
  }

  /**
   * Builds a deterministic artifact name from a base name and optional indices.
   *
   * Naming matrix:
   *   no indices                  → {name}
   *   executionIndex only         → {name}_{exec}          (multi-iteration, no retries)
   *   retryIndex only             → {name}_{retry}         (single-iteration, with retries)
   *   executionIndex + retryIndex → {name}_{exec}_{retry}  (multi-iteration + retries)
   */
  static buildArtifactName(
    baseName: string,
    executionIndex?: number,
    retryIndex?: number,
  ): string {
    if (executionIndex !== undefined && retryIndex !== undefined) {
      return `${baseName}_${executionIndex}_${retryIndex}`;
    }
    if (executionIndex !== undefined) return `${baseName}_${executionIndex}`;
    if (retryIndex     !== undefined) return `${baseName}_${retryIndex}`;
    return baseName;
  }

  /**
   * Returns a new evidence list with names stamped according to execution index
   * and/or retry index. Returns the original list unchanged when both are absent.
   *
   * @param evidences      - Evidence list for one attempt (original names).
   * @param executionIndex - 1-based data-driven iteration (undefined = single-iteration TC).
   * @param retryIndex     - 1-based retry attempt position (undefined = no retries occurred).
   */
  static stampNames(
    evidences: EvidenceAttachment[],
    executionIndex?: number,
    retryIndex?: number,
  ): EvidenceAttachment[] {
    if (executionIndex === undefined && retryIndex === undefined) return evidences;
    return evidences.map((e) => ({
      ...e,
      name: EvidenceCollector.buildArtifactName(e.name, executionIndex, retryIndex),
    }));
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private buildEvidence(
    filePath: string | undefined,
    bodyBuffer: Buffer | undefined,
    name: string,
    contentType: string,
  ): EvidenceAttachment | undefined {
    if (filePath) {
      const buf = this.readFileBuffer(filePath);
      if (!buf) {
        void Logs.agregarLineaAlLog(`[Azure] Advertencia: no se pudo leer ${filePath}`);
        return undefined;
      }
      return { name, path: filePath, body: buf, contentType };
    }

    if (bodyBuffer) {
      return { name, body: bodyBuffer, contentType };
    }

    return undefined;
  }
}
