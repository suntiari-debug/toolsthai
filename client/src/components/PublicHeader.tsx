import { Link } from "wouter";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import BrandMark from "./BrandMark";

export default function PublicHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="public-header">
      <div className="shell nav-shell">
        <Link href="/" onClick={closeMenu}><BrandMark /></Link>
        <nav className={isOpen ? "main-nav is-open" : "main-nav"} aria-label="เมนูหลัก">
          <a href="/#tools" onClick={closeMenu}>เครื่องมือ</a>
          <a href="/#how-it-works" onClick={closeMenu}>วิธีใช้งาน</a>
          <a href="/#why-tools-thai" onClick={closeMenu}>ทำไมต้อง Tools Thai</a>
          <Link href="/pricing-calculator" onClick={closeMenu}>คำนวณราคาขาย</Link>
          <Link className="nav-cta-mobile" href={isAuthenticated ? "/account" : "/quotation"} onClick={closeMenu}>
            {isAuthenticated ? "บัญชีของฉัน" : "เริ่มสร้างเอกสาร"} <ArrowUpRight size={16} />
          </Link>
        </nav>
        {isAuthenticated ? <Link className="nav-cta" href="/account">บัญชีของฉัน <ArrowUpRight size={16} /></Link> : <button className="nav-cta" type="button" onClick={startLogin}>บันทึกงานของฉัน <ArrowUpRight size={16} /></button>}
        <button
          className="menu-toggle"
          type="button"
          aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <X size={21} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
