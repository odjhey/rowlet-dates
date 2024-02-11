import { useCallback, useState } from 'react'
import entryStore from '../libs/storage'

type Entry = {
  id: string
  date: string
  tz: string
  hours: string
}

type EntryInput = {
  date: string
  tz: string
  hours: string
}

export const useEntryStorage = () => {
  const [entries, setEntries] = useState<Entry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const listEntries = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await entryStore.listEntries()
      setEntries(result) // Update local copy
      return result
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getEntry = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      return await entryStore.getEntry(id)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const newEntry = useCallback(
    async (entry: EntryInput) => {
      setIsLoading(true)
      try {
        await entryStore.newEntry(entry)
        await listEntries() // Refresh the local list after adding a new entry
      } finally {
        setIsLoading(false)
      }
    },
    [listEntries],
  )

  const updateEntry = useCallback(
    async (id: string, entryUpdate: EntryInput) => {
      setIsLoading(true)
      try {
        await entryStore.updateEntry(id, entryUpdate)
        await listEntries() // Refresh the local list after an update
      } finally {
        setIsLoading(false)
      }
    },
    [listEntries],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      setIsLoading(true)
      try {
        await entryStore.deleteEntry(id)
        await listEntries() // Refresh the local list after deletion
      } finally {
        setIsLoading(false)
      }
    },
    [listEntries],
  )

  // Adjust the hook to return the entries array directly alongside the other properties in an object
  return [
    entries,
    { isLoading, listEntries, getEntry, newEntry, updateEntry, deleteEntry },
  ] as const
}
