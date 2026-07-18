'use client';

import { useState, useRef } from 'react';

import CleanerAvatar from '@/components/CleanerAvatar';
import CleanerProfileModal from '@/components/CleanerProfileModal';
import {
  BEDROOMS_TO_EOT_SIZE,
  BEDROOMS_TO_AIRBNB_SIZE,
  eotSizeLabel,
  airbnbSizeLabel,
} from '@/lib/constants/services';
import { SERVICE_FEE_PERCENT } from '@/lib/pricing';
import type { Cleaner, ServiceCategory } from '@/lib/types';

interface BackupCleanerSliderProps {
  cleaners: Cleaner[];
  selectedIds: string[];
  onToggle: (cleanerId: string) => void;
  maxSelections?: number;
  autoAssign: boolean;
  onAutoAssignChange: (value: boolean) => void;
  /** Service category — used to show fixed prices for EOT / Airbnb */
  serviceCategory?: ServiceCategory;
  /** Number of bedrooms (0 = studio). Used with serviceCategory for fixed-price lookup. */
  propertySize?: number;
}

/** Green circle-check pinned bottom-right (mirrors CleanerIdentity's VerifiedCheck). */
function VerifiedCheck() {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white"
      aria-label="Verified"
    >
      <svg className="h-4 w-4 text-trust" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

export default function BackupCleanerSlider({
  cleaners,
  selectedIds,
  onToggle,
  maxSelections = 3,
  autoAssign,
  onAutoAssignChange,
  serviceCategory,
  propertySize,
}: BackupCleanerSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [profileCleaner, setProfileCleaner] = useState<Cleaner | null>(null);

  // Service-correct price for a backup: fixed (£X · size) for EoT/Airbnb, else
  // hourly £X/hr. Unchanged from before — just the display sourcing.
  const priceLabel = (c: Cleaner): string => {
    if (serviceCategory && propertySize !== undefined) {
      if (serviceCategory === 'end-of-tenancy') {
        const slug = BEDROOMS_TO_EOT_SIZE[propertySize];
        const base = slug ? c.eotPrices?.[slug] : undefined;
        if (typeof base === 'number' && slug) {
          const withFee = Math.round(base * (1 + SERVICE_FEE_PERCENT / 100) * 100) / 100;
          return `£${withFee.toFixed(2)} · ${eotSizeLabel(slug)}`;
        }
      } else if (serviceCategory === 'airbnb') {
        const slug = BEDROOMS_TO_AIRBNB_SIZE[propertySize];
        const base = slug ? c.airbnbPrices?.[slug] : undefined;
        if (typeof base === 'number' && slug) {
          const withFee = Math.round(base * (1 + SERVICE_FEE_PERCENT / 100) * 100) / 100;
          return `£${withFee.toFixed(2)} · ${airbnbSizeLabel(slug)}`;
        }
      }
    }
    return `£${(c.hourlyRateRegular ?? 0).toFixed(2)}/hr`;
  };

  if (cleaners.length === 0 && !autoAssign) return null;

  return (
    <div>
      <h4 className="font-newsreader text-lg font-semibold text-ink">Backup Cleaners</h4>
      <p className="mt-1 font-jost text-sm font-light text-ink-2">
        Select up to {maxSelections} backup cleaners available on your chosen date, just in case.
      </p>

      {/* First choice: auto-assign */}
      <label className="group mt-4 flex cursor-pointer items-start gap-3">
        <div
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-xs transition ${
            autoAssign ? 'bg-primary text-white' : 'border border-line bg-surface'
          }`}
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
          <span className="font-jost text-sm font-medium text-ink transition group-hover:text-ink/80">
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
          {/* The bench — a faces-first horizontal strip. Partial next face + edge
              fade is the scroll affordance (no chevron button). */}
          <div className="relative mt-4">
            <div
              ref={scrollRef}
              className="flex gap-1 overflow-x-auto scrollbar-hide pb-2 pr-10"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {cleaners.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const isDisabled = !isSelected && selectedIds.length >= maxSelections;
                const firstName = c.name.split(' ')[0];
                return (
                  <div key={c.id} className="w-[104px] shrink-0 text-center">
                    {/* Tap the FACE to select / deselect */}
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onToggle(c.id)}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${c.name} as backup`}
                      className={`relative mx-auto block ${
                        isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                      }`}
                    >
                      <div className="relative">
                        <CleanerAvatar
                          photo={c.photo}
                          name={c.name}
                          size={56}
                          className={
                            isSelected
                              ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface'
                              : ''
                          }
                        />
                        {c.identityVerified && <VerifiedCheck />}
                        {isSelected && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white ring-2 ring-surface">
                            &#10003;
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Tap the NAME / details to open the profile */}
                    <button
                      type="button"
                      onClick={() => setProfileCleaner(c)}
                      className="mt-2 block w-full"
                    >
                      <span className="block truncate font-jost text-[13px] font-medium text-ink hover:underline">
                        {firstName}
                      </span>
                      <span className="mt-0.5 block font-jost text-[11px] text-ink-3">
                        {c.reviewCount > 0 ? (
                          <>
                            <span className="text-rating">&#9733;</span> {c.rating}
                          </>
                        ) : (c.isNew ?? true) ? (
                          // F-B: "New to Rena" expires (5 jobs / 60 days post-go-live)
                          'New to Rena'
                        ) : (
                          'No reviews yet'
                        )}
                      </span>
                      <span className="mt-0.5 block truncate font-jost text-[11px] font-medium text-ink-2">
                        {priceLabel(c)}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Right edge fade — hints there's more to scroll */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent" />
          </div>

          {selectedIds.length > 0 && (
            <p className="mt-2 font-jost text-xs font-light text-ink-3">
              {selectedIds.length} of {maxSelections} backup{selectedIds.length !== 1 ? 's' : ''}{' '}
              selected
            </p>
          )}
        </>
      )}

      {/* Profile modal — gains a "Select as backup" button in this context */}
      {profileCleaner && (
        <CleanerProfileModal
          cleaner={profileCleaner}
          onClose={() => setProfileCleaner(null)}
          onSelectBackup={() => onToggle(profileCleaner.id)}
          isSelectedBackup={selectedIds.includes(profileCleaner.id)}
        />
      )}
    </div>
  );
}
