import {
  differenceInCalendarDays,
  differenceInSeconds,
  format,
  formatDistanceToNowStrict,
  isSameYear,
  isToday,
  isYesterday,
  type Locale,
} from 'date-fns';
import { es } from 'date-fns/locale';

type Token = Parameters<NonNullable<Locale['formatDistance']>>[0];

const SHORT: Partial<Record<Token, (n: number) => string>> = {
  xSeconds: (n) => `${n} s`,
  xMinutes: (n) => `${n} min`,
  xHours: (n) => `${n} h`,
  xDays: (n) => `${n} d`,
  xWeeks: (n) => `${n} sem`,
  xMonths: (n) => `${n} ${n === 1 ? 'mes' : 'meses'}`,
  xYears: (n) => `${n} ${n === 1 ? 'año' : 'años'}`,
};

/** Locale `es` con unidades cortas: "hace 3 h", "hace 5 min". */
const esShort: Locale = {
  ...es,
  formatDistance: (token, count, options) => {
    const short = SHORT[token];
    if (!short) return es.formatDistance(token, count, options);
    const value = short(count);
    if (!options?.addSuffix) return value;
    return options.comparison && options.comparison > 0 ? `en ${value}` : `hace ${value}`;
  },
};

function toDate(d: string | Date) {
  return typeof d === 'string' ? new Date(d) : d;
}

export function timeAgo(d: string | Date) {
  const date = toDate(d);
  if (Number.isNaN(date.getTime())) return '';
  const secs = differenceInSeconds(new Date(), date);
  if (secs < 45 && secs > -45) return 'ahora';
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: esShort });
}

/** "en 3 d" / "hace 2 h" para fechas futuras o pasadas. */
export function relative(d: string | Date) {
  return formatDistanceToNowStrict(toDate(d), { addSuffix: true, locale: esShort });
}

export function fullDate(d: string | Date) {
  return format(toDate(d), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
}

export function longDate(d: string | Date) {
  return format(toDate(d), "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function monthYear(d: string | Date) {
  return format(toDate(d), "MMMM 'de' yyyy", { locale: es });
}

export function shortDate(d: string | Date) {
  const date = toDate(d);
  return format(date, isSameYear(date, new Date()) ? 'd MMM' : 'd MMM yyyy', { locale: es });
}

export function timeHM(d: string | Date) {
  return format(toDate(d), 'HH:mm', { locale: es });
}

/** Etiqueta de día para separadores de chat. */
export function dayLabel(d: string | Date) {
  const date = toDate(d);
  if (isToday(date)) return 'Hoy';
  if (isYesterday(date)) return 'Ayer';
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEEE', { locale: es });
  return format(date, isSameYear(date, new Date()) ? "EEEE d 'de' MMMM" : "d 'de' MMMM 'de' yyyy", {
    locale: es,
  });
}

/** Hora corta para listas de conversaciones. */
export function conversationTime(d: string | Date) {
  const date = toDate(d);
  if (isToday(date)) return timeHM(date);
  if (isYesterday(date)) return 'Ayer';
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEE', { locale: es });
  return shortDate(date);
}

export type TimeBucket = 'today' | 'week' | 'older';

export function timeBucket(d: string | Date): TimeBucket {
  const date = toDate(d);
  if (isToday(date)) return 'today';
  if (differenceInCalendarDays(new Date(), date) < 7) return 'week';
  return 'older';
}
