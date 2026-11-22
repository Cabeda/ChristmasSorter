/**
 * Format an ISO date the way the UI and emails show it. Invalid input is
 * returned unchanged rather than throwing during a send.
 *
 * @param iso ISO date string.
 * @returns A long Portuguese date.
 */
export function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("pt-pt", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Turn a date into the `YYYY-MM-DD` string an `<input type="date">` expects.
 *
 * @param date Date to format.
 * @returns The input value, or an empty string for an invalid date.
 */
export function toDateInputValue(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
