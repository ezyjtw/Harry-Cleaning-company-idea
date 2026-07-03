'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import CleanerIdentity from '@/components/CleanerIdentity';
import CleanerProfileModal from '@/components/CleanerProfileModal';
import { useAuth } from '@/hooks/useAuth';
import { serviceLabelFromSlug } from '@/lib/constants/services';
import type { Cleaner } from '@/lib/types';

interface CompletedBooking {
  id: string;
  date: string;
  serviceType: string;
  cleaner: { id: string; name: string | null; image: string | null };
}

/** A past cleaner the customer has booked, joined with their live profile when
 *  still listed. `full` drives stars + the profile modal; when the cleaner is no
 *  longer listed we fall back to the booking-derived identity (no stars). */
interface MyCleaner {
  id: string;
  name: string;
  image: string | null;
  lastDate: string;
  service: string;
  full: Cleaner | null;
}

// Same shape mapping /cleaners uses — the list endpoint is the only source that
// returns a full Cleaner (rating, reviewCount, prices) the profile modal needs.
function mapApiCleaner(c: Record<string, unknown>): Cleaner {
  return {
    id: c.id as string,
    name: (c.name as string) || '',
    photo: (c.photo || c.image || '') as string,
    rating: (c.rating as number) || 0,
    reviewCount: (c.reviewCount as number) || 0,
    hourlyRateRegular: (c.hourlyRateRegular as number) || null,
    hourlyRateDeep: (c.hourlyRateDeep as number) || null,
    hourlyRateSameDay: (c.hourlyRateSameDay as number) || null,
    serviceTypes: (c.serviceTypes as string[]) || [],
    bio: (c.bio as string) || '',
    specialties: (c.specialties as string[]) || [],
    languages: [],
    tier: (c.tier as Cleaner['tier']) || 'starter',
    location: (c.location as string) || '',
    postcodeAreas: [],
    verified: (c.verified as boolean) || false,
    identityVerified: (c.identityVerified as boolean) || false,
    insured: false,
    backgroundChecked: (c.backgroundChecked as boolean) || false,
    yearsExperience: 0,
    completedJobs: (c.completedJobs as number) || 0,
    availability: (c.availability as string[]) || [],
    timeSlots: (c.timeSlots as Record<string, string[]>) || {},
    availableNow: (c.availableNow as boolean) || false,
    responseTime: (c.responseTime as string) || '~15 min',
    categoryRatings: { thoroughness: 0, punctuality: 0, communication: 0, value: 0 },
    bringsProducts: false,
    productFee: 0,
    eotPrices: (c.eotPrices as Record<string, number>) || undefined,
    airbnbPrices: (c.airbnbPrices as Record<string, number>) || undefined,
    distance: (c.distance as number) ?? null,
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function MyCleanersPage() {
  const router = useRouter();
  const { authLoading, isAuthenticated, isCleaner, isAdmin } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [cleaners, setCleaners] = useState<MyCleaner[]>([]);
  const [selected, setSelected] = useState<Cleaner | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated || isCleaner || isAdmin) return;

    async function load() {
      try {
        const [bookingsRes, cleanersRes] = await Promise.all([
          fetch('/api/bookings?status=COMPLETED'),
          fetch('/api/cleaners?limit=50'),
        ]);
        const bookingsData = bookingsRes.ok ? await bookingsRes.json() : { data: [] };
        const cleanersData = cleanersRes.ok ? await cleanersRes.json() : { cleaners: [] };

        const fullById = new Map<string, Cleaner>(
          ((cleanersData.cleaners as Record<string, unknown>[]) || [])
            .map(mapApiCleaner)
            .map((c) => [c.id, c])
        );

        // API orders completed bookings by createdAt desc, so first-seen per
        // cleaner is their most recent clean. Uncapped.
        const seen = new Set<string>();
        const rows: MyCleaner[] = [];
        for (const b of (bookingsData.data as CompletedBooking[]) || []) {
          if (seen.has(b.cleaner.id)) continue;
          seen.add(b.cleaner.id);
          rows.push({
            id: b.cleaner.id,
            name: b.cleaner.name || 'Cleaner',
            image: b.cleaner.image,
            lastDate: b.date,
            service: b.serviceType,
            full: fullById.get(b.cleaner.id) ?? null,
          });
        }
        setCleaners(rows);
      } catch {
        setCleaners([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [authLoading, isAuthenticated, isCleaner, isAdmin]);

  if (authLoading || (!isAuthenticated && !loading)) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-newsreader text-2xl font-semibold text-ink">My cleaners</h1>
        <p className="mt-1 font-jost text-sm font-light text-ink-3">
          The cleaners you&rsquo;ve booked before — rebook the ones you trust.
        </p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-line" />
          ))}
        </div>
      ) : cleaners.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center">
          <p className="font-jost text-sm text-ink-3">No cleaners yet</p>
          <Link
            href="/cleaners"
            className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-6 py-3 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Find a cleaner
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {cleaners.map((c) => {
            const meta = (
              <>
                Last clean: {formatDate(c.lastDate)} &middot; {serviceLabelFromSlug(c.service)}
              </>
            );
            const openProfile = () => {
              if (c.full) setSelected(c.full);
              else router.push(`/cleaners/${c.id}`);
            };
            return (
              <div
                key={c.id}
                className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <button
                  type="button"
                  onClick={openProfile}
                  className="min-w-0 flex-1 rounded-lg text-left transition-opacity hover:opacity-90"
                  aria-label={`View ${c.name}'s profile`}
                >
                  <CleanerIdentity
                    photo={c.full ? c.full.photo : c.image}
                    name={c.name}
                    verified={c.full ? c.full.identityVerified || c.full.backgroundChecked : false}
                    rating={c.full ? c.full.rating : 0}
                    reviewCount={c.full ? c.full.reviewCount : 0}
                    meta={meta}
                  />
                </button>
                <Link
                  href={`/book/${c.id}`}
                  className="shrink-0 self-start rounded-[10px] bg-primary px-5 py-2.5 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover sm:self-auto"
                >
                  Book again
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <CleanerProfileModal cleaner={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** Local guard hook — redirects non-customers, mirrors the Home tab. */
function useAuthGuard() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated, isCleaner, isAdmin } = useAuth();
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/login?callbackUrl=/account/cleaners');
    else if (isCleaner) router.push('/cleaner');
    else if (isAdmin) router.push('/admin');
  }, [authLoading, isAuthenticated, isCleaner, isAdmin, router]);
  return { authLoading, isAuthenticated, isCleaner, isAdmin };
}
