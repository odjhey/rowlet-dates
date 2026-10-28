// Calendar dates are whole UTC day numbers, so DST changes and timezone
// offsets can never shift a date onto its neighbour.
export const DAY_MS = 86_400_000
// Last day a JavaScript Date can represent (8.64e15 ms after the epoch).
export const MAX_DAY = 100_000_000

export const toUtcDate = (day: number) => new Date(day * DAY_MS)

export const parseDateValue = (value: string): number | null => {
  const match = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const dayOfMonth = Number(match[3])
  // setUTCFullYear keeps years below 100 literal, unlike Date.UTC.
  const date = new Date(0)
  date.setUTCFullYear(year, month, dayOfMonth)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== dayOfMonth
  ) {
    return null
  }
  return date.getTime() / DAY_MS
}

export const formatDateValue = (
  year: number,
  monthIndex: number,
  day: number,
) =>
  [
    String(year).padStart(4, '0'),
    String(monthIndex + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')

export const toDateValue = (day: number) => {
  const date = toUtcDate(day)
  return formatDateValue(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
}

export const lastDayOfMonth = (day: number, monthsAhead: number) => {
  const date = toUtcDate(day)
  const end = new Date(0)
  end.setUTCFullYear(
    date.getUTCFullYear(),
    date.getUTCMonth() + monthsAhead + 1,
    0,
  )
  return end.getTime() / DAY_MS
}

// 1970-01-01 (day 0) was a Thursday; 0 is Sunday and 6 is Saturday.
export const weekdayIndex = (day: number) => (((day + 4) % 7) + 7) % 7
export const isWeekend = (day: number) => {
  const index = weekdayIndex(day)
  return index === 0 || index === 6
}

// Counts Saturdays and Sundays across the whole range without walking it.
export const countWeekendDays = (start: number, end: number) => {
  const total = end - start + 1
  const fullWeeks = Math.floor(total / 7)
  let weekend = fullWeeks * 2
  for (let day = start + fullWeeks * 7; day <= end; day += 1) {
    if (isWeekend(day)) weekend += 1
  }
  return weekend
}

export type LimitResult =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; limit: number }

export const parseLimit = (value: string): LimitResult => {
  const text = value.trim()
  if (text === '') return { kind: 'empty' }
  const limit = /^\d+$/.test(text) ? Number(text) : 0
  if (limit < 1) {
    return {
      kind: 'invalid',
      message: 'Enter a whole number of days, 1 or more.',
    }
  }
  if (!Number.isSafeInteger(limit)) {
    return { kind: 'invalid', message: 'That day limit is too large.' }
  }
  return { kind: 'valid', limit }
}
