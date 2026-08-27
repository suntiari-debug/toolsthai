export type ReceivableFilterRow = {
  documentNumber: string;
  customerName: string;
  dueDate: Date | string;
  status: string;
};

function toLocalDateKey(value: Date | string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function filterReceivables<T extends ReceivableFilterRow>(rows: T[], options: { status: string; searchTerm: string; dueFrom: string; dueTo: string }) {
  const needle = options.searchTerm.trim().toLowerCase();
  return rows.filter((row) => {
    const dueDate = toLocalDateKey(row.dueDate);
    const matchesStatus = options.status === "all" || row.status === options.status;
    const matchesSearch = !needle || `${row.documentNumber} ${row.customerName}`.toLowerCase().includes(needle);
    const matchesRange = (!options.dueFrom || dueDate >= options.dueFrom) && (!options.dueTo || dueDate <= options.dueTo);
    return matchesStatus && matchesSearch && matchesRange;
  });
}
