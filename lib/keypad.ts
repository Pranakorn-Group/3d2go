export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back" | "clear";

const MAX_WHOLE_DIGITS = 6;
const MAX_DECIMALS = 2;

/** Applies one keypad press to a money string, keeping it a valid amount ("", "0.", "12.5", ...). */
export function pressKey(value: string, key: KeypadKey): string {
  if (key === "clear") return "";
  if (key === "back") return value.slice(0, -1);

  const [whole, decimals] = value.split(".");
  if (key === ".") {
    if (decimals !== undefined) return value;
    return `${whole || "0"}.`;
  }

  if (decimals !== undefined) return decimals.length >= MAX_DECIMALS ? value : value + key;
  if (whole === "0") return key; // "0" then "5" is "5", and "00" stays "0"
  return whole.length >= MAX_WHOLE_DIGITS ? value : value + key;
}
