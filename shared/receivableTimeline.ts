export const receivableEventLabels = {
  created: "เพิ่มรายการลูกหนี้",
  "payment-recorded": "บันทึกการรับชำระ",
} as const;

export type ReceivableEventType = keyof typeof receivableEventLabels;

export function getReceivableEventLabel(type: ReceivableEventType) {
  return receivableEventLabels[type];
}
