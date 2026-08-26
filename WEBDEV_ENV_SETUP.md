# คู่มือ Environment Variables สำหรับ Tools Thai บน WebDev

เอกสารนี้เป็นรายการตั้งค่า Environment สำหรับ WebDev ของโปรเจกต์ Tools Thai ซึ่งเป็น full-stack application ที่ประกอบด้วย React/Vite, Express/tRPC, Manus OAuth, Drizzle/MySQL และ storage integration โดย WebDev จัดการค่า environment และ secrets ผ่านหน้าตั้งค่าของโปรเจกต์ จึงไม่เก็บไฟล์ `.env` หรือ `.env.example` ที่มีค่าใช้งานจริงไว้ใน source code

> **หลักความปลอดภัย:** ห้ามใส่ค่า Secret จริงลงใน GitHub และห้ามส่ง `JWT_SECRET`, `DATABASE_URL` หรือ API key ผ่านแชตสาธารณะ ให้กรอกค่าลับในหน้า Secrets ของ WebDev เท่านั้น

## 1. เตรียมค่าก่อน Deploy

สร้างหรือเปิด WebDev project ที่จะใช้ Deploy แล้วเตรียมค่าเหล่านี้จากระบบ WebDev/Manus ตามที่โปรเจกต์เปิดใช้งานจริง

| กลุ่ม | ตัวแปร | ระดับ | ใช้กับฟีเจอร์ |
|---|---|---|---|
| Runtime | `NODE_ENV` | ค่าแนะนำ `production` | กำหนด production behavior |
| Runtime | `PORT` | ค่าแนะนำ `3000` | พอร์ตที่ server ใช้รับ traffic |
| SEO | `PUBLIC_SITE_URL` | แนะนำอย่างยิ่ง | canonical, Open Graph, JSON-LD, robots และ sitemap |
| Database | `DATABASE_URL` | จำเป็นสำหรับข้อมูลถาวร | users, company profiles และ saved documents |
| Session | `JWT_SECRET` | จำเป็นสำหรับ login | sign/verify session cookie |
| OAuth | `VITE_APP_ID` | จำเป็นสำหรับ login | OAuth application ID ฝั่ง browser/server |
| OAuth | `OAUTH_SERVER_URL` | จำเป็นสำหรับ login | OAuth backend callback/exchange |
| OAuth | `VITE_OAUTH_PORTAL_URL` | จำเป็นสำหรับ login | URL ที่ browser redirect ไปเริ่ม login |
| Owner | `OWNER_OPEN_ID` | แนะนำ | กำหนด owner/admin ระหว่าง sync user |
| Storage | `BUILT_IN_FORGE_API_URL` | จำเป็นเมื่อ upload asset | endpoint สำหรับ presigned upload/proxy |
| Storage | `BUILT_IN_FORGE_API_KEY` | จำเป็นเมื่อ upload asset | server-side Forge credential |
| Maps | `VITE_FRONTEND_FORGE_API_URL` | Optional | Google Maps integration ฝั่ง browser |
| Maps | `VITE_FRONTEND_FORGE_API_KEY` | Optional | credential สำหรับ browser-side Maps integration |
| Analytics | `VITE_ANALYTICS_ENDPOINT` | Optional | URL analytics script |
| Analytics | `VITE_ANALYTICS_WEBSITE_ID` | Optional | website ID ของ analytics |

ค่า `VITE_*` ถูกฝังใน client bundle ตอน Build จึงต้องมีค่าก่อนสั่ง `pnpm build` ส่วนค่าที่ไม่มี prefix `VITE_` ใช้ฝั่ง server ตอนรันจริงและต้องเก็บเป็น Secret หากเป็น credential

## 2. จัดการ Environment Variables ใน WebDev

WebDev inject ค่า system environment สำหรับ Database, Manus OAuth, JWT และ Forge storage ให้กับ full-stack project อยู่แล้ว จึงไม่ควรสร้างค่า duplicate หรือ override ตัวแปรระบบ เว้นแต่ได้รับค่าใหม่จาก WebDev โดยตรง เปิด WebDev project แล้วเข้าเมนูสำหรับ **Environment Variables** หรือ **Secrets** เฉพาะเมื่อต้องเพิ่ม custom configuration ของโปรเจกต์

รายการที่ผู้ดูแลโปรเจกต์ต้องตรวจหรือกำหนดเองมีดังนี้

1. หลัง Publish แล้ว ตั้ง `PUBLIC_SITE_URL` เป็น URL สาธารณะ HTTPS ตัวจริงที่ WebDev สร้างให้ เช่น `https://your-actual-project-id.manus.space` โดยห้ามใช้คำว่า `your-project` ตรง ๆ และไม่ใส่ slash ท้าย URL
2. ตรวจว่า `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL` และ `BUILT_IN_FORGE_API_KEY` ถูก inject จาก WebDev ก่อนทดสอบ login หรือ upload
3. เพิ่ม `VITE_ANALYTICS_ENDPOINT` และ `VITE_ANALYTICS_WEBSITE_ID` เฉพาะเมื่อมี analytics service จริง หากเว้นว่าง ระบบจะไม่โหลด analytics script
4. เพิ่มค่า Maps เฉพาะเมื่อเปิดใช้ Maps จริงเท่านั้น

เมื่อใช้ค่า Secret ให้เลือกชนิดที่ WebDev ระบุว่าเป็น secret/private value และตรวจให้แน่ใจว่าไม่แสดงใน build log, screenshot หรือ commit

## 3. เตรียมฐานข้อมูลและ Migration

โปรเจกต์ใช้ `drizzle/schema.ts` และมี migration SQL อยู่ในโฟลเดอร์ `drizzle/` จำนวน 5 ไฟล์ เมื่อตั้ง `DATABASE_URL` แล้วต้องตรวจให้ schema ในฐานข้อมูลตรงกับ migration ก่อนทดสอบ login หรือการบันทึกเอกสาร

ไม่ควรเรียกคำสั่ง migration กับฐานข้อมูล production แบบสุ่มโดยไม่ตรวจ SQL ก่อน ให้ใช้ลำดับที่ WebDev รองรับและสำรองฐานข้อมูลก่อน หาก WebDev มี database migration workflow ในตัว ให้ใช้ workflow นั้นเป็นหลัก หากต้องใช้คำสั่งใน repository คำสั่งที่กำหนดไว้คือ

```bash
pnpm db:push
```

คำสั่งนี้ต้องทำใน environment ที่มี `DATABASE_URL` จริง และควรตรวจผล migration หลังทำเสร็จ โดยเฉพาะตาราง `users`, `company_profiles` และ `saved_documents`

## 4. ตรวจ OAuth callback URL

ก่อนทดสอบปุ่ม login ให้ตรวจว่า OAuth application อนุญาต callback path ของ Deployment ใหม่ ซึ่งโค้ดใช้ path

```text
/api/oauth/callback
```

ดังนั้น callback URL ต้องเป็น URL สาธารณะของ WebDev ต่อด้วย path นี้ เช่น

```text
https://your-actual-project-id.manus.space/api/oauth/callback
```

อย่าใช้ URL ของ Sandbox หรือ `localhost` ใน OAuth configuration ของ production

## 5. ตั้งค่าโดเมน SEO

กำหนดเพียงตัวแปรนี้เป็นหลัก

```text
PUBLIC_SITE_URL=https://your-actual-project-id.manus.space
```

ระบบจะใช้ค่านี้สร้าง URL สำหรับ

- `<link rel="canonical">`
- `og:url`
- JSON-LD WebSite และ BreadcrumbList
- `robots.txt` บรรทัด Sitemap
- URL ใน `sitemap.xml`

ถ้าไม่กำหนด `PUBLIC_SITE_URL` ระบบจะพยายาม derive จาก host ของ request ฝั่ง server แต่สำหรับ production แนะนำให้กำหนดค่าคงที่เสมอ เพื่อป้องกัน proxy หรือ preview host ทำให้ canonical ผิดโดเมน

## 6. คำสั่งตรวจสอบก่อน Publish

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm start
```

หลังเปิด server ให้ตรวจอย่างน้อย

```bash
curl -I https://your-actual-project-id.manus.space/
curl https://your-actual-project-id.manus.space/robots.txt
curl https://your-actual-project-id.manus.space/sitemap.xml
curl https://your-actual-project-id.manus.space/api/trpc/auth.me
```

ควรเห็นว่า root และหน้าเครื่องมือหลักตอบ HTTP 200, `robots.txt` ชี้ไปยัง `/sitemap.xml` ของโดเมนใหม่, sitemap มี URL โดเมนใหม่ทั้งหมด และ `auth.me` ตอบได้โดยไม่เกิด server error

## 7. Checklist หลัง Publish

- [ ] Production มี `PUBLIC_SITE_URL` เป็น URL ใหม่แบบ HTTPS และไม่มี slash ท้าย
- [ ] มี `DATABASE_URL` และ migration ครบ 5 ไฟล์
- [ ] ทดสอบ login และตรวจ `/api/oauth/callback`
- [ ] ทดสอบบันทึก company profile และ saved document
- [ ] ทดสอบ upload logo/signature/stamp หากใช้ฟีเจอร์ดังกล่าว
- [ ] ตรวจ canonical และ `og:url` จาก HTML ที่ server ส่งจริง
- [ ] ตรวจ `robots.txt` และ `sitemap.xml` จาก URL ใหม่
- [ ] ตรวจว่าไม่มี Secret อยู่ใน GitHub หรือ build log
- [ ] หากมี auto-deploy ให้ push ไปยัง branch ที่ WebDev ผูกไว้ แล้วตรวจ deployment ใหม่ทุกครั้ง
