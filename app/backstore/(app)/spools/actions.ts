"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { nextSpoolSerial } from "@/lib/codes";
import { prisma } from "@/lib/db";
import {
  checkOpening,
  checkWeighIn,
  checkWeighOut,
  EMPTY_AT_G,
  filamentCost,
  remainingG,
  sameType,
  serialFromScan,
  usage,
} from "@/lib/spool";

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();

const grams = (label: string) => z.coerce.number({ error: `${label} is required` }).int(`${label} must be whole grams`).min(0, `${label} can't be negative`);

const specSchema = z.object({
  netG: grams("Net weight").min(1, "Net weight must be more than 0 g"),
  tareG: grams("Reel weight"),
  densityGcm3: z.coerce.number().min(0.5, "Density looks wrong").max(3, "Density looks wrong"),
});

const saveSpecSchema = specSchema.extend({
  brand: z.string().trim().min(1),
  type: z.string().trim().min(1),
});

/** Sets the net / reel weight and density used for new spools of one brand + type. */
export async function saveSpoolSpec(input: z.input<typeof saveSpecSchema>) {
  return run(async () => {
    await requireAdmin();
    const { brand, type, ...data } = saveSpecSchema.parse(input);
    await prisma.spoolSpec.upsert({ where: { brand_type: { brand, type } }, create: { brand, type, ...data }, update: data });
    revalidatePath("/backstore/spools", "layout");
  });
}

const openSchema = specSchema.extend({
  productId: z.string().min(1, "Pick a filament"),
  grossG: grams("Weight"),
  /** Take one roll out of stock (off for rolls that were opened before spools were tracked). */
  fromStock: z.boolean().default(true),
  /** Also save net / reel / density as the default for this brand + type. */
  saveSpec: z.boolean().default(false),
  note: optionalText,
});

/** Opens a roll for printing: weighs it in, gives it a serial (for its QR label) and takes it out of stock. */
export async function openSpool(input: z.input<typeof openSchema>) {
  return run(async () => {
    await requireAdmin();
    const { productId, grossG, fromStock, saveSpec, note, ...w } = openSchema.parse(input);
    const problem = checkOpening(w, grossG);
    if (problem) throw new UserError(problem);

    const serial = await prisma.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      if (fromStock) {
        if (p.stockQty - p.reservedQty < 1)
          throw new UserError(`No ${p.sku} roll free in stock — untick "Take from stock" if it's already out`);
        await tx.product.update({ where: { id: p.id }, data: { stockQty: { decrement: 1 } } });
      }

      const serial = await nextSpoolSerial(tx);
      const spool = await tx.spool.create({
        data: { serial, productId, ...w, startGrossG: grossG, lastGrossG: grossG, unitCostSgd: p.avgCostSgd, note },
      });
      if (fromStock) {
        await tx.stockMovement.create({
          data: {
            productId,
            kind: "OPEN",
            qty: -1,
            unitCostSgd: p.avgCostSgd,
            refType: "SPOOL",
            refId: spool.id,
            note: `Spool ${serial}`,
          },
        });
      }
      if (saveSpec) {
        await tx.spoolSpec.upsert({
          where: { brand_type: { brand: p.brand, type: p.type } },
          create: { brand: p.brand, type: p.type, ...w },
          update: w,
        });
      }
      return serial;
    });

    revalidatePath("/backstore", "layout");
    return serial;
  });
}

/** The spool a scanned QR code / typed serial points to. */
export async function findSpool(text: string) {
  return run(async () => {
    await requireAdmin();
    const serial = serialFromScan(z.string().min(1, "Scan or type a serial").parse(text));
    const spool = await prisma.spool.findUnique({ where: { serial }, select: { serial: true } });
    if (!spool) throw new UserError(`No spool ${serial}`);
    return spool.serial;
  });
}

const startSchema = z.object({
  spoolId: z.string(),
  beforeG: grams("Before weight"),
  slicerG: grams("Slicer estimate").nullable().optional(),
  jobRef: optionalText,
  /** The filament type the job was sliced for; must match the spool's. */
  jobType: optionalText,
  note: optionalText,
});

/** Weigh-in before a print. The job stays open until it is weighed out. */
export async function startJob(input: z.input<typeof startSchema>) {
  return run(async () => {
    await requireAdmin();
    const { spoolId, beforeG, slicerG, jobRef, jobType, note } = startSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const s = await tx.spool.findUniqueOrThrow({ where: { id: spoolId }, include: { product: true } });
      if (s.status === "EMPTY") throw new UserError(`${s.serial} is marked empty`);
      if (jobType && !sameType(jobType, s.product.type))
        throw new UserError(`${s.serial} is ${s.product.type}, but the job needs ${jobType} — use a ${jobType} spool`);
      const running = await tx.spoolUsage.findFirst({ where: { spoolId, endedAt: null } });
      if (running) throw new UserError(`${s.serial} already has a job on the printer — weigh it out first`);

      const problem = checkWeighIn({ ...s, densityGcm3: Number(s.densityGcm3) }, beforeG);
      if (problem) throw new UserError(problem);

      await tx.spoolUsage.create({ data: { spoolId, beforeG, slicerG, jobRef, note } });
      // A lighter reading than last time is filament nobody logged (e.g. purge, a failed print).
      await tx.spool.update({ where: { id: spoolId }, data: { lastGrossG: beforeG } });
    });

    revalidatePath("/backstore/spools", "layout");
  });
}

const finishSchema = z.object({
  usageId: z.string(),
  afterG: grams("After weight"),
  note: optionalText,
});

/** Weigh-out after a print: records grams used and their cost. Returns what is left on the spool. */
export async function finishJob(input: z.input<typeof finishSchema>) {
  return run(async () => {
    await requireAdmin();
    const { usageId, afterG, note } = finishSchema.parse(input);

    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.spoolUsage.findUniqueOrThrow({ where: { id: usageId }, include: { spool: true } });
      if (u.endedAt) throw new UserError("This job was already weighed out");
      const s = u.spool;
      const problem = checkWeighOut(s, u.beforeG, afterG);
      if (problem) throw new UserError(problem);

      const { usedG, overG } = usage(u.beforeG, afterG, u.slicerG);
      const costSgd = filamentCost(usedG, Number(s.unitCostSgd), s.netG);
      await tx.spoolUsage.update({
        where: { id: usageId },
        data: { afterG, usedG, costSgd, endedAt: new Date(), note: note ?? u.note },
      });
      await tx.spool.update({ where: { id: s.id }, data: { lastGrossG: afterG } });
      const left = remainingG(s, afterG);
      return { usedG, overG, costSgd, remainingG: left, nearlyEmpty: left <= EMPTY_AT_G };
    });

    revalidatePath("/backstore/spools", "layout");
    return result;
  });
}

/** Drops a weigh-in that was a mistake (the job never ran). */
export async function cancelJob(usageId: string) {
  return run(async () => {
    await requireAdmin();
    const u = await prisma.spoolUsage.findUniqueOrThrow({ where: { id: usageId } });
    if (u.endedAt) throw new UserError("This job was already weighed out");
    await prisma.spoolUsage.delete({ where: { id: usageId } });
    revalidatePath("/backstore/spools", "layout");
  });
}

/** Marks a spool finished (or back in use). */
export async function setSpoolEmpty(id: string, empty: boolean) {
  return run(async () => {
    await requireAdmin();
    if (empty && (await prisma.spoolUsage.count({ where: { spoolId: id, endedAt: null } })))
      throw new UserError("Weigh out the running job first");
    await prisma.spool.update({
      where: { id },
      data: empty ? { status: "EMPTY", emptiedAt: new Date() } : { status: "OPEN", emptiedAt: null },
    });
    revalidatePath("/backstore/spools", "layout");
  });
}
