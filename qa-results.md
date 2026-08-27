# QA Results

## PDF Export Direct Check — 21 August 2026

การทดสอบใช้การกดปุ่ม **ดาวน์โหลด PDF** จริงบนหน้าเอกสารผ่าน Chromium headless โดยตรวจใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จรับเงิน ใบส่งของ และใบกำกับภาษี ผลลัพธ์เป็น PDF A4 หน้าละ 1 หน้าในทุกประเภท โดยมีขนาดไฟล์ระหว่าง 126,406–133,847 bytes

| ประเภทเอกสาร | ขนาดหน้า | จำนวนหน้า | ผลทดสอบ |
|---|---:|---:|---|
| ใบเสนอราคา | A4 | 1 | ผ่าน |
| ใบแจ้งหนี้ | A4 | 1 | ผ่าน |
| ใบเสร็จรับเงิน | A4 | 1 | ผ่าน |
| ใบส่งของ | A4 | 1 | ผ่าน |
| ใบกำกับภาษี | A4 | 1 | ผ่าน |

ตรวจภาพ PDF ของใบเสนอราคาแล้วพบว่าข้อความภาษาไทย หัวตาราง ยอดรวม และพื้นที่ลายเซ็นแสดงผลครบถ้วนตาม layout เอกสาร A4

## Responsive Visual Check

ตรวจหน้า Landing Page, ใบเสนอราคา และเครื่องคำนวณราคาขายบนหน้าจอมือถือ 375 × 812 px แล้ว ฟอร์มและปุ่มหลักยังมีขนาดอ่านง่าย ระบบนำทางเปลี่ยนเป็นเมนูมือถือ และ preview เอกสารไม่ล้นขอบหน้าจอ

## Accessibility Check

ตรวจด้วย axe-core บนหน้า Landing Page, ใบเสนอราคา, ใบกำกับภาษี, เครื่องคำนวณราคาขาย และเครื่องคำนวณ VAT หลังปรับ viewport, heading hierarchy, keyboard focus ของ preview เอกสาร และ contrast ของข้อความแล้ว ไม่พบ accessibility violation ในทุกหน้าที่ตรวจ

## Document Conversion Flow

ทดสอบผ่านเบราว์เซอร์จริงจากหน้าใบเสนอราคาไปยังใบแจ้งหนี้ ใบเสร็จรับเงิน และใบส่งของ โดยระบบสร้างเลขเอกสารใหม่ที่มี prefix ถูกต้อง (`IV`, `RC`, `DN`) และ restore ชื่อบริษัท ชื่อลูกค้า และรายการสินค้าจาก session storage ครบถ้วนในหน้าปลายทางทุกกรณี

## Company Profile Null-State Regression — 21 August 2026

ทดสอบด้วย Chromium headless บนหน้า `/quotation` โดยจำลองผู้ใช้ที่ล็อกอินและให้ `companyProfile.get` ส่งค่า `null` ผลการทดสอบยืนยันว่าปุ่ม **บันทึกเข้าบัญชี** แสดงสำหรับผู้ใช้ที่ล็อกอินตามปกติ ปุ่ม **ใช้ template ที่บันทึก** ไม่แสดงเมื่อยังไม่มี template บริษัท และไม่มี console error หรือ API query error ที่มีข้อความ `Query data cannot be undefined` หรือ `companyProfile` เกิดขึ้น


## Receivables dashboard browser QA — 27 August 2026

หน้า `http://localhost:3000/receivables` โหลดสำเร็จบน development server ในสถานะยังไม่ได้เข้าสู่ระบบ โดยแสดงหัวข้อ “ติดตามรับชำระ ให้เห็นเงินที่ต้องได้”, คำอธิบาย, ปุ่มเข้าสู่ระบบ และลิงก์กลับหน้าหลักครบถ้วน พร้อม footer และ internal links เดิม ไม่มี runtime error ที่ทำให้หน้าเสียหายจากการตรวจ browser รอบนี้ การตรวจ authenticated flow ต้องใช้ session ของผู้ใช้จริง จึงยังไม่สามารถยืนยันข้อมูลในฐานข้อมูลจาก sandbox ได้.


หลังเพิ่ม SEO metadata หน้า `/receivables` แสดง title `ติดตามรับชำระ | Tools Thai` ใน browser และยังโหลดเนื้อหา gate, CTA และ internal links ได้ครบถ้วนบน viewport เดิม โดยไม่พบอาการหน้าแตกหรือ runtime error จากการตรวจซ้ำ.
