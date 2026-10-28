// How "no limit" is written: the symbol, with its word where the symbol would stand alone and unexplained.
// A quota that is `null` (or an invitation with `max_usage` -1) has no limit set; the symbol is the right side of
// "10 MB / ∞", and the word goes with it on a control, in a sentence and in what an operator types.
export const INFINITY = "∞";
export const NO_LIMIT = "No limit";
// A control, or a field that shows only the value: "∞ No limit".
export const UNLIMITED_LABEL = `${INFINITY} ${NO_LIMIT}`;
// Inside brackets that are already there, or after "Leave empty for": "∞ no limit".
export const UNLIMITED_BRACKET = `${INFINITY} ${NO_LIMIT.toLowerCase()}`;
// Under an input: what to type. The keyboard has no ∞, so the words work too.
export const UNLIMITED_HINT = `"${INFINITY}" ("no limit" and "unlimited" work too)`;

/** Does this text mean "no limit"? The symbol and both words are read, in any case. */
export function isUnlimitedInput(text) {
  const value = String(text ?? "")
    .trim()
    .toLowerCase();
  return value === INFINITY || value === "unlimited" || value === "no limit";
}
