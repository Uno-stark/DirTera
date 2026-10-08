/**
 * Format an ISO date string to a short human-readable date.
 * Returns "—" for falsy input.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function fmtDate(iso) {
  return iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}

/**
 * Returns true when the given expiry date is in the future
 * but within the next 7 days.
 *
 * @param {string|null|undefined} expiresAt
 * @returns {boolean}
 */
export function isExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt) - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

/**
 * Capitalise only the first character of a string.
 *
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a date to a relative human-readable string ("2h ago", "3d ago" …).
 * Falls back to a short date for anything older than 7 days.
 *
 * @param {string} isoString
 * @returns {string}
 */
export function fmtRelative(isoString) {
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
