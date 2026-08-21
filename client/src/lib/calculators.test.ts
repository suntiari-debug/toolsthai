import { describe, expect, it } from "vitest";
import { calculateDueDate, calculateMargin, calculatePricing, calculateVat } from "./calculators";

describe("business calculators", () => {
  it("calculates a recommended selling price including target margin and VAT", () => {
    const result = calculatePricing({ productCost: 350, otherCost: 40, targetMargin: 35, platformFee: 0, vatRate: 7 });
    expect(result.totalCost).toBe(390);
    expect(result.sellingBeforeVat).toBeCloseTo(600, 6);
    expect(result.profit).toBeCloseTo(210, 6);
    expect(result.sellingWithVat).toBeCloseTo(642, 6);
    expect(result.actualMargin).toBeCloseTo(35, 6);
  });

  it("separates VAT correctly when input already includes VAT", () => {
    const result = calculateVat({ amount: 1070, rate: 7, mode: "included" });
    expect(result.beforeVat).toBeCloseTo(1000, 6);
    expect(result.vat).toBeCloseTo(70, 6);
    expect(result.total).toBe(1070);
  });

  it("calculates margin and markup from cost and selling price", () => {
    const result = calculateMargin({ cost: 450, price: 750 });
    expect(result.profit).toBe(300);
    expect(result.margin).toBeCloseTo(40, 6);
    expect(result.markup).toBeCloseTo(66.6667, 3);
  });

  it("calculates a payment due date from issue date and credit days", () => {
    expect(calculateDueDate("2026-08-01", 30)).toBe("2026-08-31");
  });
});
