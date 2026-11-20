"use server";

import { z } from "zod";
import { run } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Mirrors pos-view.tsx's DraftState — the form fields making up an in-progress sale.
const draftSchema = z.object({
  mode: z.enum(["sell", "reserve"]),
  cart: z.array(
    z.object({
      productId: z.string(),
      qty: z.number().int().positive(),
      unitPrice: z.string(),
      serials: z.array(z.string()),
    }),
  ),
  discount: z.string(),
  customerName: z.string(),
  phone: z.string(),
  deposit: z.string(),
  dueDate: z.string(),
  note: z.string(),
  channel: z.enum(["STORE", "SHOPEE", "LAZADA", "TIKTOK", "CAROUSELL", "OTHER"]),
  orderNo: z.string(),
  fee: z.string(),
  received: z.string(),
  otherAmount: z.string(),
  otherNote: z.string(),
});

/** Saves the in-progress cart so it comes back on any device. Called on every cart/form change, debounced client-side. */
export async function saveDraft(state: unknown) {
  return run(async () => {
    const user = await requireAdmin();
    const parsed = draftSchema.parse(state);
    await prisma.posDraft.upsert({
      where: { userId: user.id },
      create: { userId: user.id, state: parsed },
      update: { state: parsed },
    });
  });
}

/** Clears the draft once the sale has been checked out (or the cart explicitly cleared). */
export async function clearDraft() {
  return run(async () => {
    const user = await requireAdmin();
    await prisma.posDraft.deleteMany({ where: { userId: user.id } });
  });
}
