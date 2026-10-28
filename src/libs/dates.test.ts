import { describe, expect, it } from 'vitest'
import {
  countWeekendDays,
  isWeekend,
  parseDateValue,
  parseLimit,
  toDateValue,
  weekdayIndex,
} from './dates'

const day = (value: string) => {
  const parsed = parseDateValue(value)
  if (parsed === null) throw new Error(`Invalid test date ${value}`)
  return parsed
}

// Brute-force reference for countWeekendDays.
const walkWeekendDays = (start: number, end: number) => {
  let count = 0
  for (let d = start; d <= end; d += 1) if (isWeekend(d)) count += 1
  return count
}

describe('parseDateValue', () => {
  it('returns whole UTC day numbers', () => {
    expect(parseDateValue('1970-01-01')).toBe(0)
    expect(parseDateValue('1970-01-02')).toBe(1)
    expect(parseDateValue('1969-12-31')).toBe(-1)
    expect(parseDateValue('2026-10-01')).toBe(20727)
  })

  it('handles leap years', () => {
    expect(parseDateValue('2024-02-29')).not.toBeNull()
    expect(parseDateValue('2000-02-29')).not.toBeNull()
    expect(parseDateValue('2023-02-29')).toBeNull()
    expect(parseDateValue('1900-02-29')).toBeNull()
    expect(day('2024-03-01') - day('2024-02-28')).toBe(2)
    expect(day('2023-03-01') - day('2023-02-28')).toBe(1)
    expect(day('2025-01-01') - day('2024-01-01')).toBe(366)
  })

  it('rejects invalid dates', () => {
    expect(parseDateValue('2026-02-30')).toBeNull()
    expect(parseDateValue('2026-04-31')).toBeNull()
    expect(parseDateValue('2026-13-01')).toBeNull()
    expect(parseDateValue('2026-00-10')).toBeNull()
    expect(parseDateValue('2026-01-00')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(parseDateValue('')).toBeNull()
    expect(parseDateValue('2026-1-01')).toBeNull()
    expect(parseDateValue('26-01-01')).toBeNull()
    expect(parseDateValue('2026/01/01')).toBeNull()
    expect(parseDateValue(' 2026-01-01')).toBeNull()
  })

  it('keeps years below 100 literal', () => {
    const d = day('0099-12-31')
    expect(toDateValue(d)).toBe('0099-12-31')
    expect(toDateValue(d + 1)).toBe('0100-01-01')
    expect(toDateValue(day('0001-01-01'))).toBe('0001-01-01')
    expect(parseDateValue('0004-02-29')).not.toBeNull()
    expect(parseDateValue('0001-02-29')).toBeNull()
  })

  it('round-trips through toDateValue', () => {
    for (const value of [
      '2026-10-01',
      '2024-02-29',
      '1969-07-20',
      '9999-12-31',
      '10000-01-01',
    ]) {
      expect(toDateValue(day(value))).toBe(value)
    }
  })
})

describe('weekdayIndex', () => {
  it('maps days to 0 (Sunday) through 6 (Saturday)', () => {
    expect(weekdayIndex(day('1970-01-01'))).toBe(4) // Thursday
    expect(weekdayIndex(day('2026-10-01'))).toBe(4) // Thursday
    expect(weekdayIndex(day('2026-10-03'))).toBe(6) // Saturday
    expect(weekdayIndex(day('2026-10-04'))).toBe(0) // Sunday
    expect(weekdayIndex(day('2026-10-05'))).toBe(1) // Monday
  })

  it('handles days before the epoch', () => {
    expect(weekdayIndex(day('1969-12-31'))).toBe(3) // Wednesday
    expect(weekdayIndex(day('1969-12-28'))).toBe(0) // Sunday
    expect(weekdayIndex(day('0001-01-01'))).toBe(1) // Monday (proleptic)
  })

  it('agrees with Date#getUTCDay', () => {
    for (let d = -800; d <= 800; d += 13) {
      expect(weekdayIndex(d)).toBe(new Date(d * 86_400_000).getUTCDay())
    }
  })
})

describe('countWeekendDays', () => {
  // 2026-10-03 is a Saturday, 2026-10-04 a Sunday.
  it('counts a single day', () => {
    expect(countWeekendDays(day('2026-10-01'), day('2026-10-01'))).toBe(0)
    expect(countWeekendDays(day('2026-10-03'), day('2026-10-03'))).toBe(1)
    expect(countWeekendDays(day('2026-10-04'), day('2026-10-04'))).toBe(1)
  })

  it('counts ranges that start on a weekend', () => {
    expect(countWeekendDays(day('2026-10-03'), day('2026-10-05'))).toBe(2)
    expect(countWeekendDays(day('2026-10-04'), day('2026-10-09'))).toBe(1)
    expect(countWeekendDays(day('2026-10-04'), day('2026-10-10'))).toBe(2)
  })

  it('counts ranges that end on a weekend', () => {
    expect(countWeekendDays(day('2026-10-01'), day('2026-10-03'))).toBe(1)
    expect(countWeekendDays(day('2026-10-01'), day('2026-10-04'))).toBe(2)
    expect(countWeekendDays(day('2026-10-05'), day('2026-10-10'))).toBe(1)
  })

  it('counts weekday-only ranges', () => {
    expect(countWeekendDays(day('2026-10-05'), day('2026-10-09'))).toBe(0)
  })

  it('counts multi-week ranges', () => {
    // Exactly two weeks always holds four weekend days.
    expect(countWeekendDays(day('2026-10-01'), day('2026-10-14'))).toBe(4)
    expect(countWeekendDays(day('2026-10-03'), day('2026-10-16'))).toBe(4)
    // October 2026: Saturdays 3/10/17/24/31, Sundays 4/11/18/25.
    expect(countWeekendDays(day('2026-10-01'), day('2026-10-31'))).toBe(9)
    // 2024 is a leap year starting on a Monday: 52 Saturdays, 52 Sundays.
    expect(countWeekendDays(day('2024-01-01'), day('2024-12-31'))).toBe(104)
  })

  it('matches a day-by-day walk for every short range', () => {
    const base = day('2026-10-01')
    for (let start = base; start < base + 7; start += 1) {
      for (let end = start; end < start + 30; end += 1) {
        expect(countWeekendDays(start, end)).toBe(walkWeekendDays(start, end))
      }
    }
  })
})

describe('parseLimit', () => {
  const invalid = {
    kind: 'invalid',
    message: 'Enter a whole number of days, 1 or more.',
  }

  it('treats blank input as empty', () => {
    expect(parseLimit('')).toEqual({ kind: 'empty' })
    expect(parseLimit('   ')).toEqual({ kind: 'empty' })
  })

  it('accepts whole numbers, ignoring surrounding space and leading zeros', () => {
    expect(parseLimit('90')).toEqual({ kind: 'valid', limit: 90 })
    expect(parseLimit(' 1 ')).toEqual({ kind: 'valid', limit: 1 })
    expect(parseLimit('007')).toEqual({ kind: 'valid', limit: 7 })
  })

  it('rejects zero, fractions, signs and other text', () => {
    expect(parseLimit('0')).toEqual(invalid)
    expect(parseLimit('000')).toEqual(invalid)
    expect(parseLimit('1.5')).toEqual(invalid)
    expect(parseLimit('1.0')).toEqual(invalid)
    expect(parseLimit('-3')).toEqual(invalid)
    expect(parseLimit('+3')).toEqual(invalid)
    expect(parseLimit('1e3')).toEqual(invalid)
    expect(parseLimit('ten')).toEqual(invalid)
  })

  it('rejects limits beyond the safe integer range', () => {
    expect(parseLimit('9007199254740991')).toEqual({
      kind: 'valid',
      limit: Number.MAX_SAFE_INTEGER,
    })
    expect(parseLimit('9007199254740992')).toEqual({
      kind: 'invalid',
      message: 'That day limit is too large.',
    })
  })
})
