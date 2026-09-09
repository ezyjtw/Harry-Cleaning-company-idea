'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import AccountMenu from '@/components/app/AccountMenu';
import HiddenProfileBanner from '@/components/app/HiddenProfileBanner';
import InboxBell from '@/components/app/InboxBell';
import {
  type AppJob as Job,
  HeroJob,
  JobCard,
  LIFECYCLE_ACTION,
  ReceiptRow,
  haptic,
  isoOf,
  pay,
} from '@/components/app/job-cards';

function dateEyebrow(): string {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

// Dashboard shape A (James-ruled): compact eyebrow — "TUE 8 SEPT".
function dateEyebrowShort(): string {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/,/g, '')
    .toUpperCase();
}

// Time-of-day-aware greeting word.
function greetingWord(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

// ─── Day-one first-run states (James-ruled) ──────────────────────────────────
// A cleaner who has NEVER had a job gets a purpose-built Today instead of
// "Day off": State 1 (no availability set — "Almost There") or State 2
// (available, nothing booked ever — "Ready for Work"). The has-worked probe
// checks COMPLETED and REVIEWED — completed jobs become REVIEWED after a
// customer review, which the page's main fetch doesn't include — so an
// established cleaner's quiet day keeps the existing Day off screen (State 3)
// untouched. Probes fire only when the jobs list comes back empty, and any
// probe failure falls back to Day off — never a broken screen.
const JS_DAY_TO_API = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

interface FreeRow {
  iso: string;
  label: string;
  hours: string;
}
interface DayOneState {
  state: 1 | 2;
  free: FreeRow[];
}

function fmtSlotTime(t: string): string {
  return t.replace(/^0/, '');
}

// Today V2 quiet-day tile: "Thu 9:00" — always weekday-short + time.
function nextJobTile(j: Job): string {
  return `${new Date(`${j.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })} ${j.time}`;
}

// C3: the earned-today serif ticker — counts up to the day's completed total,
// and counts on from there when another job completes.
function EarnedTicker({ amount }: { amount: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const delta = amount - from;
    if (delta === 0) return;
    const t0 = performance.now();
    const DURATION = 700;
    let raf: number;
    const step = (t: number) => {
      const p = Math.min((t - t0) / DURATION, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + delta * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = amount;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [amount]);
  return (
    <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-3.5">
      <span className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        Today
      </span>
      <span className="font-jost text-xl font-semibold text-teal">£{display.toFixed(2)}</span>
    </div>
  );
}

// ─── Today V2 shared pieces (James-ruled) ────────────────────────────────────

// The app's only bordered shout: a live offer, under the greeting in EVERY
// Today state. No accept/decline here — VIEW OFFER goes to the offer screen.
function offerCountdown(expiresAt: string | null | undefined, now: number): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 'Expiring';
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor(totalS / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m left`;
  return `${m}:${String(totalS % 60).padStart(2, '0')} left`;
}

function OfferAlerts({ offers, now }: { offers: Job[]; now: number }) {
  if (offers.length === 0) return null;
  return (
    <div className="mb-4 space-y-3" data-testid="offer-alerts">
      {offers.map((o) => (
        <div key={o.id} className="rounded-2xl border-2 border-primary bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              New Offer
            </p>
            {offerCountdown(o.cascadeExpiresAt, now) && (
              <p
                className="shrink-0 font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-primary"
                data-testid="offer-countdown"
              >
                {offerCountdown(o.cascadeExpiresAt, now)}
              </p>
            )}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="font-jost text-[20px] font-semibold leading-tight text-primary">
              {new Date(`${o.date}T00:00:00`).toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}{' '}
              · {o.time}
            </p>
            <p className="shrink-0 text-right font-jost text-[18px] font-semibold leading-tight text-teal">
              £{pay(o).toFixed(2)}
            </p>
          </div>
          <p className="mt-1 truncate font-jost text-sm text-ink-2">
            {o.serviceType} · {o.duration}h · {o.address}
          </p>
          <Link
            href={`/app/offer/${o.id}`}
            onClick={() => haptic('light')}
            className="mt-3 block w-full rounded-[12px] bg-primary px-4 py-3 text-center font-jost text-sm font-semibold uppercase tracking-[0.04em] text-white active:opacity-80"
          >
            View Offer
          </Link>
        </div>
      ))}
    </div>
  );
}

interface StripDay {
  iso: string;
  label: string;
  value: string;
  strong: boolean;
}

function WeekStrip({ days }: { days: StripDay[] }) {
  return (
    <Link
      href="/app/availability"
      onClick={() => haptic('light')}
      className="mt-6 grid grid-cols-4 gap-2"
      data-testid="week-strip"
    >
      {days.map((s) => (
        <span
          key={s.iso}
          className="rounded-2xl border border-line bg-surface px-2 py-2.5 text-center"
        >
          <span className="block font-jost text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            {s.label}
          </span>
          <span
            className={`mt-0.5 block font-jost text-[13px] font-medium ${
              s.strong ? 'text-primary' : 'text-ink-3'
            }`}
          >
            {s.value}
          </span>
        </span>
      ))}
    </Link>
  );
}

function ChangeAvailabilityRow() {
  return (
    <Link
      href="/app/availability"
      onClick={() => haptic('light')}
      className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface px-5 py-3.5"
      data-testid="change-availability-row"
    >
      <span className="flex items-center gap-2.5">
        <svg
          className="h-[18px] w-[18px] text-ink-2"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="font-jost text-[15px] font-medium text-ink">Change My Availability</span>
      </span>
      <svg
        className="h-4 w-4 text-ink-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

function PlanNextWeekCard() {
  return (
    <Link
      href="/app/availability"
      onClick={() => haptic('light')}
      className="mt-3 flex items-center justify-between rounded-2xl bg-primary-soft px-5 py-4"
      data-testid="plan-next-week"
    >
      <span>
        <span className="block font-jost text-[15px] font-semibold text-primary">
          Plan Next Week
        </span>
        <span className="block font-jost text-[12px] text-ink-2">30 seconds</span>
      </span>
      <svg
        className="h-4 w-4 text-primary"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

export default function TodayPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [dayOne, setDayOne] = useState<DayOneState | null>(null);
  // Today V2 (James-ruled): live offers surface on Today itself, every state.
  const [offers, setOffers] = useState<Job[]>([]);

  // Dashboard shape A: greeting name + week-strip/invite data. All
  // best-effort — the dashboard renders fine while (or if) these never land.
  const [firstName, setFirstName] = useState<string | null>(null);
  const [profileVisible, setProfileVisible] = useState<boolean | null>(null);
  const [blockedSet, setBlockedSet] = useState<Set<string>>(() => new Set());
  const [nextWeekTouched, setNextWeekTouched] = useState<boolean | null>(null);
  // Today V2 day-one dashboard: open hours per rolling day + the 7-day total.
  const [openHoursByIso, setOpenHoursByIso] = useState<Record<string, number>>({});
  const [openWeekHours, setOpenWeekHours] = useState(0);

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.name) setFirstName(String(d.name).split(' ')[0]);
        if (d) setProfileVisible(d.visibleInDirectory !== false);
      })
      .catch(() => {});
    fetch('/api/cleaner/availability')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const blocked = new Set<string>(
          (Array.isArray(d.blockedDates) ? d.blockedDates : []).map((b: { date: string }) => b.date)
        );
        setBlockedSet(blocked);
        // The "Plan Next Week" invite shows only while next calendar week is
        // untouched (no per-date edits, no blocks) — the blank-week reminder.
        const mon = new Date();
        mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + 7);
        const isos: string[] = [];
        for (let i = 0; i < 7; i++) {
          const dd = new Date(mon);
          dd.setDate(mon.getDate() + i);
          isos.push(isoOf(dd));
        }
        const ds: Record<string, unknown[]> = d.dateSlots || {};
        setNextWeekTouched(isos.some((iso) => blocked.has(iso) || (ds[iso]?.length ?? 0) > 0));
        // Open hours for the rolling next 7 days (date slots override the
        // template; blocked days count 0) — the day-one tiles/strip read these.
        const weeklySlots: Record<string, { start: string; end: string }[]> = d.weeklySlots || {};
        const dateSlots: Record<string, { start: string; end: string }[]> = d.dateSlots || {};
        const toMin = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return t === '23:59' ? 24 * 60 : h * 60 + m;
        };
        const byIso: Record<string, number> = {};
        let total = 0;
        for (let i = 0; i < 7; i++) {
          const dd = new Date();
          dd.setDate(dd.getDate() + i);
          const iso = isoOf(dd);
          if (blocked.has(iso)) {
            byIso[iso] = 0;
            continue;
          }
          const slots = dateSlots[iso]?.length
            ? dateSlots[iso]
            : weeklySlots[JS_DAY_TO_API[dd.getDay()]] || [];
          const h = slots.reduce((sum, r) => sum + (toMin(r.end) - toMin(r.start)) / 60, 0);
          byIso[iso] = h;
          total += h;
        }
        setOpenHoursByIso(byIso);
        setOpenWeekHours(Math.round(total * 10) / 10);
      })
      .catch(() => {});
  }, []);

  // Runs only when the jobs list is empty: decides day-one State 1/2, or null
  // (has worked before → the existing Day off). Fail-open to null on any error.
  const resolveDayOne = useCallback(async (): Promise<DayOneState | null> => {
    try {
      const [workedRes, availRes] = await Promise.all([
        fetch('/api/cleaner/jobs?status=COMPLETED,REVIEWED&limit=1'),
        fetch('/api/cleaner/availability'),
      ]);
      if (!workedRes.ok || !availRes.ok) return null;
      const worked = await workedRes.json().catch(() => null);
      if (!Array.isArray(worked?.jobs) || worked.jobs.length > 0) return null;
      const avail = await availRes.json().catch(() => null);
      if (!avail) return null;
      const weekly: Record<string, { start: string; end: string }[]> = avail.weeklySlots || {};
      const dateSlots: Record<string, { start: string; end: string }[]> = avail.dateSlots || {};
      const blocked = new Set<string>(
        (Array.isArray(avail.blockedDates) ? avail.blockedDates : []).map(
          (b: { date: string }) => b.date
        )
      );
      const hasAvailability =
        Object.values(weekly).some((s) => Array.isArray(s) && s.length > 0) ||
        Object.values(dateSlots).some((s) => Array.isArray(s) && s.length > 0);
      if (!hasAvailability) return { state: 1, free: [] };
      // State 2: her open hours over the rolling next 7 days — date overrides
      // win, blocked days drop out, empty days simply don't appear (honest,
      // no nag line).
      const free: FreeRow[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const iso = isoOf(d);
        if (blocked.has(iso)) continue;
        const slots = dateSlots[iso]?.length
          ? dateSlots[iso]
          : weekly[JS_DAY_TO_API[d.getDay()]] || [];
        if (!slots.length) continue;
        const label =
          i === 0
            ? 'Today'
            : i === 1
              ? 'Tomorrow'
              : d.toLocaleDateString('en-GB', { weekday: 'long' });
        free.push({
          iso,
          label,
          hours: slots.map((s) => `${fmtSlotTime(s.start)}–${fmtSlotTime(s.end)}`).join(', '),
        });
      }
      return { state: 2, free };
    } catch {
      return null;
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const [res, offersRes] = await Promise.all([
        fetch(
          '/api/cleaner/jobs?status=ACCEPTED,CONFIRMED,EN_ROUTE,IN_PROGRESS,COMPLETED&limit=50'
        ),
        // Today V2: live offers ride the same jobs API (additive field carries
        // the window end); best-effort — a failed offers read never breaks Today.
        fetch('/api/cleaner/jobs?status=AWAITING_CLEANER&limit=10').catch(() => null),
      ]);
      if (offersRes?.ok) {
        const od = await offersRes.json().catch(() => null);
        const olist: Job[] = Array.isArray(od?.jobs) ? od.jobs : [];
        olist.sort((a, b) =>
          String(a.cascadeExpiresAt || '9999').localeCompare(String(b.cascadeExpiresAt || '9999'))
        );
        setOffers(olist);
      }
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json().catch(() => null);
      const list: Job[] = Array.isArray(data?.jobs) ? data.jobs : [];
      // Day-one discriminator resolves BEFORE loading clears so the first
      // paint is already the right state (no Day-off flash). It re-runs on
      // every refetch, so setting availability flips State 1 → 2 on the next
      // focus, and a first booking clears day-one entirely.
      setDayOne(list.length === 0 ? await resolveDayOne() : null);
      setJobs(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [resolveDayOne]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Freshness: refetch when the app/tab regains focus or becomes visible (a
  // cleaner switching back from Maps/messages sees current jobs), and expose a
  // refetch the native shell's pull-to-refresh can call via injected JS.
  useEffect(() => {
    const onFocus = () => fetchJobs();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchJobs();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    (window as unknown as { __renaRefresh?: () => void }).__renaRefresh = fetchJobs;
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      delete (window as unknown as { __renaRefresh?: () => void }).__renaRefresh;
    };
  }, [fetchJobs]);

  // Live-ticking next-job countdown; 1s while an offer countdown is on screen.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), offers.length > 0 ? 1000 : 30000);
    return () => clearInterval(t);
  }, [offers.length]);

  const today = isoOf(new Date());
  const todayJobs = useMemo(
    () => jobs.filter((j) => j.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [jobs, today]
  );
  // C3: the day splits into what's still to do and the receipts of what's done.
  const activeToday = useMemo(
    () => todayJobs.filter((j) => j.status !== 'completed' && j.status !== 'cancelled'),
    [todayJobs]
  );
  const doneToday = useMemo(() => todayJobs.filter((j) => j.status === 'completed'), [todayJobs]);
  const earnedToday = useMemo(() => doneToday.reduce((s, j) => s + pay(j), 0), [doneToday]);
  const nextUpcoming = useMemo(() => {
    return jobs
      .filter((j) => j.status !== 'completed' && j.status !== 'cancelled')
      .map((j) => ({ j, start: new Date(`${j.date}T${j.time}:00`).getTime() }))
      .filter((x) => !Number.isNaN(x.start) && x.start > now)
      .sort((a, b) => a.start - b.start)[0]?.j;
  }, [jobs, now]);

  // W1 (James-ruled): the day's rhythm. Morning = jobs exist, none started —
  // the preview. Evening = last job completed (earned-based, never clock-based)
  // — the flip. The live-day view between them is untouched.
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoOf(d);
  }, []);
  const evening = useMemo(
    () => !loading && todayJobs.length > 0 && activeToday.length === 0 && doneToday.length > 0,
    [loading, todayJobs, activeToday, doneToday]
  );
  const expectedToday = useMemo(
    () => todayJobs.filter((j) => j.status !== 'cancelled').reduce((s, j) => s + pay(j), 0),
    [todayJobs]
  );
  const tomorrowFirst = useMemo(
    () =>
      jobs
        .filter(
          (j) => j.date === tomorrowIso && j.status !== 'completed' && j.status !== 'cancelled'
        )
        .sort((a, b) => a.time.localeCompare(b.time))[0],
    [jobs, tomorrowIso]
  );

  const weekSummary = useMemo(() => {
    const d = new Date();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const inWeek = jobs.filter(
      (j) => new Date(`${j.date}T00:00:00`) >= monday && j.status === 'completed'
    );
    return { earned: inWeek.reduce((s, j) => s + pay(j), 0), count: inWeek.length };
  }, [jobs]);

  const advance = async (job: Job) => {
    const action = LIFECYCLE_ACTION[job.status];
    if (!action) return;
    haptic('medium');
    setProcessingId(job.id);
    setActionError('');
    try {
      const res = await fetch(`/api/cleaner/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action.next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        haptic('success');
        await fetchJobs();
      } else {
        haptic('error');
        setActionError(data?.error || 'Could not update the job.');
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/10 px-5 py-4">
        <p className="text-sm font-medium text-danger">Please sign in to see your jobs.</p>
      </div>
    );
  }

  // Full error state (retry) — only when we have nothing to show.
  if (!loading && loadError && jobs.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-jost text-xl font-semibold text-ink">Couldn&apos;t load your jobs</h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchJobs();
          }}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Day-one states 1 & 2 (James-ruled). State 3 — has worked before — is
  // the existing Day off rendering below, untouched, footer included. ─────────
  if (!loading && dayOne?.state === 1) {
    return (
      <div>
        <HiddenProfileBanner className="mb-4" />
        <header className="mb-5">
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {dateEyebrow()}
          </p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">
              Almost There
            </h1>
            <div className="mt-1 flex shrink-0 items-center gap-2">
              <AccountMenu />
              <InboxBell />
            </div>
          </div>
        </header>
        <OfferAlerts offers={offers} now={now} />
        <div
          className="flex flex-col items-center px-6 pt-12 text-center"
          data-testid="day-one-set-availability"
        >
          <svg
            className="h-10 w-10 text-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <p className="mt-4 font-jost text-lg font-semibold text-ink">Nobody can book you yet</p>
          <p className="mt-1.5 font-jost text-sm text-ink-2">
            Set the hours you&apos;re free and jobs in your area will start finding you.
          </p>
          <Link
            href="/app/availability"
            onClick={() => haptic('light')}
            className="mt-6 inline-block rounded-[10px] bg-primary px-5 py-2.5 font-jost text-sm font-medium text-white"
          >
            Set your availability
          </Link>
        </div>
      </div>
    );
  }
  // ─── Today V2 (James-ruled): the dashboard in every state. ────────────────
  const jobStrip: StripDay[] = [];
  const hourStrip: StripDay[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = isoOf(d);
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const count = jobs.filter(
      (j) => j.date === iso && j.status !== 'cancelled' && j.status !== 'completed'
    ).length;
    const off = blockedSet.has(iso);
    jobStrip.push({
      iso,
      label,
      value: count > 0 ? `${count} job${count === 1 ? '' : 's'}` : off ? 'off' : '—',
      strong: count > 0,
    });
    const h = openHoursByIso[iso] ?? 0;
    hourStrip.push({
      iso,
      label,
      value: off ? 'off' : h > 0 ? `${Math.round(h * 10) / 10} hrs` : '—',
      strong: !off && h > 0,
    });
  }
  const weekBookedCount = jobs.filter((j) => {
    const d = new Date();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return (
      new Date(`${j.date}T00:00:00`) >= monday &&
      j.status !== 'cancelled' &&
      j.status !== 'completed'
    );
  }).length;

  const dashHeader = (
    <header className="mb-5">
      <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        {dateEyebrowShort()}
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h1 className="font-jost text-[26px] font-semibold leading-tight text-primary">
          {greetingWord()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <div className="mt-1 flex shrink-0 items-center gap-2">
          <AccountMenu />
          <InboxBell />
        </div>
      </div>
      {evening && (
        <p className="mt-1.5 font-jost text-sm text-ink-2" data-testid="evening-flip">
          {tomorrowFirst
            ? `Tomorrow: ${tomorrowFirst.time} · ${tomorrowFirst.clientName}`
            : 'Nothing booked tomorrow yet — keep your availability fresh.'}
        </p>
      )}
    </header>
  );

  // Adaptive tiles (James-ruled): never £0.00 or "0 jobs" — switch to what is
  // true and useful. A £0 THIS WK shows the week's booked count instead.
  const thisWkTile =
    weekSummary.earned > 0 ? (
      <div className="rounded-2xl border border-line bg-surface px-3 py-3">
        <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          This Wk
        </p>
        <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-teal">
          £{weekSummary.earned.toFixed(0)}
        </p>
      </div>
    ) : (
      <div className="rounded-2xl border border-line bg-surface px-3 py-3">
        <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          This Wk
        </p>
        <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-ink">
          {weekBookedCount > 0 ? `${weekBookedCount} booked` : '—'}
        </p>
      </div>
    );

  // WORKING DAY: jobs today.
  if (!loading && todayJobs.length > 0) {
    const nToday = todayJobs.filter((j) => j.status !== 'cancelled').length;
    return (
      <div>
        <HiddenProfileBanner className="mb-4" />
        {dashHeader}
        <OfferAlerts offers={offers} now={now} />
        {actionError && (
          <div className="mb-4 rounded-lg border border-line bg-surface px-4 py-3">
            <p className="text-sm text-ink-2">{actionError}</p>
          </div>
        )}
        <div className="mb-4 grid grid-cols-3 gap-2" data-testid="stat-tiles">
          <div className="rounded-2xl border border-line bg-surface px-3 py-3">
            <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Today
            </p>
            <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-primary">
              {nToday} job{nToday === 1 ? '' : 's'}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-3 py-3">
            <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Expected
            </p>
            <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-teal">
              £{expectedToday.toFixed(0)}
            </p>
          </div>
          {thisWkTile}
        </div>
        <div className="space-y-3">
          {activeToday.map((job, i) =>
            i === 0 ? (
              <HeroJob
                key={job.id}
                job={job}
                now={now}
                processing={processingId === job.id}
                onAdvance={() => advance(job)}
                onCancelled={fetchJobs}
              />
            ) : (
              <JobCard
                key={job.id}
                job={job}
                now={now}
                processing={processingId === job.id}
                onAdvance={() => advance(job)}
                onCancelled={fetchJobs}
              />
            )
          )}
        </div>
        {doneToday.length > 0 && (
          <div className={activeToday.length > 0 ? 'mt-5' : ''}>
            <p className="mb-1.5 font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Done today
            </p>
            <div className="rounded-2xl border border-line bg-surface px-4 py-1">
              {doneToday.map((job) => (
                <ReceiptRow key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
        {earnedToday > 0 && <EarnedTicker amount={earnedToday} />}
        <WeekStrip days={jobStrip} />
        <ChangeAvailabilityRow />
        {nextWeekTouched === false && <PlanNextWeekCard />}
      </div>
    );
  }

  // QUIET DAY (has worked, nothing today): the full dashboard — the old bare
  // Day Off screen retires (James-ruled Today V2).
  if (!loading && todayJobs.length === 0 && !dayOne) {
    return (
      <div>
        <HiddenProfileBanner className="mb-4" />
        {dashHeader}
        <OfferAlerts offers={offers} now={now} />
        <div className="mb-4 grid grid-cols-3 gap-2" data-testid="stat-tiles">
          <div className="rounded-2xl border border-line bg-surface px-3 py-3">
            <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Today
            </p>
            <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-primary">
              Day off
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-3 py-3">
            <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Next Job
            </p>
            <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-ink">
              {nextUpcoming ? nextJobTile(nextUpcoming) : '—'}
            </p>
          </div>
          {thisWkTile}
        </div>
        {nextUpcoming && (
          <JobCard job={nextUpcoming} now={now} processing={false} onAdvance={() => {}} />
        )}
        <WeekStrip days={jobStrip} />
        <ChangeAvailabilityRow />
        {nextWeekTouched === false && <PlanNextWeekCard />}
      </div>
    );
  }

  // DAY-ONE STATE 2 (availability set, no jobs ever): the zero-free dashboard
  // — replaces "Ready For Work" (James-ruled Today V2).
  if (!loading && dayOne?.state === 2) {
    return (
      <div>
        <HiddenProfileBanner className="mb-4" />
        {dashHeader}
        <OfferAlerts offers={offers} now={now} />
        <div className="mb-4 grid grid-cols-3 gap-2" data-testid="stat-tiles">
          <div className="rounded-2xl border border-line bg-surface px-3 py-3">
            <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Status
            </p>
            <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-primary">
              Ready
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface px-3 py-3">
            <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
              Open This Wk
            </p>
            <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-ink">
              {openWeekHours > 0 ? `${openWeekHours} hrs` : '—'}
            </p>
          </div>
          {profileVisible === false ? (
            <Link
              href="/app/profile"
              onClick={() => haptic('light')}
              className="rounded-2xl border border-line bg-surface px-3 py-3"
              data-testid="profile-tile"
            >
              <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                Profile
              </p>
              <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-danger">
                Hidden
              </p>
            </Link>
          ) : (
            <div
              className="rounded-2xl border border-line bg-surface px-3 py-3"
              data-testid="profile-tile"
            >
              <p className="font-jost text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                Profile
              </p>
              <p className="mt-0.5 font-jost text-lg font-semibold leading-tight text-ink">
                {profileVisible === true ? 'Visible' : '—'}
              </p>
            </div>
          )}
        </div>
        {/* Hero slot: where the first job will land */}
        <div
          className="rounded-2xl border border-line bg-surface p-6 text-center"
          data-testid="first-job-slot"
        >
          <p className="font-jost text-lg font-semibold text-ink">Your First Job Lands Here</p>
          <p className="mt-1 font-jost text-sm text-ink-2">
            Nothing booked yet — offers land here as they come.
          </p>
        </div>
        <WeekStrip days={hourStrip} />
        <ChangeAvailabilityRow />
      </div>
    );
  }

  // Only the loading skeleton remains on this path — every real state above
  // returns its own dashboard (Today V2).
  return (
    <div>
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-line" />
        <div className="h-24 animate-pulse rounded-2xl bg-line" />
        <div className="h-44 animate-pulse rounded-2xl bg-line" />
      </div>
    </div>
  );
}
