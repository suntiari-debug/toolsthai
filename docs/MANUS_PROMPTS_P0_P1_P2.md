# ชุด Prompt สำหรับสั่งพัฒนา Tools Thai ตามลำดับ P0, P1 และ P2

เอกสารนี้ออกแบบให้ใช้กับแชตใหม่ในโปรเจกต์ **Tools Thai WebDev เดิม** ไม่จำเป็นต้องสร้างโปรเจกต์ใหม่ ให้คัดลอก **บริบทกลาง** หนึ่งครั้ง แล้วตามด้วย Prompt ของฟีเจอร์ที่ต้องการเพียง **หนึ่งรายการต่อหนึ่งงาน** การแยกงานเช่นนี้ช่วยให้ migration, QA และ checkpoint ตรวจสอบย้อนกลับได้ง่าย

## บริบทกลาง: วางก่อน Prompt ทุกครั้ง

```text
ทำงานต่อในโปรเจกต์ Tools Thai WebDev เดิม ห้ามสร้าง workspace หรือ repository ใหม่ และต้องรักษาฟีเจอร์ที่มีอยู่ทั้งหมดโดยไม่ regress ได้แก่

- เครื่องมือเอกสารภาษาไทย: ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ, ใบส่งของ และใบกำกับภาษี
- Document Center: ค้นหา/กรอง, สถานะ, duplicate, archive/restore, resume editor และ PDF export history
- PDF workflow: loading แบบ staged, ตั้งชื่อไฟล์, preview ก่อนดาวน์โหลด และประวัติ export
- Receivables: invoice-to-receivable, partial payment, owner-scoped data, balance/status automation, payment replacement/soft void พร้อม audit timeline
- รายงานอายุลูกหนี้และ export CSV ที่ไม่นับ payment ที่ถูก void

ข้อกำหนดบังคับ:
1. อ่าน skill ที่เกี่ยวข้องก่อนวางแผนหรือแก้โค้ด โดยเฉพาะ webdev-readme-fullstack; งาน schedule ต้องอ่าน automation-and-scheduling และ webdev-periodic-updates; งานไฟล์ต้องอ่าน webdev-file-storage.
2. ก่อนแก้ไข ให้เพิ่ม checklist แบบ [ ] ที่ละเอียดและตรวจได้ลง todo.md ห้ามลบ history เดิม และเปลี่ยนเป็น [x] ทันทีเมื่อแต่ละส่วนเสร็จจริง.
3. ใช้ React + TypeScript + Vite + tRPC + Drizzle/MySQL ตามโครงสร้างปัจจุบัน ห้ามแก้ .env โดยตรง และห้ามใช้ REST/fetch wrapper แทน tRPC.
4. ข้อมูลเอกสาร ลูกหนี้ payment, export และข้อมูลใหม่ทุกชนิดต้อง owner-scoped ด้วย ctx.user.id ทั้ง query และ mutation ห้ามเชื่อ ID จาก client โดยไม่ตรวจ owner.
5. ใช้ migration workflow เท่านั้น: แก้ drizzle/schema.ts -> generate migration -> อ่าน SQL -> apply แบบปลอดภัย -> verify schema. ห้ามใช้ destructive migration หรือ reset database.
6. รักษาเงินด้วย cents-safe calculation. ห้ามลบหรือแก้ไข payment history เดิมโดยตรง; หากเปลี่ยนข้อมูลการเงินต้องมี audit trail.
7. UI ภาษาไทยเป็นหลัก ใช้ visual language เดิม: warm paper/cream, deep teal, navy และ terracotta อย่างพอดี; responsive; keyboard accessible; มี reduced-motion.
8. เพิ่มหรือปรับ Vitest สำหรับ business rule, router owner scope และ error cases ทุกครั้ง จากนั้นรัน pnpm check, pnpm test, pnpm build, browser QA desktop และ mobile. Restart dev server ก่อน QA เมื่อจำเป็น.
9. ห้าม checkpoint หรือ deploy จนกว่าจะผ่าน QA และอ่าน todo.md ยืนยันงานที่เสร็จเป็น [x]. หลังผ่านแล้ว commit/push GitHub main, สร้าง checkpoint และสรุปสิ่งที่เปลี่ยน/สิ่งที่ยังไม่ทำอย่างตรงไปตรงมา.
10. ห้ามสร้าง review, testimonial, rating หรือข้อมูลการเงินสมมติใน production. Fixture ใช้ได้เฉพาะ test/browser QA และต้องไม่แสดงต่อผู้ใช้จริง.
```

## P0: ต้องทำก่อนเพื่อปิดวงจร “ออกใบแจ้งหนี้ → รับเงิน → ออกใบเสร็จ”

### P0-1: สร้างใบเสร็จฉบับร่างจากลูกหนี้ที่ชำระครบ

```text
ต่อจากบริบทกลาง ให้พัฒนาฟีเจอร์ “ออกใบเสร็จฉบับร่างจากรายการลูกหนี้ที่ชำระครบ” ตามแบบ UI/UX ใน docs/WEEKLY_FEATURE_RECEIPT_UI_UX.md

เป้าหมาย: ผู้ใช้สร้าง receipt draft จาก receivable ที่ชำระครบแล้วโดยไม่ต้องกรอกลูกค้า รายการสินค้า หรือยอดเงินซ้ำ และยังคง audit trail ของ invoice/payment เดิมครบถ้วน

ขอบเขตที่ต้องทำ:
1. เพิ่ม protected, owner-scoped API สำหรับตรวจ eligibility ของ receipt และสร้าง/เปิด receipt draft โดยรับจาก client แค่ receivableId. Server ต้องอ่าน invoice, receivable และ active payments เอง แล้วตรวจว่า receivable เป็นของ ctx.user.id, ไม่ cancelled และยอดคงเหลือเป็น 0.
2. สร้าง receipt draft จากข้อมูล invoice เดิม: ลูกค้า รายการสินค้า ยอดรวม บริษัทผู้ออกเอกสาร และเลข invoice อ้างอิงต้องถูกส่งต่ออย่างถูกต้อง. เก็บ source metadata อย่างน้อย sourceInvoiceId, sourceReceivableId, activePaymentIds, paymentTotalAtCreation และ createdFrom=receivable-paid โดย client เขียนทับไม่ได้.
3. ทำ idempotency: หาก receipt draft จาก receivable เดิมมีอยู่ ให้เปิด draft เดิมแทนการสร้างซ้ำ. ป้องกัน double-click และ concurrent request ไม่ให้สร้าง receipt ซ้ำ. ระบุและทดสอบกลยุทธ์ unique constraint/transaction ที่ใช้.
4. เพิ่ม Receipt Preparation Sheet: เรียกจากแถว paid ใน Receivables Dashboard, success state หลัง payment สุดท้าย และ Document Center receivable drawer. Sheet ต้องสรุป invoice, ลูกค้า, ยอดสุทธิ, วิธี/วันที่รับชำระ และมี CTA “เปิดฉบับร่างใบเสร็จ”.
5. รายการที่ยังไม่ paid ให้ CTA disabled พร้อมข้อความ “ออกใบเสร็จได้เมื่อยอดคงเหลือเป็น ฿0.00”; ห้ามสร้าง receipt จาก partial/open/overdue/cancelled receivable.
6. หลังยืนยัน ให้ handoff ไป /receipt ด้วย resume contract เดิม และแสดง source-context banner เหนือ editor. ผู้ใช้แก้รายละเอียด presentation ใน receipt editor ได้ แต่แก้ payment relationship จาก editor ไม่ได้.
7. หาก payment ต้นทางถูก void/replaced หลังสร้าง draft ห้ามแก้หรือลบ receipt อัตโนมัติ. เมื่อเปิด receipt ให้แสดง warning ว่า source payment เปลี่ยนและลิงก์กลับไปตรวจ receivable timeline.
8. เพิ่ม activity event ที่อธิบายการสร้าง receipt draft โดยเชื่อม owner/source อย่างปลอดภัย แล้วแสดงใน timeline ตามความเหมาะสม.

เกณฑ์ตรวจรับ: Vitest ครอบคลุม paid eligibility, non-owner access, partial blocked, duplicate/concurrent guard และ source-payment change. Browser QA ครอบคลุม desktop/mobile ตั้งแต่ชำระครบจนเปิด editor และทดสอบ error/retry. ห้าม deploy ก่อนทุก test/build ผ่าน.
```

### P0-2: ระบบเตือนวันครบกำหนดชำระแบบ opt-in และไม่ส่งซ้ำ

```text
ต่อจากบริบทกลาง ให้พัฒนาระบบเตือนติดตามลูกหนี้ที่ใกล้ครบกำหนดและเกินกำหนด โดยเริ่มจาก in-app notification แบบ opt-in ก่อน ห้ามส่ง email/SMS จริงจนกว่าผู้ใช้จะอนุมัติ provider และ secret ที่จำเป็น

ต้องอ่าน automation-and-scheduling และ webdev-periodic-updates ก่อนวางแผนโค้ด หากต้องใช้ Heartbeat ให้ทำตาม skill อย่างเคร่งครัด

ข้อกำหนด:
1. ให้ผู้ใช้ตั้งค่าการเตือนของตนเองได้: เปิด/ปิด, จำนวนวันก่อนครบกำหนด (เช่น 1/3/7), และ timezone เริ่มต้น Asia/Bangkok. การตั้งค่าต้อง owner-scoped.
2. สร้าง daily scheduled evaluation ที่ปลอดภัยและ idempotent โดยสร้าง in-app notification เฉพาะ receivable ที่ active และมียอดคงเหลือมากกว่า 0. ไม่แจ้ง paid/cancelled หรือ payment ที่ถูก void จนยอดคงเหลือกลับมาแล้วเท่านั้น.
3. เก็บ reminder audit/dedupe record: userId, receivableId, reminderType, due-date basis, sent/created time และสถานะ เพื่อห้ามเตือนชนิดเดิมซ้ำในวันเดียวกัน. ห้ามใช้ Date.now ใน render/hydration.
4. เพิ่ม notification inbox ขนาดเล็กใน Receivables Dashboard และ Document Center: แสดง urgency, เลข invoice, ลูกค้า, ยอดคงเหลือ, วันครบกำหนด และ CTA เปิดรายการ. ทำ mark-as-read โดย owner เท่านั้น.
5. เพิ่ม manual “ตรวจรายการที่ควรเตือนตอนนี้” สำหรับ admin/test flow โดยต้องไม่ bypass dedupe ใน production. แยก test fixture จากข้อมูลจริงชัดเจน.
6. เพิ่ม dashboard count ของใกล้ครบกำหนด/เกินกำหนดโดยไม่ทำ query ที่เปิดเผยข้อมูลข้าม owner.

เกณฑ์ตรวจรับ: migration review/apply, test timezone/date boundaries, dedupe, paid/void scenario, non-owner block และ schedule idempotency. รัน browser QA desktop/mobile ของ inbox และการเปิด invoice จาก notification. สรุป cron/heartbeat ที่สร้างและแนวทางหยุด/ตรวจ log ให้ชัดเจนก่อน checkpoint.
```

## P1: เพิ่มความเร็วการทำงานและหลักฐานประกอบ

### P1-1: Customer Master และเลือกข้อมูลลูกค้าในเอกสาร

```text
ต่อจากบริบทกลาง ให้เพิ่ม Customer Master สำหรับ Tools Thai เพื่อให้ผู้ใช้เก็บและเลือกข้อมูลลูกค้าในเอกสารใหม่ได้ โดยต้องไม่ทำให้เอกสารเก่าที่เก็บ customer data อยู่ใน payload ใช้งานไม่ได้

ขอบเขต:
1. ออกแบบ schema customer owner-scoped ที่รองรับชื่อบริษัท/บุคคล, เลขประจำตัวผู้เสียภาษี, ที่อยู่, ผู้ติดต่อ, โทรศัพท์, email, note, createdAt/updatedAt และ soft archive. ระบุ strategy ป้องกัน duplicate แบบไม่บล็อกการทำธุรกิจ เช่น warning จากชื่อ/เลขภาษีซ้ำภายใน owner เดียวกัน.
2. เพิ่ม tRPC CRUD/list/search ตาม owner พร้อม validation ภาษาไทย, server-side pagination และห้าม query ข้าม owner. ห้าม rewrite saved document payload เก่าแบบ bulk/destructive.
3. เพิ่ม Customer Picker ใน document editor: search-as-you-type แบบ debounce, เลือกลูกค้าแล้วเติม fields, สร้างลูกค้าใหม่แบบ compact dialog และให้ผู้ใช้แก้ข้อมูลเฉพาะเอกสารได้โดยไม่ทับ master โดยไม่ตั้งใจ.
4. สร้างหน้า “ลูกค้า” ที่ค้นหา/แก้ไข/archive/restore ได้ พร้อมจำนวนเอกสารและยอดลูกหนี้ที่สัมพันธ์กันเฉพาะ owner. แสดง empty, loading, duplicate-warning และ error states.
5. ระบุการเชื่อม customerId กับเอกสาร/receivables แบบ migration-safe; เอกสารเก่าที่ไม่มี customerId ต้องแสดงและแก้ไขได้เหมือนเดิม.

เกณฑ์ตรวจรับ: tests validation/search/owner scope/archived fallback, browser QA เลือกลูกค้าแล้วเติมข้อมูลและเอกสารเก่ายังเปิดได้, check/test/build/desktop/mobile ผ่านก่อน checkpoint.
```

### P1-2: แนบหลักฐานการรับชำระอย่างปลอดภัย

```text
ต่อจากบริบทกลาง ให้เพิ่มการแนบหลักฐานการรับชำระ (เช่น สลิปหรือ PDF) กับ payment โดยใช้ S3 storage เป็นแหล่งเก็บไฟล์เดียว ห้ามเก็บ file bytes/BLOB ในฐานข้อมูล

ต้องอ่าน webdev-file-storage ก่อนเริ่ม และห้ามแก้ .env โดยตรง

ขอบเขต:
1. เพิ่ม schema metadata สำหรับ payment attachment: owner/payment relation, storage key, original filename, mime type, size, createdAt และ optional caption. ใช้ migration additive และ foreign key ที่เหมาะสม.
2. จำกัดชนิดและขนาดไฟล์ที่อนุญาตอย่างชัดเจน (ภาพและ PDF) ทั้ง client และ server. ตรวจ owner ของ payment ก่อนออก upload target หรือ presigned view URL. ห้ามเปิด key ดิบหรือไฟล์ของผู้ใช้อื่น.
3. เพิ่ม upload area ใน payment modal/detail พร้อม progress, retry, empty state, thumbnail สำหรับรูป, PDF icon, ชื่อ/ขนาดไฟล์ และปุ่มดู/ลบ metadata ที่มี confirm. การลบต้องลบ object และ metadata ตาม authorization อย่างปลอดภัย หรือใช้ soft-delete ที่อธิบายชัดเจน.
4. เพิ่ม audit event สำหรับการเพิ่ม/ลบหลักฐาน โดยห้ามบันทึกข้อมูลอ่อนไหวจากภาพลง timeline.
5. ทำ mobile camera/file-picker flow ที่ใช้งานได้และ keyboard accessibility บน desktop.

เกณฑ์ตรวจรับ: tests mime/size/owner authorization/delete semantics, browser QA upload-view-delete โดยใช้ fixture file เฉพาะ test, และตรวจว่า payment/attachment ไม่ข้าม owner. ไม่มี deployment จน check/test/build ผ่าน.
```

### P1-3: Version History ของเอกสารแบบ immutable

```text
ต่อจากบริบทกลาง ให้เพิ่ม version history แบบ immutable สำหรับเอกสารธุรกิจ เพื่อให้ผู้ใช้เห็นว่าเอกสารถูกบันทึก/เปลี่ยนอะไรเมื่อใด และ restore รุ่นก่อนหน้าได้โดยไม่เขียนทับประวัติเดิม

ขอบเขต:
1. ออกแบบ schema document revisions ที่เก็บ snapshot payload, documentId, ownerId, revision number, summary, createdAt และ actor ที่พร้อมรองรับหลายผู้ใช้ในอนาคต. Snapshot สร้างเมื่อผู้ใช้กดบันทึกสำเร็จเท่านั้น ไม่ใช่ทุก keystroke.
2. ทุก query/mutation owner-scoped; restore revision ต้องสร้าง revision ใหม่จาก payload เดิม ไม่ลบหรือแก้ revision เก่า. ห้ามเปลี่ยน export history หรือ source metadata ของ receipt โดยไม่ตรวจผลกระทบ.
3. เพิ่ม Version History drawer ใน Document Center และ editor: revision number, เวลา, summary ของ field สำคัญ, preview/read-only และ CTA “สร้างฉบับใหม่จากรุ่นนี้”. ใช้คำเตือนก่อน restore.
4. เอกสารเก่าที่ไม่มี revisions ต้องเริ่มจาก current snapshot อย่างปลอดภัยเมื่อบันทึกครั้งแรก. กำหนด retention/pagination เพื่อไม่โหลด payload จำนวนมากใน list view.

เกณฑ์ตรวจรับ: tests immutable restore, non-owner access, export history preservation, legacy document fallback และ browser QA desktop/mobile ของ preview/restore. รัน full regression suite ก่อน checkpoint.
```

### P1-4: ส่งเอกสารผ่าน secure share link ก่อน email integration

```text
ต่อจากบริบทกลาง ให้เพิ่ม secure share link สำหรับเอกสาร PDF โดยเริ่มจากลิงก์ที่หมดอายุและเพิกถอนได้ก่อน ห้ามเพิ่ม email provider หรือส่ง email จริงโดยไม่ได้รับการอนุมัติและ secret จากผู้ใช้

ขอบเขต:
1. เจ้าของเอกสารสร้าง share link ที่มี random token, expiry, revoke status, document snapshot/version reference และ access audit. Token ต้อง hash ใน DB, ไม่ส่ง documentId แบบเดาได้, และไม่เปิด tRPC owner data ต่อ public route.
2. หน้า public share แสดงเฉพาะ PDF/document preview ที่ถูกอนุญาต ไม่แสดง Document Center, payment timeline, customer master, internal notes หรือข้อมูลบัญชีอื่น. ระบุ behavior เมื่อหมดอายุ/ถูก revoke อย่างชัดเจน.
3. ใน Document Center เพิ่ม dialog สร้าง/คัดลอก/ตั้งวันหมดอายุ/เพิกถอน และดูจำนวนครั้งเข้าถึง. มี keyboard/accessibility และ reduced motion.
4. ให้ PDF export และ document revision ใช้ snapshot ที่ผู้ใช้เลือกชัดเจน เพื่อไม่ให้ link เปลี่ยนเนื้อหาแบบไม่คาดคิดหลังแก้เอกสาร.

เกณฑ์ตรวจรับ: token entropy/hash, expiry/revoke, owner/non-owner/public route tests, browser QA share flow และ no-index metadata. หากผู้ใช้ต้องการ email ภายหลัง ให้หยุดขอเลือก provider และใช้ secret workflow ก่อนเริ่ม.
```

## P2: ขยายสู่การทำงานเป็นทีมและระบบธุรกิจเชิงลึก

### P2-1: Workspace และสิทธิ์ผู้ใช้หลายคน

```text
ต่อจากบริบทกลาง ให้วางแผนและพัฒนา Workspace/Team Access สำหรับ Tools Thai อย่างระมัดระวัง เนื่องจากระบบปัจจุบัน owner-scoped และมีข้อมูลจริงอยู่แล้ว

ห้ามเปลี่ยน data boundary จาก userId เป็น workspaceId แบบ destructive หรือ deploy โดยไม่มีแผน migration/rollback ที่ตรวจแล้ว

ขอบเขต:
1. เริ่มด้วย discovery report: inventory ตารางที่ผูก userId, migration strategy จาก personal data ไป personal default workspace, role matrix และ risk/rollback plan. ส่งแผนให้ยืนยันก่อน apply migration ที่กระทบข้อมูลจริง.
2. หลังอนุมัติ เพิ่ม workspace, memberships, invitations และ roles อย่างน้อย owner/admin/editor/viewer. ทุก query ต้องบังคับ workspace membership และ role server-side; client role checks ใช้เพื่อ UX เท่านั้น.
3. ทำ Team Settings UI: ชวนสมาชิก, ดู pending invite, เปลี่ยน role, ถอนสิทธิ์, audit log. ผู้ใช้ไม่ควรถอด owner คนสุดท้ายออกหรือเพิ่มสิทธิ์ตนเองโดยไม่มี policy.
4. ย้าย document, receivable, payment, attachment และ report query ให้ scope ด้วย workspace พร้อม test ป้องกัน cross-workspace leak. Preserve existing single-user behavior.

เกณฑ์ตรวจรับ: migration dry-run/verification, role matrix tests, cross-workspace isolation, invite expiry, browser QA desktop/mobile และ checkpoint แยกก่อน/หลัง data migration. หยุดเพื่อขอการอนุมัติทันทีหากพบความเสี่ยงต่อข้อมูลเดิม.
```

### P2-2: เอกสารปรับปรุงและการเชื่อมบัญชีแบบแยกโครงการ

```text
ต่อจากบริบทกลาง ให้เริ่มด้วย design/discovery สำหรับ “Credit Note, Debit Note, หัก ณ ที่จ่าย, e-Tax หรือการเชื่อมโปรแกรมบัญชี” ห้ามอ้างว่าระบบสอดคล้องข้อกฎหมายหรือเป็น e-Tax Invoice โดยไม่ได้กำหนดข้อกำหนดธุรกิจและตรวจสอบเงื่อนไขของผู้ใช้ก่อน

งานรอบแรกต้องส่ง Design Decision Record ที่เปรียบเทียบตัวเลือกและขอคำยืนยัน ไม่ต้องรีบแก้ schema หรือ deploy:
1. ระบุว่าองค์กรจะใช้เอกสารใดก่อน, ต้องการ calculation/fields/numbering/approval แบบใด, และต้องเชื่อม provider บัญชีใด (ถ้ามี).
2. แยกข้อมูลที่เป็น business records ออกจากข้อมูลรับรอง/credential. หากเชื่อม provider ให้ตรวจ connector/config ก่อนและขอ secret ผ่าน secret workflow เท่านั้น.
3. ออกแบบ immutable source links, correction/reversal workflow, validation, export format และ audit history. ห้ามแก้ invoice ที่ออกแล้วเพื่อทำ correction โดยตรง.
4. เสนอ test plan, data migration plan, user acceptance cases และสิ่งที่อยู่นอก scope ของรอบแรก.

จบงานด้วยเอกสารสรุปและคำถามที่ต้องยืนยันก่อน implementation; ห้ามสร้าง claim ทางภาษีหรือเปิด integration จริงในรอบ discovery.
```

### P2-3: Dashboard ผู้บริหารสำหรับยอดขายและกระแสเงินสด

```text
ต่อจากบริบทกลาง ให้เพิ่ม Management Dashboard สำหรับผู้ใช้ที่ต้องการเห็นยอดขาย รับชำระ และลูกหนี้คงค้างตามช่วงเวลา โดยระบุชัดว่าเป็นรายงานการจัดการภายใน ไม่ใช่คำแนะนำการลงทุนหรือประมาณการผลประกอบการ

ขอบเขต:
1. สร้าง owner-scoped report API ที่ใช้ข้อมูล invoice, receivable และ payment ที่ active เท่านั้น. ทุก metric ต้องระบุสูตร ช่วงเวลา timezone และข้อจำกัดของข้อมูล เช่น invoice ที่ยังไม่ถูกเพิ่มเป็น receivable.
2. หน้า dashboard มี range selector, KPI อย่างยอด invoice, ยอดรับชำระ, ยอดคงค้าง, overdue และ chart แนวโน้มรายเดือน. ใช้ empty/loading/error state และ accessible table alternative สำหรับทุก chart.
3. รองรับ CSV export ของชุดข้อมูลที่แสดง พร้อม metadata วันสร้าง report, timezone และ filters. ห้ามสมมติ forecast, target หรือ revenue ที่ไม่มีข้อมูล.
4. เชื่อม deep links ไป Document Center/Receivables Aging Report และให้ filter คงอยู่เมื่อกลับมา.

เกณฑ์ตรวจรับ: test aggregation (รวม/ตัด voided/cancelled), date boundaries/timezone, owner scope, CSV formatting และ browser QA desktop/mobile. ตรวจตัวเลขเทียบ query source ที่ชัดเจนก่อน checkpoint.
```

## วิธีใช้ที่แนะนำ

เริ่มจาก **P0-1** เพียงงานเดียว แล้วให้ Manus สรุป plan และขอคำยืนยันก่อนแตะ database หลัง checkpoint ของ P0-1 จึงค่อยสั่ง P0-2 การรวมหลาย Prompt ในงานเดียวไม่แนะนำ เพราะ payment, document metadata และ scheduled notifications ต้องมีการตรวจ regression แยกกัน

| ลำดับที่แนะนำ | Prompt | ผลลัพธ์ที่คุ้มค่าที่สุด |
|---:|---|---|
| 1 | P0-1 | ปิดวงจรรับเงินด้วยใบเสร็จ ลดการกรอกซ้ำ |
| 2 | P0-2 | ลดการลืมติดตามหนี้และทำให้ aging report เกิด action |
| 3 | P1-1 | ลดการกรอกข้อมูลลูกค้าซ้ำทุกเอกสาร |
| 4 | P1-2 | เพิ่มหลักฐานรับเงินที่ตรวจย้อนหลังได้ |
| 5 | P1-3 หรือ P1-4 | เลือกตามความต้องการตรวจ revision หรือส่งเอกสารให้ลูกค้า |
| 6 | P2-1 ถึง P2-3 | เริ่มเมื่อมีทีม ความต้องการ compliance หรือการวิเคราะห์เชิงบริหารชัดเจน |
