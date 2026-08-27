# การเตือนติดตามลูกหนี้แบบ In-app

## ขอบเขตการส่งแจ้งเตือน

ระบบนี้สร้าง **in-app notification** ในบัญชีของเจ้าของข้อมูลเท่านั้น ไม่มีการส่งอีเมล, SMS หรือข้อมูลไปยังผู้ให้บริการภายนอก ผู้ใช้ต้องเปิดการเตือนเองจากหน้า **ติดตามรับชำระ** และเลือกวันล่วงหน้า 1, 3 หรือ 7 วัน โดยเวลาอ้างอิงเริ่มต้นเป็น `Asia/Bangkok`.

| รายการ | การทำงาน |
| --- | --- |
| เงื่อนไข | เฉพาะลูกหนี้ไม่ถูกยกเลิกและมียอดคงเหลือมากกว่า `฿0.00` |
| ประเภท | `due-soon` เมื่อถึงวันที่เลือกก่อนกำหนดชำระ และ `overdue` หลังวันครบกำหนด |
| Dedupe | unique `(userId, receivableId, reminderType, evaluationDate)` ห้ามชนิดเดิมซ้ำภายในวันท้องถิ่นเดียวกัน |
| การแก้ไข payment | ไม่ใช้ payment ที่ถูก void เป็นยอดชำระ; เมื่อยอดคงเหลือกลับมา ระบบจึงพิจารณาเตือนใหม่ได้ |
| Manual check | ปุ่ม **ตรวจรายการที่ควรเตือนตอนนี้** ปรากฏเฉพาะ admin และใช้ rule/dedupe ชุดเดียวกับงานรายวัน |

## งานรายวัน

เมื่อผู้ใช้เปิดการเตือนครั้งแรก ระบบจะสร้างงานรายวันของผู้ใช้นั้น และเก็บ task UID ไว้ใน `receivable_reminder_settings.scheduleCronTaskUid`.

| รายการ | ค่า |
| --- | --- |
| Cron (UTC, 6 fields) | `0 5 1 * * *` |
| เวลาที่ผู้ใช้เห็น (Asia/Bangkok) | ทุกวัน 08:05 น. |
| Callback | `POST /api/scheduled/receivable-reminders` |
| การยืนยันตัวตน | เฉพาะ scheduled identity; callback ใช้ task UID จาก identity ไม่อ่าน ID จาก request body |
| Retry | safe สำหรับ 5xx/429 เพราะ evaluation เขียน audit ด้วย unique constraint และ recover duplicate key |

> ก่อนเปิดการเตือนจริง ต้องมีเวอร์ชันที่เผยแพร่แล้ว เนื่องจากงานรายวันเรียกโดเมน production เท่านั้น ไม่เรียก dev preview.

## หยุดและตรวจสอบ

ผู้ใช้หยุดงานของตัวเองได้จากหน้า **ติดตามรับชำระ → ตั้งค่าการเตือนของฉัน → ปิดการเตือนในแอป → บันทึกการตั้งค่า**. ระบบจะพักงานเดิมไว้แทนการลบ เพื่อให้เปิดกลับได้อย่างปลอดภัยโดยใช้ task UID เดิม

ผู้ดูแลโครงการตรวจรายการงานและ log ได้จากหน้า **Settings → Schedules**. สำหรับการตรวจเชิงเทคนิค สามารถใช้คำสั่งต่อไปนี้ใน environment โครงการ โดยแทนค่า user ID/task UID ที่ถูกต้อง:

```bash
manus-heartbeat list --user-id <user-id>
manus-heartbeat logs --task-uid <task-uid> --with-body
manus-heartbeat update --task-uid <task-uid> --enable=false
manus-heartbeat update --task-uid <task-uid> --enable=true
```

หาก callback ล้มเหลว จะตอบ JSON แบบ 500 ที่มีข้อความผิดพลาดและเวลาให้ตรวจจาก execution log ได้ ขณะที่ task UID ไม่พบหรือการตั้งค่าถูกปิดจะตอบสำเร็จพร้อมสถานะ `orphan` หรือ `disabled` เพื่อไม่ให้เกิด retry ที่ไม่จำเป็น.
