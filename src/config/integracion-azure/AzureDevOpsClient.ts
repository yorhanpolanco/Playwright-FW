import https from 'https';
import { URL } from 'url';
import Logs from '../logConfig';
import type { AzureConfiguration } from './types/azure.types';
import type {
  TestPoint,
  TestPointsResponse,
  TestRun,
  TestResultsResponse,
  TestResultUpdate,
  TestResultAttachment,
  AttachmentUploadResult,
  WitAttachmentUploadResult,
  WorkItem,
  JsonPatchOperation,
  WiqlQuery,
  WiqlResult,
} from './types/azure.types';

// ── Custom errors ──────────────────────────────────────────────────────────────

class RateLimitError extends Error {
  constructor(message: string) { super(message); this.name = 'RateLimitError'; }
}
class AzureServerError extends Error {
  constructor(public statusCode: number, message: string) { super(message); this.name = 'AzureServerError'; }
}
class AzureClientError extends Error {
  constructor(public statusCode: number, message: string) { super(message); this.name = 'AzureClientError'; }
}

// ── Internal request options ───────────────────────────────────────────────────

interface HttpOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  contentType?: string;
  binaryBuffer?: Buffer;
  baseOverride?: string;
  queryParams?: Record<string, string>;
}

// ── Client ─────────────────────────────────────────────────────────────────────

export class AzureDevOpsClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly apiVersion: string;
  private readonly clientMaxRetries: number;

  constructor(private readonly cfg: AzureConfiguration) {
    this.baseUrl     = `https://dev.azure.com/${cfg.org}/${encodeURIComponent(cfg.project)}`;
    this.authHeader  = `Basic ${Buffer.from(`:${cfg.pat}`).toString('base64')}`;
    this.apiVersion  = cfg.apiVersion;
    this.clientMaxRetries = 3;
  }

  // ── Test Plan / Suite / Points ───────────────────────────────────────────────

  async getTestPoints(planId: string, suiteId: string): Promise<TestPoint[]> {
    const data = await this.request<TestPointsResponse>({
      method: 'GET',
      path: `/_apis/test/Plans/${planId}/Suites/${suiteId}/points`,
    });
    return data.value ?? [];
  }

  async getTestPointsByTestCaseId(
    planId: string,
    suiteId: string,
    testCaseId: string,
  ): Promise<TestPoint[]> {
    const data = await this.request<TestPointsResponse>({
      method: 'GET',
      path: `/_apis/testplan/Plans/${planId}/Suites/${suiteId}/Testpoint`,
      queryParams: { testCaseID: testCaseId, 'api-version': '7.1-preview.2' },
    });
    return data.value ?? [];
  }

  // ── Test Runs ────────────────────────────────────────────────────────────────

  async createTestRun(name: string, planId: string, pointIds: number[]): Promise<TestRun> {
    return this.request<TestRun>({
      method: 'POST',
      path: '/_apis/test/runs',
      body: {
        name,
        isAutomated: true,
        plan: { id: parseInt(planId, 10) },
        pointIds,
      },
    });
  }

  async completeTestRun(runId: number): Promise<void> {
    await this.request<unknown>({
      method: 'PATCH',
      path: `/_apis/test/runs/${runId}`,
      body: { state: 'Completed' },
    });
  }

  // ── Test Results ─────────────────────────────────────────────────────────────

  async getTestResults(runId: number): Promise<TestResultsResponse> {
    return this.request<TestResultsResponse>({
      method: 'GET',
      path: `/_apis/test/runs/${runId}/results`,
    });
  }

  async updateTestResults(runId: number, updates: TestResultUpdate[]): Promise<void> {
    await this.request<unknown>({
      method: 'PATCH',
      path: `/_apis/test/Runs/${runId}/results`,
      body: updates,
    });
  }

  async associateBugWithResult(runId: number, resultId: number, bugId: number): Promise<void> {
    // PATCH the batch results endpoint with associatedBugs.
    // Matches the validated "Vincular-TestResul-Bug" request from the
    // apiToUpdateTestCase Postman collection: PATCH /test/Runs/{runId}/results
    // body: [{ "id": resultId, "associatedBugs": [{ "id": bugId }] }]
    await this.request<unknown>({
      method: 'PATCH',
      path: `/_apis/test/Runs/${runId}/results`,
      body: [{ id: resultId, associatedBugs: [{ id: bugId }] }],
    });
  }

  // ── Test Result Attachments (base64 JSON stream) ─────────────────────────────

  async uploadTestResultAttachment(
    runId: number,
    resultId: number,
    attachment: TestResultAttachment,
  ): Promise<AttachmentUploadResult> {
    return this.request<AttachmentUploadResult>({
      method: 'POST',
      path: `/_apis/test/Runs/${runId}/Results/${resultId}/attachments`,
      body: attachment,
    });
  }

  // ── Work Item Attachments (octet-stream) ─────────────────────────────────────

  async uploadWorkItemAttachment(
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<WitAttachmentUploadResult> {
    return this.request<WitAttachmentUploadResult>({
      method: 'POST',
      path: '/_apis/wit/attachments',
      queryParams: { fileName },
      binaryBuffer: fileBuffer,
    });
  }

  // ── Work Items (Bugs) ────────────────────────────────────────────────────────

  async createWorkItem(type: string, operations: JsonPatchOperation[]): Promise<WorkItem> {
    return this.request<WorkItem>({
      method: 'POST',
      path: `/_apis/wit/workitems/$${type}`,
      body: operations,
      contentType: 'application/json-patch+json',
    });
  }

  async updateWorkItem(id: number, operations: JsonPatchOperation[]): Promise<WorkItem> {
    return this.request<WorkItem>({
      method: 'PATCH',
      path: `/_apis/wit/workitems/${id}`,
      body: operations,
      contentType: 'application/json-patch+json',
    });
  }

  async getWorkItem(id: number, expand?: string): Promise<WorkItem> {
    const queryParams: Record<string, string> = {};
    if (expand) queryParams['$expand'] = expand;
    return this.request<WorkItem>({
      method: 'GET',
      path: `/_apis/wit/workitems/${id}`,
      queryParams,
    });
  }

  async queryWorkItems(wiql: WiqlQuery): Promise<WiqlResult> {
    return this.request<WiqlResult>({
      method: 'POST',
      path: '/_apis/wit/wiql',
      body: wiql,
    });
  }

  async getWorkItemsBatch(ids: number[]): Promise<WorkItem[]> {
    if (ids.length === 0) return [];
    const data = await this.request<{ value: WorkItem[] }>({
      method: 'POST',
      path: '/_apis/wit/workitemsbatch',
      body: { ids, fields: ['System.Id', 'System.Title', 'System.State', 'System.WorkItemType'] },
    });
    return data.value ?? [];
  }

  // ── Core HTTP ────────────────────────────────────────────────────────────────

  private async request<T>(opts: HttpOptions): Promise<T> {
    return this.withRetry(() => this.doRequest<T>(opts));
  }

  private buildUrl(opts: HttpOptions): string {
    const base = opts.baseOverride ?? this.baseUrl;
    const url   = new URL(`${base}${opts.path}`);

    if (!opts.queryParams?.['api-version']) {
      url.searchParams.set('api-version', this.apiVersion);
    }

    if (opts.queryParams) {
      for (const [k, v] of Object.entries(opts.queryParams)) {
        url.searchParams.set(k, v);
      }
    }

    return url.toString();
  }

  private async doRequest<T>(opts: HttpOptions): Promise<T> {
    const url    = this.buildUrl(opts);
    const parsed = new URL(url);

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    let bodyBuffer: Buffer | undefined;

    if (opts.binaryBuffer) {
      headers['Content-Type']   = 'application/octet-stream';
      headers['Content-Length'] = String(opts.binaryBuffer.byteLength);
      bodyBuffer = opts.binaryBuffer;
    } else if (opts.body !== undefined) {
      const ct = opts.contentType ?? 'application/json';
      const raw = JSON.stringify(opts.body);
      headers['Content-Type']   = ct;
      headers['Content-Length'] = String(Buffer.byteLength(raw, 'utf8'));
      bodyBuffer = Buffer.from(raw, 'utf8');
    }

    return new Promise<T>((resolve, reject) => {
      const reqOpts: https.RequestOptions = {
        hostname:           parsed.hostname,
        port:               443,
        path:               `${parsed.pathname}${parsed.search}`,
        method:             opts.method,
        headers,
        rejectUnauthorized: false,
        timeout:            30_000,
      };

      const req = https.request(reqOpts, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer | string) =>
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
        );
        res.on('end', () => {
          const raw    = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;

          if (status === 204) { resolve(undefined as unknown as T); return; }
          if (status === 429) { reject(new RateLimitError(`Azure rate-limit (429): ${parsed.pathname}`)); return; }
          if (status >= 500)  { reject(new AzureServerError(status, `Azure server error ${status}: ${raw.slice(0, 300)}`)); return; }
          if (status >= 400)  { reject(new AzureClientError(status, `Azure client error ${status}: ${raw.slice(0, 300)}`)); return; }

          try   { resolve(JSON.parse(raw) as T); }
          catch { resolve(raw as unknown as T); }
        });
      });

      req.on('timeout', () => { req.destroy(); reject(new Error(`[Azure] Request timeout: ${parsed.pathname}`)); });
      req.on('error',   reject);
      if (bodyBuffer) req.write(bodyBuffer);
      req.end();
    });
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < this.clientMaxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof RateLimitError) {
          const delay = Math.pow(2, attempt) * 1500;
          await Logs.agregarLineaAlLog(`[Azure] Rate limited — reintentando en ${delay}ms (intento ${attempt + 1}/${this.clientMaxRetries})`);
          await this.sleep(delay);
        } else if (err instanceof AzureServerError) {
          const delay = 1000 * (attempt + 1);
          await Logs.agregarLineaAlLog(`[Azure] Error de servidor — reintentando en ${delay}ms (intento ${attempt + 1}/${this.clientMaxRetries})`);
          await this.sleep(delay);
        } else {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
