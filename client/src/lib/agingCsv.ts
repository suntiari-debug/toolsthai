type AgingBucket = { label: string; count: number; outstanding: string };
type AgingItem = { documentNumber: string; customerName: string; issueDate: Date | string; dueDate: Date | string; totalAmount: string | number; paidAmount: string | number; outstanding: string | number; daysPastDue: number; bucket: string; status: string };
type AgingReport = { asOf: Date | string; month: string; buckets: AgingBucket[]; items: AgingItem[]; summary: { outstanding: string; invoiceCount: number; collectedThisMonth: string; paymentCount: number; collectedByMethod: Record<string, string> } };

function escapeCsv(value: string | number | null | undefined) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function row(values: Array<string | number | null | undefined>) {
  return values.map(escapeCsv).join(",");
}

const formatDateOnly = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const paymentMethodLabels: Record<string, string> = { cash: "เงินสด", transfer: "โอนเงิน", card: "บัตร", cheque: "เช็ค", other: "อื่น ๆ" };

export function createAgingReportCsv(report: AgingReport) {
  const lines = [
    row(["รายงานอายุลูกหนี้ Tools Thai"]),
    row(["วันอ้างอิง", formatDateOnly(report.asOf)]),
    row(["เดือนรับชำระ", report.month]),
    row([]),
    row(["สรุปยอดคงค้าง", "จำนวนใบแจ้งหนี้", "ยอดคงค้าง"]),
    row(["รวม", report.summary.invoiceCount, report.summary.outstanding]),
    ...report.buckets.map((bucket) => row([bucket.label, bucket.count, bucket.outstanding])),
    row([]),
    row(["สรุปรับชำระเดือนที่เลือก", "จำนวนรายการ", "ยอดรับชำระ"]),
    row(["รวม", report.summary.paymentCount, report.summary.collectedThisMonth]),
    ...Object.entries(report.summary.collectedByMethod).map(([method, amount]) => row([paymentMethodLabels[method] || method, "", amount])),
    row([]),
    row(["เลขที่เอกสาร", "ลูกค้า", "วันที่ออก", "ครบกำหนด", "ยอดเอกสาร", "รับชำระแล้ว", "ยอดคงเหลือ", "อายุค้างชำระ (วัน)", "ช่วงอายุ", "สถานะ"]),
    ...report.items.map((item) => row([item.documentNumber, item.customerName, formatDateOnly(item.issueDate), formatDateOnly(item.dueDate), item.totalAmount, item.paidAmount, item.outstanding, item.daysPastDue, item.bucket, item.status])),
  ];
  return `\ufeff${lines.join("\r\n")}\r\n`;
}

export function getAgingReportFilename(asOf: string) {
  return `รายงานอายุลูกหนี้-${asOf || "รายงาน"}.csv`;
}
