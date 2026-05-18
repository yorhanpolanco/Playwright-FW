import Logs from '../logConfig';
import type { AzureDevOpsClient } from './AzureDevOpsClient';
import type { ActiveDefectRegistry } from './ActiveDefectRegistry';
import type { ErrorFingerprintService } from './ErrorFingerprintService';
import type {
  DuplicateCheckResult,
  ErrorFingerprint,
  ExistingBug,
  WorkItem,
} from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// DuplicateBugDetector
//
// Three-level hierarchy for detecting whether a bug already exists:
//
//  Level 1 — Local cache (ActiveDefectRegistry)
//   Hit when the same fingerprint or TC ID was seen in this run.
//
//  Level 2 — Azure linked work items
//   Queries the test case's work item for "Tested By" / related bug links.
//   Catches bugs created in previous runs that are still active.
//
//  Level 3 — Title similarity (WIQL keyword search)
//   Keyword search over bug titles. Jaccard score ≥ 0.65 declares a match.
// ─────────────────────────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.65;

const ACTIVE_STATES = new Set(['Active', 'New', 'Approved', 'In Progress', 'Committed']);

// Only TestedBy links reliably indicate a Bug was associated with a Test Case.
// System.LinkTypes.Related is intentionally excluded: Test Cases routinely have
// Related links to Test Suites, User Stories, Requirements, and other non-Bug
// work items. Including Related here would cause those items to be mistaken for
// existing Bug work items, silently suppressing real bug creation.
const BUG_TESTED_BY_RELATIONS = new Set([
  'Microsoft.VSTS.Common.TestedBy-Forward',
  'Microsoft.VSTS.Common.TestedBy-Reverse',
]);

export class DuplicateBugDetector {
  constructor(
    private readonly registry:      ActiveDefectRegistry,
    private readonly client:        AzureDevOpsClient,
    private readonly fingerprinter: ErrorFingerprintService,
  ) {}

  async check(
    fingerprint: ErrorFingerprint,
    tcId: string,
  ): Promise<DuplicateCheckResult> {

    // ── Level 1: cache ─────────────────────────────────────────────────────
    const cached = this.registry.findByFingerprint(fingerprint.hash)
                ?? this.registry.findByTcId(tcId);

    if (cached) {
      await Logs.agregarLineaAlLog(
        `[Azure] Duplicado detectado (Level 1 — cache): bug #${cached.id} para TC${tcId}`,
      );
      return { isDuplicate: true, existingBug: cached, level: 'cache' };
    }

    // ── Level 2: Azure linked work items ───────────────────────────────────
    const linkedBugs = await this.safeCall(
      () => this.findActiveBugsForTestCase(tcId),
      `buscar bugs vinculados a TC${tcId}`,
    );

    if (linkedBugs.length > 0) {
      const activeBug = linkedBugs[0];
      await Logs.agregarLineaAlLog(
        `[Azure] Duplicado detectado (Level 2 — Azure linked): bug #${activeBug.id} para TC${tcId}`,
      );
      this.registry.register({ ...activeBug, testCaseId: tcId, fingerprint: fingerprint.hash });
      return { isDuplicate: true, existingBug: activeBug, level: 'azure' };
    }

    // ── Level 3: title similarity ──────────────────────────────────────────
    const keyword = this.buildSearchKeyword(fingerprint);
    const similar = await this.safeCall(
      () => this.findActiveBugsByTitleKeyword(keyword),
      `buscar bugs similares para "${keyword}"`,
    );

    const match = this.findSimilarBug(similar, fingerprint.normalizedMessage);
    if (match) {
      await Logs.agregarLineaAlLog(
        `[Azure] Duplicado detectado (Level 3 — similaridad): bug #${match.id} para TC${tcId}`,
      );
      this.registry.register({ ...match, testCaseId: tcId, fingerprint: fingerprint.hash });
      return { isDuplicate: true, existingBug: match, level: 'similarity' };
    }

    await Logs.agregarLineaAlLog(
      `[Azure] No se encontró bug duplicado para TC${tcId} (hash=${fingerprint.hash})`,
    );
    return { isDuplicate: false };
  }

  // ── Level 2: Azure linked work items ──────────────────────────────────────

  private async findActiveBugsForTestCase(testCaseId: string): Promise<ExistingBug[]> {
    const workItem   = await this.client.getWorkItem(parseInt(testCaseId, 10), 'relations');
    const candidates = this.extractLinkedWorkItemIds(workItem);
    if (candidates.length === 0) return [];

    // Fetch full details so we can verify type = Bug and state is active.
    // This is the critical guard: without it any Related link (e.g. to a Test
    // Suite or User Story) would be mistaken for an existing Bug work item.
    const items = await this.client.getWorkItemsBatch(candidates);
    return items
      .filter((wi) => this.isActiveBug(wi))
      .map((wi) => this.toExistingBug(wi));
  }

  // ── Level 3: WIQL title search ─────────────────────────────────────────────

  private async findActiveBugsByTitleKeyword(keyword: string): Promise<ExistingBug[]> {
    if (!keyword.trim()) return [];

    const safeKeyword = keyword.replace(/'/g, "''").slice(0, 100);
    const wiql = {
      query:
        `SELECT [System.Id], [System.Title], [System.State] ` +
        `FROM WorkItems ` +
        `WHERE [System.WorkItemType] = 'Bug' ` +
        `AND [System.State] NOT IN ('Closed', 'Resolved', 'Done') ` +
        `AND [System.Title] CONTAINS '${safeKeyword}' ` +
        `ORDER BY [System.CreatedDate] DESC`,
    };

    const result = await this.client.queryWorkItems(wiql);
    const ids    = (result.workItems ?? []).map((wi) => wi.id).slice(0, 20);
    if (ids.length === 0) return [];

    const workItems = await this.client.getWorkItemsBatch(ids);
    return workItems
      .filter((wi) => this.isActiveBug(wi))
      .map((wi) => this.toExistingBug(wi));
  }

  // ── Work item helpers ──────────────────────────────────────────────────────

  private extractLinkedWorkItemIds(testCaseWorkItem: WorkItem): number[] {
    const ids: number[] = [];
    for (const rel of testCaseWorkItem.relations ?? []) {
      if (!BUG_TESTED_BY_RELATIONS.has(rel.rel)) continue;
      const match = rel.url.match(/\/workitems\/(\d+)/i);
      if (match) ids.push(parseInt(match[1], 10));
    }
    return ids;
  }

  private isActiveBug(wi: WorkItem): boolean {
    const type  = String(wi.fields['System.WorkItemType'] ?? '');
    const state = String(wi.fields['System.State'] ?? '');
    return type === 'Bug' && ACTIVE_STATES.has(state);
  }

  private toExistingBug(wi: WorkItem): ExistingBug {
    return {
      id:    wi.id,
      title: String(wi.fields['System.Title'] ?? ''),
      state: String(wi.fields['System.State'] ?? ''),
      url:   wi.url ?? '',
    };
  }

  // ── Similarity helpers ─────────────────────────────────────────────────────

  private findSimilarBug(bugs: ExistingBug[], normalizedMessage: string): ExistingBug | undefined {
    for (const bug of bugs) {
      const score = this.similarity(
        normalizedMessage.toLowerCase(),
        bug.title.toLowerCase(),
      );
      if (score >= SIMILARITY_THRESHOLD) return bug;
    }
    return undefined;
  }

  private buildSearchKeyword(fp: ErrorFingerprint): string {
    return fp.normalizedMessage
      .replace(/<[^>]{1,500}>/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 4)
      .join(' ');
  }

  private similarity(a: string, b: string): number {
    if (a === b)  return 1;
    if (!a || !b) return 0;
    const setA         = new Set(this.bigrams(a));
    const setB         = new Set(this.bigrams(b));
    const intersection = [...setA].filter((bg) => setB.has(bg)).length;
    const union        = setA.size + setB.size - intersection;
    return union === 0 ? 1 : intersection / union;
  }

  private bigrams(s: string): string[] {
    const result: string[] = [];
    for (let i = 0; i < s.length - 1; i++) result.push(s.slice(i, i + 2));
    return result;
  }

  // ── Safe call wrapper ──────────────────────────────────────────────────────

  private async safeCall<T>(
    fn: () => Promise<T>,
    label: string,
  ): Promise<Awaited<T> extends (infer U)[] ? U[] : never[]> {
    try {
      return (await fn()) as any;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(`[Azure] Error al ${label}: ${msg}`);
      return [] as any;
    }
  }
}
