import { useEffect, useState } from 'react'
import dayjs from 'dayjs'

import './App.css'
import useSet from './hooks/use-set'
import { Hours } from './components/Hours'

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

function getDateArray(from: Date, to: Date) {
  const fromDate = dayjs(from)
  const toDate = dayjs(to)
  const diffDays = toDate.diff(fromDate, 'day')

  return Array.from({ length: diffDays + 1 }, (_, index) =>
    fromDate.add(index, 'day').toDate(),
  )
}

function App() {
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [diff, setDiff] = useState(0)
  const [selectedDates, selectedDateActions] = useSet(new Set<string>())

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

      <div className="flex gap-2 flex-wrap">
        {getDateArray(startDate, endDate).map((date) => {
          const badgeClass = selectedDateActions.has(date.toISOString())
            ? 'badge-accent'
            : 'badge-neutral'

          return (
            <div
              key={date.toISOString()}
              className={`badge ${badgeClass}`}
              onClick={() => {
                if (selectedDateActions.has(date.toISOString())) {
                  selectedDateActions.remove(date.toISOString())
                } else {
                  selectedDateActions.add(date.toISOString())
                }
              }}
            >
              {dayjs(date).format('YY-MM-DD ddd')}
            </div>
          )
        })}
      </div>

      <div className="divider"></div>
      {JSON.stringify(selectedDates.size)}
      <div className="flex flex-wrap gap-2">
        {[...selectedDates.values()].map((date) => {
          return (
            <div
              key={date}
              className={`badge badge-neutral`}
              onClick={() => {
                if (selectedDateActions.has(date)) {
                  selectedDateActions.remove(date)
                } else {
                  selectedDateActions.add(date)
                }
              }}
            >
              {dayjs(date).format('YY-MM-DD ddd')}
            </div>
          )
        })}
      </div>
      <div className="divider"></div>
      <Hours></Hours>
    </>
  )
}

export default App
