"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { nextSaleCode } from "@/lib/codes";
import { round2, weightedAverage } from "@/lib/costing";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

const saleSchema = z
  .object({
    mode: z.enum(["sell", "reserve"]),
    items: z
      .array(
        z.object({
          productId: z.string(),
          qty: z.coerce.number().int().positive("Qty must be at least 1"),
          unitPrice: z.coerce.number().min(0, "Price can't be negative"),
        }),
      )
      .min(1, "Cart is empty"),
    discount: z.coerce.number().min(0, "Discount can't be negative").default(0),
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

type Row = { avgCostThb: Prisma.Decimal };

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

export async function createSale(input: SaleInput) {
  return run(async () => {
    await requireAdmin();
    const s = saleSchema.parse(input);
    const subtotal = round2(s.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0));
    if (s.discount > subtotal) throw new UserError("Discount is bigger than the subtotal");
    const total = round2(subtotal - s.discount);

    const sale = await prisma.$transaction(async (tx) => {
      const costs = new Map<string, number>();

      // Conditional updates so two checkouts can never oversell the same roll.
      for (const [productId, qty] of sumByProduct(s.items)) {
        const rows =
          s.mode === "sell"
            ? await tx.$queryRaw<Row[]>`
                UPDATE "Product" SET "stockQty" = "stockQty" - ${qty}, "updatedAt" = now()
                WHERE id = ${productId} AND active AND "stockQty" - "reservedQty" >= ${qty}
                RETURNING "avgCostThb"`
            : await tx.$queryRaw<Row[]>`
                UPDATE "Product" SET "reservedQty" = "reservedQty" + ${qty}, "updatedAt" = now()
                WHERE id = ${productId} AND active AND "stockQty" - "reservedQty" >= ${qty}
                RETURNING "avgCostThb"`;
        if (rows.length === 0) await notEnough(tx, productId);
        costs.set(productId, Number(rows[0].avgCostThb));
      }

      const sell = s.mode === "sell";
      const created = await tx.sale.create({
        data: {
          code: await nextSaleCode(tx),
          status: sell ? "COMPLETED" : "RESERVED",
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
              unitCostThb: sell ? costs.get(i.productId) : null,
            })),
          },
        },
      });

      if (sell) {
        await tx.stockMovement.createMany({
          data: s.items.map((i) => ({
            productId: i.productId,
            kind: "SALE" as const,
            qty: -i.qty,
            unitCostThb: costs.get(i.productId),
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
          RETURNING "avgCostThb"`;
        if (rows.length === 0) await notEnough(tx, productId);
        costs.set(productId, Number(rows[0].avgCostThb));
      }

      for (const item of sale.items) {
        await tx.saleItem.update({ where: { id: item.id }, data: { unitCostThb: costs.get(item.productId) } });
      }
      await tx.stockMovement.createMany({
        data: sale.items.map((i) => ({
          productId: i.productId,
          kind: "SALE" as const,
          qty: -i.qty,
          unitCostThb: costs.get(i.productId),
          refType: "SALE",
          refId: sale.id,
          note: sale.code,
        })),
      });
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
          const cost = item.unitCostThb === null ? Number(p.avgCostThb) : Number(item.unitCostThb);
          await tx.product.update({
            where: { id: p.id },
            data: {
              stockQty: p.stockQty + item.qty,
              avgCostThb: weightedAverage(p.stockQty, Number(p.avgCostThb), item.qty, cost),
            },
          });
          await tx.stockMovement.create({
            data: {
              productId: p.id,
              kind: "ADJUST",
              qty: item.qty,
              unitCostThb: cost,
              refType: "SALE",
              refId: sale.id,
              note: `Void ${sale.code}`,
            },
          });
        }
      }
      await tx.sale.update({ where: { id }, data: { status: "CANCELLED" } });
    });

    revalidatePath("/backstore", "layout");
  });
}
