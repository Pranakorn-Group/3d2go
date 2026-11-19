"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

const categoryEnum = z.enum(["ADS", "SHIPPING", "RENT", "UTILITIES", "FEE", "OTHER"]);
const channelEnum = z.enum(["STORE", "SHOPEE", "LAZADA", "TIKTOK", "CAROUSELL", "OTHER"]);

const entrySchema = z.object({
  date: z.coerce.date(),
  /** Signed (SGD): positive = income, negative = expense. */
  amount: z.coerce.number().refine((n) => n !== 0, "Amount can't be zero"),
  category: categoryEnum.default("OTHER"),
  channel: channelEnum.nullable().optional(),
  note: z.string().trim().optional(),
});

export type LedgerEntryInput = z.input<typeof entrySchema>;

export async function createLedgerEntry(input: LedgerEntryInput) {
  return run(async () => {
    await requireAdmin();
    const e = entrySchema.parse(input);
    await prisma.ledgerEntry.create({
      data: { date: e.date, amount: e.amount, category: e.category, channel: e.channel || null, note: e.note || null },
    });
    revalidatePath("/backstore", "layout");
  });
}

export async function deleteLedgerEntry(id: string) {
  return run(async () => {
    await requireAdmin();
    const { count } = await prisma.ledgerEntry.deleteMany({ where: { id } });
    if (count === 0) throw new UserError("Entry not found");
    revalidatePath("/backstore", "layout");
  });
}
