import { describe, expect, it } from "vitest";
import { getPdfExportStageIndex, pdfExportStages, runPdfExportLifecycle } from "./pdfExportStatus";

describe("PDF export status", () => {
  it("keeps the user-facing PDF stages in their intended order", () => {
    expect(pdfExportStages.map((stage) => stage.id)).toEqual(["preparing", "rendering", "downloading"]);
    expect(getPdfExportStageIndex("rendering")).toBe(1);
  });

  it("shows each export stage and closes the overlay after a successful download", async () => {
    const stages: Array<string | null> = [];
    await runPdfExportLifecycle({
      setStage: (stage) => stages.push(stage),
      prepare: async () => "fonts-ready",
      render: async (value) => `${value}:pdf-ready`,
      download: async () => undefined,
    });
    expect(stages).toEqual(["preparing", "rendering", "downloading", null]);
  });

  it("closes the overlay when rendering fails", async () => {
    const stages: Array<string | null> = [];
    await expect(runPdfExportLifecycle({
      setStage: (stage) => stages.push(stage),
      prepare: async () => "fonts-ready",
      render: async () => { throw new Error("canvas failed"); },
      download: async () => undefined,
    })).rejects.toThrow("canvas failed");
    expect(stages).toEqual(["preparing", "rendering", null]);
  });
});
