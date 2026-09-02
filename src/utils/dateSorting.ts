export type SupportedDateValue =
  | string
  | number
  | Date
  | null
  | undefined
  | { toMillis?: () => number; toDate?: () => Date; seconds?: number; nanoseconds?: number };

/** Converts the date formats accepted by the application into epoch milliseconds. */
export function dateValueToEpoch(value: SupportedDateValue): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const time = value.toMillis();
      return Number.isFinite(time) ? time : null;
    }
    if (typeof value.toDate === 'function') return dateValueToEpoch(value.toDate());
    if (typeof value.seconds === 'number') {
      return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
    }
    return null;
  }

  const text = value.trim();
  if (!text) return null;

  const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brDate) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = brDate;
    const time = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
    const parsed = new Date(time);
    return parsed.getUTCFullYear() === +year && parsed.getUTCMonth() === +month - 1 && parsed.getUTCDate() === +day
      ? time
      : null;
  }

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const time = Date.UTC(+year, +month - 1, +day);
    const parsed = new Date(time);
    return parsed.getUTCFullYear() === +year && parsed.getUTCMonth() === +month - 1 && parsed.getUTCDate() === +day
      ? time
      : null;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function compareDateValuesDescending(a: SupportedDateValue, b: SupportedDateValue): number {
  const aTime = dateValueToEpoch(a);
  const bTime = dateValueToEpoch(b);
  if (aTime === bTime) return 0;
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return bTime - aTime;
}

/**
 * Returns a new, stably sorted array. The business date is always primary;
 * an optional real timestamp is only used to order records on the same date.
 */
export function sortByDateDescending<T>(
  records: readonly T[],
  getDate: (record: T) => SupportedDateValue,
  getSecondaryDate?: (record: T) => SupportedDateValue
): T[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const primary = compareDateValuesDescending(getDate(a.record), getDate(b.record));
      if (primary !== 0) return primary;
      if (getSecondaryDate) {
        const secondary = compareDateValuesDescending(getSecondaryDate(a.record), getSecondaryDate(b.record));
        if (secondary !== 0) return secondary;
      }
      return a.index - b.index;
    })
    .map(({ record }) => record);
}
