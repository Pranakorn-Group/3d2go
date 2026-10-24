"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { nextPurchaseCode } from "@/lib/codes";
import { allocatePO, weightedAverage } from "@/lib/costing";
import { prisma } from "@/lib/db";

const poSchema = z.object({
  id: z.string().optional(),
  supplier: z.string().trim().min(1, "Supplier is required"),
  currency: z.enum(["THB", "SGD"]),
  totalPaidSgd: z.coerce.number().positive("SGD paid must be more than 0").nullable().optional(),
  estRate: z.coerce.number().positive("Rate must be more than 0").nullable().optional(),
  trackingNo: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .optional(),
  orderedAt: z.coerce.date(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Pick a product for every line"),
        qty: z.coerce.number().int().positive("Qty must be at least 1"),
        unitPrice: z.coerce.number().min(0, "Price can't be negative"),
      }),
    )
    .min(1, "Add at least one item"),
});

export type PurchaseInput = z.input<typeof poSchema>;

export async function savePurchase(input: PurchaseInput) {
  return run(async () => {
    await requireAdmin();
    const { id, items, ...data } = poSchema.parse(input);

    const po = await prisma.$transaction(async (tx) => {
      if (id) {
        const existing = await tx.purchaseOrder.findUniqueOrThrow({ where: { id } });
        if (existing.status === "RECEIVED" || existing.status === "CANCELLED")
          throw new UserError("This order is closed and can't be edited");
        await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
        return tx.purchaseOrder.update({ where: { id }, data: { ...data, items: { create: items } } });
      }
      return tx.purchaseOrder.create({
        data: { ...data, code: await nextPurchaseCode(tx), items: { create: items } },
      });
    });

    revalidatePath("/backstore", "layout");
    return { id: po.id };
  });
}

export async function setPurchaseStatus(id: string, status: "PLACED" | "SHIPPED" | "CANCELLED") {
  return run(async () => {
    await requireAdmin();
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
    if (po.status === "RECEIVED") throw new UserError("Order is already received");
    await prisma.purchaseOrder.update({ where: { id }, data: { status } });
    revalidatePath("/backstore", "layout");
  });
}

/**
 * Receive the whole order: spread the SGD actually paid across lines by value (ต้นทุนต่อม้วน),
 * add rolls to stock and roll the new cost into each product's weighted-average cost.
 */
export async function receivePurchase(id: string, totalPaidSgd: number) {
  return run(async () => {
    await requireAdmin();
    const paid = z.coerce.number().positive("Enter the SGD amount you paid").parse(totalPaidSgd);

    await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: { items: { orderBy: { id: "asc" } } },
      });
      if (po.status === "RECEIVED") throw new UserError("Order is already received");
      if (po.status === "CANCELLED") throw new UserError("Order is cancelled");
      if (po.items.length === 0) throw new UserError("Order has no items");

      const allocation = allocatePO(
        po.items.map((i) => ({ qty: i.qty, unitPrice: Number(i.unitPrice) })),
        paid,
      );

      for (const [idx, item] of po.items.entries()) {
        const { allocatedSgd, unitCostSgd } = allocation[idx];
        await tx.purchaseOrderItem.update({ where: { id: item.id }, data: { allocatedSgd, unitCostSgd } });

        // Read inside the loop: the same product may appear on several lines.
        const p = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        await tx.product.update({
          where: { id: p.id },
          data: {
            stockQty: p.stockQty + item.qty,
            avgCostSgd: weightedAverage(p.stockQty, Number(p.avgCostSgd), item.qty, unitCostSgd),
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: p.id,
            kind: "RECEIVE",
            qty: item.qty,
            unitCostSgd,
            refType: "PO",
            refId: po.id,
            note: po.code,
          },
        });
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date(), totalPaidSgd: paid },
      });
    });

    revalidatePath("/backstore", "layout");
  });
}

export async function deletePurchase(id: string) {
  return run(async () => {
    await requireAdmin();
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id } });
    if (po.status === "RECEIVED") throw new UserError("Received orders can't be deleted");
    await prisma.purchaseOrder.delete({ where: { id } });
    revalidatePath("/backstore", "layout");
  });
}
