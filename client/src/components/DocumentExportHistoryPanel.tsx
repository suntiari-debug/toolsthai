import React from "react";
import { FileText } from "lucide-react";

export type DocumentExportHistoryItem = { id: number; filename: string; createdAt: Date };

export function DocumentExportHistoryPanel({ isLoading, exports }: { isLoading: boolean; exports: DocumentExportHistoryItem[] | undefined }) {
  if (isLoading) return <p className="export-history-empty">กำลังโหลดประวัติ...</p>;
  if (!exports?.length) return <p className="export-history-empty">ยังไม่พบประวัติการส่งออก PDF</p>;
  return <ol className="export-history-list">{exports.map((item) => <li key={item.id}><FileText size={16} /><div><strong>{item.filename}</strong><span>{new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(item.createdAt)}</span></div></li>)}</ol>;
}
