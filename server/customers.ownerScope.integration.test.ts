import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConnection, type Connection, type ResultSetHeader } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { __setDbForTests, createCustomer, getCustomer, listCustomers, saveDocument, setCustomerArchived, updateCustomer } from "./db";

const databaseUrl = process.env.DATABASE_URL;
let connection: Connection | null = null;
let fixtureOpenIds: string[] = [];

describe.skipIf(!databaseUrl)("Customer Master owner scope integration", () => {
  beforeEach(async () => {
    fixtureOpenIds = [];
    connection = await createConnection(databaseUrl!);
    await connection.beginTransaction();
    __setDbForTests(drizzle(connection));
  });

  afterEach(async () => {
    __setDbForTests(null);
    if (connection) {
      await connection.rollback();
      if (fixtureOpenIds.length) await connection.execute(`DELETE FROM users WHERE openId IN (${fixtureOpenIds.map(() => "?").join(",")})`, fixtureOpenIds);
      await connection.end();
    }
    connection = null;
  });

  it("keeps customers and their document relation inside the owner while warning instead of blocking duplicates", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    fixtureOpenIds = [`customer-owner-${suffix}`, `customer-other-${suffix}`];
    const [owners] = await connection!.execute<ResultSetHeader>("INSERT INTO users (`openId`, `role`) VALUES (?, 'user'), (?, 'user')", fixtureOpenIds);
    const ownerId = Number(owners.insertId);
    const otherId = ownerId + 1;
    const first = await createCustomer(ownerId, { customerType: "company", name: "บริษัท สยามทดสอบ จำกัด", taxId: "0105555555555", address: "กรุงเทพฯ", contactName: "คุณเอ", phone: "021234567", email: "contact@example.com", note: "ลูกค้าทดสอบ" });
    const second = await createCustomer(ownerId, { customerType: "company", name: "บริษัท สยามทดสอบ จำกัด", taxId: "0105555555555" });
    expect(second.duplicateMatches).toMatchObject([{ id: first.customer.id, name: "บริษัท สยามทดสอบ จำกัด", taxId: "0105555555555" }]);
    await expect(updateCustomer(otherId, first.customer.id, { customerType: "person", name: "แก้ไขข้าม owner" })).rejects.toThrow("ไม่พบข้อมูลลูกค้าของผู้ใช้รายนี้");
    await expect(saveDocument({ userId: otherId, customerId: first.customer.id, kind: "invoice", documentNumber: `IV-OTHER-${suffix}`, customerName: "อื่น", payload: '{"kind":"invoice","customer":{"name":"อื่น"}}' })).rejects.toThrow("ไม่พบข้อมูลลูกค้าของผู้ใช้รายนี้");
    await saveDocument({ userId: ownerId, customerId: first.customer.id, kind: "invoice", documentNumber: `IV-LINKED-${suffix}`, customerName: "บริษัท สยามทดสอบ จำกัด", payload: '{"kind":"invoice","customer":{"name":"บริษัท สยามทดสอบ จำกัด"}}' });
    await saveDocument({ userId: ownerId, kind: "quotation", documentNumber: `QT-LEGACY-${suffix}`, customerName: "ลูกค้าเดิม", payload: '{"kind":"quotation","customer":{"name":"ลูกค้าเดิม","address":"เดิม","taxId":"","contact":""}}' });
    const active = await listCustomers(ownerId, { page: 1, pageSize: 1 });
    expect(active).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    const linked = await getCustomer(ownerId, first.customer.id);
    expect(linked).toMatchObject({ documentCount: 1, receivableCount: 0, outstandingAmount: "0.00" });
    await setCustomerArchived(ownerId, first.customer.id, true);
    expect((await listCustomers(ownerId)).items.map((item) => item.id)).not.toContain(first.customer.id);
    expect((await listCustomers(ownerId, { archived: true })).items.map((item) => item.id)).toContain(first.customer.id);
    const legacy = await getCustomer(ownerId, second.customer.id);
    expect(legacy?.documentCount).toBe(0);
  });

  it("filters server-side by name, tax ID, and contact while paginating only the owner's customers", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    fixtureOpenIds = [`customer-search-owner-${suffix}`, `customer-search-other-${suffix}`];
    const [owners] = await connection!.execute<ResultSetHeader>("INSERT INTO users (`openId`, `role`) VALUES (?, 'user'), (?, 'user')", fixtureOpenIds);
    const ownerId = Number(owners.insertId);
    const otherId = ownerId + 1;
    const inputs = [
      { name: "บริษัท ค้นหาชื่อ จำกัด", taxId: "0105555555501", contactName: "คุณดาว" },
      { name: "บริษัท ทดสอบสอง จำกัด", taxId: "0105555555502", contactName: "คุณค้นหาผู้ติดต่อ" },
      { name: "บริษัท ทดสอบสาม จำกัด", taxId: "0105555555503", contactName: "คุณบี" },
      { name: "บริษัท ทดสอบสี่ จำกัด", taxId: "0105555555504", contactName: "คุณซี" },
      { name: "บริษัท ทดสอบห้า จำกัด", taxId: "0105555555505", contactName: "คุณดี" },
    ];
    for (const customer of inputs) await createCustomer(ownerId, { customerType: "company", ...customer });
    await createCustomer(otherId, { customerType: "company", name: "บริษัท ค้นหาชื่อ จำกัด", taxId: "0105555555599", contactName: "คุณอื่น" });
    await expect(listCustomers(ownerId, { query: "ค้นหาชื่อ" })).resolves.toMatchObject({ total: 1, items: [{ name: "บริษัท ค้นหาชื่อ จำกัด" }] });
    await expect(listCustomers(ownerId, { query: "0105555555502" })).resolves.toMatchObject({ total: 1, items: [{ contactName: "คุณค้นหาผู้ติดต่อ" }] });
    await expect(listCustomers(ownerId, { query: "ค้นหาผู้ติดต่อ" })).resolves.toMatchObject({ total: 1, items: [{ taxId: "0105555555502" }] });
    await expect(listCustomers(otherId, { query: "ค้นหาผู้ติดต่อ" })).resolves.toMatchObject({ total: 0, items: [] });
    const firstPage = await listCustomers(ownerId, { page: 1, pageSize: 2 });
    const secondPage = await listCustomers(ownerId, { page: 2, pageSize: 2 });
    expect(firstPage).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(secondPage).toMatchObject({ total: 5, page: 2, pageSize: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.items.map((customer) => customer.id)).not.toEqual(firstPage.items.map((customer) => customer.id));
    expect(new Set([...firstPage.items, ...secondPage.items].map((customer) => customer.id))).toHaveLength(4);
    const orderFixtures = [
      { name: "ORDER-ALPHA", updatedAt: new Date("2026-08-20T01:00:00.000Z") },
      { name: "ORDER-BRAVO", updatedAt: new Date("2026-08-20T02:00:00.000Z") },
      { name: "ORDER-CHARLIE", updatedAt: new Date("2026-08-20T03:00:00.000Z") },
    ];
    for (const [index, item] of orderFixtures.entries()) {
      const created = await createCustomer(ownerId, { customerType: "company", name: item.name, taxId: `01055555556${index + 10}`, contactName: "เรียงลำดับ" });
      await connection!.execute("UPDATE customers SET updatedAt = ? WHERE id = ? AND userId = ?", [item.updatedAt, created.customer.id, ownerId]);
    }
    const orderedFirstPage = await listCustomers(ownerId, { query: "ORDER-", page: 1, pageSize: 2 });
    const orderedSecondPage = await listCustomers(ownerId, { query: "ORDER-", page: 2, pageSize: 2 });
    expect(orderedFirstPage.items.map((customer) => customer.name)).toEqual(["ORDER-CHARLIE", "ORDER-BRAVO"]);
    expect(orderedSecondPage.items.map((customer) => customer.name)).toEqual(["ORDER-ALPHA"]);
  });
});
