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
    languages: [],
    tier: ((c.tier as string) || 'standard') as Cleaner['tier'],
    location: (c.location as string) || '',
    postcodeAreas: [],
    verified: (c.verified as boolean) || false,
    identityVerified: (c.identityVerified as boolean) || false,
    backgroundChecked: (c.backgroundChecked as boolean) || false,
    yearsExperience: 0,
    completedJobs: (c.completedJobs as number) || 0,
    availability: [],
    timeSlots: {},
    availableNow: (c.availableNow as boolean) || false,
    responseTime: (c.responseTime as string) || '~15 min',
    categoryRatings: DEFAULT_CATEGORY_RATINGS,
    insured: (c.insured as boolean) || false,
    bringsProducts: false,
    productFee: 0,
  };
}

/**
 * Hook that fetches cleaners from the API and provides helper functions
 * compatible with the old mock-data interface.
 */
export function useCleanersApi() {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cleaners?limit=50')
      .then((res) => (res.ok ? res.json() : { cleaners: [] }))
      .then((data: { cleaners: Record<string, unknown>[] }) => {
        setCleaners(data.cleaners.map(mapApiCleaner));
      })
      .catch(() => setCleaners([]))
      .finally(() => setLoading(false));
  }, []);

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

  return { cleaners, loading, getCleanerById, getReviewsForCleaner };
}
