interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sun=0
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'am' : 'pm';
  const display = h <= 12 ? h : h - 12;
  return `${display}${suffix}`;
}

function buildGrid(slots: Slot[]): boolean[][] {
  const grid: boolean[][] = HOURS.map(() => DAY_NUMBERS.map(() => false));
  for (const slot of slots) {
    const colIdx = DAY_NUMBERS.indexOf(slot.dayOfWeek);
    if (colIdx === -1) continue;
    const startH = parseInt(slot.startTime.split(':')[0], 10);
    const endH = parseInt(slot.endTime.split(':')[0], 10);
    for (let h = startH; h < endH; h++) {
      const rowIdx = h - HOURS[0];
      if (rowIdx >= 0 && rowIdx < HOURS.length) {
        grid[rowIdx][colIdx] = true;
      }
    }
  }
  return grid;
}

export default function AvailabilityCalendar({ slots }: { slots: Slot[] }) {
  const grid = buildGrid(slots);
  const hasSlotsForDay = DAY_NUMBERS.map((_, colIdx) => grid.some((row) => row[colIdx]));

  if (slots.length === 0) {
    return (
      <p className="mt-3 font-jost text-[14px] font-light text-ink-3">No availability set yet.</p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr>
            <th className="w-12 px-2 py-2" />
            {DAYS.map((day, i) => (
              <th key={day} className="px-1 py-2 text-center">
                <span
                  className={`font-jost text-[12px] font-medium ${
                    hasSlotsForDay[i] ? 'text-ink' : 'text-ink-3/50'
                  }`}
                >
                  {day}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour, ri) => (
            <tr key={hour}>
              <td className="px-2 py-0 text-right align-top">
                <span className="font-jost text-[10px] font-light text-ink-3 leading-none">
                  {hourLabel(hour)}
                </span>
              </td>
              {DAY_NUMBERS.map((_, ci) => {
                const active = grid[ri][ci];
                return (
                  <td key={ci} className="px-0.5 py-0">
                    <div
                      className={`h-6 rounded-sm ${active ? 'bg-gold/20' : 'bg-cream'}`}
                      style={{
                        border: active
                          ? '1px solid rgba(47,128,237,0.25)'
                          : '1px solid rgba(14,14,12,0.04)',
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
