'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import { SAME_DAY_FEATURE_ENABLED } from '@/lib/config/features';

interface Testimonial {
  clientName: string;
  rating: number;
  text: string;
  categories?: { thoroughness: number; punctuality: number; communication: number };
}

interface PreviewData {
  name: string;
  image: string;
  bio: string;
  hourlyRateRegular: number | null;
  hourlyRateDeep: number | null;
  hourlyRateSameDay: number | null;
  specialties: string[];
  languages: string[];
  location: string;
  postcode: string;
  yearsExperience: number | null;
  completedJobs: number;
  rating: number;
  reviewCount: number;
  availableNow: boolean;
  identityVerified: boolean;
  backgroundChecked: boolean;
  testimonials: Testimonial[];
  availabilitySlots: { dayOfWeek: number; startTime: string; endTime: string }[];
  blockedDates: string[];
}

export default function ProfilePreviewPage() {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'card' | 'full'>('card');

  useEffect(() => {
    const dayMap: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    };
    Promise.all([
      fetch('/api/cleaner/profile').then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.ok ? res.json() : null;
      }),
      fetch('/api/cleaner/availability').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([p, avail]) => {
        if (!p) return;
        const slots: PreviewData['availabilitySlots'] = [];
        if (avail?.weeklySlots) {
          for (const [dayName, daySlots] of Object.entries(avail.weeklySlots)) {
            const dow = dayMap[dayName];
            if (dow === undefined) continue;
            for (const s of daySlots as { start: string; end: string }[]) {
              slots.push({ dayOfWeek: dow, startTime: s.start, endTime: s.end });
            }
          }
        }
        setData({
          name: p.name || '',
          image: p.image || '',
          bio: p.bio || '',
          hourlyRateRegular: p.hourlyRateRegular ?? null,
          hourlyRateDeep: p.hourlyRateDeep ?? null,
          hourlyRateSameDay: p.hourlyRateSameDay ?? null,
          specialties: p.specialties || [],
          languages: p.languages || [],
          location: p.location || p.postcode || '',
          postcode: p.postcode || '',
          yearsExperience: p.yearsExperience ?? null,
          completedJobs: p.completedJobs || 0,
          rating: Number(p.rating) || 0,
          reviewCount: p.reviewCount || 0,
          availableNow: p.availableNow || false,
          identityVerified: p.verificationStatus === 'VERIFIED',
          backgroundChecked: p.backgroundCheckPassed || false,
          testimonials: (Array.isArray(p.testimonials) ? p.testimonials : []).filter(
            (t: Testimonial) => t.clientName?.trim() && t.text?.trim()
          ),
          availabilitySlots: slots,
          blockedDates: (avail?.blockedDates || []).map((b: { date: string }) => b.date),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const listedRate = data ? (data.hourlyRateRegular ?? 0) : 0;
  const sameDayRate = data ? (data.hourlyRateSameDay ?? 0) : 0;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 rounded-lg w-48" />
          <div className="h-64 bg-ink/5 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <p className="font-jost text-sm text-ink-3">Failed to load profile data.</p>
      </div>
    );
  }

  const stars = (rating: number) => (
    <span className="inline-flex text-yellow-400">
      {'★'.repeat(Math.floor(rating))}
      {rating % 1 >= 0.5 && '★'}
      {'☆'.repeat(5 - Math.floor(rating) - (rating % 1 >= 0.5 ? 1 : 0))}
    </span>
  );

  const verifiedBadge = (size: string) =>
    (data.identityVerified || data.backgroundChecked) && (
      <svg className={`${size} shrink-0 text-teal`} viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    );

  const avatar = (size: number, textSize: string) => (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-cream overflow-hidden`}
      style={{ width: size, height: size }}
    >
      {data.image ? (
        <Image
          src={data.image}
          alt=""
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className={`font-cormorant ${textSize} font-semibold text-ink`}>
          {data.name.charAt(0)}
        </span>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-cormorant text-2xl font-light text-ink">Profile Preview</h1>
          <p className="font-jost text-sm font-light text-ink-3 mt-1">
            See how customers view your profile on the website
          </p>
        </div>
        <Link
          href="/cleaner/profile"
          className="shrink-0 rounded-full px-5 py-2.5 bg-ink text-cream font-jost text-[12px] font-light hover:bg-ink/90 transition text-center"
        >
          Edit Profile
        </Link>
      </div>

      {/* View toggle */}
      <div
        className="inline-flex rounded-lg bg-white p-1 mb-6"
        style={{ border: '1px solid rgba(14,14,12,0.08)' }}
      >
        <button
          onClick={() => setView('card')}
          className={`rounded-md px-5 py-2 font-jost text-[13px] font-light transition ${
            view === 'card' ? 'bg-ink text-cream shadow-sm' : 'text-ink-3 hover:text-ink'
          }`}
        >
          Card View
        </button>
        <button
          onClick={() => setView('full')}
          className={`rounded-md px-5 py-2 font-jost text-[13px] font-light transition ${
            view === 'full' ? 'bg-ink text-cream shadow-sm' : 'text-ink-3 hover:text-ink'
          }`}
        >
          Full Profile
        </button>
      </div>

      {/* Card View */}
      {view === 'card' && (
        <div>
          <p className="font-jost text-[13px] font-light text-ink-3 mb-4">
            This is how your profile card appears in search results when customers browse cleaners.
          </p>
          <div className="max-w-sm">
            <div
              className="flex flex-col bg-white transition-shadow hover:shadow-md"
              style={{ border: '0.5px solid rgba(27,42,74,0.08)' }}
            >
              <div className="flex items-start gap-4 px-5 pt-5 pb-4">
                {avatar(48, 'text-[18px]')}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-jost text-[16px] font-medium text-ink uppercase">
                      {data.name}
                    </h3>
                    {verifiedBadge('h-4 w-4')}
                  </div>
                  <p className="font-jost text-[12px] font-light text-ink-3">{data.location}</p>
                </div>
                <div className="text-right">
                  <span className="font-jost text-[20px] font-semibold text-ink">
                    &pound;{listedRate.toFixed(2)}
                  </span>
                  <span className="font-jost text-[11px] font-light text-ink-3">/hr</span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-5">
                {stars(data.rating)}
                <span className="font-jost text-[12px] font-light text-ink-2">
                  {data.rating} ({data.reviewCount})
                </span>
                {SAME_DAY_FEATURE_ENABLED && data.availableNow && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                    </span>
                    <span className="font-jost text-[11px] font-medium text-ink">
                      Available today
                    </span>
                  </span>
                )}
              </div>

              <p className="mt-3 line-clamp-2 px-5 font-jost text-[13px] font-light leading-relaxed text-ink-2">
                {data.bio || 'No bio added yet'}
              </p>

              {data.specialties.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 px-5">
                  {data.specialties.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-cream px-3 py-1 font-jost text-[11px] font-medium text-ink-2"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-ink/5 px-5 py-3">
                <span className="font-jost text-[11px] font-light text-ink-3">
                  {data.yearsExperience ?? 0} yrs experience &middot; {data.completedJobs} jobs
                </span>
                <span className="font-jost text-[11px] font-medium uppercase tracking-[0.1em] text-ink underline underline-offset-4">
                  Book now
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Profile View */}
      {view === 'full' && (
        <div>
          <p className="font-jost text-[13px] font-light text-ink-3 mb-4">
            This is your full profile page that customers see when they click on your card.
          </p>
          <div
            className="rounded-xl bg-white overflow-hidden"
            style={{ border: '1px solid rgba(14,14,12,0.06)' }}
          >
            {/* Profile header */}
            <section className="bg-cream px-6 py-8 md:px-10 md:py-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {avatar(80, 'text-[32px]')}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="font-cormorant text-[28px] font-light leading-tight text-ink sm:text-[34px] uppercase">
                      {data.name}
                    </h2>
                    {verifiedBadge('h-5 w-5')}
                  </div>
                  <p className="mt-1 font-jost text-[14px] font-light text-ink-3">
                    {data.location}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {stars(data.rating)}
                    <span className="font-jost text-[13px] font-light text-ink-2">
                      {data.rating} ({data.reviewCount} reviews)
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {SAME_DAY_FEATURE_ENABLED && data.availableNow && (
                      <span className="flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                        </span>
                        <span className="font-jost text-[11px] font-medium text-ink">
                          Available today
                        </span>
                      </span>
                    )}
                    {data.specialties.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-white px-3 py-1 font-jost text-[12px] font-medium text-ink-2"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div>
                    <span className="font-cormorant text-[32px] font-semibold text-ink">
                      &pound;{listedRate.toFixed(2)}
                    </span>
                    <span className="font-jost text-[13px] font-light text-ink-3">/hr</span>
                  </div>
                  {SAME_DAY_FEATURE_ENABLED && data.availableNow && (
                    <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
                      &pound;{sameDayRate.toFixed(2)}/hr same-day
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    <span className="inline-block rounded-md bg-ink px-6 py-3 text-center font-jost text-[13px] font-medium text-cream">
                      Book now
                    </span>
                    {SAME_DAY_FEATURE_ENABLED && data.availableNow && (
                      <span className="inline-block rounded-md bg-teal px-6 py-3 text-center font-jost text-[13px] font-medium text-white">
                        Book for today
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Body */}
            <div className="px-6 py-8 md:px-10 md:py-10">
              {/* About */}
              <section>
                <h3 className="font-cormorant text-[22px] font-semibold text-ink">About</h3>
                <p className="mt-3 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                  {data.bio || 'No bio added yet.'}
                </p>
              </section>

              {/* Stats */}
              <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { value: `${data.yearsExperience ?? '-'}`, label: 'Years experience' },
                  { value: `${data.completedJobs}`, label: 'Jobs completed' },
                  { value: `${data.rating}`, label: 'Avg rating' },
                  { value: '~15 min', label: 'Response time' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-cream px-4 py-5 text-center">
                    <div className="font-cormorant text-[26px] font-semibold text-ink">
                      {stat.value}
                    </div>
                    <div className="mt-1 font-jost text-[12px] font-light text-ink-3">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </section>

              {/* Languages */}
              {data.languages.length > 0 && (
                <section className="mt-8">
                  <h3 className="font-cormorant text-[22px] font-semibold text-ink">Languages</h3>
                  <p className="mt-2 font-jost text-[14px] font-light text-ink-2">
                    {data.languages.join(', ')}
                  </p>
                </section>
              )}

              {/* Availability */}
              <section className="mt-8">
                <h3 className="font-cormorant text-[22px] font-semibold text-ink">Availability</h3>
                <AvailabilityCalendar
                  slots={data.availabilitySlots}
                  blockedDates={data.blockedDates}
                />
              </section>

              {/* Reviews */}
              <section className="mt-8">
                <h3 className="font-cormorant text-[22px] font-semibold text-ink">
                  Reviews ({data.reviewCount + data.testimonials.length})
                </h3>
                <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
                  Only verified customers who completed a booking can leave reviews.
                </p>
                <div className="mt-6 space-y-0">
                  {data.testimonials.map((t, i) => (
                    <div key={`testimonial-${i}`} className="border-t border-ink/5 py-5">
                      <div className="flex items-center gap-2">
                        <span className="font-jost text-[14px] font-medium text-ink">
                          {t.clientName}
                        </span>
                        <span className="rounded-full bg-cream px-2 py-0.5 font-jost text-[10px] font-medium text-ink-3">
                          Testimonial
                        </span>
                      </div>
                      <div className="mt-1">{stars(t.rating)}</div>
                      {t.categories && (
                        <div className="mt-2 flex flex-wrap gap-3">
                          {[
                            { label: 'Thoroughness', v: t.categories.thoroughness },
                            { label: 'Punctuality', v: t.categories.punctuality },
                            { label: 'Communication', v: t.categories.communication },
                          ].map((cat) => (
                            <span
                              key={cat.label}
                              className="font-jost text-[11px] font-light text-ink-3"
                            >
                              {cat.label}: {cat.v}/5
                            </span>
                          ))}
                        </div>
                      )}
                      {t.text && (
                        <p className="mt-3 font-jost text-[14px] font-light leading-relaxed text-ink-2">
                          {t.text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {data.reviewCount === 0 && data.testimonials.length === 0 && (
                  <p className="py-8 text-center font-jost text-[14px] font-light text-ink-3">
                    No reviews yet.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
