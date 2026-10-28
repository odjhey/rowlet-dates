// Time helpers shared by the Hours screen, so the durations it shows can be
// checked without a browser.

export type ActivityTimes = {
  from: string
  to: string
}

export function isValidTime(time: string): boolean {
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)
}

export function toMinutes(time: string): number | null {
  if (!isValidTime(time)) return null
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Same-day absolute difference: an end earlier than the start is not treated as overnight.
export function activityMinutes(activity: ActivityTimes): number | null {
  const from = toMinutes(activity.from)
  const to = toMinutes(activity.to)
  if (from === null || to === null) return null
  return Math.abs(to - from)
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (!hours) return `${minutes} min`
  if (!minutes) return `${hours} h`
  return `${hours} h ${minutes} min`
}
