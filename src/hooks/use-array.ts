import { useState } from 'react'

type UseArray<T> = [
  T[],
  {
    set: (array: T[]) => void
    push: (element: T) => void
    remove: (index: number) => void
    update: (index: number, newElement: T) => void
    clear: () => void
  },
]

function useArray<T>(initialArray: T[]): UseArray<T> {
  const [array, setArray] = useState<T[]>(initialArray)

  function push(element: T) {
    setArray((a) => [...a, element])
  }

  function remove(index: number) {
    setArray((a) => a.filter((_, i) => i !== index))
  }

  function update(index: number, newElement: T) {
    setArray((a) => a.map((item, i) => (i === index ? newElement : item)))
  }

  function clear() {
    setArray([])
  }

  return [array, { set: setArray, push, remove, update, clear }]
}

export default useArray
