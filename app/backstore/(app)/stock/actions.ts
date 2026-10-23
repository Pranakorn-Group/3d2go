"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { requireAdmin } from "@/lib/auth";
import { buildBulkRows } from "@/lib/bulk";
import { weightedAverage } from "@/lib/costing";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();

const productSchema = z.object({
  id: z.string().optional(),
  brand: z.string().trim().min(1, "Brand is required"),
  type: z.string().trim().min(1, "Type is required"),
  color: z.string().trim().min(1, "Color is required"),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex like #00BCD4")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  sku: z.string().trim().min(1, "SKU is required").toUpperCase(),
  sellPriceThb: z.coerce.number().min(0, "Price can't be negative"),
  refUrl: optionalText,
  note: optionalText,
  lowStockAt: z.coerce.number().int().min(0).default(2),
  // Only used when creating: opening stock with its ต้นทุนต่อม้วน.
  openingQty: z.coerce.number().int().min(0).default(0),
  openingCostThb: z.coerce.number().min(0).default(0),
});

export type ProductInput = z.input<typeof productSchema>;

/** Brand and type must come from the managed lists (Stock → Brands & types). */
async function assertInCatalog(brand: string, type: string) {
  const [b, t] = await Promise.all([
    prisma.brand.findUnique({ where: { name: brand } }),
    prisma.filamentType.findUnique({ where: { name: type } }),
  ]);
  if (!b) throw new UserError(`Brand "${brand}" isn't in the list — add it under Brands & types first`);
  if (!t) throw new UserError(`Type "${type}" isn't in the list — add it under Brands & types first`);
}

export async function saveProduct(input: ProductInput) {
  return run(async () => {
    await requireAdmin();
    const { id, openingQty, openingCostThb, ...data } = productSchema.parse(input);
    await assertInCatalog(data.brand, data.type);

    const product = id
      ? await prisma.product.update({ where: { id }, data })
      : await prisma.$transaction(async (tx) => {
          const created = await tx.product.create({
            data: { ...data, stockQty: openingQty, avgCostThb: openingCostThb },
          });
          if (openingQty > 0) {
            await tx.stockMovement.create({
              data: {
                productId: created.id,
                kind: "ADJUST",
                qty: openingQty,
                unitCostThb: openingCostThb,
                note: "Opening stock",
              },
            });
          }
          return created;
        });

    revalidatePath("/backstore", "layout");
    return toProduct(product);
  });
}

const bulkSchema = z.object({
  brand: z.string().trim().min(1, "Pick a brand"),
  type: z.string().trim().min(1, "Pick a type"),
  colors: z.array(z.object({ color: z.string(), colorHex: z.string().nullable() })).max(200),
  // Shared by every row.
  sellPriceThb: z.coerce.number().min(0, "Price can't be negative"),
  openingQty: z.coerce.number().int("Qty must be a whole number").min(0).default(0),
  openingCostThb: z.coerce.number().min(0, "Cost can't be negative").default(0),
  note: optionalText,
  lowStockAt: z.coerce.number().int().min(0).default(2),
  refUrl: optionalText,
});

/** Creates one product per color row (see lib/bulk.ts). All rows are saved together or none are. */
export async function bulkCreateProducts(input: z.input<typeof bulkSchema>) {
  return run(async () => {
    await requireAdmin();
    const { brand, type, colors, sellPriceThb, openingQty, openingCostThb, note, lowStockAt, refUrl } =
      bulkSchema.parse(input);
    await assertInCatalog(brand, type);

    const { rows, errors } = buildBulkRows(colors, brand, type);
    if (errors.length) throw new UserError(`Row ${errors[0].line}: ${errors[0].message}`);
    if (!rows.length) throw new UserError("Add at least one color");

    const taken = await prisma.product.findMany({
      where: { sku: { in: rows.map((r) => r.sku) } },
      select: { sku: true },
    });
    if (taken.length) throw new UserError(`SKU already exists: ${taken.map((t) => t.sku).join(", ")}`);

    await prisma.$transaction(async (tx) => {
      for (const r of rows) {
        await tx.product.create({
          data: {
            brand,
            type,
            color: r.color,
            colorHex: r.colorHex,
            sku: r.sku,
            sellPriceThb,
            stockQty: openingQty,
            avgCostThb: openingCostThb,
            note,
            lowStockAt,
            refUrl,
            movements: openingQty
              ? { create: { kind: "ADJUST", qty: openingQty, unitCostThb: openingCostThb, note: "Opening stock" } }
              : undefined,
          },
        });
      }
    });

    revalidatePath("/backstore", "layout");
    return rows.length;
  });
}

const catalogSchema = z.object({
  kind: z.enum(["brand", "type"]),
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(60),
});

/** Adds a brand/type, or renames one — products using the old name are renamed with it. */
export async function saveCatalogItem(input: z.input<typeof catalogSchema>) {
  return run(async () => {
    await requireAdmin();
    const { kind, id, name } = catalogSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      if (kind === "brand") {
        if (!id) return void (await tx.brand.create({ data: { name } }));
        const old = await tx.brand.findUniqueOrThrow({ where: { id } });
        await tx.brand.update({ where: { id }, data: { name } });
        await tx.product.updateMany({ where: { brand: old.name }, data: { brand: name } });
      } else {
        if (!id) return void (await tx.filamentType.create({ data: { name } }));
        const old = await tx.filamentType.findUniqueOrThrow({ where: { id } });
        await tx.filamentType.update({ where: { id }, data: { name } });
        await tx.product.updateMany({ where: { type: old.name }, data: { type: name } });
      }
    });

    revalidatePath("/backstore", "layout");
  });
}

/** Removes a brand/type that no product uses (archived products count — rename instead). */
export async function deleteCatalogItem(kind: "brand" | "type", id: string) {
  return run(async () => {
    await requireAdmin();
    const item =
      kind === "brand"
        ? await prisma.brand.findUniqueOrThrow({ where: { id } })
        : await prisma.filamentType.findUniqueOrThrow({ where: { id } });
    const used = await prisma.product.count({ where: kind === "brand" ? { brand: item.name } : { type: item.name } });
    if (used) throw new UserError(`${item.name} is used by ${used} product${used === 1 ? "" : "s"} — rename it instead`);

    if (kind === "brand") await prisma.brand.delete({ where: { id } });
    else await prisma.filamentType.delete({ where: { id } });
    revalidatePath("/backstore", "layout");
  });
}

const adjustSchema = z.object({
  productId: z.string(),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Change can't be zero"),
  note: z.string().trim().min(1, "Please give a reason"),
  // Cost per roll for stock added outside a purchase order (optional, keeps avg cost if empty).
  unitCostThb: z.coerce.number().min(0).nullable().optional(),
});

export async function adjustStock(input: z.input<typeof adjustSchema>) {
  return run(async () => {
    await requireAdmin();
    const { productId, delta, note, unitCostThb } = adjustSchema.parse(input);

    await prisma.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      const newQty = p.stockQty + delta;
      if (newQty < 0) throw new UserError(`Only ${p.stockQty} in stock`);
      if (newQty < p.reservedQty) throw new UserError(`${p.reservedQty} rolls are reserved — cancel reservations first`);

      let avg = Number(p.avgCostThb);
      if (delta > 0 && unitCostThb != null) {
        avg = weightedAverage(p.stockQty, avg, delta, unitCostThb);
      }
      await tx.product.update({ where: { id: productId }, data: { stockQty: newQty, avgCostThb: avg } });
      await tx.stockMovement.create({
        data: { productId, kind: "ADJUST", qty: delta, unitCostThb: unitCostThb ?? p.avgCostThb, note },
      });
    });

    revalidatePath("/backstore", "layout");
  });
}

export async function setProductActive(id: string, active: boolean) {
  return run(async () => {
    await requireAdmin();
    await prisma.product.update({ where: { id }, data: { active } });
    revalidatePath("/backstore", "layout");
  });
}
