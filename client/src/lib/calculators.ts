export function safeNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculatePricing({ productCost, otherCost, targetMargin, platformFee, vatRate }: { productCost: number; otherCost: number; targetMargin: number; platformFee: number; vatRate: number }) {
  const totalCost = safeNumber(productCost) + safeNumber(otherCost);
  const margin = Math.min(95, safeNumber(targetMargin)) / 100;
  const fee = Math.min(95, safeNumber(platformFee)) / 100;
  const denominator = Math.max(0.01, 1 - margin - fee);
  const sellingBeforeVat = totalCost / denominator;
  const platformFeeAmount = sellingBeforeVat * fee;
  const profit = sellingBeforeVat - platformFeeAmount - totalCost;
  const vat = sellingBeforeVat * safeNumber(vatRate) / 100;
  return { totalCost, sellingBeforeVat, platformFeeAmount, profit, sellingWithVat: sellingBeforeVat + vat, actualMargin: sellingBeforeVat ? profit / sellingBeforeVat * 100 : 0, vat };
}

export function calculateVat({ amount, rate, mode }: { amount: number; rate: number; mode: "excluded" | "included" }) {
  const base = safeNumber(amount);
  const vatRate = safeNumber(rate) / 100;
  if (mode === "included") {
    const beforeVat = base / (1 + vatRate);
    return { beforeVat, vat: base - beforeVat, total: base };
  }
  return { beforeVat: base, vat: base * vatRate, total: base * (1 + vatRate) };
}

export function calculateMargin({ cost, price }: { cost: number; price: number }) {
  const productCost = safeNumber(cost);
  const sellingPrice = safeNumber(price);
  const profit = sellingPrice - productCost;
  return { profit, margin: sellingPrice ? profit / sellingPrice * 100 : 0, markup: productCost ? profit / productCost * 100 : 0 };
}

export function calculateDueDate(issueDate: string, days: number) {
  const date = new Date(`${issueDate || new Date().toISOString().slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() + Math.round(safeNumber(days)));
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}
