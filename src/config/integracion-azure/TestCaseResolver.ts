import type { Suite, TestCase } from '@playwright/test/reporter';
import Logs from '../logConfig';

// ─────────────────────────────────────────────────────────────────────────────
// TestCaseResolver
//
// Extracts @TC### tags from Playwright test annotations and builds a stable
// testId → tcId map during onBegin.
//
// Iteration mapping rule:
//   tag: ['@TC12', '@TC14', '@TC075'] with 3 tests in the loop
//   → test[0] → TC12,  test[1] → TC14,  test[2] → TC075
//
// Modulo wrapping (more iterations than TC tags):
//   tag: ['@TC12', '@TC14']  with 3 tests in the loop
//   → test[0] → TC12,  test[1] → TC14,  test[2] → TC12  (wraps + warns)
//   TC12 has 2 iterations, TC14 has 1 iteration.
//
// Fail-wins contract: the caller is responsible for aggregating outcomes per
// TC ID.  This resolver only handles the test→tcId mapping and iteration idx.
// ─────────────────────────────────────────────────────────────────────────────

const TC_TAG_PATTERN = /^@TC(\d{1,10})$/i;

export class TestCaseResolver {
  /** testId → numeric TC ID string (without leading zeros) */
  private readonly tcMap             = new Map<string, string>();
  /** testId → 0-based iteration index within its TC group */
  private readonly iterationIndexMap = new Map<string, number>();
  /** tcId → total number of tests mapped to it */
  private readonly tcCountMap        = new Map<string, number>();

  // ── Public interface ───────────────────────────────────────────────────────

  /** Call once in onBegin to pre-build the entire mapping. */
  buildMapping(rootSuite: Suite): void {
    this.tcMap.clear();
    this.iterationIndexMap.clear();
    this.tcCountMap.clear();
    this.walkSuite(rootSuite);
    void Logs.agregarLineaAlLogHeader(
      `[Azure] TestCaseResolver: ${this.tcMap.size} test(s) mapeados a Test Cases`,
    );
  }

  /** Returns the resolved TC ID for a given Playwright test ID, or undefined. */
  resolveTcId(testId: string): string | undefined {
    return this.tcMap.get(testId);
  }

  /** Returns all unique TC IDs that were resolved. */
  getAllTcIds(): string[] {
    return [...new Set(this.tcMap.values())];
  }

  /**
   * Returns the 0-based iteration index of a test within its TC group.
   * Example: if TC12 has 3 tests, they return 0, 1, 2 respectively.
   */
  getIterationIndex(testId: string): number {
    return this.iterationIndexMap.get(testId) ?? 0;
  }

  /**
   * Returns how many Playwright tests are mapped to a given TC ID.
   * 1 means a single test (no subindex needed); > 1 means multi-iteration.
   */
  getTcTestCount(tcId: string): number {
    return this.tcCountMap.get(tcId) ?? 1;
  }

  /** Returns true when more than one test shares the same TC ID. */
  isMultiIteration(tcId: string): boolean {
    return (this.tcCountMap.get(tcId) ?? 1) > 1;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private walkSuite(suite: Suite): void {
    this.assignTcIds(suite.tests ?? []);
    for (const child of suite.suites ?? []) {
      this.walkSuite(child);
    }
  }

  /**
   * Groups sibling tests by their canonical TC tag fingerprint, then assigns
   * TC IDs positionally within each group with modulo wrapping.
   */
  private assignTcIds(tests: TestCase[]): void {
    const groups = new Map<string, TestCase[]>();

    for (const test of tests) {
      const tcTags = this.extractTcTags(test.tags);
      if (tcTags.length === 0) continue;
      const key = tcTags.join('|');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(test);
    }

    for (const [key, group] of groups) {
      const tcTags = key.split('|');

      if (group.length > tcTags.length) {
        void Logs.agregarLineaAlLogHeader(
          `[Azure] Aviso: ${group.length} iteraciones para ${tcTags.length} TC tag(s) ` +
          `(${tcTags.join(', ')}) — se aplicará módulo. ` +
          `Cada TC con múltiples iteraciones usará regla fail-wins.`,
        );
      }

      group.forEach((test, groupIdx) => {
        const tag  = tcTags[groupIdx % tcTags.length];
        const tcId = this.parseTcId(tag);
        if (!tcId) return;

        this.tcMap.set(test.id, tcId);

        // 0-based index within this specific TC (not within the group)
        const currentTcCount = this.tcCountMap.get(tcId) ?? 0;
        this.iterationIndexMap.set(test.id, currentTcCount);
        this.tcCountMap.set(tcId, currentTcCount + 1);

        void Logs.agregarLineaAlLogHeader(
          `[Azure] Mapping: "${test.title}" → TC${tcId}` +
          (currentTcCount > 0 ? ` (iteración ${currentTcCount + 1})` : ''),
        );
      });
    }
  }

  /** Returns only the @TC### tags from a tag array, preserving order. */
  private extractTcTags(tags: string[]): string[] {
    return tags.filter((t) => TC_TAG_PATTERN.test(t));
  }

  /** Parses "@TC012" → "12" (strips leading zeros). Returns '' on no match. */
  private parseTcId(tag: string): string {
    const m = tag.match(TC_TAG_PATTERN);
    return m ? String(parseInt(m[1], 10)) : '';
  }
}

// ── Standalone helper ─────────────────────────────────────────────────────────

export function extractTcIdsFromTags(tags: string[]): string[] {
  return tags
    .filter((t) => TC_TAG_PATTERN.test(t))
    .map((t) => { const m = t.match(TC_TAG_PATTERN); return m ? String(parseInt(m[1], 10)) : ''; })
    .filter(Boolean);
}
