import { Link } from "wouter";
import BrandMark from "./BrandMark";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="shell footer-grid">
        <div className="footer-intro">
          <BrandMark />
          <p>เครื่องมือเอกสารและคำนวณสำหรับธุรกิจไทย ใช้งานง่าย ฟรี และเริ่มทำงานได้ทันที</p>
        </div>
        <div>
          <p className="footer-label">เอกสารธุรกิจ</p>
          <Link href="/quotation">ใบเสนอราคา</Link>
          <Link href="/invoice">ใบแจ้งหนี้</Link>
          <Link href="/receipt">ใบเสร็จรับเงิน</Link>
          <Link href="/tax-invoice">ใบกำกับภาษี</Link>
          <Link href="/delivery-note">ใบส่งของ</Link>
        </div>
        <div>
          <p className="footer-label">เครื่องคำนวณ</p>
          <Link href="/pricing-calculator">คำนวณต้นทุนและราคาขาย</Link>
          <Link href="/vat-calculator">คำนวณ VAT</Link>
          <Link href="/margin-calculator">คำนวณกำไรและ Margin</Link>
          <Link href="/payment-terms">คำนวณวันครบกำหนด</Link>
        </div>
        <div>
          <p className="footer-label">ข้อมูลสำคัญ</p>
          <a href="/#privacy">ความเป็นส่วนตัว</a>
          <a href="/#terms">เงื่อนไขการใช้งาน</a>
          <a href="/#contact">ติดต่อเรา</a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© 2026 Tools Thai</span>
        <span>สร้างเพื่อช่วยให้ธุรกิจไทยทำงานได้คล่องตัวขึ้น</span>
      </div>
    </footer>
  );
}
