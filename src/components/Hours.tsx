import dayjs from 'dayjs'
import { useEffect } from 'react'
import { useForm, useFieldArray, useWatch, Control } from 'react-hook-form'

export const Hours = () => {
  return (
    <div>
      <h1>Hours</h1>
      <App></App>
    </div>
  )
}

type FormValues = {
  date: string
  tz: string
  hours: {
    name: string
    from: string
    to: string
  }[]
}

const Total = ({ control }: { control: Control<FormValues> }) => {
  const hours = useWatch({
    control,
    name: 'hours',
  })

  const tz = useWatch({
    control,
    name: 'tz',
  })

  const date = useWatch({
    control,
    name: 'date',
  })

  const summary = hours.reduce<string[]>((acc, current) => {
    return [...acc, `- ${current.from}-${current.to} ${current.name}`]
  }, [])

  const totalMins = hours.reduce((acc, current) => {
    return acc + calculateTimeDifference(current.from, current.to).mins
  }, 0)

  const header = [`# ${date} (${tz})`, `## Today's Tasks`]

  const footer = [`## Todo Next`, `## Today's Thoughts`]

  return (
    <>
      <div className="flex gap-2 items-center">
        <div>total:</div>
        <input
          readOnly
          className="input input-sm input-bordered"
          value={totalMins}
        ></input>
        <input
          readOnly
          className="input input-sm input-bordered"
          value={totalMins / 60}
        ></input>
      </div>
      <textarea
        readOnly
        className="textarea textarea-bordered min-h-40"
        value={[...header, ...summary, ...footer].join('\n')}
      ></textarea>
    </>
  )
}

function isValidTime(time: string): boolean {
  // Regular expression to check if the string is in HH:MM format
  const timeFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeFormat.test(time)
}

function calculateTimeDifference(time1: string, time2: string) {
  if (!isValidTime(time1) || !isValidTime(time2)) {
    // Return 0 if either time is invalid
    console.log('invalid input', { time1, time2 })
    return { mins: 0 }
  }

  const [hours1, minutes1] = time1.split(':').map(Number)
  const [hours2, minutes2] = time2.split(':').map(Number)

  // Convert both times to minutes
  const totalMinutes1 = hours1 * 60 + minutes1
  const totalMinutes2 = hours2 * 60 + minutes2

  // Calculate the absolute difference in minutes
  const totalMins = Math.abs(totalMinutes1 - totalMinutes2)

  return { mins: totalMins }
}

export default function App() {
  const {
    register,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      date: dayjs().format('YYYY-MM-DD'),
      tz: 'GMT+8',
      hours: [{ name: 'test', from: '00:00', to: '00:00' }],
    },
    mode: 'onBlur',
  })

  const { fields, append, remove } = useFieldArray({
    name: 'hours',
    control,
  })

  const hourWatcher = watch('hours')

  return (
    <div>
      <form className="flex flex-col justify-center gap-1">
        <div>
          <input
            placeholder="date"
            type="date"
            {...register(`date` as const, {
              required: true,
            })}
            className={errors?.date ? 'error' : 'input input-sm input-bordered'}
          />
          <input
            placeholder="tz"
            {...register(`tz` as const, {
              required: true,
            })}
            className={errors?.tz ? 'error' : 'input input-sm input-bordered'}
          />
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => {
              setValue('tz', 'JST', { shouldValidate: true })
            }}
          >
            JST
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => {
              setValue('tz', 'GMT+8', { shouldValidate: true })
            }}
          >
            GMT+8
          </button>
        </div>

        {fields.map((field, index) => {
          return (
            <div key={field.id}>
              <section
                className={'section flex gap-2 items-center'}
                key={field.id}
              >
                <input
                  placeholder="desc"
                  {...register(`hours.${index}.name` as const, {
                    required: true,
                  })}
                  className={
                    errors?.hours?.[index]?.name
                      ? 'error'
                      : 'input input-sm input-bordered'
                  }
                />

                <input
                  placeholder="from"
                  type="time"
                  {...register(`hours.${index}.from` as const, {
                    required: true,
                  })}
                  className={
                    errors?.hours?.[index]?.from
                      ? 'error'
                      : 'input input-sm input-bordered'
                  }
                />
                <input
                  placeholder="to"
                  type="time"
                  {...register(`hours.${index}.to` as const, {
                    required: true,
                  })}
                  className={
                    errors?.hours?.[index]?.to
                      ? 'error'
                      : 'input input-sm input-bordered'
                  }
                />

                {
                  calculateTimeDifference(
                    hourWatcher[index].from,
                    hourWatcher[index].to,
                  ).mins
                }

                <button type="button" onClick={() => remove(index)}>
                  DELETE
                </button>
              </section>
            </div>
          )
        })}

        <div>
          <button
            className="btn btn-sm"
            type="button"
            onClick={() =>
              append({
                name: '',
                from: '00:00',
                to: '00:00',
              })
            }
          >
            APPEND
          </button>
        </div>
        <Total control={control} />
        <Gantt control={control} />
        <SerializeForm
          setHours={(hours) => {
            setValue('hours', hours)
          }}
        />
      </form>
    </div>
  )
}

type TimeBlock = {
  name: string
  from: string
  to: string
}

type GanttChartOutput = (string | number)[][]

function timeToBlockIndex(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 2 + (minutes >= 30 ? 1 : 0)
}

function generateGanttChart(hours: TimeBlock[]): GanttChartOutput {
  return hours.map((hour) => {
    const fromIndex = timeToBlockIndex(hour.from)
    const toIndex = timeToBlockIndex(hour.to)

    // Initialize row with '0's and the task name
    const row: (string | number)[] = new Array(48).fill(0)
    row[0] = hour.name

    // Fill with 'AM' or 'PM' based on the time block
    for (let i = fromIndex; i < toIndex; i++) {
      row[i] = i < 24 ? 'AM' : 'PM' // Assuming 'AM' for blocks before 12:00 and 'PM' for those after
    }

    return row
  })
}

const Gantt = ({ control }: { control: Control<FormValues> }) => {
  const formValues = useWatch({
    name: 'hours',
    control,
  })

  const chart = generateGanttChart(formValues)

  return (
    <>
      {chart.map((v, idx) => (
        <div key={idx} className="flex border-solid border border-slate-200">
          {v.map((half, idxH) => {
            if (idxH === 0)
              return (
                <div key={idxH} className="overflow-auto w-60 h-6">
                  {half}
                </div>
              )
            if (half === 'AM')
              return (
                <div
                  key={idxH}
                  className="w-4 bg-blue-400 border border-dashed"
                ></div>
              )
            if (half === 'PM')
              return (
                <div
                  key={idxH}
                  className="w-4 bg-orange-400 border border-dashed"
                ></div>
              )
            return <div key={idxH} className="w-4"></div>
          })}
        </div>
      ))}
    </>
  )
}

const SerializeForm = ({
  setHours,
}: {
  setHours: (hours: { to: string; name: string; from: string }[]) => void
}) => {
  const { register, watch } = useForm()

  const inputText = watch('inputText')

  useEffect(() => {
    if (inputText) {
      try {
        const result = serializeTextToTimeBlocks(inputText)
        setHours(result)
        console.log(result)
      } catch (error) {
        console.error((error as Error).message)
      }
    }
  }, [inputText]) // Re-run the effect when `inputText` changes

  return (
    <textarea
      className="textarea textarea-bordered min-h-40"
      {...register('inputText')}
      placeholder="Enter times and names"
    />
  )
}

function serializeTextToTimeBlocks(input: string): TimeBlock[] {
  const timeBlockRegex = /^(\d{2}:\d{2})-(\d{2}:\d{2})\s+(.*)$/
  return input
    .split('\n') // Split the input into lines
    .filter((line) => line.trim() !== '') // Filter out empty lines
    .map((line) => {
      const match = line.match(timeBlockRegex)
      if (!match) throw new Error(`Invalid line format: ${line}`)
      const [, from, to, name] = match
      return { name, from, to }
    })
}
