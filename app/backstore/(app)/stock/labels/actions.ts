"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { isValidSerial, normalizeSerial, randomSerial } from "@/lib/labels";

/** Most labels one print run may create (about 70 A4 sheets of small labels). */
const MAX_LABELS = 2000;

const createSchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), qty: z.coerce.number().int("Qty must be a whole number").min(0).max(MAX_LABELS) }))
    .max(500),
});

/**
 * Gives each requested label its own random serial (lib/labels.ts), in the order asked; `seq` counts each
 * product's labels. Not limited by stock: labels are printed ahead of the rolls arriving.
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
      const serials = await freshSerials(tx, total);
      for (const { productId, qty } of items) {
        const p = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
        if (!p) throw new UserError("Product not found");
        const last = await tx.productLabel.aggregate({ where: { productId }, _max: { seq: true } });
        const from = (last._max.seq ?? 0) + 1;
        const rows = Array.from({ length: qty }, (_, i) => ({ productId, seq: from + i, serial: serials[out.length + i] }));
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

/** `count` random serials not used by any label yet (a repeat is about 1 in 34 billion, but checked anyway). */
async function freshSerials(tx: Prisma.TransactionClient, count: number) {
  const picked = new Set<string>();
  while (picked.size < count) {
    const batch = Array.from({ length: count - picked.size }, () => randomSerial()).filter((s) => !picked.has(s));
    const used = await tx.productLabel.findMany({ where: { serial: { in: batch } }, select: { serial: true } });
    const taken = new Set(used.map((u) => u.serial));
    for (const s of batch) if (!taken.has(s)) picked.add(s);
  }
  return [...picked];
}

/** The product behind a scanned label, for the POS. Refuses labels already sold or held by a reservation. */
export async function lookupLabel(serial: string) {
  return run(async () => {
    await requireAdmin();
    const raw = z.string().trim().toUpperCase().min(1, "Empty scan").parse(serial);
    // Labels printed before random serials (SKU-0001) are looked up as they are.
    const s = (await prisma.productLabel.findUnique({ where: { serial: raw }, select: { id: true } })) ? raw : normalizeSerial(raw);
    if (s !== raw && !isValidSerial(s)) throw new UserError(`${raw} isn't a valid label serial — misread? Scan again`);
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

const presetSchema = z.object({
  name: z.string().trim().min(1, "Give the preset a name").max(60),
  settings: z.record(z.string(), z.union([z.string().max(80), z.boolean()])),
});

/** Saves the current layout under a name; saving an existing name overwrites it. */
export async function saveLabelPreset(input: z.input<typeof presetSchema>) {
  return run(async () => {
    await requireAdmin();
    const { name, settings } = presetSchema.parse(input);
    const preset = await prisma.labelPreset.upsert({ where: { name }, create: { name, settings }, update: { settings } });
    revalidatePath("/backstore/stock/labels");
    return { id: preset.id, name: preset.name };
  });
}

export async function deleteLabelPreset(id: string) {
  return run(async () => {
    await requireAdmin();
    await prisma.labelPreset.delete({ where: { id: z.string().parse(id) } });
    revalidatePath("/backstore/stock/labels");
  });
}

/**
 * Removes printed labels that were never sold or reserved (lost, misprinted, damaged). Their serials stop
 * scanning. Labels a sale or reservation holds are kept, so sales history stays intact.
 */
export async function deleteLabels(ids: string[]) {
  return run(async () => {
    await requireAdmin();
    const list = z.array(z.string()).min(1, "Pick at least one label").max(1000).parse(ids);
    const { count } = await prisma.productLabel.deleteMany({ where: { id: { in: list }, saleId: null, soldAt: null } });
    if (!count) throw new UserError("Only labels that aren't sold or reserved can be removed");
    revalidatePath("/backstore/stock/labels/printed");
    return { removed: count, kept: list.length - count };
  });
}
