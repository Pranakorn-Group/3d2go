"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { nextSpoolSerial } from "@/lib/codes";
import { prisma } from "@/lib/db";
import { checkOpening, checkWeighIn, checkWeighOut, EMPTY_AT_G, filamentCost, loanCharge, remainingG, serialFromScan } from "@/lib/spool";
import { getLendRate } from "@/lib/spools";

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
  /** Empty = sell price per kg × LEND_MARKUP. */
  lendPerKgSgd: z
    .union([z.literal("").transform(() => null), z.coerce.number().min(0, "Price can't be negative")])
    .nullable()
    .optional(),
});

/** Sets the net / reel weight, density and lend price used for spools of one brand + type. */
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

/** Opens a roll for lending: weighs it, gives it a serial (for its QR label) and takes it out of stock. */
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

const lendSchema = z.object({
  spoolId: z.string(),
  customerName: z.string().trim().min(1, "Customer name is required").max(80),
  phone: optionalText,
  note: optionalText,
  beforeG: grams("Weight"),
});

/** filament2go: a customer takes the spool. Weighs it out and fixes today's price per kg for this loan. */
export async function lendSpool(input: z.input<typeof lendSchema>) {
  return run(async () => {
    await requireAdmin();
    const { spoolId, beforeG, ...customer } = lendSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const s = await tx.spool.findUniqueOrThrow({ where: { id: spoolId } });
      if (s.status === "EMPTY") throw new UserError(`${s.serial} is marked empty`);
      const out = await tx.spoolLoan.findFirst({ where: { spoolId, returnedAt: null } });
      if (out) throw new UserError(`${s.serial} is already with ${out.customerName} — take it back first`);

      const problem = checkWeighIn({ ...s, densityGcm3: Number(s.densityGcm3) }, beforeG);
      if (problem) throw new UserError(problem);

      const ratePerKgSgd = await getLendRate(s, tx);
      await tx.spoolLoan.create({ data: { spoolId, beforeG, ratePerKgSgd, ...customer } });
      // A lighter reading than last time is filament nobody logged (e.g. scale drift, a purge in the shop).
      await tx.spool.update({ where: { id: spoolId }, data: { lastGrossG: beforeG } });
    });

    revalidatePath("/backstore/spools", "layout");
  });
}

const returnSchema = z.object({
  loanId: z.string(),
  afterG: grams("Weight"),
  note: optionalText,
});

/** The customer brings the spool back: weighs it in and works out what they pay (shown as a PayNow QR). */
export async function returnSpool(input: z.input<typeof returnSchema>) {
  return run(async () => {
    await requireAdmin();
    const { loanId, afterG, note } = returnSchema.parse(input);

    const result = await prisma.$transaction(async (tx) => {
      const l = await tx.spoolLoan.findUniqueOrThrow({ where: { id: loanId }, include: { spool: true } });
      if (l.returnedAt) throw new UserError("This spool was already returned");
      const s = l.spool;
      const problem = checkWeighOut(s, l.beforeG, afterG);
      if (problem) throw new UserError(problem);

      const usedG = l.beforeG - afterG;
      const chargeSgd = loanCharge(usedG, Number(l.ratePerKgSgd));
      const costSgd = filamentCost(usedG, Number(s.unitCostSgd), s.netG);
      // Nothing used → nothing to pay, so the loan is settled straight away.
      const now = new Date();
      await tx.spoolLoan.update({
        where: { id: loanId },
        data: { afterG, usedG, chargeSgd, costSgd, returnedAt: now, paidAt: chargeSgd > 0 ? null : now, note: note ?? l.note },
      });
      await tx.spool.update({ where: { id: s.id }, data: { lastGrossG: afterG } });
      const left = remainingG(s, afterG);
      return {
        loanId,
        serial: s.serial,
        customerName: l.customerName,
        usedG,
        chargeSgd,
        remainingG: left,
        nearlyEmpty: left <= EMPTY_AT_G,
      };
    });

    revalidatePath("/backstore/spools", "layout");
    return result;
  });
}

/** Drops a loan that was a mistake (the spool never left the shop). */
export async function cancelLoan(loanId: string) {
  return run(async () => {
    await requireAdmin();
    const l = await prisma.spoolLoan.findUniqueOrThrow({ where: { id: loanId } });
    if (l.returnedAt) throw new UserError("This spool was already returned");
    await prisma.spoolLoan.delete({ where: { id: loanId } });
    revalidatePath("/backstore/spools", "layout");
  });
}

/** Records (or un-records) the customer's payment for a returned spool. */
export async function setLoanPaid(loanId: string, paid: boolean) {
  return run(async () => {
    await requireAdmin();
    const l = await prisma.spoolLoan.findUniqueOrThrow({ where: { id: loanId } });
    if (!l.returnedAt) throw new UserError("Take the spool back first");
    await prisma.spoolLoan.update({ where: { id: loanId }, data: { paidAt: paid ? new Date() : null } });
    revalidatePath("/backstore/spools", "layout");
  });
}

/** Marks a spool finished (or back in use). */
export async function setSpoolEmpty(id: string, empty: boolean) {
  return run(async () => {
    await requireAdmin();
    if (empty && (await prisma.spoolLoan.count({ where: { spoolId: id, returnedAt: null } })))
      throw new UserError("The spool is still with a customer — take it back first");
    await prisma.spool.update({
      where: { id },
      data: empty ? { status: "EMPTY", emptiedAt: new Date() } : { status: "OPEN", emptiedAt: null },
    });
    revalidatePath("/backstore/spools", "layout");
  });
}
