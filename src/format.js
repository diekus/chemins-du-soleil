import { t } from './i18n.js';

/** Humanize a past timestamp as "just now" / "N minutes ago" / "N hours ago", translated. */
export function relativeTime(timestamp) {
  const mins = Math.round((Date.now() - timestamp) / 60000);
  if (mins < 1)   return t('common.justNow');
  if (mins === 1) return t('common.minuteAgo');
  if (mins < 60)  return t('common.minutesAgo', { count: mins });
  const hours = Math.round(mins / 60);
  return hours === 1 ? t('common.hourAgo') : t('common.hoursAgo', { count: hours });
}
