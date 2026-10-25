import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import dayjs from 'dayjs'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useEntryStorage } from '../hooks/use-storage'
import { HOURS_DRAFT_KEY, readDraft, writeDraft } from '../libs/drafts'
import './Hours.css'

type Activity = {
  name: string
  from: string
  to: string
}

// Also the active draft shape; snapshots and logSignature use only date/tz/hours.
type FormValues = {
  date: string
  tz: string
  hours: Activity[]
  inputText: string
}

type Endpoint = 'from' | 'to'

type StoredEntry = {
  id: string
  date: string
  tz: string
  hours: string
}

type Status = { kind: 'success' | 'error'; message: string } | null

const SLOT_COUNT = 48
const SLOT_MINUTES = 30
const LAST_SLOT = SLOT_COUNT - 1
const ENDPOINTS: Endpoint[] = ['from', 'to']
const ENDPOINT_LABEL: Record<Endpoint, string> = { from: 'start', to: 'end' }
const LINE_FORMAT = 'HH:MM-HH:MM description'
const LINE_PATTERN = /^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})(?:\s+(.*))?$/
const EMPTY_ACTIVITY: Activity = { name: '', from: '', to: '' }

const pad = (value: number) => String(value).padStart(2, '0')

const TZ_PRESETS = ['GMT+8', 'JST']

function isValidTime(time: string): boolean {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)
}

function toMinutes(time: string): number | null {
  if (!isValidTime(time)) return null
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Same-day absolute difference: an end earlier than the start is not treated as overnight.
function activityMinutes(activity: Activity): number | null {
  const from = toMinutes(activity.from)
  const to = toMinutes(activity.to)
  if (from === null || to === null) return null
  return Math.abs(to - from)
}

function slotTime(slot: number): string {
  const minutes = slot * SLOT_MINUTES
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} min`
  if (!minutes) return `${hours} h`
  return `${hours} h ${minutes} min`
}

function activityLabel(activity: Activity, index: number): string {
  return activity.name.trim() || `Activity ${index + 1}`
}

function activitiesToText(activities: Activity[]): string {
  return activities
    .map(({ from, to, name }) => `${from}-${to} ${name}`)
    .join('\n')
}

function parseActivityLines(
  text: string,
  requireValidTimes: boolean,
): { activities: Activity[]; errors: string[] } {
  const activities: Activity[] = []
  const errors: string[] = []
  text.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const line = rawLine.trim()
    if (!line) return
    const match = line.match(LINE_PATTERN)
    if (!match) {
      errors.push(
        `Line ${lineIndex + 1}: expected “${LINE_FORMAT}”, got “${line}”.`,
      )
      return
    }
    const from = match[1].padStart(5, '0')
    const to = match[2].padStart(5, '0')
    if (requireValidTimes) {
      for (const time of [from, to]) {
        if (!isValidTime(time))
          errors.push(
            `Line ${lineIndex + 1}: “${time}” is not a valid 24-hour time.`,
          )
      }
    }
    activities.push({ name: (match[3] ?? '').trim(), from, to })
  })
  return { activities, errors }
}

function buildReport(date: string, tz: string, activities: Activity[]): string {
  const day = date || 'Date not set'
  const heading = tz.trim() ? `# ${day} (${tz})` : `# ${day}`
  const tasks = activities
    .filter((activity) => activityMinutes(activity) !== null)
    .map(({ from, to, name }) => `- ${from}-${to} ${name}`.trimEnd())
  return [
    heading,
    `## Today's Tasks`,
    ...tasks,
    `## Todo Next`,
    `## Today's Thoughts`,
  ].join('\n')
}

function saveProblems({ date, hours }: FormValues): string[] {
  const problems: string[] = []
  if (!date) problems.push('Choose a date.')
  if (!hours.length) problems.push('Add at least one activity.')
  hours.forEach((activity, index) => {
    if (activityMinutes(activity) === null)
      problems.push(
        `${activityLabel(activity, index)} needs valid start and end times.`,
      )
  })
  return problems
}

function logSignature({ date, tz, hours }: FormValues): string {
  return JSON.stringify([date, tz, activitiesToText(hours)])
}

function initialValues(): FormValues {
  return {
    date: dayjs().format('YYYY-MM-DD'),
    tz: TZ_PRESETS[0],
    hours: [],
    inputText: '',
  }
}

function isActivity(value: unknown): value is Activity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'from' in value &&
    typeof value.from === 'string' &&
    'to' in value &&
    typeof value.to === 'string'
  )
}

// Partial or invalid strings are still valid draft data; only the shape is checked.
function isHoursDraft(value: unknown): value is FormValues {
  return (
    typeof value === 'object' &&
    value !== null &&
    'date' in value &&
    typeof value.date === 'string' &&
    'tz' in value &&
    typeof value.tz === 'string' &&
    'inputText' in value &&
    typeof value.inputText === 'string' &&
    'hours' in value &&
    Array.isArray(value.hours) &&
    value.hours.every(isActivity)
  )
}

function draftOf({ date, tz, hours, inputText }: FormValues): FormValues {
  return {
    date,
    tz,
    hours: hours.map(({ name, from, to }) => ({ name, from, to })),
    inputText,
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function snapshotSavedAt(id: string): string | null {
  const savedAt = Number(id)
  return Number.isFinite(savedAt) && savedAt > 0
    ? dayjs(savedAt).format('D MMM YYYY, HH:mm')
    : null
}

function snapshotPreview(hours: string): string {
  const { activities, errors } = parseActivityLines(hours, false)
  if (errors.length) {
    const firstLine = hours.split(/\r?\n/).find((line) => line.trim())
    return firstLine ? firstLine.trim() : 'No activities'
  }
  if (!activities.length) return 'No activities'
  const total = activities.reduce(
    (sum, activity) => sum + (activityMinutes(activity) ?? 0),
    0,
  )
  const lead = activities[0].name.trim() || 'Untitled activity'
  const more = activities.length > 1 ? ` +${activities.length - 1} more` : ''
  const count = `${activities.length} ${
    activities.length === 1 ? 'activity' : 'activities'
  }`
  return `${count} · ${formatDuration(total)} · ${lead}${more}`
}

export const Hours = () => {
  const [restored] = useState(() =>
    readDraft(HOURS_DRAFT_KEY, initialValues, isHoursDraft),
  )
  const { register, control, setValue, getValues, reset, watch } =
    useForm<FormValues>({ defaultValues: restored.value })
  const { fields, append, remove, replace } = useFieldArray({
    name: 'hours',
    control,
  })
  const activities = useWatch({ control, name: 'hours' })
  const date = useWatch({ control, name: 'date' })
  const tz = useWatch({ control, name: 'tz' })

  const [draftError, setDraftError] = useState(restored.error)
  // Starts as what was restored (or shown after a failed read), so mounting never
  // overwrites stored data; only a real change writes.
  const writtenDraft = useRef(JSON.stringify(draftOf(restored.value)))

  // Synchronous on purpose: a refresh right after an edit must not beat the write.
  const persistDraft = useCallback(() => {
    const draft = draftOf(getValues())
    const text = JSON.stringify(draft)
    if (text === writtenDraft.current) return
    const error = writeDraft(HOURS_DRAFT_KEY, draft)
    if (!error) writtenDraft.current = text
    setDraftError(error)
  }, [getValues])

  // Typed input reaches storage here; programmatic changes also call persistDraft directly.
  useEffect(() => {
    const subscription = watch(persistDraft)
    return () => subscription.unsubscribe()
  }, [watch, persistDraft])

  const [entries, { listEntries, getEntry, newEntry }] = useEntryStorage()
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [listError, setListError] = useState('')
  const [snapshotStatus, setSnapshotStatus] = useState<Status>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const syncedSignature = useRef<string | null>(null)

  const [timelineStatus, setTimelineStatus] = useState('')
  const [copiedReport, setCopiedReport] = useState<string | null>(null)
  const [copyError, setCopyError] = useState('')

  const ids = useId()
  const dateErrorId = `${ids}-date-error`
  const slotHelpId = `${ids}-slot-help`

  const counted = activities.filter(
    (activity) => activityMinutes(activity) !== null,
  )
  const totalMinutes = counted.reduce(
    (sum, activity) => sum + (activityMinutes(activity) ?? 0),
    0,
  )
  const excludedCount = activities.length - counted.length
  const report = buildReport(date, tz, activities)

  const refreshSnapshots = useCallback(async () => {
    setListState('loading')
    try {
      await listEntries()
      setListState('ready')
    } catch (error) {
      setListError(errorText(error))
      setListState('error')
    }
  }, [listEntries])

  useEffect(() => {
    void refreshSnapshots()
  }, [refreshSnapshots])

  const saveSnapshot = async () => {
    const values = getValues()
    const problems = saveProblems(values)
    if (problems.length) {
      setSnapshotStatus({
        kind: 'error',
        message: `Not saved. ${problems.join(' ')}`,
      })
      return
    }
    const savedHours = activitiesToText(values.hours)
    const savedSignature = JSON.stringify([values.date, values.tz, savedHours])
    setIsSaving(true)
    setSnapshotStatus(null)
    try {
      await newEntry({
        date: values.date,
        tz: values.tz,
        hours: savedHours,
      })
      syncedSignature.current = savedSignature
      setListState('ready')
      setSnapshotStatus({
        kind: 'success',
        message: `Saved snapshot for ${values.date} at ${dayjs().format(
          'HH:mm',
        )}.`,
      })
    } catch (error) {
      setSnapshotStatus({
        kind: 'error',
        message: `Saving failed (${errorText(
          error,
        )}). Your current log is still here.`,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const loadSnapshot = async (entry: StoredEntry) => {
    const current = getValues()
    if (
      current.hours.length > 0 &&
      syncedSignature.current !== logSignature(current) &&
      !window.confirm(
        `Replace the current draft with the snapshot for ${
          entry.date || 'an undated day'
        }? The current log will be replaced.`,
      )
    )
      return
    const beforeLoadSignature = logSignature(current)
    setLoadingId(entry.id)
    setSnapshotStatus(null)
    try {
      const stored = await getEntry(entry.id)
      if (!stored) throw new Error('that snapshot no longer exists')
      const parsed = parseActivityLines(stored.hours ?? '', false)
      if (parsed.errors.length) {
        setSnapshotStatus({
          kind: 'error',
          message: `Not loaded: ${parsed.errors[0]} Your current log is unchanged.`,
        })
        return
      }
      if (logSignature(getValues()) !== beforeLoadSignature) {
        throw new Error(
          'the log changed while loading; load the snapshot again if you want to replace it',
        )
      }
      // Snapshots hold date/tz/rows only; the Lines editor keeps its text.
      const next: FormValues = {
        date: stored.date ?? '',
        tz: stored.tz ?? '',
        hours: parsed.activities,
        inputText: getValues('inputText'),
      }
      reset(next)
      persistDraft()
      syncedSignature.current = logSignature(next)
      setTimelineStatus('')
      setSnapshotStatus({
        kind: 'success',
        message: `Loaded snapshot for ${next.date || 'an undated day'} with ${
          next.hours.length
        } ${next.hours.length === 1 ? 'activity' : 'activities'}.`,
      })
    } catch (error) {
      setSnapshotStatus({
        kind: 'error',
        message: `Loading failed (${errorText(
          error,
        )}). Your current log is unchanged.`,
      })
    } finally {
      setLoadingId(null)
    }
  }

  const applySlot = (index: number, endpoint: Endpoint, time: string) => {
    const activity = getValues(`hours.${index}` as const)
    const other: Endpoint = endpoint === 'from' ? 'to' : 'from'
    setValue(`hours.${index}.${endpoint}` as const, time, {
      shouldDirty: true,
    })
    persistDraft()
    setTimelineStatus(
      `${activityLabel(activity, index)}: ${
        ENDPOINT_LABEL[endpoint]
      } set to ${time}; ${ENDPOINT_LABEL[other]} stays ${
        activity[other] || 'empty'
      }.`,
    )
  }

  const copyReport = async () => {
    setCopyError('')
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('clipboard access is not available here')
      await navigator.clipboard.writeText(report)
      setCopiedReport(report)
    } catch (error) {
      setCopiedReport(null)
      setCopyError(
        `Couldn't copy (${errorText(
          error,
        )}). Select the text in the box and copy it manually.`,
      )
    }
  }

  const reportLines = report.split('\n').length

  return (
    <div className="hours hours-stack">
      <h1 className="page-title">Hours</h1>

      <div className="hours-line">
        <label>
          <span className="sr-only">Date</span>
          <input
            type="date"
            className="input input-sm input-bordered hours-date"
            aria-invalid={!date}
            aria-describedby={date ? undefined : dateErrorId}
            {...register('date')}
          />
        </label>
        <label>
          <span className="sr-only">Time zone label</span>
          <input
            className="input input-sm input-bordered hours-tz"
            {...register('tz')}
          />
        </label>
        <span
          className="hours-line"
          role="group"
          aria-label="Time zone label presets"
        >
          {TZ_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="btn btn-sm btn-outline"
              aria-pressed={tz === preset}
              onClick={() => {
                setValue('tz', preset, { shouldDirty: true })
                persistDraft()
              }}
            >
              {preset}
            </button>
          ))}
        </span>
      </div>
      {!date && (
        <p id={dateErrorId} className="error-message">
          Choose a date before saving.
        </p>
      )}
      <p className="error-message hours-live" role="alert">
        {draftError}
      </p>

      {fields.length > 0 && (
        <ol className="hours-rows">
          {fields.map((field, index) => {
            const activity = activities[index] ?? EMPTY_ACTIVITY
            const minutes = activityMinutes(activity)
            const n = index + 1
            return (
              <li key={field.id} className="hours-line">
                <label className="hours-row-name">
                  <span className="sr-only">Activity {n} description</span>
                  <input
                    className="input input-sm input-bordered"
                    placeholder="description"
                    {...register(`hours.${index}.name` as const)}
                  />
                </label>
                <label>
                  <span className="sr-only">Activity {n} start</span>
                  <input
                    type="time"
                    className="input input-sm input-bordered mono hours-time"
                    aria-invalid={
                      Boolean(activity.from) && !isValidTime(activity.from)
                    }
                    {...register(`hours.${index}.from` as const)}
                  />
                </label>
                <label>
                  <span className="sr-only">Activity {n} end</span>
                  <input
                    type="time"
                    className="input input-sm input-bordered mono hours-time"
                    aria-invalid={
                      Boolean(activity.to) && !isValidTime(activity.to)
                    }
                    {...register(`hours.${index}.to` as const)}
                  />
                </label>
                <span className="mono hours-row-min">
                  {minutes === null ? (
                    <>
                      <span aria-hidden="true">--</span>
                      <span className="sr-only">not counted</span>
                    </>
                  ) : (
                    `${minutes} min`
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  aria-label={`Remove ${activityLabel(activity, index)}`}
                  onClick={() => {
                    remove(index)
                    persistDraft()
                  }}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <div className="hours-line">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => {
            append({ ...EMPTY_ACTIVITY })
            persistDraft()
          }}
        >
          Add
        </button>
        <span>
          Total <strong className="mono">{formatDuration(totalMinutes)}</strong>{' '}
          <span className="mono muted">
            ({totalMinutes} min, {Number((totalMinutes / 60).toFixed(2))} h)
          </span>
        </span>
        {excludedCount > 0 && (
          <span className="error-message">
            {excludedCount} without valid times left out of total and log
          </span>
        )}
      </div>

      <label>
        <span className="sr-only">Markdown daily log</span>
        <textarea
          readOnly
          className="textarea textarea-bordered mono hours-text"
          rows={Math.min(Math.max(reportLines, 5), 20)}
          value={report}
        />
      </label>
      <div className="hours-line">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => void copyReport()}
        >
          Copy
        </button>
        <span className="status-message" role="status">
          {copiedReport === report ? 'Copied.' : ''}
        </span>
      </div>
      <p className="error-message hours-live" role="alert">
        {copyError}
      </p>

      {fields.length > 0 && (
        <section
          className="hours-section hours-stack"
          aria-labelledby={`${ids}-timeline-title`}
        >
          <div className="hours-line">
            <h2 id={`${ids}-timeline-title`} className="panel-title">
              Timeline
            </h2>
            <span id={slotHelpId} className="field-hint">
              Choose Start or End, then a half-hour slot. Arrows move; Enter
              sets. Scroll for later hours.
            </span>
          </div>
          <div className="hours-tl">
            <div className="hours-tl-inner">
              <div className="hours-tl-grid" aria-hidden="true">
                <span className="hours-tl-info" />
                <span className="hours-tl-scale">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <span key={hour}>{pad(hour)}</span>
                  ))}
                </span>
              </div>
              <ol className="hours-tl-rows">
                {fields.map((field, index) => (
                  <TimelineRow
                    key={field.id}
                    index={index}
                    activity={activities[index] ?? EMPTY_ACTIVITY}
                    helpId={slotHelpId}
                    onApply={applySlot}
                  />
                ))}
              </ol>
            </div>
          </div>
          <p className="status-message hours-live" role="status">
            {timelineStatus}
          </p>
        </section>
      )}

      <ActivityTextPanel
        activities={activities}
        textField={register('inputText')}
        getText={() => getValues('inputText')}
        onExport={(text) => {
          setValue('inputText', text)
          persistDraft()
        }}
        onReplace={(next) => {
          replace(next)
          persistDraft()
          setTimelineStatus('')
        }}
      />

      <section
        className="hours-section hours-stack"
        aria-labelledby={`${ids}-snapshots-title`}
      >
        <div className="hours-line">
          <h2 id={`${ids}-snapshots-title`} className="panel-title">
            Saved
          </h2>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={isSaving}
            onClick={() => void saveSnapshot()}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={listState === 'loading'}
            onClick={() => void refreshSnapshots()}
          >
            Refresh
          </button>
        </div>
        <p className="status-message hours-live" role="status">
          {snapshotStatus?.kind === 'success' ? snapshotStatus.message : ''}
          {listState === 'loading' && entries.length > 0
            ? ' Refreshing snapshots…'
            : ''}
        </p>
        <p className="error-message hours-live" role="alert">
          {snapshotStatus?.kind === 'error' ? snapshotStatus.message : ''}
          {listState === 'error'
            ? ` Couldn't read saved snapshots (${listError}).`
            : ''}
        </p>
        {entries.length > 0 ? (
          <ul className="hours-saves">
            {entries
              .slice()
              .reverse()
              .map((entry) => {
                const savedAt = snapshotSavedAt(entry.id)
                const title = `${entry.date || 'Undated'}${
                  entry.tz ? ` ${entry.tz}` : ''
                }`
                return (
                  <li key={entry.id} className="hours-line">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      aria-label={`Load snapshot ${title}${
                        savedAt ? `, saved ${savedAt}` : ''
                      }`}
                      disabled={loadingId !== null}
                      onClick={() => void loadSnapshot(entry)}
                    >
                      {loadingId === entry.id ? 'Loading…' : 'Load'}
                    </button>
                    <span className="mono">{title}</span>
                    <span className="muted">
                      {snapshotPreview(entry.hours)}
                    </span>
                    <span className="muted">
                      {savedAt ? `saved ${savedAt}` : `id ${entry.id}`}
                    </span>
                  </li>
                )
              })}
          </ul>
        ) : listState === 'loading' ? (
          <p className="muted">Loading…</p>
        ) : listState === 'ready' ? (
          <p className="muted">No saved snapshots.</p>
        ) : null}
      </section>
    </div>
  )
}

const TimelineRow = ({
  index,
  activity,
  helpId,
  onApply,
}: {
  index: number
  activity: Activity
  helpId: string
  onApply: (index: number, endpoint: Endpoint, time: string) => void
}) => {
  const [endpoint, setEndpoint] = useState<Endpoint>('from')
  const [focusSlot, setFocusSlot] = useState<number | null>(null)
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([])

  const label = activityLabel(activity, index)
  const current = activity[endpoint]
  const currentMinutes = toMinutes(current)
  const tabSlot =
    focusSlot ??
    (currentMinutes === null ? 0 : Math.floor(currentMinutes / SLOT_MINUTES))
  const fromMinutes = toMinutes(activity.from)
  const toMinutesValue = toMinutes(activity.to)
  const span =
    fromMinutes !== null && toMinutesValue !== null
      ? {
          start: Math.min(fromMinutes, toMinutesValue),
          end: Math.max(fromMinutes, toMinutesValue),
        }
      : null
  const markers: { endpoint: Endpoint; minutes: number }[] = []
  if (fromMinutes !== null)
    markers.push({ endpoint: 'from', minutes: fromMinutes })
  if (toMinutesValue !== null)
    markers.push({ endpoint: 'to', minutes: toMinutesValue })

  const moveFocus = (slot: number) => {
    setFocusSlot(slot)
    slotRefs.current[slot]?.focus()
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    slot: number,
  ) => {
    const next =
      event.key === 'ArrowRight'
        ? Math.min(LAST_SLOT, slot + 1)
        : event.key === 'ArrowLeft'
          ? Math.max(0, slot - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? LAST_SLOT
              : null
    if (next === null) return
    event.preventDefault()
    moveFocus(next)
  }

  const percent = (minutes: number) => `${(minutes / SLOT_MINUTES) * 100}%`

  return (
    <li className="hours-tl-grid">
      <span className="hours-tl-info">
        <span className="hours-tl-name" title={label}>
          {label}
        </span>
        <span
          className="hours-line"
          role="group"
          aria-label={`Time to set for ${label}`}
        >
          {ENDPOINTS.map((option) => (
            <button
              key={option}
              type="button"
              className="btn btn-sm btn-outline"
              aria-pressed={endpoint === option}
              onClick={() => {
                setEndpoint(option)
                setFocusSlot(null)
              }}
            >
              {option === 'from' ? 'Start' : 'End'}
            </button>
          ))}
        </span>
      </span>
      <span
        className="hours-slots"
        role="group"
        aria-label={`Half-hour slots for ${label}`}
        aria-describedby={helpId}
      >
        {Array.from({ length: SLOT_COUNT }, (_, slot) => {
          const slotStart = slot * SLOT_MINUTES
          const slotEnd = slotStart + SLOT_MINUTES
          const time = slotTime(slot)
          const fillStart = span ? Math.max(span.start, slotStart) : 0
          const fillEnd = span ? Math.min(span.end, slotEnd) : 0
          const isCurrent = current === time
          return (
            <button
              key={slot}
              ref={(element) => {
                slotRefs.current[slot] = element
              }}
              type="button"
              className="hours-slot"
              data-hour-start={slot % 2 === 0 || undefined}
              data-pm={slot >= SLOT_COUNT / 2 || undefined}
              tabIndex={slot === tabSlot ? 0 : -1}
              aria-label={`${label}: set ${
                ENDPOINT_LABEL[endpoint]
              } to ${time}${isCurrent ? ' (current)' : ''}`}
              onKeyDown={(event) => handleKeyDown(event, slot)}
              onFocus={() => setFocusSlot(slot)}
              onClick={() => {
                setFocusSlot(slot)
                onApply(index, endpoint, time)
              }}
            >
              {fillEnd > fillStart && (
                <span
                  className="hours-slot-fill"
                  style={{
                    left: percent(fillStart - slotStart),
                    width: percent(fillEnd - fillStart),
                  }}
                />
              )}
              {markers
                .filter(
                  (marker) =>
                    marker.minutes >= slotStart && marker.minutes < slotEnd,
                )
                .map((marker) => (
                  <span
                    key={marker.endpoint}
                    className="hours-slot-marker"
                    data-active={marker.endpoint === endpoint || undefined}
                    style={{ left: percent(marker.minutes - slotStart) }}
                  />
                ))}
            </button>
          )
        })}
      </span>
    </li>
  )
}

const ActivityTextPanel = ({
  activities,
  textField,
  getText,
  onExport,
  onReplace,
}: {
  activities: Activity[]
  textField: UseFormRegisterReturn<'inputText'>
  getText: () => string
  onExport: (text: string) => void
  onReplace: (activities: Activity[]) => void
}) => {
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const ids = useId()
  const textId = `${ids}-text`
  const hintId = `${ids}-hint`
  const errorsId = `${ids}-errors`

  const applyText = () => {
    const text = getText()
    setStatus('')
    if (!text.trim()) {
      setErrors(['The text box is empty, so nothing was replaced.'])
      return
    }
    const parsed = parseActivityLines(text, true)
    if (parsed.errors.length) {
      setErrors([
        ...parsed.errors,
        'Nothing was replaced; your current activities are unchanged.',
      ])
      return
    }
    onReplace(parsed.activities)
    setErrors([])
    setStatus(
      `Replaced rows with ${parsed.activities.length} ${
        parsed.activities.length === 1 ? 'line' : 'lines'
      }.`,
    )
  }

  const fillText = () => {
    onExport(activitiesToText(activities))
    setErrors([])
    setStatus(
      activities.length
        ? `Exported ${activities.length} ${
            activities.length === 1 ? 'row' : 'rows'
          }.`
        : 'No rows to export.',
    )
  }

  return (
    <div className="hours-section hours-stack">
      <div className="hours-line">
        <label htmlFor={textId} className="field-label">
          Lines
        </label>
        <span id={hintId} className="field-hint">
          one per line, <span className="mono">{LINE_FORMAT}</span>; Apply text
          replaces all rows
        </span>
      </div>
      <textarea
        id={textId}
        className="textarea textarea-bordered mono hours-text"
        rows={5}
        placeholder={'09:15-10:45 Write report\n11:00-11:30 Team sync'}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length ? `${hintId} ${errorsId}` : hintId}
        {...textField}
      />
      <div className="hours-line">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={applyText}
        >
          Apply text
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={fillText}
        >
          Export rows
        </button>
        <span className="status-message" role="status">
          {status}
        </span>
      </div>
      <div id={errorsId} className="hours-live" role="alert">
        {errors.length > 0 && (
          <ul className="error-message hours-error-list">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
