export const HOURS_DRAFT_KEY = 'hours-draft-0.0.0'
export const DIFF_DRAFT_KEY = 'diff-draft-0.0.0'

export function readDraft<T>(
  key: string,
  fallback: () => T,
  validate: (value: unknown) => value is T,
): { value: T; error: string | null } {
  try {
    const text = window.localStorage.getItem(key)
    if (text === null) return { value: fallback(), error: null }
    const value: unknown = JSON.parse(text)
    if (validate(value)) return { value, error: null }
  } catch {
    return {
      value: fallback(),
      error:
        "Couldn't restore the local draft. New edits will start a new draft.",
    }
  }
  return {
    value: fallback(),
    error:
      "Couldn't read the saved draft format. New edits will start a new draft.",
  }
}

// Commit the small draft before returning to the input event, not after a debounce.
export function writeDraft(key: string, value: unknown): string | null {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return null
  } catch {
    return "Couldn't save this draft locally. Keep this page open or copy your data before refreshing."
  }
}
