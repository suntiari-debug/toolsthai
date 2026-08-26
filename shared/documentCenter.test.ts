import { describe, expect, it } from "vitest";
import { makeCopyDocumentNumber, summarizeDocumentStatuses } from "./documentCenter";

describe("document center helpers", () => {
  it("creates a unique copy number within the database column limit", () => {
    const copyNumber = makeCopyDocumentNumber("QT-2026-0000000000000000000000000000000000000000000000000000000000", 1_775_000_000_000);
    expect(copyNumber).toMatch(/-COPY-/);
    expect(copyNumber.length).toBeLessThanOrEqual(64);
  });

  it("summarizes document statuses for the center dashboard", () => {
    expect(summarizeDocumentStatuses([{ status: "draft" }, { status: "sent" }, { status: "overdue" }, { status: "paid" }])).toEqual({ total: 4, awaiting: 2, paid: 1 });
  });
});
