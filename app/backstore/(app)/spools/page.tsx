import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { startOfMonthBkk } from "@/lib/dates";
import { spoolInclude, toProduct, toSpool, toSpoolLoan } from "@/lib/dto";
import { getSpoolSpecs } from "@/lib/spools";
import { SpoolsView } from "./spools-view";

export const metadata: Metadata = { title: "filament2go" };

export default async function SpoolsPage() {
  const [spools, products, specs, month, unpaid] = await Promise.all([
    prisma.spool.findMany({ include: spoolInclude, orderBy: { openedAt: "desc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }] }),
    getSpoolSpecs(),
    prisma.spoolLoan.aggregate({
      where: { returnedAt: { gte: startOfMonthBkk() } },
      _sum: { usedG: true, chargeSgd: true, costSgd: true },
      _count: true,
    }),
    prisma.spoolLoan.findMany({
      where: { returnedAt: { not: null }, paidAt: null, chargeSgd: { gt: 0 } },
      include: { spool: { select: { serial: true } } },
      orderBy: { returnedAt: "asc" },
    }),
  ]);
  const proxy = process.env.PAYNOW_PROXY?.trim();
  return (
    <SpoolsView
      spools={spools.map(toSpool)}
      products={products.map(toProduct)}
      specs={specs}
      month={{
        usedG: month._sum.usedG ?? 0,
        chargeSgd: Number(month._sum.chargeSgd ?? 0),
        costSgd: Number(month._sum.costSgd ?? 0),
        loans: month._count,
      }}
      unpaid={unpaid.map((l) => ({ ...toSpoolLoan(l), serial: l.spool.serial }))}
      paynow={proxy ? { proxy, name: process.env.PAYNOW_NAME?.trim() || "NA" } : null}
    />
  );
}
