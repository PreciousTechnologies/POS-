import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  cn,
  formatRangeLabel,
  rangeForPreset,
  todayInTimeZone,
  type DateRange,
  type RangePreset,
} from "@/lib/utils";

const presets: Array<{ id: Exclude<RangePreset, "custom">; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "month", label: "Month" },
];

export function RangePicker({
  from,
  to,
  onChange,
  timezone = "Africa/Dar_es_Salaam",
  className,
}: {
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  timezone?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<RangePreset>("30d");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  const applyPreset = (preset: Exclude<RangePreset, "custom">) => {
    setActivePreset(preset);
    onChange(rangeForPreset(preset, timezone));
  };

  const today = todayInTimeZone(timezone);

  return (
    <div ref={ref} className={cn("range-picker", className)}>
      <div className="segmented hidden sm:inline-flex">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={cn("segmented-option", activePreset === preset.id && "is-active")}
            onClick={() => applyPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <CalendarDays size={13} />
          <span className="max-w-[210px] truncate">{formatRangeLabel({ from, to }, timezone)}</span>
          <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div
            className="surface-card absolute right-0 top-full z-30 mt-2 w-[260px] p-3 shadow-lg"
            role="dialog"
            aria-label="Custom date range"
          >
            <div className="eyebrow mb-2">Custom range</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="field">
                <span className="field-label">From</span>
                <input
                  type="date"
                  className="input"
                  value={from}
                  max={to || today}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    setActivePreset("custom");
                    onChange({ from: value, to: value > to ? value : to });
                  }}
                />
              </label>
              <label className="field">
                <span className="field-label">To</span>
                <input
                  type="date"
                  className="input"
                  value={to}
                  min={from}
                  max={today}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) return;
                    setActivePreset("custom");
                    onChange({ from: value < from ? value : from, to: value });
                  }}
                />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
