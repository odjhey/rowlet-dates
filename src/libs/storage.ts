import localforage from 'localforage'

const version = '0.0.0'
const getVersionedKey = (key: string) => {
  return `${key}-${version}`
}

type Entry = {
  id: string
  date: string
  tz: string
  hours: string
}

const ENTRIES_KEY = getVersionedKey('saves')

const generateId = (): string => Date.now().toString() // For uniqueness, consider using UUIDs

const fetchEntries = async (): Promise<Entry[]> =>
  localforage.getItem<Entry[]>(ENTRIES_KEY).then((entries) => entries || [])

const saveEntries = (entries: Entry[]): Promise<Entry[]> =>
  localforage.setItem(ENTRIES_KEY, entries)

const listEntries = async (): Promise<Entry[]> => fetchEntries()

const getEntry = async (id: string): Promise<Entry | null> =>
  fetchEntries().then(
    (entries) => entries.find((entry) => entry.id === id) || null,
  )

const newEntry = async (entry: Omit<Entry, 'id'>): Promise<string> => {
  const id = generateId()
  const newEntry = { ...entry, id }
  const entries = await fetchEntries()
  await saveEntries([...entries, newEntry])
  return id
}

const updateEntry = async (
  id: string,
  entryUpdate: Partial<Entry>,
): Promise<void> => {
  const entries = await fetchEntries()
  const updatedEntries = entries.map((entry) =>
    entry.id === id ? { ...entry, ...entryUpdate } : entry,
  )
  await saveEntries(updatedEntries)
}

const deleteEntry = async (id: string): Promise<void> => {
  const entries = await fetchEntries()
  const filteredEntries = entries.filter((entry) => entry.id !== id)
  await saveEntries(filteredEntries)
}

const entryStore = {
  listEntries,
  getEntry,
  newEntry,
  updateEntry,
  deleteEntry,
}

export default entryStore
