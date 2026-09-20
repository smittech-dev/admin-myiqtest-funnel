import { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  isValid
} from 'date-fns';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

/**
 * The times a range falls back to when only days are picked.
 *
 * A range is now an instant rather than a day, so a picked day has to become
 * the whole of that day or a filter for "today" would return only the midnight
 * that has already passed.
 */
const DAY_START = '00:00';
const DAY_END = '23:59';

const PRESETS: { label: string; range: () => DateRangeValue }[] = [
  { label: 'Today', range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  {
    label: 'Yesterday',
    range: () => {
      const day = subDays(new Date(), 1);
      return { from: startOfDay(day), to: endOfDay(day) };
    }
  },
  {
    label: 'Last 7 days',
    range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) })
  },
  {
    label: 'Last 30 days',
    range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) })
  },
  {
    label: 'This month',
    range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) })
  },
  {
    label: 'Last month',
    range: () => {
      const prev = subMonths(new Date(), 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
  }
];

/** `HH:mm` for a date, or the given fallback when there is no date yet. */
function timeOf(date: Date | undefined, fallback: string): string {
  return date && isValid(date) ? format(date, 'HH:mm') : fallback;
}

/** Puts an `HH:mm` onto a date, leaving the day alone. Invalid input is ignored. */
function withTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return date;

  const next = new Date(date);
  next.setHours(Math.min(23, Math.max(0, hours)), Math.min(59, Math.max(0, minutes)), 0, 0);
  return next;
}

/** True when the range covers whole days, so the label can leave the times off. */
function isWholeDays(value: DateRangeValue): boolean {
  const startsAtMidnight =
    !value.from || (value.from.getHours() === 0 && value.from.getMinutes() === 0);
  const endsAtDayEnd =
    !value.to || (value.to.getHours() === 23 && value.to.getMinutes() === 59);
  return startsAtMidnight && endsAtDayEnd;
}

function label(value: DateRangeValue): string {
  if (!value.from) return 'All time';

  // Times are only worth the width when they are not the whole-day default.
  const pattern = isWholeDays(value) ? 'dd MMM yyyy' : 'dd MMM yyyy HH:mm';

  if (!value.to) return format(value.from, pattern);
  return `${format(value.from, pattern)} – ${format(value.to, pattern)}`;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(value.from);

  const fromTime = timeOf(value.from, DAY_START);
  const toTime = timeOf(value.to, DAY_END);

  /**
   * Picking days keeps whatever times are already set.
   *
   * Otherwise choosing a day after setting a time would silently discard it,
   * which is the sort of thing an operator only notices in the results.
   */
  function handleSelect(range: DayPickerRange | undefined) {
    onChange({
      from: range?.from ? withTime(range.from, fromTime) : undefined,
      to: range?.to ? withTime(range.to, toTime) : undefined
    });
  }

  function handleTime(field: 'from' | 'to', time: string) {
    const target = value[field];
    // Nothing to attach a time to yet — the day has to come first.
    if (!target) return;
    onChange({ ...value, [field]: withTime(target, time) });
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('justify-start font-normal', !hasValue && 'text-muted-foreground')}
          >
            <CalendarIcon className="size-4" />
            {label(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-row gap-1 p-2 sm:w-40 sm:flex-col sm:border-r">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal"
                  onClick={() => {
                    onChange(preset.range());
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <Separator className="my-1 hidden sm:block" />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground justify-start font-normal"
                onClick={() => {
                  onChange({});
                  setOpen(false);
                }}
              >
                All time
              </Button>
            </div>

            <div>
              <Calendar
                mode="range"
                numberOfMonths={2}
                defaultMonth={value.from}
                selected={value as DayPickerRange}
                onSelect={handleSelect}
              />

              <Separator />

              <div className="flex items-end gap-3 p-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="range-from-time" className="text-muted-foreground text-xs">
                    From time
                  </Label>
                  <Input
                    id="range-from-time"
                    type="time"
                    className="w-[7.5rem]"
                    value={fromTime}
                    disabled={!value.from}
                    onChange={(e) => handleTime('from', e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="range-to-time" className="text-muted-foreground text-xs">
                    To time
                  </Label>
                  <Input
                    id="range-to-time"
                    type="time"
                    className="w-[7.5rem]"
                    value={toTime}
                    disabled={!value.to}
                    onChange={(e) => handleTime('to', e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  disabled={!value.from || isWholeDays(value)}
                  onClick={() =>
                    onChange({
                      from: value.from ? startOfDay(value.from) : undefined,
                      to: value.to ? endOfDay(value.to) : undefined
                    })
                  }
                >
                  Whole days
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasValue && (
        <Button variant="ghost" size="icon" onClick={() => onChange({})} title="Clear date filter">
          <X className="size-4" />
          <span className="sr-only">Clear date filter</span>
        </Button>
      )}
    </div>
  );
}
