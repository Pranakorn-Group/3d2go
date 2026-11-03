"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { labelSerial } from "@/lib/labels";

/** Most labels one print run may create (about 70 A4 sheets of small labels). */
const MAX_LABELS = 2000;

const createSchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), qty: z.coerce.number().int("Qty must be a whole number").min(0).max(MAX_LABELS) }))
    .max(500),
});

/**
 * Gives each requested label its own serial (SKU-0001, SKU-0002, … per product), in the order asked.
 * Not limited by stock: labels are printed ahead of the rolls arriving.
 */
export async function createLabels(input: z.input<typeof createSchema>) {
  return run(async () => {
    await requireAdmin();
    const items = createSchema.parse(input).items.filter((i) => i.qty > 0);
    const total = items.reduce((s, i) => s + i.qty, 0);
    if (!total) throw new UserError("Set how many labels to print");
    if (total > MAX_LABELS) throw new UserError(`At most ${MAX_LABELS} labels at a time`);

    const serials = await prisma.$transaction(async (tx) => {
      const out: string[] = [];
      for (const { productId, qty } of items) {
        const p = await tx.product.findUnique({ where: { id: productId }, select: { sku: true } });
        if (!p) throw new UserError("Product not found");
        const last = await tx.productLabel.aggregate({ where: { productId }, _max: { seq: true } });
        const from = (last._max.seq ?? 0) + 1;
        const rows = Array.from({ length: qty }, (_, i) => ({ productId, seq: from + i, serial: labelSerial(p.sku, from + i) }));
        // (productId, seq) is unique, so two print runs at once fail here instead of sharing serials.
        await tx.productLabel.createMany({ data: rows });
        out.push(...rows.map((r) => r.serial));
      }
      return out;
    });

    revalidatePath("/backstore/stock/labels");
    return serials;
  });
}

/** The product behind a scanned label, for the POS. Refuses labels already sold or held by a reservation. */
export async function lookupLabel(serial: string) {
  return run(async () => {
    await requireAdmin();
    const s = z.string().trim().toUpperCase().min(1, "Empty scan").parse(serial);
    const label = await prisma.productLabel.findUnique({
      where: { serial: s },
      select: { serial: true, productId: true, soldAt: true, sale: { select: { code: true, status: true } } },
    });
    if (!label) throw new UserError(`${s} isn't a label we printed`);
    if (label.soldAt) throw new UserError(`${s} was already sold${label.sale ? ` (${label.sale.code})` : ""}`);
    if (label.sale) throw new UserError(`${s} is held by reservation ${label.sale.code}`);
    return { serial: label.serial, productId: label.productId };
  });
}
