import { describe, expect, it } from "vitest";
import { getReceivableEventLabel, receivableEventLabels } from "./receivableTimeline";

describe("receivable activity timeline", () => {
  it("provides a stable, user-facing label for every persisted event type", () => {
    expect(Object.keys(receivableEventLabels)).toEqual(["created", "payment-recorded", "payment-voided", "payment-replaced", "receipt-draft-created"]);
    expect(getReceivableEventLabel("created")).toBe("เพิ่มรายการลูกหนี้");
    expect(getReceivableEventLabel("payment-recorded")).toBe("บันทึกการรับชำระ");
    expect(getReceivableEventLabel("payment-voided")).toBe("ยกเลิกรายการรับชำระ");
    expect(getReceivableEventLabel("payment-replaced")).toBe("แทนที่รายการรับชำระ");
    expect(getReceivableEventLabel("receipt-draft-created")).toBe("สร้างใบเสร็จฉบับร่าง");
  });
});
