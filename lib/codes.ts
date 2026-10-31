import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { bkkStamp } from "@/lib/dates";

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

export function nextSpoolSerial(tx: Prisma.TransactionClient) {
  return next(`SP-${bkkStamp(true)}-`, (prefix) =>
    tx.spool.findFirst({ where: { serial: { startsWith: prefix } }, orderBy: { serial: "desc" }, select: { serial: true } }).then(
      (s) => s && { code: s.serial },
    ),
  );
}
