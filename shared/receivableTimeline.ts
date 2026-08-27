export const receivableEventLabels = {
  created: "เพิ่มรายการลูกหนี้",
  "payment-recorded": "บันทึกการรับชำระ",
  "payment-voided": "ยกเลิกรายการรับชำระ",
  "payment-replaced": "แทนที่รายการรับชำระ",
  "receipt-draft-created": "สร้างใบเสร็จฉบับร่าง",
} as const;

export type ReceivableEventType = keyof typeof receivableEventLabels;

export function getReceivableEventLabel(type: ReceivableEventType) {
  return receivableEventLabels[type];
}
