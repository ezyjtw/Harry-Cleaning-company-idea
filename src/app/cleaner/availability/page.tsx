'use client';

import { useState, useCallback } from 'react';

interface TimeSlot {
  start: string;
  end: string;
}

interface BlockedDate {
  date: string;
  reason: string;
}

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

const daysOfWeek: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const dayAbbrevs: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const defaultSlots: Record<DayOfWeek, TimeSlot[]> = {
  Monday: [{ start: '08:00', end: '17:00' }],
  Tuesday: [{ start: '08:00', end: '17:00' }],
  Wednesday: [{ start: '08:00', end: '13:00' }],
  Thursday: [{ start: '08:00', end: '17:00' }],
  Friday: [{ start: '08:00', end: '17:00' }],
  Saturday: [{ start: '09:00', end: '14:00' }],
  Sunday: [],
};

const timeOptions: string[] = [];
for (let h = 6; h <= 22; h++) {
  timeOptions.push(`${h.toString().padStart(2, '0')}:00`);
  timeOptions.push(`${h.toString().padStart(2, '0')}:30`);
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<Record<DayOfWeek, TimeSlot[]>>(defaultSlots);
  const [sameDayBookings, setSameDayBookings] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Blocked dates
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([
    { date: '2026-03-25', reason: 'Holiday' },
  ]);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  // AI Chat
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ action: string; description: string } | null>(null);

  const addSlot = (day: DayOfWeek) => {
    setSlots((prev) => ({
      ...prev,
      [day]: [...prev[day], { start: '09:00', end: '17:00' }],
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

  const updateSlot = (day: DayOfWeek, index: number, field: 'start' | 'end', value: string) => {
    setSlots((prev) => ({
      ...prev,
      [day]: prev[day].map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
    }));
    setSaved(false);
  };

  const addBlockedDate = () => {
    if (!newBlockDate) return;
    if (blockedDates.some((b) => b.date === newBlockDate)) return;
    setBlockedDates((prev) => [
      ...prev,
      { date: newBlockDate, reason: newBlockReason || 'Unavailable' },
    ]);
    setNewBlockDate('');
    setNewBlockReason('');
    setSaved(false);
  };

  const removeBlockedDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((b) => b.date !== date));
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/cleaner/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, blockedDates, sameDayBookings }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silently fail for now
    } finally {
      setSaving(false);
    }
  }, [slots, blockedDates, sameDayBookings]);

  const handleAiSend = async () => {
    if (!aiInput.trim() || aiLoading) return;

    const userMsg = aiInput.trim();
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setAiLoading(true);
    setAiPreview(null);

    // Process the AI request locally for common patterns
    const lower = userMsg.toLowerCase();
    let response = '';
    let preview: { action: string; description: string } | null = null;

    if (lower.includes('not available') || lower.includes('block') || lower.includes('off')) {
      const dayMatch = daysOfWeek.find((d) => lower.includes(d.toLowerCase()));
      if (dayMatch) {
        preview = { action: 'remove', description: `Remove all slots for ${dayMatch}` };
        response = `I can clear your ${dayMatch} schedule. Click "Apply" to confirm.`;
      } else if (lower.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        preview = { action: 'block_date', description: `Block ${dateStr}` };
        response = `I'll block tomorrow (${dateStr}). Click "Apply" to confirm.`;
      } else {
        response =
          'Which day would you like me to block? You can say something like "Block next Tuesday" or "I\'m not available on Fridays".';
      }
    } else if (lower.includes('available') || lower.includes('add') || lower.includes('open')) {
      const dayMatch = daysOfWeek.find((d) => lower.includes(d.toLowerCase()));
      if (dayMatch) {
        // Extract time if mentioned
        const timeMatch = lower.match(/(\d{1,2})\s*(?:am|pm|:00|:30)?/);
        if (timeMatch) {
          preview = { action: 'add_slot', description: `Add availability for ${dayMatch}` };
          response = `I can add a time slot for ${dayMatch}. Click "Apply" to confirm.`;
        } else {
          preview = {
            action: 'add_slot',
            description: `Add default slot (09:00-17:00) for ${dayMatch}`,
          };
          response = `I'll add a 9am-5pm slot for ${dayMatch}. Click "Apply" to confirm.`;
        }
      } else {
        response =
          'Which day would you like to open up? Try "Make me available on Sundays" or "Add Saturday mornings".';
      }
    } else if (lower.includes('clear') || lower.includes('reset')) {
      response =
        'Would you like to clear your entire schedule? Please specify which day or say "clear all" to reset everything.';
    } else {
      response =
        'I can help manage your availability! Try:\n- "I\'m not available next Tuesday"\n- "Block this Saturday"\n- "Open up Sunday mornings"\n- "Clear my Wednesday schedule"';
    }

    setAiMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    if (preview) setAiPreview(preview);
    setAiLoading(false);
  };

  const applyAiChange = () => {
    if (!aiPreview) return;

    if (aiPreview.action === 'remove') {
      const dayMatch = daysOfWeek.find((d) => aiPreview.description.includes(d));
      if (dayMatch) {
        setSlots((prev) => ({ ...prev, [dayMatch]: [] }));
      }
    } else if (aiPreview.action === 'block_date') {
      const dateMatch = aiPreview.description.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        setBlockedDates((prev) => [...prev, { date: dateMatch[0], reason: 'Blocked via AI' }]);
      }
    } else if (aiPreview.action === 'add_slot') {
      const dayMatch = daysOfWeek.find((d) => aiPreview.description.includes(d));
      if (dayMatch) {
        setSlots((prev) => ({
          ...prev,
          [dayMatch]: [...prev[dayMatch], { start: '09:00', end: '17:00' }],
        }));
      }
    }

    setAiPreview(null);
    setAiMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'Done! Changes applied. Remember to save.' },
    ]);
    setSaved(false);
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
            <p className="text-sm text-gray-500 mt-0.5">
              Allow customers to book you for today at a premium rate
            </p>
          </div>
          <button
            onClick={() => {
              setSameDayBookings(!sameDayBookings);
              setSaved(false);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sameDayBookings ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                sameDayBookings ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* AI Availability Manager */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <button
          onClick={() => setAiOpen(!aiOpen)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Manage with AI</p>
              <p className="text-xs text-gray-500">
                Say &quot;I&apos;m not available next Tuesday&quot; and let AI update your schedule
              </p>
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${aiOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {aiOpen && (
          <div className="border-t border-gray-200 px-6 py-4">
            {/* Messages */}
            <div className="max-h-60 overflow-y-auto space-y-3 mb-4">
              {aiMessages.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  Try: &quot;I&apos;m not available next Tuesday&quot; or &quot;Open up Sunday
                  mornings&quot;
                </p>
              )}
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[80%] text-sm whitespace-pre-wrap ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-500">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* AI Preview */}
            {aiPreview && (
              <div className="mb-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-800">Proposed change</p>
                    <p className="text-xs text-purple-600">{aiPreview.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={applyAiChange}
                      className="px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setAiPreview(null)}
                      className="px-3 py-1 bg-white border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSend()}
                placeholder='e.g. "Block next Friday"'
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                onClick={handleAiSend}
                disabled={aiLoading}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
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
                          onChange={(e) => updateSlot(day, index, 'start', e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-400">to</span>
                        <select
                          value={slot.end}
                          onChange={(e) => updateSlot(day, index, 'end', e.target.value)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeSlot(day, index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove slot"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add time slot
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked dates */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Blocked Dates</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Block specific dates when you&apos;re unavailable (holidays, personal days)
          </p>
        </div>
        <div className="px-6 py-4">
          {/* Existing blocked dates */}
          {blockedDates.length > 0 && (
            <div className="space-y-2 mb-4">
              {blockedDates
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((bd) => (
                  <div
                    key={bd.date}
                    className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className="w-4 h-4 text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{bd.date}</span>
                      <span className="text-sm text-gray-500">— {bd.reason}</span>
                    </div>
                    <button
                      onClick={() => removeBlockedDate(bd.date)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Add blocked date */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={newBlockDate}
                onChange={(e) => setNewBlockDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="e.g. Holiday"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={addBlockedDate}
              disabled={!newBlockDate}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Block Date
            </button>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Changes saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
