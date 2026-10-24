// SGQR / PayNow payload (EMVCo merchant-presented QR). Pure, so it runs on the client too.

export type PayNowOptions = {
  /** Mobile number (+65…) or UEN that receives the payment. */
  proxy: string;
  amount?: number | null;
  /** Shown to the payer and on the bank statement as the reference. */
  reference?: string;
  /** Let the payer change the amount. */
  editable?: boolean;
  /** Last day the QR can be paid, as YYYYMMDD. */
  expiry?: string;
  merchantName?: string;
};

const MAX_REFERENCE = 25;

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE, as required for field 63. */
function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Banks only accept letters, digits, spaces and dashes in the reference. */
export function cleanReference(ref: string) {
  return ref.replace(/[^A-Za-z0-9 -]/g, "").trim().slice(0, MAX_REFERENCE);
}

/** Every reference starts with the shop name so the payment is recognisable on statements. */
export const REFERENCE_PREFIX = "3D2GO";

/** The reference to put in the QR: the prefix, then the note (cleaned, not prefixed twice, max 25 chars). */
export function shopReference(note: string) {
  const rest = cleanReference(note).replace(new RegExp(`^${REFERENCE_PREFIX}\\b[ -]*`, "i"), "");
  return cleanReference(rest ? `${REFERENCE_PREFIX} ${rest}` : REFERENCE_PREFIX);
}

export function paynowPayload({ proxy, amount, reference, editable = false, expiry, merchantName = "NA" }: PayNowOptions) {
  const isMobile = proxy.startsWith("+");
  const account =
    field("00", "SG.PAYNOW") +
    field("01", isMobile ? "0" : "2") +
    field("02", proxy) +
    field("03", editable ? "1" : "0") +
    (expiry ? field("04", expiry) : "");
  const ref = reference ? cleanReference(reference) : "";

  const body =
    field("00", "01") +
    field("01", "11") +
    field("26", account) +
    field("52", "0000") +
    field("53", "702") +
    (amount && amount > 0 ? field("54", amount.toFixed(2)) : "") +
    field("58", "SG") +
    field("59", merchantName.slice(0, 25)) +
    field("60", "Singapore") +
    (ref ? field("62", field("01", ref)) : "") +
    "6304";
  return body + crc16(body);
}

/** YYYYMMDD in Singapore, `days` from today. */
export function sgDate(days = 0) {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Singapore" }).replaceAll("-", "");
}
