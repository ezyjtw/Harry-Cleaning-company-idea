import { MatchingService } from './matching.service';
import type { CleanerMatch } from './matching.service';

// ─── Time-first DISCOVERY layer ─────────────────────────────────────────────
//
// "Which cleaners are available somewhere within a time-of-day BAND on a date,
// for a service in a postcode?" — the query behind the time-first front door.
//
// This is a THIN WRAPPER over MatchingService.findMatches — the SAME cross-cleaner
// availability query the booking cascade uses to assign jobs. It does NOT compute
// availability itself: it calls findMatches once per 30-min candidate start across
// the band and unions the cleaners findMatches reports available, recording each
// cleaner's free start-times. findMatches stays the single source of truth for
// "who's free at [date, start]".
//
// Discovery only — it never books anything. Picking a cleaner from these results
// pre-fills the NORMAL cleaner-first booking (that cleaner as primary + the slot)
// and runs the identical PENDING→AWAITING_CLEANER→accept→cascade with the normal
// backups. A time-first booking of Cleaner X is identical to a cleaner-first one.
//
// ⚠️ Availability fidelity: because this reuses findMatches, it reflects the
// cleaner's RECURRING weekly AvailabilitySlot pattern + existing bookings only —
// it does NOT consult date-specific slots (AvailabilityDateSlot) or overrides
// (AvailabilityOverride), which the per-cleaner calendar DOES. See design Q2.
//
// Cost: N candidate-starts × one findMatches each (each a cross-cleaner pass).
// Acceptable at current scale; flagged for later batching, NOT optimized now.

export type TimeBand = 'morning' | 'afternoon' | 'evening';

/** Bands are START windows — the job starts within [startMin, endMin); its end may
 *  extend past the band (findMatches checks the cleaner can cover the full duration). */
export const TIME_BANDS: Record<TimeBand, { label: string; startMin: number; endMin: number }> = {
  morning: { label: 'Morning', startMin: 8 * 60, endMin: 12 * 60 }, // 08:00–12:00
  afternoon: { label: 'Afternoon', startMin: 12 * 60, endMin: 17 * 60 }, // 12:00–17:00
  evening: { label: 'Evening', startMin: 17 * 60, endMin: 21 * 60 }, // 17:00–21:00
};

const STEP_MIN = 30;

export interface BandAvailabilityCriteria {
  date: Date;
  band: TimeBand;
  duration: number; // hours
  serviceType: string;
  postcode: string;
  clientId?: string; // optional — repeat-cleaner prioritisation, forwarded to findMatches
}

/** A ranked available cleaner + the in-band start-times they can take (for the pin step). */
export interface AvailableCleaner extends CleanerMatch {
  openStartTimes: string[]; // "HH:MM" starts within the band this cleaner is free for
}

export interface BandAvailabilityResult {
  date: string; // YYYY-MM-DD
  band: TimeBand;
  cleaners: AvailableCleaner[];
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getAvailableCleanersForBand(
  criteria: BandAvailabilityCriteria
): Promise<BandAvailabilityResult> {
  const band = TIME_BANDS[criteria.band];
  const durationMin = criteria.duration * 60;

  // Candidate 30-min starts within the band. Skip starts whose job would run past
  // midnight (defensive); findMatches enforces the cleaner's own slot coverage.
  const starts: number[] = [];
  for (let m = band.startMin; m < band.endMin; m += STEP_MIN) {
    if (m + durationMin <= 24 * 60) starts.push(m);
  }

  // Union across candidate starts: userId -> cleaner (+ collected free starts).
  const byUser = new Map<string, AvailableCleaner>();

  for (const startMin of starts) {
    const startTime = minutesToTime(startMin);
    const result = await MatchingService.findMatches({
      date: criteria.date,
      startTime,
      duration: criteria.duration,
      serviceType: criteria.serviceType,
      postcode: criteria.postcode,
      clientId: criteria.clientId,
    });
    for (const match of result.matches) {
      if (!match.isAvailable) continue;
      const existing = byUser.get(match.userId);
      if (existing) {
        existing.openStartTimes.push(startTime);
      } else {
        byUser.set(match.userId, { ...match, openStartTimes: [startTime] });
      }
    }
  }

  // Rank by the existing matching score (already computed per CleanerMatch), desc.
  const cleaners = Array.from(byUser.values()).sort((a, b) => b.totalScore - a.totalScore);

  return { date: toDateString(criteria.date), band: criteria.band, cleaners };
}
