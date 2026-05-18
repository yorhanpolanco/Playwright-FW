import crypto from 'crypto';
import type { ErrorFingerprint, ErrorCategory, StepRecord } from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// ErrorFingerprintService
//
// Generates a stable, normalized fingerprint from a test failure.
// Used for duplicate bug detection and building the bug title.
//
// Normalization removes dynamic data (timestamps, IDs, GUIDs, URLs, tokens)
// so the same logical error produces the same fingerprint across runs.
// ─────────────────────────────────────────────────────────────────────────────

export class ErrorFingerprintService {

  generate(
    errorMessage: string,
    stackTrace:   string | undefined,
    steps:        StepRecord[],
    testTitle:    string,
  ): ErrorFingerprint {
    const rawMessage        = errorMessage;
    const normalizedMessage = this.normalizeMessage(errorMessage);
    const normalizedStack   = this.normalizeStack(stackTrace ?? '');
    const errorType         = this.extractErrorType(errorMessage, stackTrace ?? '');
    const errorCategory     = this.classifyError(errorMessage, stackTrace ?? '');
    const stepContext       = this.extractStepContext(steps);

    const fingerprintInput = [
      errorType,
      normalizedMessage.slice(0, 200),
      normalizedStack.split('\n').slice(0, 5).join('|'),
      stepContext.slice(0, 3).join('|'),
    ].join('::');

    const hash = crypto
      .createHash('sha256')
      .update(fingerprintInput)
      .digest('hex')
      .slice(0, 12);

    return { hash, normalizedMessage, errorType, errorCategory, stepContext, rawMessage };
  }

  buildBugTitle(fingerprint: ErrorFingerprint, testTitle: string, maxLength = 200): string {
    const prefix    = `[AUTO] ${testTitle}`;
    const separator = ' — ';
    const remaining = maxLength - prefix.length - separator.length;
    const excerpt   = fingerprint.normalizedMessage.slice(0, Math.max(20, remaining));
    return `${prefix}${separator}${excerpt}`.slice(0, maxLength).replace(/[<>"]/g, '');
  }

  normalizeMessage(msg: string): string {
    return msg
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.Z+\-]+/g, '<TIMESTAMP>')
      .replace(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/g, '<DATETIME>')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<GUID>')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<JWT>')
      .replace(/Bearer\s+[A-Za-z0-9._\-+/=]{10,}/g, 'Bearer <TOKEN>')
      .replace(/api[_-]?key[=:\s]+[A-Za-z0-9._\-+/=]{8,}/gi, 'api_key=<KEY>')
      .replace(/\b\d{6,}\b/g, '<ID>')
      .replace(/https?:\/\/([^/\s]+)\/[^\s]*/g, 'https://$1/<PATH>')
      .replace(/[?&][A-Za-z_]+(SessionId|CorrelationId|RequestId|Token)=[^\s&]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeStack(stack: string): string {
    return stack
      .replace(/[A-Z]:\\[^\s:)]+/g, '<PATH>')
      .replace(/\/[^\s:)]{1,500}\.(?:ts|js|mjs|cjs)/g, '<FILE>')
      .replace(/:\d+:\d+/g, '')
      .replace(/node_modules\/[^\s)]+/g, 'node_modules/<MODULE>')
      .trim();
  }

  private extractErrorType(message: string, stack: string): string {
    const stackMatch = stack.match(/^([A-Za-z]+Error|[A-Za-z]+Exception):/m);
    if (stackMatch) return stackMatch[1];
    const msgMatch = message.match(/^([A-Za-z]+Error|[A-Za-z]+Exception):/);
    if (msgMatch) return msgMatch[1];
    if (/expect\(.{0,1000}\)\.to/i.test(message)) return 'AssertionError';
    if (/Timeout/i.test(message))           return 'TimeoutError';
    if (/ECONNREFUSED|ENOTFOUND/i.test(message)) return 'NetworkError';
    return 'UnknownError';
  }

  private classifyError(message: string, stack: string): ErrorCategory {
    const combined = `${message}\n${stack}`;
    if (/expect\(.{0,1000}\)\.to|AssertionError/i.test(combined)) return 'assertion';
    if (/TimeoutError|timed out|exceeded/i.test(combined))         return 'timeout';
    if (/ECONNREFUSED|ENOTFOUND|net::ERR_|socket/i.test(combined)) return 'network';
    if (/locator|waiting for|no element|not found/i.test(combined)) return 'element-not-found';
    if (/navigation|goto|page\.go/i.test(combined))                return 'navigation';
    if (/EPIPE|ECONNRESET|hang up/i.test(combined))                return 'infrastructure';
    return 'unknown';
  }

  private extractStepContext(steps: StepRecord[]): string[] {
    return steps
      .filter((s) => s.category === 'test.step')
      .sort((a, b) => a.order - b.order)
      .slice(-5)
      .map((s) => s.title);
  }
}
