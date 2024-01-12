import { useState } from 'react'

type UseSet<T> = [
  Set<T>,
  {
    set: (set: Set<T>) => void
    add: (element: T) => void
    remove: (element: T) => void
    has: (element: T) => boolean
    clear: () => void
  },
]

function useSet<T>(initialSet: Set<T> = new Set()): UseSet<T> {
  const [set, setSet] = useState<Set<T>>(initialSet)

  function add(element: T) {
    setSet((prevSet) => new Set(prevSet).add(element))
  }

  function remove(element: T) {
    setSet((prevSet) => {
      const newSet = new Set(prevSet)
      newSet.delete(element)
      return newSet
    })
  }

  function has(element: T) {
    return set.has(element)
  }

  function clear() {
    setSet(new Set())
  }

  return [set, { set: setSet, add, remove, clear, has }]
}

export default useSet
