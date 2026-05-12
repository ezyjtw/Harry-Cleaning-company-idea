'use client';

import { useState } from 'react';

interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sun=0

const HALF_HOURS: string[] = [];
for (let h = 7; h <= 21; h++) {
  HALF_HOURS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 21) HALF_HOURS.push(`${h.toString().padStart(2, '0')}:30`);
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr;
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h === 0 ? 12 : h <= 12 ? h : h - 12;
  return m === '00' ? `${display}${suffix}` : `${display}:${m}${suffix}`;
}

function timeToIndex(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h - 7) * 2 + (m >= 30 ? 1 : 0);
}

function buildWeekGrid(slots: Slot[], weekStart: Date, blockedDates: string[]): boolean[][] {
  const grid: boolean[][] = HALF_HOURS.map(() => DAY_NUMBERS.map(() => false));
  const blockedSet = new Set(blockedDates);

  for (let col = 0; col < 7; col++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + col);
    const dateStr = date.toISOString().split('T')[0];
    if (blockedSet.has(dateStr)) continue;

    const dow = DAY_NUMBERS[col];
    const daySlots = slots.filter((s) => s.dayOfWeek === dow);
    for (const slot of daySlots) {
      const startIdx = timeToIndex(slot.startTime);
      const endIdx = timeToIndex(slot.endTime);
      for (let r = startIdx; r < endIdx && r < HALF_HOURS.length; r++) {
        if (r >= 0) grid[r][col] = true;
      }
    }
  }
  return grid;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface Props {
  slots: Slot[];
  blockedDates?: string[];
}

export default function AvailabilityCalendar({ slots, blockedDates = [] }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const thisMonday = getMonday(today);
  const weekStart = new Date(thisMonday);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const grid = buildWeekGrid(slots, weekStart, blockedDates);
  const hasAny = grid.some((row) => row.some((v) => v));

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  if (slots.length === 0) {
    return (
      <p className="mt-3 font-jost text-[14px] font-light text-ink-3">No availability set yet.</p>
    );
  }

  return (
    <div className="mt-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekOffset((w) => Math.max(w - 1, 0))}
          disabled={weekOffset === 0}
          className="p-1.5 rounded-lg hover:bg-cream transition disabled:opacity-30"
        >
          <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="font-jost text-[13px] font-light text-ink">
          {formatDateShort(weekStart)} – {formatDateShort(weekEnd)}
        </span>
        <button
          onClick={() => setWeekOffset((w) => Math.min(w + 1, 8))}
          disabled={weekOffset >= 8}
          className="p-1.5 rounded-lg hover:bg-cream transition disabled:opacity-30"
        >
          <svg className="w-4 h-4 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr>
              <th className="w-12 px-2 py-2" />
              {weekDates.map((d, i) => (
                <th key={i} className="px-0.5 py-2 text-center">
                  <span className="font-jost text-[11px] font-medium text-ink-3">
                    {DAY_LABELS[i]}
                  </span>
                  <br />
                  <span
                    className={`font-jost text-[11px] font-light ${
                      isToday(d) ? 'text-gold font-medium' : 'text-ink-3'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HALF_HOURS.map((time, ri) => {
              const isHour = time.endsWith(':00');
              return (
                <tr key={time}>
                  <td className="px-2 py-0 text-right align-top">
                    {isHour && (
                      <span className="font-jost text-[10px] font-light text-ink-3 leading-none">
                        {formatTime(time)}
                      </span>
                    )}
                  </td>
                  {DAY_NUMBERS.map((_, ci) => {
                    const active = grid[ri][ci];
                    return (
                      <td key={ci} className="px-0.5 py-0">
                        <div
                          className={`h-4 ${isHour ? 'rounded-t-sm' : 'rounded-b-sm'} ${
                            active ? 'bg-gold/20' : 'bg-cream'
                          }`}
                          style={{
                            border: active
                              ? '1px solid rgba(47,128,237,0.25)'
                              : '1px solid rgba(14,14,12,0.04)',
                            borderTop: isHour || active ? undefined : 'none',
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!hasAny && weekOffset > 0 && (
        <p className="mt-3 text-center font-jost text-[13px] font-light text-ink-3">
          No availability this week
        </p>
      )}
    </div>
  );
}
