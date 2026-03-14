"use client";

import { useState } from "react";

interface TimeSlot {
  start: string;
  end: string;
}

type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

const daysOfWeek: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayAbbrevs: Record<DayOfWeek, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const defaultSlots: Record<DayOfWeek, TimeSlot[]> = {
  Monday: [{ start: "08:00", end: "17:00" }],
  Tuesday: [{ start: "08:00", end: "17:00" }],
  Wednesday: [{ start: "08:00", end: "13:00" }],
  Thursday: [{ start: "08:00", end: "17:00" }],
  Friday: [{ start: "08:00", end: "17:00" }],
  Saturday: [{ start: "09:00", end: "14:00" }],
  Sunday: [],
};

const timeOptions: string[] = [];
for (let h = 6; h <= 22; h++) {
  timeOptions.push(`${h.toString().padStart(2, "0")}:00`);
  timeOptions.push(`${h.toString().padStart(2, "0")}:30`);
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Record<DayOfWeek, TimeSlot[]>>(defaultSlots);
  const [sameDayBookings, setSameDayBookings] = useState(true);
  const [saved, setSaved] = useState(false);

  const addSlot = (day: DayOfWeek) => {
    setSlots((prev) => ({
      ...prev,
      [day]: [...prev[day], { start: "09:00", end: "17:00" }],
    }));
    setSaved(false);
  };

  const removeSlot = (day: DayOfWeek, index: number) => {
    setSlots((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }));
    setSaved(false);
  };

  const updateSlot = (day: DayOfWeek, index: number, field: "start" | "end", value: string) => {
    setSlots((prev) => ({
      ...prev,
      [day]: prev[day].map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
    }));
    setSaved(false);
  };

  const handleSave = () => {
    // TODO: Save to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
        <p className="text-gray-500 mt-1">Set your working hours for each day of the week</p>
      </div>

      {/* Same-day bookings toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Available for same-day bookings</p>
            <p className="text-sm text-gray-500 mt-0.5">Allow customers to book you for today at a premium rate</p>
          </div>
          <button
            onClick={() => { setSameDayBookings(!sameDayBookings); setSaved(false); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sameDayBookings ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                sameDayBookings ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Weekly calendar */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Weekly Schedule</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {daysOfWeek.map((day) => (
            <div key={day} className="px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="w-20 pt-2">
                  <p className="font-medium text-gray-900 hidden sm:block">{day}</p>
                  <p className="font-medium text-gray-900 sm:hidden">{dayAbbrevs[day]}</p>
                </div>
                <div className="flex-1 space-y-3">
                  {slots[day].length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Not available</p>
                  ) : (
                    slots[day].map((slot, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={slot.start}
                          onChange={(e) => updateSlot(day, index, "start", e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <span className="text-gray-400">to</span>
                        <select
                          value={slot.end}
                          onChange={(e) => updateSlot(day, index, "end", e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeSlot(day, index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove slot"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => addSlot(day)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add time slot
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Changes saved
          </span>
        )}
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
