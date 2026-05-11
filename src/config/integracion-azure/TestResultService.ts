import Logs from '../logConfig';
import type { AzureDevOpsClient } from './AzureDevOpsClient';
import type { AzureConfiguration, TestResultUpdate, TcRunMapping } from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// TestResultService
//
// Manages the lifecycle of a single Azure DevOps Test Run for one Playwright
// execution session.
//
// Fail-wins rule (data-driven multi-iteration tests):
//   When multiple Playwright tests share the same TC ID (because the iteration
//   count exceeds the number of @TC tags and modulo wrapping is applied), ALL
//   their outcomes are aggregated with "fail wins":
//
//     iteration 1 → FAIL  ← sets TC to FAILED
//     iteration 2 → PASS  ← IGNORED; TC stays FAILED
//     iteration 3 → PASS  ← IGNORED; TC stays FAILED
//
//   Final Azure result for that TC: FAILED.
//   The opposite is also enforced: a PASS cannot demote a previously written
//   FAIL regardless of execution order.
//
// Flow:
//  1. initialize(tcIds)        → get point IDs, create run, get result IDs
//  2. updateResult(tcId, ...)  → update outcome (fail-wins applied)
//  3. finalize()               → close the run as Completed
// ─────────────────────────────────────────────────────────────────────────────

export class TestResultService {
  private runId: number | null     = null;
  private initialized              = false;
  private initError: string | null = null;

  /** tcId → { pointId, resultId } */
  private readonly mappings = new Map<string, TcRunMapping>();

  /**
   * Tracks the worst outcome seen so far per TC ID.
   * "Fail wins": once a TC is Failed it can never be overwritten with Passed.
   */
  private readonly tcWorstOutcome = new Map<string, 'Passed' | 'Failed'>();

  constructor(
    private readonly client: AzureDevOpsClient,
    private readonly cfg: AzureConfiguration,
  ) {}

  // ── Initialization ─────────────────────────────────────────────────────────

  async initialize(tcIds: string[]): Promise<void> {
    if (this.initialized) return;

    if (tcIds.length === 0) {
      this.initialized = true;
      await Logs.agregarLineaAlLog('[Azure] No se encontraron TC IDs — se omite la inicialización del Test Run');
      return;
    }

    try {
      await this.buildMappings(tcIds);

      const pointIds = [...this.mappings.values()].map((m) => m.pointId);
      if (pointIds.length === 0) {
        await Logs.agregarLineaAlLog('[Azure] Ningún test point encontrado para los TC IDs dados — se omite la creación del Test Run');
        this.initialized = true;
        return;
      }

      const runName = this.buildRunName();
      const run     = await this.client.createTestRun(runName, this.cfg.testPlanId, pointIds);
      this.runId    = run.id;

      await Logs.agregarLineaAlLogHeader(`[Azure] Test Run creado: #${this.runId} "${runName}"`);

      await this.resolveResultIds();
      this.initialized = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.initError   = msg;
      this.initialized = true;
      await Logs.agregarLineaAlLog(`[Azure] Error durante inicialización del Test Run: ${msg}`);
    }
  }

  // ── Result updates ─────────────────────────────────────────────────────────

  async updateResult(
    tcId: string,
    outcome: 'Passed' | 'Failed',
    options: {
      errorMessage?:  string;
      comment?:       string;
      durationInMs?:  number;
      startedDate?:   Date;
      completedDate?: Date;
    } = {},
  ): Promise<{ runId: number; resultId: number } | null> {
    const mapping = this.mappings.get(tcId);
    if (!mapping?.resultId || !this.runId) {
      await Logs.agregarLineaAlLog(
        `[Azure] Sin mapping de resultId para TC${tcId} — resultado no actualizado`,
      );
      return null;
    }

    // ── Fail-wins aggregation ────────────────────────────────────────────────
    const currentWorst = this.tcWorstOutcome.get(tcId);

    if (currentWorst === 'Failed' && outcome === 'Passed') {
      await Logs.agregarLineaAlLog(
        `[Azure] TC${tcId} ya tiene resultado FAILED — iteración PASSED no lo sobreescribe (fail-wins)`,
      );
      // Still return the ids so attachments can be uploaded to the result
      return { runId: this.runId, resultId: mapping.resultId };
    }

    this.tcWorstOutcome.set(tcId, outcome);
    // ── End fail-wins ────────────────────────────────────────────────────────

    const update: TestResultUpdate = {
      id:           mapping.resultId,
      state:        'Completed',
      outcome,
      comment:      options.comment,
      errorMessage: options.errorMessage?.slice(0, 1000),
      durationInMs: options.durationInMs,
      startedDate:  options.startedDate?.toISOString(),
      completedDate: options.completedDate?.toISOString(),
    };

    try {
      await this.client.updateTestResults(this.runId, [update]);
      await Logs.agregarLineaAlLogHeader(
        `[Azure] Resultado TC${tcId} → ${outcome} (resultId=${mapping.resultId})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLog(`[Azure] Error al actualizar resultado TC${tcId}: ${msg}`);
    }

    return { runId: this.runId, resultId: mapping.resultId };
  }

  // ── Finalization ───────────────────────────────────────────────────────────

  async finalize(): Promise<void> {
    if (!this.runId) return;
    try {
      await this.client.completeTestRun(this.runId);
      await Logs.agregarLineaAlLogHeader(`[Azure] Test Run #${this.runId} marcado como Completed`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await Logs.agregarLineaAlLogHeader(`[Azure] Error al cerrar Test Run #${this.runId}: ${msg}`);
    }
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  getRunId(): number | null   { return this.runId; }
  isReady(): boolean          { return this.initialized && !this.initError && this.runId !== null; }
  getInitError(): string | null { return this.initError; }
  getMapping(tcId: string): TcRunMapping | undefined { return this.mappings.get(tcId); }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private async buildMappings(tcIds: string[]): Promise<void> {
    const points  = await this.client.getTestPoints(this.cfg.testPlanId, this.cfg.testSuiteId);
    const tcIdSet = new Set(tcIds.map(String));

    for (const point of points) {
      const pointTcId = String(point.testCase.id);
      if (!tcIdSet.has(pointTcId)) continue;
      this.mappings.set(pointTcId, { tcId: pointTcId, pointId: point.id });
    }

    const found   = this.mappings.size;
    const missing = tcIds.filter((id) => !this.mappings.has(id));

    await Logs.agregarLineaAlLogHeader(
      `[Azure] Test Points encontrados: ${found}/${tcIds.length}` +
      (missing.length ? ` — sin point: TC${missing.join(', TC')}` : ''),
    );
  }

  private async resolveResultIds(): Promise<void> {
    if (!this.runId) return;
    const response = await this.client.getTestResults(this.runId);
    for (const result of response.value ?? []) {
      const mapping = this.mappings.get(String(result.testCase.id));
      if (mapping) mapping.resultId = result.id;
    }
    const withResult = [...this.mappings.values()].filter((m) => m.resultId).length;
    await Logs.agregarLineaAlLogHeader(`[Azure] Result IDs resueltos: ${withResult}/${this.mappings.size}`);
  }

  private buildRunName(): string {
    const date    = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const env     = process.env.ENV     ?? '';
    const browser = process.env.BROWSER ?? '';
    const tags    = process.env.TAGS    ?? '';

    return ['Playwright Automated Run', date, env, browser, tags]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(' — ');
  }
}
