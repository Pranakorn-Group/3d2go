import "server-only";
import { UserError } from "@/lib/action";
import { prisma } from "@/lib/db";
import { isValidSerial, normalizeSerial } from "@/lib/labels";

/** A printed label still on the shelf: not sold, not held by a reservation, not opened as a spool. */
export const ON_SHELF = { saleId: null, soldAt: null, spoolId: null } as const;

/**
 * The roll behind a scanned or typed label serial. Refuses labels already sold, held by a reservation or
 * opened as a filament2go spool, with a message saying which.
 */
export async function findShelfLabel(text: string) {
  const raw = text.trim().toUpperCase();
  if (!raw) throw new UserError("Empty scan");
  // Labels printed before random serials (SKU-0001) are looked up as they are.
  const s = (await prisma.productLabel.findUnique({ where: { serial: raw }, select: { id: true } })) ? raw : normalizeSerial(raw);
  if (s !== raw && !isValidSerial(s)) throw new UserError(`${raw} isn't a valid label serial — misread? Scan again`);
  const label = await prisma.productLabel.findUnique({
    where: { serial: s },
    select: { serial: true, productId: true, soldAt: true, sale: { select: { code: true } }, spool: { select: { serial: true } } },
  });
  if (!label) throw new UserError(`${s} isn't a label we printed`);
  if (label.spool) throw new UserError(`${s} was already opened as spool ${label.spool.serial}`);
  if (label.soldAt) throw new UserError(`${s} was already sold${label.sale ? ` (${label.sale.code})` : ""}`);
  if (label.sale) throw new UserError(`${s} is held by reservation ${label.sale.code}`);
  return { serial: label.serial, productId: label.productId };
}
