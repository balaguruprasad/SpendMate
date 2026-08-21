"use client";

/**
 * Branded single-date picker: a button trigger showing the formatted date, a
 * Popover, and the shadcn Calendar. Value in/out is an ISO `yyyy-MM-dd` string
 * (the shape the invoice/payment forms already store) — so it's a drop-in
 * replacement for `<input type="date">`. Parsing/formatting is done in local
 * time via date-fns so the day never shifts across timezones.
 */
import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** ISO `yyyy-MM-dd` (or empty for unset). */
  value?: string | null;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Block future dates (e.g. invoice/payment dates can't be in the future). */
  disableFuture?: boolean;
  className?: string;
}

function parseValue(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Select a date",
  disabled,
  invalid,
  disableFuture,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid}
          className={cn(
            "w-full justify-start gap-2 px-3 font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
          {selected ? format(selected, "dd MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          autoFocus
          disabled={disableFuture ? { after: new Date() } : undefined}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, "yyyy-MM-dd"));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
