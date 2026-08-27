# Module 1 implementation notes

- `DocumentPreview` รับ `document`, style overrides และสร้าง element หลักด้วย id `printable-document`; thumbnail ใน PDF confirmation ต้องใช้ instance ที่ซ่อน id นี้เพื่อหลีกเลี่ยง id ซ้ำกับ preview หลัก.
- `documents.save` ใน router คืนเพียง `{ success: true }` ขณะที่ `db.saveDocument` ยังไม่คืน insert id. PDF export history จึงต้องปรับ contract ให้บันทึกเอกสารและรับ document id ที่ server เพิ่งสร้าง ก่อนเรียก `recordExport`.
- `recordDocumentExport` ตรวจ owner โดยเรียก `getSavedDocument(userId, documentId)` อยู่แล้ว และ `listDocumentExports` กรองทั้ง `userId`/`documentId`.
- `DocumentTool` มี validation dialog ก่อน export และใช้งาน `isExporting`; workflow ใหม่จะต่อจาก dialog นี้ไปยัง confirmation dialog แล้วแสดง staged state `preparing`, `rendering`, `downloading`.
- `DocumentCenter` เพิ่ม route แล้วและใช้ session key `toolsThai.convertedDocument` เดิม จึงยังเข้ากันได้กับ effect restore ที่มีอยู่ใน `DocumentTool` และ `Account`.
- ฐานข้อมูลมี table/columns/FKs ของ migration 0007 อยู่ก่อนเริ่มงาน แต่ไม่มี composite indexes; ได้สร้างและตรวจแล้วว่า `document_exports_user_document_created_idx (userId,documentId,createdAt)` และ `saved_documents_user_status_updated_idx (userId,status,updatedAt)` มีอยู่ครบ.
- ตาราง `__drizzle_migrations` มีเพียงหนึ่ง hash ในปัจจุบัน จึงไม่ควรสั่ง migration runner แบบรวมทั้งหมดจนกว่าจะ reconcile metadata ของ 0006/0007 ด้วยวิธีที่ตรวจสอบ hash และ timestamp จาก journal แล้ว.
- Browser verification หลัง restart: `/documents` แสดง authenticated Document Center ได้จริงหลัง auth request เสร็จ (request ใช้เวลาราว 3 วินาที); ภาพก่อนหน้านี้ที่เห็น loading เป็น capture เร็วเกินไป ไม่ใช่ loading loop. `/quotation` และ `/receivables` render ได้โดยไม่มี console error ใหม่จาก Module 1.
- Browser fixture ของ Module 1 ผ่าน flow `filter-status-duplicate-archive-resume` และ PDF confirmation. Visual inspection ของ dialog ยืนยันพบ filename input อ่านง่าย, live document thumbnail แสดงจริงโดยไม่มี id ซ้ำ และ modal contrast/spacing เหมาะกับ workspace โทน warm-paper/deep-teal.
