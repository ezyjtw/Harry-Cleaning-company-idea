'use client';

import { useState } from 'react';

import {
  generateEstimate,
  ROOM_TYPES,
  EXTRA_SERVICES,
  type RoomDetail,
  type CleaningEstimate,
} from '@/lib/estimator';
import { getPriceBreakdown } from '@/lib/pricing';

interface Props {
  cleanerRate: number;
  sameDayRate: number;
  isLastMinute: boolean;
  onEstimateApply: (duration: number, serviceType: string) => void;
}

export default function CleaningEstimator({
  cleanerRate,
  sameDayRate,
  isLastMinute,
  onEstimateApply,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomDetail[]>([]);
  const [hasPets, setHasPets] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<CleaningEstimate | null>(null);

  // Room being added
  const [addingRoom, setAddingRoom] = useState({
    type: 'bedroom',
    size: 'medium' as 'small' | 'medium' | 'large',
    condition: 'moderate' as 'light' | 'moderate' | 'heavy',
  });

  const addRoom = () => {
    setRooms([...rooms, { ...addingRoom }]);
    setAddingRoom({ type: 'bedroom', size: 'medium', condition: 'moderate' });
  };

  const removeRoom = (index: number) => {
    setRooms(rooms.filter((_, i) => i !== index));
  };

  const toggleExtra = (value: string) => {
    setExtras((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  };

  const runEstimate = () => {
    if (rooms.length === 0) return;
    const result = generateEstimate({ rooms, hasPets, extras });
    setEstimate(result);
  };

  const applyEstimate = () => {
    if (!estimate) return;
    onEstimateApply(estimate.recommendedDuration, estimate.recommendedServiceType);
    setIsOpen(false);
  };

  const rate = isLastMinute ? sameDayRate : cleanerRate;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 p-4 text-center hover:border-brand-400 hover:bg-brand-100 transition"
      >
        <div className="text-lg font-semibold text-brand-700">Not sure what you need?</div>
        <p className="mt-1 text-sm text-brand-600">
          Tell us about your space and our AI will recommend the right service, duration, and price.
        </p>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">AI Cleaning Estimator</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Describe your space and we&apos;ll recommend the perfect cleaning plan.
      </p>

      {/* Add rooms */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700">Add your rooms</h4>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            value={addingRoom.type}
            onChange={(e) => setAddingRoom({ ...addingRoom, type: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            {ROOM_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={addingRoom.size}
            onChange={(e) =>
              setAddingRoom({ ...addingRoom, size: e.target.value as RoomDetail['size'] })
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
          <select
            value={addingRoom.condition}
            onChange={(e) =>
              setAddingRoom({ ...addingRoom, condition: e.target.value as RoomDetail['condition'] })
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="light">Light clean</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Needs deep scrub</option>
          </select>
          <button
            type="button"
            onClick={addRoom}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Add Room
          </button>
        </div>

        {/* Room list */}
        {rooms.length > 0 && (
          <div className="mt-4 space-y-2">
            {rooms.map((room, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <span className="text-sm text-gray-700">
                  {ROOM_TYPES.find((r) => r.value === room.type)?.label ?? room.type}
                  {' — '}
                  <span className="text-gray-500">
                    {room.size}, {room.condition}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeRoom(i)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pets */}
      <div className="mt-6 flex items-center gap-3">
        <label className="text-sm font-semibold text-gray-700">Pets in the home?</label>
        <button
          type="button"
          onClick={() => setHasPets(!hasPets)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
            hasPets ? 'bg-brand-500' : 'bg-gray-300'
          }`}
          role="switch"
          aria-checked={hasPets}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition transform ${
              hasPets ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        {hasPets && <span className="text-xs text-gray-500">+15% time for pet hair</span>}
      </div>

      {/* Extras */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700">Extra services</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXTRA_SERVICES.map((extra) => (
            <button
              key={extra.value}
              type="button"
              onClick={() => toggleExtra(extra.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                extras.includes(extra.value)
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {extra.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={runEstimate}
        disabled={rooms.length === 0}
        className="mt-6 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {rooms.length === 0 ? 'Add at least one room to estimate' : 'Get AI Estimate'}
      </button>

      {/* Results */}
      {estimate && (
        <div className="mt-6 rounded-xl bg-gradient-to-br from-brand-50 to-white border border-brand-200 p-5">
          <h4 className="font-bold text-gray-900">AI Recommendation</h4>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
              <div className="text-2xl font-bold text-brand-600">
                {estimate.recommendedDuration}h
              </div>
              <div className="text-xs text-gray-500">Recommended Duration</div>
              <div className="text-xs text-gray-400">
                ({estimate.durationRange.min}–{estimate.durationRange.max}h range)
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
              <div className="text-2xl font-bold text-brand-600 capitalize">
                {estimate.recommendedServiceType}
              </div>
              <div className="text-xs text-gray-500">Service Type</div>
            </div>
            <div className="rounded-lg bg-white p-3 text-center border border-gray-100">
              {(() => {
                const multiplier = estimate.recommendedServiceType === 'deep' ? 1.45 : 1;
                const breakdown = getPriceBreakdown(rate, estimate.recommendedDuration, multiplier);
                return (
                  <>
                    <div className="text-2xl font-bold text-brand-600">
                      ${breakdown.total.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">Estimated Total</div>
                    <div className="text-xs text-gray-400">
                      £{breakdown.listedSubtotal.toFixed(2)} + £{breakdown.serviceFee.toFixed(2)}{' '}
                      service fee
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Room breakdown */}
          <div className="mt-4">
            <h5 className="text-sm font-medium text-gray-700">Room Breakdown</h5>
            <div className="mt-2 space-y-1">
              {estimate.breakdown.map((room, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{room.room}</span>
                  <div className="flex items-center gap-2">
                    {room.note && <span className="text-xs text-amber-600">{room.note}</span>}
                    <span className="font-medium text-gray-700">~{room.estimatedMinutes} min</span>
                  </div>
                </div>
              ))}
              {estimate.extrasTime > 0 && (
                <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-1 mt-1">
                  <span className="text-gray-600">Extra Services</span>
                  <span className="font-medium text-gray-700">~{estimate.extrasTime} min</span>
                </div>
              )}
            </div>
          </div>

          {/* Tips */}
          {estimate.tips.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <h5 className="text-sm font-medium text-amber-800">Tips</h5>
              <ul className="mt-1 space-y-1">
                {estimate.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    &bull; {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Apply button */}
          <button
            type="button"
            onClick={applyEstimate}
            className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Apply Recommendation to Booking
          </button>
        </div>
      )}
    </div>
  );
}
