# เอกสารส่งต่อสถานะโครงการ Tools Thai

**วันที่จัดทำ:** 27 สิงหาคม 2026 (ICT)  
**วัตถุประสงค์:** สรุปสถานะเชิงเทคนิคเพื่อให้ทีมงานตัดสินใจการกู้ source และการรวม Module 1/PDF กับ Module 2 อย่างปลอดภัยก่อนสร้าง checkpoint ใหม่

## สรุปสำหรับผู้ตรวจ

Tools Thai มี source หลักบน GitHub ที่ branch `main` และ commit ล่าสุด `e92319c` ซึ่งเพิ่ม dashboard ลูกหนี้และรองรับการชำระบางส่วน โค้ดฐานนี้ build และผ่านการทดสอบได้ อย่างไรก็ดี source บน GitHub **ไม่มี** implementation ของ Module 1 Document Center และ PDF workflow รุ่นที่เคยอยู่ใน Manus checkpoint `014c73f1` จึงไม่ควรสร้าง checkpoint/เผยแพร่จาก workspace นี้จนกว่าจะกู้หรือสร้างฟีเจอร์เดิมกลับมาเทียบเท่า

> **สถานะการตัดสินใจ:** Module 2 ผ่านการตรวจเชิงเทคนิคระดับ source, database และ browser fixture แล้ว แต่การเผยแพร่ถูกระงับโดยเจตนาเพื่อป้องกัน regression ของ Module 1/PDF

| รายการ | สถานะ | หมายเหตุ |
|---|---|---|
| GitHub repository | ใช้งานได้ | [`suntiari-debug/toolsthai`](https://github.com/suntiari-debug/toolsthai) เป็น public repository |
| Branch หลัก | ใช้งานได้ | `main` มี 1 branch, 0 tags และ 43 commits ณ วันที่ตรวจ |
| Commit Module 2 บน GitHub | อยู่บน remote แล้ว | `e92319c` — `feat: add receivables and partial payment dashboard` |
| Database Module 2 | ใช้งานได้ | ตาราง `receivables`, `payments`, `receivable_events` และ `saved_documents` มีอยู่ |
| QA Module 2 ล่าสุด | ผ่าน | TypeScript, 59 Vitest tests, production build และ browser workflow ผ่าน |
| Checkpoint/production ใหม่ | **ยังไม่สร้าง** | รอการกู้/รวม Module 1 และ PDF workflow รุ่นล่าสุด |

## แผนผัง source และเวอร์ชัน

| จุดอ้างอิง | ที่มา | เนื้อหาหลัก | ข้อสังเกต |
|---|---|---|---|
| `bb1d3bc` | Git history | document editor, A4/PDF, preview zoom, templates, company profile และ document conversion | เป็น parent สายหลักของ Module 2 |
| `7302c32` | Git history | baseline ล่าสุดก่อน Module 2 | เป็น parent โดยตรงของ `e92319c` |
| `e92319c` | GitHub `main` | receivables, payments, partial payment dashboard และ migration `0005` | push สำเร็จแล้วเมื่อ 27 ส.ค. 2026 |
| `014c73f1` | Manus checkpoint เดิม | Module 1 Document Center และ PDF enhancements รุ่นล่าสุด | **ไม่พบเป็น commit/branch/tag ใน GitHub** |

การตรวจ parent chain ยืนยันว่า `e92319c → 7302c32 → bb1d3bc` ดังนั้น GitHub มี document/PDF baseline รุ่นก่อนครบในระดับแกนหลัก แต่ไม่ใช่ source รุ่นล่าสุดของ Module 1 ที่เคยเผยแพร่จาก checkpoint `014c73f1`

## ฟีเจอร์ที่พบใน GitHub source ปัจจุบัน

### 1. Document/PDF baseline

| ความสามารถ | สถานะใน source GitHub | หลักฐานเชิงโค้ด |
|---|---|---|
| สร้างใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จ, ใบส่งของ และใบกำกับภาษี | มี | `DocumentTool` และ `BusinessDocument` |
| A4 preview และ export PDF | มี | `html2canvas` และ `jsPDF` ใน client bundle |
| แปลงเอกสารต่อเนื่อง | มี | `convertDocument`, `convertTargets`, card “ทำเอกสารต่อเนื่อง” |
| รักษาข้อมูลบริษัท ลูกค้า และรายการสินค้าเมื่อแปลงเอกสาร | มีและมี regression test | `client/src/lib/document.test.ts` |
| OAuth / company profile / persistence basis | มี | WebDev auth core และ company profile APIs |
| dynamic SEO/SSR baseline | มี | build สร้าง SSR bundle สำเร็จ |

### 2. Module 1 ที่ไม่พบใน GitHub source

ฟีเจอร์ต่อไปนี้เคยอยู่ใน checkpoint `014c73f1` ตามประวัติการพัฒนา แต่ไม่พบใน branch `main`, tags หรือ commit history ที่ตรวจได้ของ repository ปัจจุบัน

| ฟีเจอร์ที่ขาดจาก GitHub source ปัจจุบัน | ผลกระทบหากเผยแพร่จาก source นี้ |
|---|---|
| Document Center สำหรับค้นหา/กรอง/เปลี่ยนสถานะ/ทำสำเนา/เก็บถาวร | ผู้ใช้จะเสีย workflow คลังเอกสารรุ่นล่าสุด |
| resume navigation ระหว่างคลังเอกสารกับ editor | เส้นทางกลับไปแก้เอกสารอาจลดความต่อเนื่อง |
| PDF loading overlay แบบ staged และ accessibility/reduced-motion | ประสบการณ์ระหว่างสร้าง PDF จะย้อนกลับไปสู่ baseline เดิม |
| ตั้งชื่อ PDF, preview ก่อน download และ export history | ฟีเจอร์ PDF รุ่นล่าสุดจะไม่อยู่ใน deploy ใหม่ |

## Module 2: ลูกหนี้และการชำระเงินบางส่วน

### 1. Database และ migration

| Migration | สถานะ | วัตถุประสงค์ |
|---|---|---|
| `drizzle/0005_amusing_lily_hollister.sql` | applied | สร้างโมเดล `receivables` และ `payments` สำหรับยอดลูกหนี้และการรับชำระ |
| `drizzle/0006_greedy_proemial_gods.sql` | applied ใน workspace ปัจจุบัน | สร้าง `receivable_events` สำหรับ activity timeline |

ฐานข้อมูลที่ตรวจพบมี `saved_documents`, `receivables`, `payments` และ `receivable_events` แล้ว ตารางเหตุการณ์มี index `receivable_events_user_receivable_created_idx` เพื่อรองรับ query ตามผู้ใช้ เอกสาร และเวลาย้อนหลัง

### 2. Workflow ที่ตรวจแล้ว

| Workflow | สถานะ | รายละเอียด |
|---|---|---|
| เพิ่มใบแจ้งหนี้เป็นลูกหนี้ | ผ่าน | คำนวณยอดรวมและยอดคงเหลือจาก payload ใบแจ้งหนี้ |
| บันทึก partial payment | ผ่าน | ตัวอย่าง QA: รับชำระ 400 บาท จากยอด 1,000 บาท เหลือ 600 บาท และสถานะเป็น `partial` |
| ป้องกันรับเกินยอดคงเหลือ | ผ่าน unit test | ใช้การคำนวณจำนวนเงินระดับสตางค์ |
| Dashboard ลูกหนี้ | ผ่าน | แสดงยอดลูกหนี้รวม, ยอดคงเหลือ, เกินกำหนด และยอดรับแล้วเดือนนี้ |
| Filter | ผ่าน | ค้นหา, สถานะ และช่วงวันครบกำหนด |
| Activity timeline | ผ่านใน workspace ปัจจุบัน | บันทึก “เพิ่มรายการลูกหนี้” และ “บันทึกการรับชำระ” พร้อมยอดและเวลา |
| Owner scope | ผ่าน test/code review | รายการ, รายละเอียด, payment และ events ส่งผ่าน `userId` จาก authenticated context |
| แปลงใบเสนอราคาเป็นใบแจ้งหนี้ | มีแล้วใน document workflow | regression test ตรวจข้อมูลลูกค้าและ items ถูกคงไว้ |

### 3. ส่วนที่ยังไม่ควรอ้างว่า complete

| รายการ | สถานะ | เหตุผล |
|---|---|---|
| แก้ไข/ลบ payment | ยังไม่เพิ่ม | scope ที่ตรวจปัจจุบันรองรับ record payment; สำหรับข้อมูลการเงินควรออกแบบเป็น reversal/audit event แทนการลบจริง |
| แสดง payment timeline ใน Document Center | blocked | Document Center รุ่น Module 1 ไม่อยู่ใน source ปัจจุบัน |
| checkpoint / deploy Module 2 | blocked โดยเจตนา | ต้องกู้หรือรวม Module 1/PDF ก่อน เพื่อไม่ให้ deploy ถอยหลัง |

## การตรวจสอบคุณภาพล่าสุด

| การตรวจ | ผลลัพธ์ | หมายเหตุ |
|---|---|---|
| `pnpm check` | ผ่าน | TypeScript ไม่มี error |
| `pnpm test` | ผ่าน | 15 test files, 59 tests หลังเพิ่ม timeline/date-range coverage |
| `pnpm build` | ผ่าน | client build, SSR build และ server bundle ผ่าน |
| Browser QA desktop | ผ่าน | เพิ่มลูกหนี้ → รับชำระบางส่วน → เหลือ 600 บาท → สถานะ partial → timeline แสดง |
| Browser QA mobile | ผ่าน | dashboard สรุปยอดและ import card ใช้ได้ใน viewport 390 × 844 |
| Browser QA production bundle | ผ่าน | workflow partial payment ผ่านบน runtime ที่ build แล้ว |

Build มีคำเตือนขนาด chunk ของ PDF libraries มากกว่า 500 kB ซึ่งไม่ทำให้ build ล้มเหลว เนื่องจาก `html2canvas` และ `jsPDF`; ควรติดตามเป็นงาน performance optimization ในระยะถัดไป แต่ไม่ใช่ blocker ของ Module 2

## Working tree ปัจจุบัน

HEAD ของ GitHub workspace ยังคือ `e92319c` แต่มีการเปลี่ยนแปลง **local ที่ยังไม่ commit/push** เพื่อให้ Module 2 ครบขึ้น ได้แก่ activity timeline, date-range filter, browser QA script, shared contracts, tests และ Drizzle migration `0006`

> ห้ามสร้าง checkpoint หรือ deploy จาก working tree ปัจจุบันก่อนตัดสินใจเรื่อง Module 1/PDF เพราะ deployment ใหม่จะแทนที่หน้าเว็บที่ใช้งานอยู่ด้วย source ที่ไม่มีฟีเจอร์ checkpoint `014c73f1`

## การตัดสินใจที่ต้องการจากทีมงาน

1. ตรวจว่า project/checkpoint `014c73f1` ใน Manus ยัง export source เป็น ZIP หรือกู้ workspace ได้หรือไม่
2. หากกู้ได้ ให้ push source นั้นขึ้น GitHub เป็น branch `recovery/module1-pdf` แล้ว merge Module 2 จาก `e92319c` และ local changes ปัจจุบันผ่าน pull request
3. หากกู้ไม่ได้ ให้อนุมัติการสร้าง Module 1/PDF workflow กลับจาก specification ที่บันทึกไว้ แล้วจึง merge Module 2
4. ตัดสินใจนโยบาย payment correction: อนุญาตแก้ไข/ยกเลิกการรับชำระแบบ audit-safe (reversal) แทนการลบข้อมูลโดยตรง
5. หลัง source รวมสมบูรณ์ ให้ rerun database/schema review, TypeScript, full Vitest, production build, desktop/mobile browser QA และสร้าง checkpoint ใหม่

## ข้อความแนะนำสำหรับส่งถึงทีม Manus

> โปรดช่วยตรวจสอบการเข้าถึงหรือ export source ของ project Tools Thai จาก checkpoint `014c73f1` เนื่องจาก GitHub repository `suntiari-debug/toolsthai` ที่ branch `main` และ commit `e92319c` ไม่มี Module 1 Document Center และ PDF workflow รุ่นล่าสุดที่เคยอยู่ใน checkpoint ดังกล่าว เราต้องการ source/ZIP หรือวิธีกู้ workspace เพื่อนำมารวมกับ Module 2 โดยไม่ทำให้ฟีเจอร์เดิมหาย

## References

[1]: https://github.com/suntiari-debug/toolsthai "Tools Thai GitHub repository"
[2]: https://github.com/suntiari-debug/toolsthai/commit/e92319cd17479162219f3e5915580d745c53614e "Commit e92319c"
