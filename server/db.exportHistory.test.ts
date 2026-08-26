import { describe, expect, it } from "vitest";
import { summarizeDocumentExportHistory } from "./db";

describe("summarizeDocumentExportHistory", () => {
  it("counts exports per document and preserves the latest timestamp from a descending history query", () => {
    const newest = new Date("2026-08-26T09:00:00.000Z");
    const summary = summarizeDocumentExportHistory([
      { documentId: 12, createdAt: newest },
      { documentId: 12, createdAt: new Date("2026-08-25T09:00:00.000Z") },
      { documentId: 99, createdAt: new Date("2026-08-24T09:00:00.000Z") },
    ]);

    expect(summary.get(12)).toEqual({ exportCount: 2, lastExportedAt: newest });
    expect(summary.get(99)).toEqual({ exportCount: 1, lastExportedAt: new Date("2026-08-24T09:00:00.000Z") });
    expect(summary.get(777)).toBeUndefined();
  });
});
