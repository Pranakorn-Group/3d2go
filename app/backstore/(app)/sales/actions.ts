"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { nextSaleCode } from "@/lib/codes";
import { round2, weightedAverage } from "@/lib/costing";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

const channelEnum = z.enum(["STORE", "SHOPEE", "LAZADA", "TIKTOK", "CAROUSELL", "OTHER"]);

const saleSchema = z
  .object({
    mode: z.enum(["sell", "reserve"]),
    items: z
      .array(
        z.object({
          productId: z.string(),
          qty: z.coerce.number().int().positive("Qty must be at least 1"),
          unitPrice: z.coerce.number().min(0, "Price can't be negative"),
          /** Roll labels scanned for this line (lib/labels.ts); may be fewer than qty. */
          serials: z.array(z.string().trim().toUpperCase().min(1)).default([]),
        }),
      )
      .min(1, "Cart is empty"),
    discount: z.coerce.number().min(0, "Discount can't be negative").default(0),
    channel: channelEnum.default("STORE"),
    platformOrderNo: z.string().trim().optional(),
    platformFee: z.coerce.number().min(0, "Fee can't be negative").default(0),
    customerName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    deposit: z.coerce.number().min(0).nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    note: z.string().trim().optional(),
  })
  .refine((s) => s.mode === "sell" || !!s.customerName, {
    message: "Customer name is required for a reservation",
  });

export type SaleInput = z.input<typeof saleSchema>;

type Row = { avgCostSgd: Prisma.Decimal };

function sumByProduct(items: { productId: string; qty: number }[]) {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.productId, (map.get(i.productId) ?? 0) + i.qty);
  return map;
}

async function notEnough(tx: Prisma.TransactionClient, productId: string): Promise<never> {
  const p = await tx.product.findUnique({ where: { id: productId } });
  if (!p) throw new UserError("Product not found");
  throw new UserError(`${p.sku}: only ${p.stockQty - p.reservedQty} available`);
}

/** Ties the scanned labels to the sale (sold now, or held by a reservation) so they can't be sold again. */
async function claimLabels(
  tx: Prisma.TransactionClient,
  items: { productId: string; qty: number; serials: string[] }[],
  saleId: string,
  sold: boolean,
) {
  for (const item of items) {
    const serials = [...new Set(item.serials)];
    if (!serials.length) continue;
    if (serials.length > item.qty) throw new UserError(`${serials.length} labels scanned for ${item.qty} roll${item.qty === 1 ? "" : "s"}`);
    const { count } = await tx.productLabel.updateMany({
      where: { serial: { in: serials }, productId: item.productId, saleId: null, soldAt: null, spoolId: null },
      data: { saleId, soldAt: sold ? new Date() : null },
    });
    if (count !== serials.length) throw new UserError("A scanned label was already used or belongs to another filament — scan again");
  }
}

export async function createSale(input: SaleInput) {
  return run(async () => {
    await requireAdmin();
    const s = saleSchema.parse(input);
    const subtotal = round2(s.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0));
    if (s.discount > subtotal) throw new UserError("Discount is bigger than the subtotal");
    const total = round2(subtotal - s.discount);
    if (s.channel !== "STORE" && s.platformFee > total) throw new UserError("Platform fee is bigger than the total");

    const sale = await prisma.$transaction(async (tx) => {
      const costs = new Map<string, number>();

      // Conditional updates so two checkouts can never oversell the same roll.
      for (const [productId, qty] of sumByProduct(s.items)) {
        const rows =
          s.mode === "sell"
            ? await tx.$queryRaw<Row[]>`
                UPDATE "Product" SET "stockQty" = "stockQty" - ${qty}, "updatedAt" = now()
                WHERE id = ${productId} AND active AND "stockQty" - "reservedQty" >= ${qty}
                RETURNING "avgCostSgd"`
            : await tx.$queryRaw<Row[]>`
                UPDATE "Product" SET "reservedQty" = "reservedQty" + ${qty}, "updatedAt" = now()
                WHERE id = ${productId} AND active AND "stockQty" - "reservedQty" >= ${qty}
                RETURNING "avgCostSgd"`;
        if (rows.length === 0) await notEnough(tx, productId);
        costs.set(productId, Number(rows[0].avgCostSgd));
      }

      const sell = s.mode === "sell";
      const created = await tx.sale.create({
        data: {
          code: await nextSaleCode(tx),
          status: sell ? "COMPLETED" : "RESERVED",
          channel: s.channel,
          platformOrderNo: s.channel === "STORE" ? null : s.platformOrderNo || null,
          platformFee: s.channel === "STORE" ? 0 : s.platformFee,
          customerName: s.customerName || null,
          phone: s.phone || null,
          deposit: sell ? null : (s.deposit ?? null),
          dueDate: sell ? null : (s.dueDate ?? null),
          subtotal,
          discount: s.discount,
          total,
          note: s.note || null,
          completedAt: sell ? new Date() : null,
          costTotal: sell ? round2(s.items.reduce((sum, i) => sum + i.qty * costs.get(i.productId)!, 0)) : null,
          items: {
            create: s.items.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              unitPrice: i.unitPrice,
              unitCostSgd: sell ? costs.get(i.productId) : null,
            })),
          },
        },
      });

      await claimLabels(tx, s.items, created.id, sell);

      if (sell) {
        await tx.stockMovement.createMany({
          data: s.items.map((i) => ({
            productId: i.productId,
            kind: "SALE" as const,
            qty: -i.qty,
            unitCostSgd: costs.get(i.productId),
            refType: "SALE",
            refId: created.id,
            note: created.code,
          })),
        });
      }
      return created;
    });

    revalidatePath("/backstore", "layout");
    return { id: sale.id, code: sale.code };
  });
}

/** Turn a reservation into a sale: reserved rolls leave stock at today's average cost. */
export async function completeReservation(id: string) {
  return run(async () => {
    await requireAdmin();
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (sale.status !== "RESERVED") throw new UserError("Only active reservations can be completed");

      const costs = new Map<string, number>();
      for (const [productId, qty] of sumByProduct(sale.items)) {
        const rows = await tx.$queryRaw<Row[]>`
          UPDATE "Product"
          SET "stockQty" = "stockQty" - ${qty}, "reservedQty" = "reservedQty" - ${qty}, "updatedAt" = now()
          WHERE id = ${productId} AND "stockQty" >= ${qty} AND "reservedQty" >= ${qty}
          RETURNING "avgCostSgd"`;
        if (rows.length === 0) await notEnough(tx, productId);
        costs.set(productId, Number(rows[0].avgCostSgd));
      }

      for (const item of sale.items) {
        await tx.saleItem.update({ where: { id: item.id }, data: { unitCostSgd: costs.get(item.productId) } });
      }
      await tx.stockMovement.createMany({
        data: sale.items.map((i) => ({
          productId: i.productId,
          kind: "SALE" as const,
          qty: -i.qty,
          unitCostSgd: costs.get(i.productId),
          refType: "SALE",
          refId: sale.id,
          note: sale.code,
        })),
      });
      await tx.productLabel.updateMany({ where: { saleId: id }, data: { soldAt: new Date() } });
      await tx.sale.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          costTotal: round2(sale.items.reduce((sum, i) => sum + i.qty * costs.get(i.productId)!, 0)),
        },
      });
    });

    revalidatePath("/backstore", "layout");
  });
}

/** Cancel a reservation (releases held rolls) or void a completed sale (returns rolls to stock). */
export async function cancelSale(id: string) {
  return run(async () => {
    await requireAdmin();
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (sale.status === "CANCELLED") throw new UserError("Already cancelled");

      if (sale.status === "RESERVED") {
        for (const [productId, qty] of sumByProduct(sale.items)) {
          await tx.$executeRaw`
            UPDATE "Product" SET "reservedQty" = GREATEST("reservedQty" - ${qty}, 0), "updatedAt" = now()
            WHERE id = ${productId}`;
        }
      } else {
        for (const item of sale.items) {
          const p = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
          const cost = item.unitCostSgd === null ? Number(p.avgCostSgd) : Number(item.unitCostSgd);
          await tx.product.update({
            where: { id: p.id },
            data: {
              stockQty: p.stockQty + item.qty,
              avgCostSgd: weightedAverage(p.stockQty, Number(p.avgCostSgd), item.qty, cost),
            },
          });
          await tx.stockMovement.create({
            data: {
              productId: p.id,
              kind: "ADJUST",
              qty: item.qty,
              unitCostSgd: cost,
              refType: "SALE",
              refId: sale.id,
              note: `Void ${sale.code}`,
            },
          });
        }
      }
      // Its labels go back on the shelf with the rolls.
      await tx.productLabel.updateMany({ where: { saleId: id }, data: { saleId: null, soldAt: null } });
      await tx.sale.update({ where: { id }, data: { status: "CANCELLED" } });
    });

    revalidatePath("/backstore", "layout");
  });
}

const channelSchema = z.object({
  channel: channelEnum,
  platformOrderNo: z.string().trim().optional(),
  platformFee: z.coerce.number().min(0, "Fee can't be negative").default(0),
});

export type SaleChannelInput = z.input<typeof channelSchema>;

/** Mark where a sale was made after the fact, e.g. an existing sale or reservation that went through Shopee. */
export async function updateSaleChannel(id: string, input: SaleChannelInput) {
  return run(async () => {
    await requireAdmin();
    const c = channelSchema.parse(input);
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id } });
    if (sale.status === "CANCELLED") throw new UserError("Cancelled sales can't be changed");
    const online = c.channel !== "STORE";
    if (online && c.platformFee > Number(sale.total)) throw new UserError("Platform fee is bigger than the total");
    await prisma.sale.update({
      where: { id },
      data: {
        channel: c.channel,
        platformOrderNo: online ? c.platformOrderNo || null : null,
        platformFee: online ? c.platformFee : 0,
      },
    });
    revalidatePath("/backstore", "layout");
  });
}
