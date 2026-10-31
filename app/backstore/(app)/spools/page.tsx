import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { startOfMonthBkk } from "@/lib/dates";
import { spoolInclude, toProduct, toSpool } from "@/lib/dto";
import { getSpoolSpecs } from "@/lib/spools";
import { SpoolsView } from "./spools-view";

export const metadata: Metadata = { title: "Spools" };

export default async function SpoolsPage() {
  const [spools, products, specs, month] = await Promise.all([
    prisma.spool.findMany({ include: spoolInclude, orderBy: { openedAt: "desc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }] }),
    getSpoolSpecs(),
    prisma.spoolUsage.aggregate({
      where: { endedAt: { gte: startOfMonthBkk() } },
      _sum: { usedG: true, costSgd: true },
      _count: true,
    }),
  ]);
  return (
    <SpoolsView
      spools={spools.map(toSpool)}
      products={products.map(toProduct)}
      specs={specs}
      month={{ usedG: month._sum.usedG ?? 0, costSgd: Number(month._sum.costSgd ?? 0), jobs: month._count }}
    />
  );
}
