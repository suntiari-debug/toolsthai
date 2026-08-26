import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentExportHistoryPanel } from "./DocumentExportHistoryPanel";

describe("DocumentExportHistoryPanel", () => {
  it("renders the PDF filename and export timestamp when history exists", () => {
    const html = renderToStaticMarkup(<DocumentExportHistoryPanel isLoading={false} exports={[{ id: 1, filename: "ใบเสนอราคา ACME.pdf", createdAt: new Date("2026-08-26T09:00:00.000Z") }]} />);
    expect(html).toContain("ใบเสนอราคา ACME.pdf");
    expect(html).toContain("26 ส.ค.");
  });

  it("renders the empty-state message when the document has not been exported", () => {
    const html = renderToStaticMarkup(<DocumentExportHistoryPanel isLoading={false} exports={[]} />);
    expect(html).toContain("ยังไม่พบประวัติการส่งออก PDF");
  });
});
