import { centsToMoney, deriveReceivableStatus, moneyToCents, type ReceivableStatus } from "./receivables";

export const agingBucketLabels = {
  current: "ยังไม่ถึงกำหนด",
  "1-30": "1–30 วัน",
  "31-60": "31–60 วัน",
  "61-90": "61–90 วัน",
  "90-plus": "มากกว่า 90 วัน",
} as const;

export type AgingBucketKey = keyof typeof agingBucketLabels;
export type AgingSourceRow = { id: number; invoiceId: number; documentNumber: string; customerName: string; issueDate: Date; dueDate: Date; totalAmount: string | number; paidAmount: string | number; status: ReceivableStatus };
export type MonthlyPayment = { amount: string | number; method: "cash" | "transfer" | "card" | "cheque" | "other" };

function calendarDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function getDaysPastDue(dueDate: Date, asOf: Date) {
  return Math.max(0, Math.floor((calendarDay(asOf) - calendarDay(dueDate)) / 86_400_000));
}

export function getAgingBucket(daysPastDue: number): AgingBucketKey {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "1-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "90-plus";
}

export function getMonthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error("เดือนอ้างอิงต้องอยู่ในรูปแบบ YYYY-MM");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("เดือนไม่ถูกต้อง");
  return { start: new Date(Date.UTC(year, monthIndex, 1)), end: new Date(Date.UTC(year, monthIndex + 1, 1)) };
}

export function buildReceivableAgingReport(input: { rows: AgingSourceRow[]; payments: MonthlyPayment[]; asOf: Date; month: string }) {
  const bucketTotals = new Map<AgingBucketKey, { totalCents: number; count: number }>(Object.keys(agingBucketLabels).map((key) => [key as AgingBucketKey, { totalCents: 0, count: 0 }]));
  const items = input.rows.flatMap((row) => {
    if (row.status === "cancelled") return [];
    const status = deriveReceivableStatus(row.totalAmount, row.paidAmount, row.dueDate, input.asOf);
    if (status === "paid") return [];
    const outstandingCents = Math.max(0, moneyToCents(row.totalAmount) - moneyToCents(row.paidAmount));
    if (!outstandingCents) return [];
    const daysPastDue = getDaysPastDue(row.dueDate, input.asOf);
    const bucket = getAgingBucket(daysPastDue);
    const aggregate = bucketTotals.get(bucket)!;
    aggregate.totalCents += outstandingCents;
    aggregate.count += 1;
    return [{ ...row, status, outstanding: centsToMoney(outstandingCents), daysPastDue, bucket }];
  });
  const collectionByMethod = input.payments.reduce<Record<MonthlyPayment["method"], number>>((summary, payment) => {
    summary[payment.method] += moneyToCents(payment.amount);
    return summary;
  }, { cash: 0, transfer: 0, card: 0, cheque: 0, other: 0 });
  const collectedCents = Object.values(collectionByMethod).reduce((sum, amount) => sum + amount, 0);
  return {
    asOf: input.asOf,
    month: input.month,
    buckets: (Object.keys(agingBucketLabels) as AgingBucketKey[]).map((key) => ({ key, label: agingBucketLabels[key], count: bucketTotals.get(key)!.count, outstanding: centsToMoney(bucketTotals.get(key)!.totalCents) })),
    items: items.sort((left, right) => right.daysPastDue - left.daysPastDue || left.dueDate.getTime() - right.dueDate.getTime()),
    summary: { outstanding: centsToMoney(bucketTotals.values().reduce((sum, bucket) => sum + bucket.totalCents, 0)), invoiceCount: items.length, collectedThisMonth: centsToMoney(collectedCents), paymentCount: input.payments.length, collectedByMethod: Object.fromEntries(Object.entries(collectionByMethod).map(([method, amount]) => [method, centsToMoney(amount)])) },
  };
}
