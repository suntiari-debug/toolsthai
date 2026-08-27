import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("receipt draft idempotency strategy", () => {
  it("enforces one receipt source per receivable at the database boundary", async () => {
    const migration = await readFile(new URL("../drizzle/0009_magical_wolf_cub.sql", import.meta.url), "utf8");
    expect(migration).toContain("CONSTRAINT `receipt_sources_receivable_unique` UNIQUE(`receivableId`)");
    expect(migration).toContain("CONSTRAINT `receipt_sources_receipt_document_unique` UNIQUE(`receiptDocumentId`)");
  });

  it("uses a transaction and resolves a duplicate-key race by reopening the existing draft", async () => {
    const implementation = await readFile(new URL("./db.ts", import.meta.url), "utf8");
    const createReceiptDraft = implementation.slice(implementation.indexOf("export async function createReceiptDraft"), implementation.indexOf("export async function getReceivableAgingReport"));
    expect(createReceiptDraft).toContain("return await db.transaction");
    expect(createReceiptDraft).toContain('code !== "ER_DUP_ENTRY"');
    expect(createReceiptDraft).toContain("getReceiptEligibility(userId, receivableId)");
    expect(createReceiptDraft).toContain("created: false");
  });
});
