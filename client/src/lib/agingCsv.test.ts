import { describe, expect, it } from "vitest";
import { createAgingReportCsv, getAgingReportFilename } from "./agingCsv";

describe("aging report CSV", () => {
  const report = { asOf: "2026-08-31T00:00:00.000Z", month: "2026-08", buckets: [{ label: "1–30 วัน", count: 1, outstanding: "500.00" }], items: [{ documentNumber: "IV-001", customerName: "บริษัท \"เอ\" จำกัด", issueDate: "2026-08-01T00:00:00.000Z", dueDate: "2026-08-20T00:00:00.000Z", totalAmount: "1000.00", paidAmount: "500.00", outstanding: "500.00", daysPastDue: 11, bucket: "1-30", status: "partial" }], summary: { outstanding: "500.00", invoiceCount: 1, collectedThisMonth: "500.00", paymentCount: 1, collectedByMethod: { transfer: "500.00", cash: "0.00" } } };

  it("writes Thai summary/detail sections with a UTF-8 BOM and escapes customer names", () => {
    const csv = createAgingReportCsv(report);
    expect(csv).toContain("\ufeffรายงานอายุลูกหนี้ Tools Thai");
    expect(csv).toContain("สรุปรับชำระเดือนที่เลือก");
    expect(csv).toContain('"บริษัท ""เอ"" จำกัด"');
    expect(csv).toContain("IV-001");
  });

  it("builds a readable filename from the report as-of date", () => {
    expect(getAgingReportFilename("2026-08-31")).toBe("รายงานอายุลูกหนี้-2026-08-31.csv");
  });
});
