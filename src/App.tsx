import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

import './App.css'

const DatePicker = (props: {
  selected: Date
  onChange: (date: Date) => void
}) => {
  return (
    <input
      type="date"
      value={props.selected.toISOString().slice(0, 10)}
      onChange={(e) => props.onChange(new Date(e.target.value))}
    />
  )
}

function App() {
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [diff, setDiff] = useState(0)

  // we lazy for now, so we use useEffect
  useEffect(() => {
    if (startDate && endDate) {
      setDiff(dayjs(endDate).diff(dayjs(startDate), 'day'))
    }
  }, [startDate, endDate])

  return (
    <>
      <div className="container mx-auto">
        <div className="flex gap-2">
          <DatePicker
            selected={startDate}
            onChange={(date) => setStartDate(date)}
          />
          -
          <DatePicker
            selected={endDate}
            onChange={(date) => setEndDate(date)}
          />
        </div>
        <div>diff: {diff}</div>
      </div>
    </>
  )
}

export default App
