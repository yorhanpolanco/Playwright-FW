import type { ExistingBug } from './types/azure.types';

// ─────────────────────────────────────────────────────────────────────────────
// ActiveDefectRegistry
//
// Process-global, in-memory registry of defects created or discovered during
// the current test run. Acts as Level-1 cache for duplicate detection.
//
// Keyed by two indices:
//  - fingerprint hash → ExistingBug
//  - test case ID     → ExistingBug (one-to-one; last write wins for same tcId)
//
// Prevents creating the same bug twice when the same fingerprint appears
// across different features / folders in one run.
// ─────────────────────────────────────────────────────────────────────────────

export class ActiveDefectRegistry {
  private readonly byFingerprint = new Map<string, ExistingBug>();
  private readonly byTcId        = new Map<string, ExistingBug>();

  register(bug: ExistingBug): void {
    if (bug.fingerprint) this.byFingerprint.set(bug.fingerprint, bug);
    if (bug.testCaseId)  this.byTcId.set(bug.testCaseId, bug);
  }

  findByFingerprint(hash: string): ExistingBug | undefined {
    return this.byFingerprint.get(hash);
  }

  findByTcId(tcId: string): ExistingBug | undefined {
    return this.byTcId.get(tcId);
  }

  has(fingerprint: string, tcId?: string): boolean {
    if (this.byFingerprint.has(fingerprint)) return true;
    if (tcId && this.byTcId.has(tcId))       return true;
    return false;
  }

  size(): number {
    return this.byFingerprint.size;
  }

  all(): ExistingBug[] {
    return [...this.byFingerprint.values()];
  }

  clear(): void {
    this.byFingerprint.clear();
    this.byTcId.clear();
  }
}
