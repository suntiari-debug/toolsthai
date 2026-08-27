import { describe, expect, it } from "vitest";
import { getReceivableEventLabel, receivableEventLabels } from "./receivableTimeline";

describe("receivable activity timeline", () => {
  it("provides a stable, user-facing label for every persisted event type", () => {
    expect(Object.keys(receivableEventLabels)).toEqual(["created", "payment-recorded"]);
    expect(getReceivableEventLabel("created")).toBe("เพิ่มรายการลูกหนี้");
    expect(getReceivableEventLabel("payment-recorded")).toBe("บันทึกการรับชำระ");
  });
});
