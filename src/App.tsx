import { useEffect, useState } from 'react'
import DatePicker from 'react-datepicker'
import dayjs from 'dayjs'

import './App.css'
import 'react-datepicker/dist/react-datepicker.css'

function App() {
  const [startDate, setStartDate] = useState<Date | null>(new Date())
  const [endDate, setEndDate] = useState<Date | null>(new Date())
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
