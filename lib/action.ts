import { z } from "zod";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export class UserError extends Error {}

/** Runs a server action body, turning validation / business errors into { ok: false }. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "code" in e && e.code === "P2002")
      return { ok: false, error: "That value is already used (duplicate)" };
    // Let Next.js redirects/notFound propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
