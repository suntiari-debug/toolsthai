import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { evaluateReceivableRemindersByTaskUid } from "./db";

/** Register before the Vite/static fallthrough; only Heartbeat cron identities can call this path. */
export function registerReceivableReminderSchedule(app: Express) {
  app.post("/api/scheduled/receivable-reminders", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const result = await evaluateReceivableRemindersByTaskUid(user.taskUid);
      return res.json({ ok: true, ...result });
    } catch (error) {
      const detail = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
      console.error("[Receivable reminders] Scheduled evaluation failed", detail);
      return res.status(500).json({ error: "scheduled-reminder-evaluation-failed", detail, timestamp: new Date().toISOString() });
    }
  });
}
