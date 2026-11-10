import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { bkkStamp } from "@/lib/dates";
import { randomSpoolSerial } from "@/lib/spool";

async function next(
  prefix: string,
  findLast: (prefix: string) => Promise<{ code: string } | null>,
) {
  const last = await findLast(prefix);
  const n = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

export function nextPurchaseCode(tx: Prisma.TransactionClient) {
  return next(`PO-${bkkStamp(false)}-`, (prefix) =>
    tx.purchaseOrder.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" }, select: { code: true } }),
  );
}

export function nextSaleCode(tx: Prisma.TransactionClient) {
  return next(`S-${bkkStamp(true)}-`, (prefix) =>
    tx.sale.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" }, select: { code: true } }),
  );
}

/** A random, unused spool serial (SP + 4 digits + check digit). */
export async function nextSpoolSerial(tx: Prisma.TransactionClient) {
  for (let i = 0; i < 50; i++) {
    const serial = randomSpoolSerial();
    if (!(await tx.spool.findUnique({ where: { serial }, select: { id: true } }))) return serial;
  }
  throw new Error("Couldn't find a free spool serial");
}
