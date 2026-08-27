import { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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

const PRESETS: { label: string; range: () => DateRangeValue }[] = [
  { label: 'Today', range: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Last 7 days', range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Last 30 days', range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  {
    label: 'This month',
    range: () => ({ from: startOfMonth(new Date()), to: new Date() })
  },
  {
    label: 'Last month',
    range: () => {
      const prev = subMonths(new Date(), 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
  }
];

function label(value: DateRangeValue): string {
  if (!value.from) return 'All time';
  if (!value.to) return format(value.from, 'dd MMM yyyy');
  return format(value.from, 'dd MMM yyyy') + ' – ' + format(value.to, 'dd MMM yyyy');
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(value.from);

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
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={value.from}
              selected={value as DayPickerRange}
              onSelect={(range) => onChange({ from: range?.from, to: range?.to })}
            />
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
