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
