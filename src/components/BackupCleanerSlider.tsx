'use client';

import { useState, useRef } from 'react';

import CleanerProfileModal from '@/components/CleanerProfileModal';
import StarRating from '@/components/StarRating';
import { getListedRate } from '@/lib/pricing';
import type { Cleaner } from '@/lib/types';

interface BackupCleanerSliderProps {
  cleaners: Cleaner[];
  selectedIds: string[];
  onToggle: (cleanerId: string) => void;
  maxSelections?: number;
  autoAssign: boolean;
  onAutoAssignChange: (value: boolean) => void;
}

export default function BackupCleanerSlider({
  cleaners,
  selectedIds,
  onToggle,
  maxSelections = 3,
  autoAssign,
  onAutoAssignChange,
}: BackupCleanerSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [profileCleaner, setProfileCleaner] = useState<Cleaner | null>(null);

  const updateScrollButtons = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 260;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (cleaners.length === 0 && !autoAssign) return null;

  return (
    <div>
      <h4 className="font-cormorant text-lg font-light text-ink">Backup Cleaners</h4>
      <p className="mt-1 font-jost text-sm font-light text-ink-2">
        Select up to {maxSelections} backup cleaners available on your chosen date, just in case.
      </p>

      {/* Auto-assign option */}
      <label className="mt-4 flex items-start gap-3 cursor-pointer group">
        <div
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-xs transition ${
            autoAssign ? 'bg-gold text-cream' : 'bg-transparent'
          }`}
          style={{
            border: autoAssign ? 'none' : '1.5px solid rgba(14,14,12,0.2)',
          }}
        >
          {autoAssign && <>&#10003;</>}
        </div>
        <input
          type="checkbox"
          className="sr-only"
          checked={autoAssign}
          onChange={(e) => onAutoAssignChange(e.target.checked)}
        />
        <div>
          <span className="font-jost text-sm font-normal text-ink group-hover:text-ink/80 transition">
            Provide me an appropriate cleaner
          </span>
          <p className="mt-0.5 font-jost text-xs font-light text-ink-3">
            We&apos;ll assign a cleaner at the same price or lower if your chosen cleaner is
            unavailable.
          </p>
        </div>
      </label>

      {cleaners.length > 0 && (
        <>
          <div className="relative mt-4">
            {/* Left scroll button */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scroll('left')}
                className="absolute -left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-ink text-cream shadow-md hover:bg-ink/90 transition"
                style={{ borderRadius: '50%' }}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </button>
            )}

            {/* Scrollable container */}
            <div
              ref={scrollRef}
              onScroll={updateScrollButtons}
              className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
              style={{
                scrollSnapType: 'x mandatory',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
              }}
            >
              {cleaners.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const isDisabled = !isSelected && selectedIds.length >= maxSelections;

                return (
                  <div
                    key={c.id}
                    className={`relative flex-shrink-0 w-[240px] text-left transition ${
                      isSelected
                        ? 'bg-cream-2 ring-2 ring-gold'
                        : isDisabled
                          ? 'bg-cream-2 opacity-40'
                          : 'bg-cream-2 hover:bg-cream-2/80'
                    }`}
                    style={{
                      border: '0.5px solid rgba(14,14,12,0.1)',
                      scrollSnapAlign: 'start',
                    }}
                  >
                    {/* Clickable area for selection */}
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onToggle(c.id)}
                      className={`w-full p-4 pb-2 text-left ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {/* Selection indicator */}
                      <div
                        className={`absolute top-3 right-3 flex h-6 w-6 items-center justify-center text-xs transition ${
                          isSelected ? 'bg-gold text-cream' : 'bg-transparent'
                        }`}
                        style={{
                          border: isSelected ? 'none' : '1.5px solid rgba(14,14,12,0.2)',
                        }}
                      >
                        {isSelected && <>&#10003;</>}
                      </div>

                      {/* Cleaner avatar */}
                      <div className="flex h-10 w-10 items-center justify-center bg-ink font-cormorant text-lg font-light text-cream">
                        {c.name.charAt(0)}
                      </div>

                      {/* Cleaner details */}
                      <h5 className="mt-3 font-jost text-sm font-medium text-ink">{c.name}</h5>
                      <div className="mt-1 flex items-center gap-1.5">
                        <StarRating rating={c.rating} />
                        <span className="font-jost text-xs font-light text-ink-3">
                          {c.rating} ({c.reviewCount})
                        </span>
                      </div>
                      <div className="mt-2 font-jost text-sm font-normal text-ink">
                        &pound;{getListedRate(c.hourlyRate)}/hr
                      </div>
                      <div className="mt-1 font-jost text-xs font-light text-ink-3">
                        {c.location}
                      </div>
                      {c.availableNow && (
                        <span className="mt-2 inline-block font-jost text-[11px] font-normal text-gold">
                          Available now
                        </span>
                      )}
                    </button>

                    {/* Show more link */}
                    <div className="px-4 pb-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfileCleaner(c);
                        }}
                        className="font-jost text-xs font-normal text-gold hover:text-gold/80 underline underline-offset-2 transition"
                      >
                        Show more
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right scroll button */}
            {canScrollRight && cleaners.length > 2 && (
              <button
                type="button"
                onClick={() => scroll('right')}
                className="absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-ink text-cream shadow-md hover:bg-ink/90 transition"
                style={{ borderRadius: '50%' }}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            )}
          </div>

          {selectedIds.length > 0 && (
            <p className="mt-2 font-jost text-xs font-light text-ink-3">
              {selectedIds.length} of {maxSelections} backup{selectedIds.length !== 1 ? 's' : ''}{' '}
              selected
            </p>
          )}
        </>
      )}

      {/* Profile modal */}
      {profileCleaner && (
        <CleanerProfileModal cleaner={profileCleaner} onClose={() => setProfileCleaner(null)} />
      )}
    </div>
  );
}
