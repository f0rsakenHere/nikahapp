/* How a number is said on screen.
 *
 * Shared, because a height written one way on the card and another way
 * on the page the card opens is the sort of difference a reader notices
 * without being able to name it.
 */

/** Stored in centimetres, read in feet and inches by most of this
 *  audience — the same reasoning as the height dropdown. */
export function feetAndInches(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}\u2032${inches % 12}\u2033 \u00b7 ${cm} cm`;
}
