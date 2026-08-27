# Receipt Draft QA Notes

- Browser fixture ผ่านบน desktop 1280×720 และ mobile 390×844 สำหรับ flow partial blocked → บันทึก payment สุดท้าย → Receipt Preparation Sheet → เปิด Receipt Editor → reopen draft เดิม
- Source-context banner และ payment-change warning แสดงเหนือ Receipt Editor โดยไม่ทับ preview หรือ form controls ทั้งสอง viewport
- CTA ในแถวลูกหนี้ที่ยังมียอดคงเหลือถูก disable พร้อมข้อความอธิบาย และ fixture ไม่ได้ใช้ข้อมูล production
