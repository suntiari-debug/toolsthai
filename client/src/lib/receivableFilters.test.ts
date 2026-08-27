import { describe, expect, it } from "vitest";
import { filterReceivables } from "./receivableFilters";

const rows = [
  { documentNumber: "IV-001", customerName: "ACME", dueDate: "2026-08-10T00:00:00.000Z", status: "open" },
  { documentNumber: "IV-002", customerName: "Baan Thai", dueDate: "2026-08-20T00:00:00.000Z", status: "partial" },
  { documentNumber: "IV-003", customerName: "Cedar", dueDate: "2026-09-01T00:00:00.000Z", status: "paid" },
];

describe("filterReceivables", () => {
  it("filters due dates inclusively while preserving other filters", () => {
    expect(filterReceivables(rows, { status: "all", searchTerm: "", dueFrom: "2026-08-10", dueTo: "2026-08-20" }).map((row) => row.documentNumber)).toEqual(["IV-001", "IV-002"]);
    expect(filterReceivables(rows, { status: "partial", searchTerm: "baan", dueFrom: "2026-08-01", dueTo: "2026-08-31" }).map((row) => row.documentNumber)).toEqual(["IV-002"]);
  });
});
