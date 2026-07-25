import * as React from "react"
import { addMonths, format, subMonths } from "date-fns"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type DatePickerProps = {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  className?: string
}

export function DatePicker({
  date,
  setDate,
  className,
}: DatePickerProps) {
  const [month, setMonth] = React.useState<Date>(date ?? new Date())

  React.useEffect(() => {
    if (date) {
      setMonth(date)
    }
  }, [date])

  const goToPreviousMonth = () => {
    setMonth((currentMonth) => subMonths(currentMonth, 1))
  }

  const goToNextMonth = () => {
    setMonth((currentMonth) => addMonths(currentMonth, 1))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />

          {date ? (
            format(date, "PPP")
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[calc(100vw-2rem)] max-w-sm p-0"
      >
        {/* Naša navigacija */}
        <div className="flex h-12 items-center justify-between border-b px-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={goToPreviousMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="pointer-events-none h-5 w-5" />
          </Button>

          <div className="pointer-events-none text-sm font-semibold">
            {format(month, "MMMM yyyy")}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={goToNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="pointer-events-none h-5 w-5" />
          </Button>
        </div>

        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          month={month}
          onMonthChange={setMonth}
          hideNavigation
          classNames={{
            month_caption: "hidden",
          }}
          className="p-2 sm:p-3"
        />
      </PopoverContent>
    </Popover>
  )
}