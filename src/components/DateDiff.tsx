import './DateDiff.css'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { DIFF_DRAFT_KEY, readDraft, writeDraft } from '../libs/drafts'

// Calendar dates are whole UTC day numbers, so DST changes and timezone
// offsets can never shift a date onto its neighbour.
const DAY_MS = 86_400_000
// Last day a JavaScript Date can represent (8.64e15 ms after the epoch).
const MAX_DAY = 100_000_000
const MONTHS_PER_PAGE = 6
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const fullDateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const weekdayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  timeZone: 'UTC',
})
const numberFormat = new Intl.NumberFormat('en-GB')

const toUtcDate = (day: number) => new Date(day * DAY_MS)

const parseDateValue = (value: string): number | null => {
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

const formatDateValue = (year: number, monthIndex: number, day: number) =>
  [
    String(year).padStart(4, '0'),
    String(monthIndex + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')

const toDateValue = (day: number) => {
  const date = toUtcDate(day)
  return formatDateValue(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
}

const todayValue = () => {
  const now = new Date()
  return formatDateValue(now.getFullYear(), now.getMonth(), now.getDate())
}

const lastDayOfMonth = (day: number, monthsAhead: number) => {
  const date = toUtcDate(day)
  const end = new Date(0)
  end.setUTCFullYear(
    date.getUTCFullYear(),
    date.getUTCMonth() + monthsAhead + 1,
    0,
  )
  return end.getTime() / DAY_MS
}

const countLabel = (count: number, singular: string, plural: string) =>
  `${numberFormat.format(count)} ${count === 1 ? singular : plural}`

// Compact YY-MM-DD ddd label, e.g. 26-10-01 Thu.
const dayLabel = (day: number) =>
  `${toDateValue(day).slice(-8)} ${weekdayFormat.format(toUtcDate(day))}`

// 1970-01-01 (day 0) was a Thursday; 0 is Sunday and 6 is Saturday.
const weekdayIndex = (day: number) => (((day + 4) % 7) + 7) % 7
const isWeekend = (day: number) => {
  const index = weekdayIndex(day)
  return index === 0 || index === 6
}

// Counts Saturdays and Sundays across the whole range without walking it.
const countWeekendDays = (start: number, end: number) => {
  const total = end - start + 1
  const fullWeeks = Math.floor(total / 7)
  let weekend = fullWeeks * 2
  for (let day = start + fullWeeks * 7; day <= end; day += 1) {
    if (isWeekend(day)) weekend += 1
  }
  return weekend
}

type DiffDraft = {
  startValue: string
  endValue: string
  limitValue: string
  selectedDates: string[]
}

const defaultDraft = (): DiffDraft => ({
  startValue: todayValue(),
  endValue: todayValue(),
  limitValue: '',
  selectedDates: [],
})

const isDiffDraft = (value: unknown): value is DiffDraft => {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.startValue === 'string' &&
    typeof draft.endValue === 'string' &&
    typeof draft.limitValue === 'string' &&
    Array.isArray(draft.selectedDates) &&
    draft.selectedDates.every((date) => typeof date === 'string')
  )
}

type LimitResult =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; limit: number }

const parseLimit = (value: string): LimitResult => {
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

export function DateDiff() {
  const ids = useId()
  const selectedTitleRef = useRef<HTMLHeadingElement>(null)
  const startInputRef = useRef<HTMLInputElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const pendingFocusRef = useRef<'start' | number | null>(null)
  const [focusDay, setFocusDay] = useState<number | null>(null)
  // Restore once, before defaults; nothing is written until the user acts.
  const [restored] = useState(() =>
    readDraft(DIFF_DRAFT_KEY, defaultDraft, isDiffDraft),
  )
  const [draft, setDraft] = useState(restored.value)
  const [storageError, setStorageError] = useState(restored.error)
  // Latest committed draft, so back-to-back actions build on each other.
  const draftRef = useRef(restored.value)

  const commit = (patch: Partial<DiffDraft>) => {
    const next = { ...draftRef.current, ...patch }
    draftRef.current = next
    setDraft(next)
    setStorageError(writeDraft(DIFF_DRAFT_KEY, next))
  }

  const { startValue, endValue, limitValue } = draft
  const selectedDates = new Set(draft.selectedDates)

  const start = parseDateValue(startValue)
  const end = parseDateValue(endValue)
  const isReversed = start !== null && end !== null && end < start
  const range =
    start !== null && end !== null && !isReversed ? { start, end } : null
  const limit = parseLimit(limitValue)

  // The rendered window resets whenever either date changes.
  const rangeKey = `${startValue}|${endValue}`
  const [monthWindow, setMonthWindow] = useState({
    rangeKey,
    months: MONTHS_PER_PAGE,
  })
  const visibleMonths =
    monthWindow.rangeKey === rangeKey ? monthWindow.months : MONTHS_PER_PAGE
  const visibleEnd = range
    ? Math.min(range.end, lastDayOfMonth(range.start, visibleMonths - 1))
    : 0
  const firstWeekStart = range ? range.start - weekdayIndex(range.start) : 0
  const weeks = range
    ? Array.from(
        { length: Math.ceil((visibleEnd - firstWeekStart + 1) / 7) },
        (_, index) => firstWeekStart + index * 7,
      )
    : []
  const tabDay =
    range &&
    focusDay !== null &&
    focusDay >= range.start &&
    focusDay <= visibleEnd
      ? focusDay
      : range?.start

  useLayoutEffect(() => {
    const target = pendingFocusRef.current
    pendingFocusRef.current = null
    if (target === 'start') {
      startInputRef.current?.focus()
    } else if (target !== null) {
      calendarRef.current
        ?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)
        ?.focus()
    }
  }, [rangeKey, visibleEnd])
  const elapsed = range ? range.end - range.start : 0
  const inclusive = elapsed + 1
  const weekendDays = range ? countWeekendDays(range.start, range.end) : 0
  const weekdays = inclusive - weekendDays
  const today = parseDateValue(todayValue())

  const selectedDays = [...selectedDates]
    .flatMap((value) => {
      const day = parseDateValue(value)
      return day === null ? [] : [{ value, day }]
    })
    .sort((a, b) => a.day - b.day)
  const selectedInRange = range
    ? selectedDays.filter(({ day }) => day >= range.start && day <= range.end)
        .length
    : 0
  const selectedOutside = selectedDays.length - selectedInRange

  const selectionSummary =
    selectedDays.length === 0
      ? 'No dates selected.'
      : selectedOutside > 0 && range
        ? `${numberFormat.format(selectedDays.length)} selected, ${numberFormat.format(selectedOutside)} outside this range.`
        : `${numberFormat.format(selectedDays.length)} selected.`

  const startError =
    start === null
      ? 'Enter a complete start date, for example 1 October 2026.'
      : null
  const endError =
    end === null
      ? 'Enter a complete end date, for example 7 October 2026.'
      : null
  const endErrorId = endError
    ? `${ids}-end-error`
    : isReversed
      ? `${ids}-reversed-error`
      : undefined
  const limitErrorId =
    limit.kind === 'invalid' ? `${ids}-limit-error` : undefined

  let limitSummary: string | null = null
  if (range && limit.kind === 'valid') {
    const left = limit.limit - inclusive
    const status =
      left > 0
        ? countLabel(left, 'day left', 'days left')
        : left === 0
          ? 'at limit'
          : countLabel(-left, 'day over', 'days over')
    const lastDay = range.start + limit.limit - 1
    const lastDate =
      lastDay <= MAX_DAY
        ? `Last date: ${toDateValue(lastDay)} ${weekdayFormat.format(toUtcDate(lastDay))}.`
        : 'Last date is beyond the supported calendar.'
    limitSummary = `${numberFormat.format(inclusive)} / ${countLabel(limit.limit, 'day', 'days')} · ${status}. ${lastDate}`
  }

  const toggleDate = (value: string) => {
    const current = draftRef.current.selectedDates
    commit({
      selectedDates: current.includes(value)
        ? current.filter((date) => date !== value)
        : [...current, value],
    })
  }

  const handleDateKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    day: number,
  ) => {
    if (
      !range ||
      event.altKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    )
      return
    let target: number
    switch (event.key) {
      case 'ArrowLeft':
        target = day - 1
        break
      case 'ArrowRight':
        target = day + 1
        break
      case 'ArrowUp':
        target = day - 7
        break
      case 'ArrowDown':
        target = day + 7
        break
      case 'Home':
        target = event.ctrlKey
          ? range.start
          : Math.max(range.start, day - weekdayIndex(day))
        break
      case 'End':
        target = event.ctrlKey
          ? visibleEnd
          : Math.min(visibleEnd, day + 6 - weekdayIndex(day))
        break
      default:
        return
    }
    event.preventDefault()
    if (target < range.start || target > visibleEnd) return
    calendarRef.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)
      ?.focus()
  }

  const swapDates = () => {
    const current = draftRef.current
    pendingFocusRef.current = 'start'
    commit({ startValue: current.endValue, endValue: current.startValue })
  }

  return (
    <div className="date-counter">
      <h1 className="page-title">Trip dates</h1>

      <div className="date-range">
        <label className="date-range-field">
          <span className="field-label">Start</span>
          <input
            ref={startInputRef}
            type="date"
            className="input"
            value={startValue}
            onChange={(event) => commit({ startValue: event.target.value })}
            aria-invalid={startError !== null}
            aria-describedby={startError ? `${ids}-start-error` : undefined}
          />
        </label>
        <label className="date-range-field">
          <span className="field-label">End</span>
          <input
            type="date"
            className="input"
            value={endValue}
            onChange={(event) => commit({ endValue: event.target.value })}
            aria-invalid={endErrorId !== undefined}
            aria-describedby={endErrorId}
          />
        </label>
        <label className="date-range-field">
          <span className="field-label">Day limit</span>
          <input
            type="text"
            inputMode="numeric"
            className="input"
            size={6}
            placeholder="optional"
            value={limitValue}
            onChange={(event) => commit({ limitValue: event.target.value })}
            aria-invalid={limitErrorId !== undefined}
            aria-describedby={limitErrorId}
          />
        </label>
      </div>
      {storageError && (
        <p className="error-message" role="alert">
          {storageError}
        </p>
      )}
      {startError && (
        <p className="error-message" id={`${ids}-start-error`}>
          {startError}
        </p>
      )}
      {endError && (
        <p className="error-message" id={`${ids}-end-error`}>
          {endError}
        </p>
      )}
      {isReversed && (
        <div className="toolbar">
          <p className="error-message" id={`${ids}-reversed-error`}>
            End is before start.
          </p>
          <button type="button" className="btn btn-sm" onClick={swapDates}>
            Swap dates
          </button>
        </div>
      )}
      {limit.kind === 'invalid' && (
        <p className="error-message" id={limitErrorId}>
          {limit.message}
        </p>
      )}

      <div role="status">
        {range && (
          <>
            <p className="date-counts">
              {countLabel(inclusive, 'date', 'dates')} (both counted) ·{' '}
              {countLabel(weekdays, 'weekday', 'weekdays')} ·{' '}
              {countLabel(weekendDays, 'weekend day', 'weekend days')} (Sat/Sun)
              · {countLabel(elapsed, 'day', 'days')} apart
            </p>
            {limitSummary && <p className="date-counts">{limitSummary}</p>}
          </>
        )}
      </div>
      <p className="muted date-note">
        Calendar arithmetic only. Destination visa and stay rules may count days
        differently.
      </p>

      {range && (
        <>
          <div
            className="date-calendar mono"
            role="grid"
            aria-label="Dates in range"
            aria-describedby={`${ids}-keyboard-help`}
            ref={calendarRef}
          >
            <div className="date-weekdays" role="row">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} role="columnheader">
                  {weekday}
                </span>
              ))}
            </div>
            <div className="date-days" role="rowgroup">
              {weeks.map((weekStart) => (
                <div className="date-week" role="row" key={weekStart}>
                  {WEEKDAYS.map((weekday, index) => {
                    const day = weekStart + index
                    if (day < range.start || day > visibleEnd) {
                      return (
                        <div
                          key={weekday}
                          role="gridcell"
                          aria-disabled="true"
                        />
                      )
                    }
                    const value = toDateValue(day)
                    return (
                      <div key={weekday} role="gridcell">
                        <button
                          type="button"
                          className={`btn btn-sm mono date-day${isWeekend(day) ? ' date-day-weekend' : ''}`}
                          data-day={day}
                          title={value}
                          tabIndex={day === tabDay ? 0 : -1}
                          aria-pressed={selectedDates.has(value)}
                          aria-current={day === today ? 'date' : undefined}
                          onFocus={() => setFocusDay(day)}
                          onKeyDown={(event) => handleDateKeyDown(event, day)}
                          onClick={() => toggleDate(value)}
                        >
                          <time dateTime={value}>{value.slice(-5)}</time>
                          <span className="sr-only">
                            , {fullDateFormat.format(toUtcDate(day))}
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <details className="date-keyboard-help">
            <summary id={`${ids}-keyboard-help`}>
              Keyboard help
              <span className="sr-only">
                : Arrow keys move; Enter or Space marks a date.
              </span>
            </summary>
            <p>
              Tab enters or leaves the dates. Arrow keys move by one day
              (Left/Right) or one week (Up/Down). Home/End move to the
              first/last date in the week; Ctrl+Home/End move to the first/last
              shown date. Enter or Space marks or unmarks a date.
            </p>
          </details>
          {visibleEnd < range.end && (
            <div className="toolbar">
              <p className="muted">
                Showing {numberFormat.format(visibleEnd - range.start + 1)} of{' '}
                {countLabel(inclusive, 'date', 'dates')}, to{' '}
                {dayLabel(visibleEnd)}.
              </p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  pendingFocusRef.current = visibleEnd + 1
                  setFocusDay(visibleEnd + 1)
                  setMonthWindow({
                    rangeKey,
                    months: visibleMonths + MONTHS_PER_PAGE,
                  })
                }}
              >
                Show next {MONTHS_PER_PAGE} months
              </button>
            </div>
          )}
        </>
      )}

      <section
        className="date-selected"
        aria-labelledby={`${ids}-selected-title`}
      >
        <div className="panel-header">
          <h2
            className="panel-title"
            id={`${ids}-selected-title`}
            ref={selectedTitleRef}
            tabIndex={-1}
          >
            Selected dates
          </h2>
          {selectedDates.size > 0 && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                commit({ selectedDates: [] })
                selectedTitleRef.current?.focus()
              }}
            >
              Clear
            </button>
          )}
        </div>
        <p className="status-message" role="status">
          {selectionSummary}
        </p>
        {selectedDays.length > 0 && (
          <ul className="date-selected-list">
            {selectedDays.map(({ value, day }) => {
              const outside =
                range !== null && (day < range.start || day > range.end)
              return (
                <li key={value}>
                  <span className="mono">{dayLabel(day)}</span>
                  {outside && (
                    <span className="muted"> (outside range)</span>
                  )}{' '}
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Remove ${fullDateFormat.format(toUtcDate(day))}`}
                    onClick={() => {
                      toggleDate(value)
                      selectedTitleRef.current?.focus()
                    }}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
