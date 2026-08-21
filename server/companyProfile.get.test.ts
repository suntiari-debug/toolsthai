import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "profile-test-user",
      email: "profile@example.com",
      name: "Profile Test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => vi.restoreAllMocks());

describe("companyProfile.get", () => {
  it("returns null instead of undefined when the user has not saved a company template", async () => {
    vi.spyOn(db, "getCompanyProfile").mockResolvedValue(null);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.companyProfile.get()).resolves.toBeNull();
  });
});
