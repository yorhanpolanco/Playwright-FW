import type { TestAttemptRecord, FlakyAnalysis } from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// FlakyDetector
//
// Analyses the retry history of a test to decide whether a failure should be
// classified as "flaky" (intermittent / infrastructure) rather than a true
// defect.  A flaky test must NOT trigger bug creation.
//
// Rules (any one is sufficient to declare flakiness):
//  1. The test PASSED in at least one retry → definitively flaky.
//  2. All attempts failed AND count >= threshold → persistent failure, NOT flaky.
//  3. Error messages change significantly across attempts → inconsistent.
//  4. All failures are timeout-based with no stable stack → infrastructure.
//  5. The stack trace differs substantially between attempts (>40% difference).
//  6. There is only one failure and it looks like a transient infrastructure
//     issue (connection reset, ECONNREFUSED, net::ERR_*).
// ─────────────────────────────────────────────────────────────────────────────

const INFRASTRUCTURE_PATTERNS = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /net::ERR_/i,
  /socket hang up/i,
  /Request timeout/i,
  /ENOTFOUND/i,
  /EPIPE/i,
];

const TIMEOUT_PATTERNS = [
  /TimeoutError/i,
  /page\.waitFor/i,
  /locator\.[^\n]{0,500}timed out/i,
  /Timeout \d+ms exceeded/i,
];

export class FlakyDetector {

  constructor(private readonly threshold: number = 3) {}

  analyze(attempts: TestAttemptRecord[]): FlakyAnalysis {
    if (attempts.length === 0) {
      return { isFlaky: false, confidence: 0 };
    }

    // Rule 1 — passed on any retry
    const passedAttempt = attempts.find((a) => a.status === 'passed');
    if (passedAttempt) {
      return {
        isFlaky:          true,
        confidence:       1.0,
        passedOnAttempt:  passedAttempt.retry,
        reason:           `El test pasó en el ${passedAttempt.retry + 1} intento — comportamiento flaky confirmado`,
      };
    }

    const failedAttempts = attempts.filter(
      (a) => a.status === 'failed' || a.status === 'timedOut',
    );

    // Rule 2 — persistent failure: all attempts failed and count meets threshold
    if (failedAttempts.length >= this.threshold) {
      return { isFlaky: false, confidence: 0 };
    }

    if (failedAttempts.length < 2) {
      // Only one recorded failure — check for infrastructure signals
      const singleMsg = failedAttempts[0]?.errorMessage ?? '';
      if (this.isInfrastructureError(singleMsg)) {
        return {
          isFlaky:    true,
          confidence: 0.75,
          reason:     'Único fallo con patrón de error de infraestructura',
        };
      }
      return { isFlaky: false, confidence: 0 };
    }

    // Rule 3 — error messages change across attempts
    const messages = failedAttempts.map((a) => this.normalize(a.errorMessage ?? ''));
    if (this.significantlyDifferent(messages)) {
      return {
        isFlaky:    true,
        confidence: 0.85,
        reason:     'Los mensajes de error cambian significativamente entre intentos',
      };
    }

    // Rule 4 — all failures are timeouts with different stack origins
    const allTimeouts = failedAttempts.every((a) =>
      this.isTimeoutError(a.errorMessage ?? ''),
    );
    if (allTimeouts) {
      const stacks = failedAttempts.map((a) => a.stackTrace ?? '');
      if (this.significantlyDifferent(stacks)) {
        return {
          isFlaky:    true,
          confidence: 0.80,
          reason:     'Todos los fallos son timeouts con stack traces distintos — posible problema de infraestructura',
        };
      }
    }

    // Rule 5 — stack traces differ substantially
    const stacks = failedAttempts
      .map((a) => a.stackTrace ?? '')
      .filter(Boolean);
    if (stacks.length >= 2 && this.stacksDiverge(stacks)) {
      return {
        isFlaky:    true,
        confidence: 0.70,
        reason:     'Los stack traces difieren sustancialmente entre intentos',
      };
    }

    return { isFlaky: false, confidence: 0 };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private normalize(msg: string): string {
    return msg
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.Z+-]+/g, '<DATE>')   // ISO dates
      .replace(/\b\d{10,}\b/g, '<ID>')                        // long numeric IDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<GUID>')
      .replace(/https?:\/\/[^\s]+/g, '<URL>')
      .replace(/\d{1,10}ms/g, '<MS>')
      .trim();
  }

  private isInfrastructureError(msg: string): boolean {
    return INFRASTRUCTURE_PATTERNS.some((p) => p.test(msg));
  }

  private isTimeoutError(msg: string): boolean {
    return TIMEOUT_PATTERNS.some((p) => p.test(msg));
  }

  private significantlyDifferent(strings: string[]): boolean {
    if (strings.length < 2) return false;
    const [first, ...rest] = strings;
    return rest.some((s) => this.similarity(first, s) < 0.6);
  }

  private stacksDiverge(stacks: string[]): boolean {
    // Compare the first meaningful line of each stack trace
    const firstLines = stacks.map((s) => this.firstMeaningfulLine(s));
    const [first, ...rest] = firstLines;
    return rest.some((line) => line !== first);
  }

  private firstMeaningfulLine(stack: string): string {
    return (
      stack
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('at ')) ?? ''
    );
  }

  /**
   * Jaccard-inspired character-level similarity in [0, 1].
   * Fast enough for short strings and does not need any library.
   */
  private similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const setA = new Set(this.bigrams(a));
    const setB = new Set(this.bigrams(b));
    const intersection = [...setA].filter((bg) => setB.has(bg)).length;
    const union = setA.size + setB.size - intersection;

    return union === 0 ? 1 : intersection / union;
  }

  private bigrams(s: string): string[] {
    const result: string[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      result.push(s.slice(i, i + 2));
    }
    return result;
  }
}
