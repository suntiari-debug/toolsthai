# Aging Report Implementation Notes

- นิยามอายุลูกหนี้ใช้ยอดคงเหลือของ receivable ที่ไม่ใช่ `paid` หรือ `cancelled` ณ วันอ้างอิง (UTC date-only) แบ่งเป็น ยังไม่ถึงกำหนด, 1–30, 31–60, 61–90 และมากกว่า 90 วัน. การคำนวณจำนวนเงินใช้ cents ผ่าน helper เดิมเพื่อหลีกเลี่ยงความคลาดเคลื่อนทศนิยม.
- ยอดรับชำระรายเดือนอ่านเฉพาะ `payments` ของเจ้าของบัญชีภายในช่วงเดือน UTC และบังคับ `voidedAt is null`; backend เป็น `receivables.agingReport` protected procedure. CSV สร้างฝั่ง client จาก report เดียวกัน, มี UTF-8 BOM, summary, method breakdown และรายละเอียดเอกสาร พร้อม CSV escaping.
- Browser QA desktop/mobile ผ่าน: ค่า buckets, ยอดคงค้าง ฿1,080.00, collection breakdown, เปลี่ยนวัน/เดือนอ้างอิง และดาวน์โหลดไฟล์ `รายงานอายุลูกหนี้-2026-08-31.csv`. ภาพ mobile แสดง filter ที่กดได้, cards/buckets ไม่ล้น, ตาราง scroll ได้ภายใน container และปุ่ม export เต็มความกว้าง.
