/** Humanize a past timestamp as "just now" / "N minutes ago" / "N hours ago". */
export function relativeTime(timestamp) {
  const mins = Math.round((Date.now() - timestamp) / 60000);
  if (mins < 1)   return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60)  return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}
