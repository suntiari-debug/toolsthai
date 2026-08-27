import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return { user: { id: 901, openId: "customer-validation", name: "ผู้ใช้ทดสอบ", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("customer router validation", () => {
  it("requires a Thai business-compatible customer name and a 13-digit tax ID when supplied", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.customers.create({ customerType: "company", name: "", taxId: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.customers.create({ customerType: "company", name: "บริษัท ทดสอบ จำกัด", taxId: "123" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
