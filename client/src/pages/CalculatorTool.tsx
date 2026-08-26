import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BarChart3, Calculator, CalendarDays, CircleDollarSign, Equal, Info, Percent, ReceiptText, TrendingUp } from "lucide-react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { calculateDueDate, calculateMargin, calculatePricing, calculateVat } from "@/lib/calculators";
import { formatTHB, formatThaiDate } from "@/lib/document";
import SeoMeta from "@/components/SeoMeta";

export type CalculatorKind = "pricing" | "vat" | "margin" | "payment-terms";

const calculatorMeta: Record<CalculatorKind, { eyebrow: string; title: string; intro: string; icon: typeof Calculator; accent: string }> = {
  pricing: { eyebrow: "BUSINESS PRICING", title: "คำนวณต้นทุนและราคาขาย", intro: "กำหนดราคาที่ช่วยครอบคลุมต้นทุน ค่าธรรมเนียม และกำไรที่คุณต้องการ", icon: Calculator, accent: "pricing" },
  vat: { eyebrow: "VAT CALCULATOR", title: "คำนวณ VAT", intro: "แยก VAT หรือรวม VAT จากยอดขายได้อย่างรวดเร็วและเข้าใจง่าย", icon: ReceiptText, accent: "vat" },
  margin: { eyebrow: "MARGIN ANALYSIS", title: "คำนวณกำไรและ Margin", intro: "ดูว่าราคาขายปัจจุบันให้กำไรและอัตราส่วนที่เหมาะสมหรือไม่", icon: TrendingUp, accent: "margin" },
  "payment-terms": { eyebrow: "PAYMENT TERMS", title: "คำนวณวันครบกำหนด", intro: "กำหนดวันชำระเงินให้ชัดเจนเมื่อออกใบเสนอราคาหรือใบแจ้งหนี้", icon: CalendarDays, accent: "terms" },
};

export default function CalculatorTool({ kind }: { kind: CalculatorKind }) {
  const meta = calculatorMeta[kind];
  const Icon = meta.icon;
  return <div className="app-page calculator-page"><SeoMeta title={`${meta.title} ออนไลน์ฟรี`} description={`${meta.intro} ใช้งานได้ฟรีจาก Tools Thai`} /><PublicHeader /><main className="calculator-workspace"><div className="shell"><Link href="/tools" className="back-link"><ArrowLeft size={16} /> เครื่องมือทั้งหมด</Link><div className="calculator-heading"><span className={`calculator-heading-icon ${meta.accent}`}><Icon size={24} /></span><div><p className="page-kicker">{meta.eyebrow}</p><h1>{meta.title}</h1><p>{meta.intro}</p></div></div>{kind === "pricing" && <PricingCalculator />}{kind === "vat" && <VatCalculator />}{kind === "margin" && <MarginCalculator />}{kind === "payment-terms" && <PaymentTermsCalculator />}{kind === "vat" && <><p className="calculator-disclaimer">ข้อมูลผลคำนวณเป็นเพียงการช่วยคำนวณเบื้องต้น ผู้ใช้ควรตรวจสอบอัตรา VAT และข้อกำหนดทางภาษีที่ใช้อยู่กับแหล่งข้อมูลทางการก่อนใช้ตัดสินใจหรือออกเอกสารจริง</p><p className="calculator-version">เวอร์ชันข้อมูล VAT: ปีภาษี 2569 · อัปเดต 21 สิงหาคม 2569</p></>}</div></main><PublicFooter /></div>;
}

function PricingCalculator() {
  const [productCost, setProductCost] = useState(350); const [otherCost, setOtherCost] = useState(40); const [targetMargin, setTargetMargin] = useState(35); const [platformFee, setPlatformFee] = useState(0); const [vatRate, setVatRate] = useState(7);
  const result = useMemo(() => calculatePricing({ productCost, otherCost, targetMargin, platformFee, vatRate }), [productCost, otherCost, targetMargin, platformFee, vatRate]);
  return <section className="calculator-card-layout"><div className="calculator-input-card"><div className="calculator-card-title"><span>กรอกตัวเลขของคุณ</span><small>ค่าที่เปลี่ยนจะคำนวณทันที</small></div><div className="calculator-fields"><NumberInput label="ต้นทุนสินค้า / บริการ" suffix="บาท" value={productCost} onChange={setProductCost} /><NumberInput label="ต้นทุนอื่น ๆ ต่อหน่วย" hint="เช่น ค่าแพ็ก ค่าขนส่ง หรือค่าแรง" suffix="บาท" value={otherCost} onChange={setOtherCost} /><div className="field-grid two-columns"><NumberInput label="กำไรที่ต้องการ (Margin)" suffix="%" value={targetMargin} onChange={setTargetMargin} /><NumberInput label="ค่าธรรมเนียมแพลตฟอร์ม" suffix="%" value={platformFee} onChange={setPlatformFee} /></div><NumberInput label="อัตรา VAT" suffix="%" value={vatRate} onChange={setVatRate} /></div><div className="input-hint"><Info size={15} /><span>Margin คือกำไรเมื่อเทียบกับราคาขาย ส่วนค่าธรรมเนียมแพลตฟอร์มจะถูกนำมาคิดในราคาที่แนะนำแล้ว</span></div></div><div className="calculator-result-card"><p>ราคาขายที่แนะนำ</p><strong>{formatTHB(result.sellingWithVat)}</strong><span>รวม VAT {vatRate}% แล้ว</span><div className="result-breakdown"><div><span>ราคาก่อน VAT</span><b>{formatTHB(result.sellingBeforeVat)}</b></div><div><span>ต้นทุนรวม</span><b>{formatTHB(result.totalCost)}</b></div><div><span>ค่าธรรมเนียมแพลตฟอร์ม</span><b>{formatTHB(result.platformFeeAmount)}</b></div><div><span>กำไรที่คาดการณ์</span><b>{formatTHB(result.profit)}</b></div></div><div className="result-margin"><span>Margin ที่คำนวณได้</span><strong>{result.actualMargin.toFixed(1)}%</strong></div></div></section>;
}

function VatCalculator() {
  const [amount, setAmount] = useState(1000); const [rate, setRate] = useState(7); const [mode, setMode] = useState<"excluded" | "included">("excluded");
  const result = useMemo(() => calculateVat({ amount, rate, mode }), [amount, rate, mode]);
  return <section className="calculator-card-layout compact"><div className="calculator-input-card"><div className="calculator-card-title"><span>คำนวณ VAT</span><small>เลือกว่าจำนวนเงินที่กรอก รวม VAT แล้วหรือไม่</small></div><div className="mode-switch"><button type="button" className={mode === "excluded" ? "active" : ""} onClick={() => setMode("excluded")}>ยอดก่อน VAT</button><button type="button" className={mode === "included" ? "active" : ""} onClick={() => setMode("included")}>ยอดรวม VAT แล้ว</button></div><div className="calculator-fields"><NumberInput label={mode === "excluded" ? "ยอดก่อน VAT" : "ยอดรวม VAT"} suffix="บาท" value={amount} onChange={setAmount} /><NumberInput label="อัตรา VAT" suffix="%" value={rate} onChange={setRate} /></div></div><div className="calculator-result-card vat-result"><p>{mode === "excluded" ? "ยอดรวม VAT แล้ว" : "ยอดก่อน VAT"}</p><strong>{formatTHB(mode === "excluded" ? result.total : result.beforeVat)}</strong><div className="result-breakdown"><div><span>ยอดก่อน VAT</span><b>{formatTHB(result.beforeVat)}</b></div><div><span>VAT {rate}%</span><b>{formatTHB(result.vat)}</b></div><div><span>ยอดรวมสุทธิ</span><b>{formatTHB(result.total)}</b></div></div></div></section>;
}

function MarginCalculator() {
  const [cost, setCost] = useState(450); const [price, setPrice] = useState(750); const result = useMemo(() => calculateMargin({ cost, price }), [cost, price]);
  return <section className="calculator-card-layout compact"><div className="calculator-input-card"><div className="calculator-card-title"><span>วิเคราะห์กำไรของสินค้า</span><small>ใส่ต้นทุนและราคาขายต่อหน่วย</small></div><div className="calculator-fields"><NumberInput label="ต้นทุนต่อหน่วย" suffix="บาท" value={cost} onChange={setCost} /><NumberInput label="ราคาขายต่อหน่วย" suffix="บาท" value={price} onChange={setPrice} /></div><div className="input-hint"><Info size={15} /><span>Markup คิดจากต้นทุน ส่วน Margin คิดจากราคาขาย เหมาะกับการดูความสามารถทำกำไรในคนละมุม</span></div></div><div className="calculator-result-card margin-result"><p>กำไรต่อหน่วย</p><strong>{formatTHB(result.profit)}</strong><div className="stat-tile-grid"><div><Percent size={17} /><span>Margin</span><b>{result.margin.toFixed(1)}%</b></div><div><BarChart3 size={17} /><span>Markup</span><b>{result.markup.toFixed(1)}%</b></div></div><div className="result-breakdown"><div><span>ต้นทุน</span><b>{formatTHB(cost)}</b></div><div><span>ราคาขาย</span><b>{formatTHB(price)}</b></div></div></div></section>;
}

function PaymentTermsCalculator() {
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10)); const [days, setDays] = useState(30); const dueDate = useMemo(() => calculateDueDate(issueDate, days), [issueDate, days]);
  return <section className="calculator-card-layout compact"><div className="calculator-input-card"><div className="calculator-card-title"><span>กำหนดวันครบกำหนด</span><small>ใช้เพื่อเตรียมวันชำระในใบเสนอราคาและใบแจ้งหนี้</small></div><div className="calculator-fields"><label className="calculator-input"><span>วันที่ออกเอกสาร</span><input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label><NumberInput label="เครดิตเทอม" suffix="วัน" value={days} onChange={setDays} /></div></div><div className="calculator-result-card terms-result"><p>วันครบกำหนดชำระ</p><strong>{formatThaiDate(dueDate)}</strong><span>นับจากวันที่ออกเอกสาร {days} วัน</span><div className="calendar-visual"><CalendarDays size={22} /><div><small>วันที่ออกเอกสาร</small><b>{formatThaiDate(issueDate)}</b></div><Equal size={17} /><div><small>กำหนดชำระ</small><b>{formatThaiDate(dueDate)}</b></div></div></div></section>;
}

function NumberInput({ label, hint, suffix, value, onChange }: { label: string; hint?: string; suffix: string; value: number; onChange: (value: number) => void }) { return <label className="calculator-input"><span>{label}</span>{hint && <small>{hint}</small>}<div><input type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} /><b>{suffix}</b></div></label>; }
