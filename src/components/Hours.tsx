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
  hours: {
    name: string
    from: string
    to: string
  }[]
}

const Total = ({ control }: { control: Control<FormValues> }) => {
  const formValues = useWatch({
    name: 'hours',
    control,
  })
  const summary = formValues.reduce<string[]>((acc, current) => {
    return [...acc, `${current.from}-${current.to} ${current.name}`]
  }, [])

  const totalMins = formValues.reduce((acc, current) => {
    return acc + calculateTimeDifference(current.from, current.to).mins
  }, 0)

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
        value={summary.join('\n')}
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
  } = useForm<FormValues>({
    defaultValues: {
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
  console.log(chart)

  return (
    <>
      {chart.map((v) => (
        <div className="flex border-solid border border-slate-200">
          {v.map((half, idx) => {
            if (idx === 0)
              return <div className="overflow-auto w-60 h-6">{half}</div>
            if (half === 'AM')
              return (
                <div className="w-4 bg-blue-400 border border-dashed"></div>
              )
            if (half === 'PM')
              return (
                <div className="w-4 bg-orange-400 border border-dashed"></div>
              )
            return <div className="w-4"></div>
          })}
        </div>
      ))}
    </>
  )
}
