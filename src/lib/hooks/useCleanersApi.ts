'use client';

import { useState, useEffect, useCallback } from 'react';

import type { Cleaner, Review } from '@/lib/types';

const DEFAULT_CATEGORY_RATINGS = { thoroughness: 0, punctuality: 0, communication: 0, value: 0 };

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
    languages: (c.languages as string[]) || [],
    tier: ((c.tier as string) || 'starter') as Cleaner['tier'],
    location: (c.location as string) || '',
    postcodeAreas: [],
    verified: (c.verified as boolean) || false,
    identityVerified: (c.identityVerified as boolean) || false,
    backgroundChecked: (c.backgroundChecked as boolean) || false,
    yearsExperience: (c.yearsExperience as number) || 0,
    completedJobs: (c.completedJobs as number) || 0,
    availability: (c.availability as string[]) || [],
    timeSlots: (c.timeSlots as Record<string, string[]>) || {},
    availableNow: (c.availableNow as boolean) || false,
    responseTime: (c.responseTime as string) || '~15 min',
    categoryRatings: DEFAULT_CATEGORY_RATINGS,
    insured: (c.insured as boolean) || false,
    bringsProducts: false,
    productFee: 0,
    eotPrices: (c.eotPrices as Record<string, number>) || undefined,
    airbnbPrices: (c.airbnbPrices as Record<string, number>) || undefined,
    distance: (c.distance as number) ?? null,
  };
}

/**
 * Hook that fetches cleaners from the API and provides helper functions
 * compatible with the old mock-data interface.
 */
/**
 * @param postcode When provided, the cleaner list is filtered server-side to those
 *   whose base is within travel-time/radius of the postcode — the REAL cleaner-set
 *   coverage (homePostcode → lat/lng + maxTravelMinutes). Omit/empty = unfiltered.
 *   Debounced so quote-phase typing doesn't fire a request per keystroke.
 */
export function useCleanersApi(postcode?: string) {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pc = (postcode ?? '').trim();
    const qs = new URLSearchParams({ limit: '50' });
    if (pc) qs.set('postcode', pc);

    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/cleaners?${qs.toString()}`)
        .then((res) => (res.ok ? res.json() : { cleaners: [], total: 0 }))
        .then((data: { cleaners: Record<string, unknown>[]; total?: number }) => {
          if (cancelled) return;
          setCleaners(data.cleaners.map(mapApiCleaner));
          setTotal(typeof data.total === 'number' ? data.total : data.cleaners.length);
        })
        .catch(() => {
          if (!cancelled) {
            setCleaners([]);
            setTotal(0);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [postcode]);

  const getCleanerById = useCallback(
    (id: string): Cleaner | undefined => cleaners.find((c) => c.id === id),
    [cleaners]
  );

  const getReviewsForCleaner = useCallback(async (cleanerId: string): Promise<Review[]> => {
    try {
      const res = await fetch(`/api/cleaners/${cleanerId}/reviews`);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  }, []);

  return { cleaners, total, loading, getCleanerById, getReviewsForCleaner };
}
