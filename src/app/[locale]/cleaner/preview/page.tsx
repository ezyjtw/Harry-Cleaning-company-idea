'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

import CleanerProfileView, {
  type CleanerProfileData,
  type ProfileService,
  type ProfileReviewItem,
} from '@/components/CleanerProfileView';
import ProfileWeekAvailability from '@/components/ProfileWeekAvailability';
import { useAuth } from '@/hooks/useAuth';
import {
  serviceTypeLabel,
  isServiceTypeSlug,
  type ServiceTypeSlug,
} from '@/lib/constants/services';

interface Testimonial {
  clientName: string;
  rating: number;
  text: string;
}
interface Slot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

function minPrice(map: Record<string, number> | null | undefined): number | null {
  if (!map) return null;
  const vals = Object.values(map).filter((n) => typeof n === 'number' && n > 0);
  return vals.length ? Math.min(...vals) : null;
}

export default function ProfilePreviewPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

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
          // R3: signOut (not router.push) — clears the stale cookie so /login
          // renders instead of middleware bouncing back to /dashboard.
          signOut({ callbackUrl: '/login' });
          return null;
        }
        return res.ok ? res.json() : null;
      }),
      fetch('/api/cleaner/availability').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([p, avail]) => {
        if (!p) return;
        setProfile(p);
        const s: Slot[] = [];
        if (avail?.weeklySlots) {
          for (const [dayName, daySlots] of Object.entries(avail.weeklySlots)) {
            const dow = dayMap[dayName];
            if (dow === undefined) continue;
            for (const sl of daySlots as { start: string; end: string }[]) {
              s.push({ dayOfWeek: dow, startTime: sl.start, endTime: sl.end });
            }
          }
        }
        setSlots(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-lg bg-line" />
          <div className="h-64 rounded-xl bg-line" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <p className="font-jost text-sm text-ink-3">Failed to load profile data.</p>
      </div>
    );
  }

  // Build the SAME CleanerProfileData the public profile page builds, from the
  // cleaner's own live profile — so the preview is exactly what customers see.
  const p = profile as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' ? v : v ? Number(v) : null;

  const serviceTypes = (((p.serviceTypes as string[]) || []).filter(
    isServiceTypeSlug
  ) as ServiceTypeSlug[]);
  const hrReg = num(p.hourlyRateRegular);
  const hrDeep = num(p.hourlyRateDeep);
  const hrSame = num(p.hourlyRateSameDay);
  const eot = (p.eotPrices as Record<string, number>) || null;
  const air = (p.airbnbPrices as Record<string, number>) || null;

  const services: ProfileService[] = [];
  if (serviceTypes.includes('regular') && hrReg)
    services.push({ label: serviceTypeLabel('regular'), price: `£${hrReg.toFixed(2)}/hr` });
  if (serviceTypes.includes('deep') && hrDeep)
    services.push({ label: serviceTypeLabel('deep'), price: `£${hrDeep.toFixed(2)}/hr` });
  if (serviceTypes.includes('same_day') && hrSame)
    services.push({
      label: serviceTypeLabel('same_day'),
      price: `£${hrSame.toFixed(2)}/hr`,
      soon: true,
    });
  {
    const m = serviceTypes.includes('end_of_tenancy') ? minPrice(eot) : null;
    if (m !== null)
      services.push({ label: serviceTypeLabel('end_of_tenancy'), price: `from £${m.toFixed(2)}` });
  }
  {
    const m = serviceTypes.includes('airbnb') ? minPrice(air) : null;
    if (m !== null)
      services.push({ label: serviceTypeLabel('airbnb'), price: `from £${m.toFixed(2)}` });
  }

  const testimonials = (Array.isArray(p.testimonials) ? p.testimonials : []) as Testimonial[];
  const reviews: ProfileReviewItem[] = testimonials
    .filter((t) => t.clientName?.trim() && t.text?.trim())
    .map((t, i) => ({ id: `testimonial-${i}`, name: t.clientName, rating: t.rating, text: t.text }));

  const now = new Date();
  const insuranceExpiry = p.insuranceExpiresAt ? new Date(p.insuranceExpiresAt as string) : null;

  const data: CleanerProfileData = {
    id: user?.id || '',
    name: (p.name as string) || 'Cleaner',
    photo: (p.image as string) || null,
    location: (p.location as string) || (p.postcode as string) || '',
    rating: num(p.rating) ?? 0,
    reviewCount: (p.reviewCount as number) || 0,
    idVerified: p.verificationStatus === 'VERIFIED',
    insured: !!p.insuranceVerified && (!insuranceExpiry || insuranceExpiry > now),
    backgroundChecked: !!p.backgroundCheckPassed,
    fromPrice: hrReg ?? hrDeep ?? null,
    bookHref: user?.id ? `/book/${user.id}` : '/cleaners',
    about: (p.bio as string) || '',
    // Sub-rating bars come from completed Rena bookings (server-computed); not
    // available client-side, so the preview shows the honest "no Rena jobs yet"
    // note when there are imported/testimonial reviews only.
    ratings: null,
    ratingsNote: reviews.length > 0 ? null : undefined,
    experience: {
      years: (p.yearsExperience as number) ?? null,
      jobs: (p.completedJobs as number) || 0,
      response: '~15 min',
    },
    languages: (p.languages as string[]) || [],
    services,
    reviews,
    reviewsSubtitle: 'Only verified customers who completed a booking can leave reviews.',
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Profile preview</h1>
          <p className="mt-1 font-jost text-sm font-light text-ink-3">
            This is exactly how customers see your profile — same layout, your live details.
          </p>
        </div>
        <Link
          href="/cleaner/profile"
          className="shrink-0 rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Edit profile
        </Link>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
        <CleanerProfileView
          data={data}
          availability={<ProfileWeekAvailability slots={slots} />}
        />
      </div>
    </div>
  );
}
