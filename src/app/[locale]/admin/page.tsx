import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface RecentBooking {
  id: string;
  customer: string;
  cleaner: string;
  service: string;
  date: string;
  amount: number;
  status: string;
}

interface RecentSignup {
  id: string;
  name: string;
  type: 'customer' | 'cleaner';
  email: string;
  date: string;
}

interface OpenCardDispute {
  disputeId: string;
  bookingRef: string;
  amount: string;
  dueBy: string | null;
}

// B1.3 dispute early-warning banner. Source of truth is the stored webhook
// events (every verified event is persisted on receipt): a dispute is OPEN
// when its charge.dispute.created event has no matching charge.dispute.closed.
// Clearing therefore relies on charge.dispute.closed being enabled on the
// platform webhook destination alongside .created. Alerting only — no money.
async function getOpenCardDisputes(): Promise<OpenCardDispute[]> {
  const [created, closed] = await Promise.all([
    prisma.stripeWebhookEvent.findMany({
      where: { type: 'charge.dispute.created' },
      orderBy: { processedAt: 'desc' },
      take: 20,
      select: { payload: true },
    }),
    prisma.stripeWebhookEvent.findMany({
      where: { type: 'charge.dispute.closed' },
      select: { payload: true },
    }),
  ]);
  const disputeOf = (payload: unknown) =>
    (payload as { data?: { object?: Record<string, unknown> } })?.data?.object ?? {};
  const closedIds = new Set(closed.map((e) => String(disputeOf(e.payload).id ?? '')));
  const open = created
    .map((e) => disputeOf(e.payload))
    .filter((d) => d.id && !closedIds.has(String(d.id)));

  return Promise.all(
    open.map(async (d) => {
      const chargeId =
        typeof d.charge === 'string' ? d.charge : ((d.charge as { id?: string })?.id ?? null);
      const booking = chargeId
        ? await prisma.booking.findUnique({ where: { stripeChargeId: chargeId } }).catch(() => null)
        : null;
      const dueBySecs = (d.evidence_details as { due_by?: number } | undefined)?.due_by;
      return {
        disputeId: String(d.id),
        bookingRef: booking ? booking.id.substring(0, 8).toUpperCase() : (chargeId ?? 'unknown'),
        amount: `£${(Number(d.amount ?? 0) / 100).toFixed(2)}`,
        dueBy: dueBySecs
          ? new Date(dueBySecs * 1000).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })
          : null,
      };
    })
  );
}

async function getAdminMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);

  const [
    totalBookings,
    lastMonthBookings,
    activeCleaners,
    lastWeekCleaners,
    revenueThisMonth,
    revenueLastMonth,
    pendingDisputes,
  ] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.booking.count({
      where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),
    prisma.user.count({
      where: { role: 'CLEANER', accountStatus: 'ACTIVE', isSuspended: false },
    }),
    prisma.user.count({
      where: {
        role: 'CLEANER',
        accountStatus: 'ACTIVE',
        isSuspended: false,
        createdAt: { gte: startOfWeek },
      },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.dispute.count({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    }),
  ]);

  const revMTD = Number(revenueThisMonth._sum.amount || 0);
  const revLastMonth = Number(revenueLastMonth._sum.amount || 0);
  const bookingChange =
    lastMonthBookings > 0
      ? (((totalBookings - lastMonthBookings) / lastMonthBookings) * 100).toFixed(1)
      : '0';
  const revenueChange =
    revLastMonth > 0 ? (((revMTD - revLastMonth) / revLastMonth) * 100).toFixed(1) : '0';

  return [
    {
      label: 'Total Bookings',
      value: totalBookings.toLocaleString(),
      change: `${Number(bookingChange) >= 0 ? '+' : ''}${bookingChange}% from last month`,
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'blue',
    },
    {
      label: 'Active Cleaners',
      value: activeCleaners.toString(),
      change: `+${lastWeekCleaners} this week`,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'green',
    },
    {
      label: 'Revenue (MTD)',
      value: `£${revMTD.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`,
      change: `${Number(revenueChange) >= 0 ? '+' : ''}${revenueChange}% from last month`,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'purple',
    },
    {
      label: 'Pending Disputes',
      value: pendingDisputes.toString(),
      change: `${pendingDisputes > 0 ? `${pendingDisputes} need attention` : 'All clear'}`,
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      color: 'red',
    },
  ];
}

async function getRecentBookings(): Promise<RecentBooking[]> {
  const bookings = await prisma.booking.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { name: true } },
      cleaner: { select: { name: true } },
    },
  });
  return bookings.map((b) => ({
    id: b.id.substring(0, 8).toUpperCase(),
    customer: b.client?.name || b.guestName || 'Guest',
    cleaner: b.cleaner.name || 'Unassigned',
    service: b.serviceType,
    date: b.date.toISOString().split('T')[0],
    amount: Number(b.totalPrice),
    status: b.status.toLowerCase().replace('_', '-'),
  }));
}

async function getRecentSignups(): Promise<RecentSignup[]> {
  const users = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    where: { role: { in: ['CLIENT', 'CLEANER'] } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return users.map((u) => ({
    id: u.id.substring(0, 8),
    name: u.name || 'Unknown',
    type: u.role === 'CLEANER' ? ('cleaner' as const) : ('customer' as const),
    email: u.email || '',
    date: u.createdAt.toISOString().split('T')[0],
  }));
}

async function getRevenueLastWeek(): Promise<number[]> {
  const now = new Date();
  const days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const result = await prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', createdAt: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    });
    days.push(Number(result._sum.amount || 0));
  }
  return days;
}

export default async function AdminDashboard() {
  const [metrics, recentBookings, recentSignups, revenueWeek, openCardDisputes] = await Promise.all(
    [
      getAdminMetrics(),
      getRecentBookings(),
      getRecentSignups(),
      getRevenueLastWeek(),
      getOpenCardDisputes().catch(() => []),
    ]
  );

  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    blue: { bg: 'bg-primary-soft', text: 'text-primary', icon: 'text-primary' },
    green: { bg: 'bg-trust/10', text: 'text-trust', icon: 'text-trust' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600' },
    red: { bg: 'bg-danger/10', text: 'text-danger', icon: 'text-danger' },
  };

  const statusStyles: Record<string, string> = {
    confirmed: 'bg-primary-soft text-primary',
    'in-progress': 'bg-orange-100 text-orange-700',
    completed: 'bg-trust/10 text-trust',
    cancelled: 'bg-danger/10 text-danger',
    pending: 'bg-warning/10 text-warning',
  };

  // Compute revenue MTD from the metrics (it's in the Revenue card value)
  const revenueMTDCard = metrics.find((m) => m.label === 'Revenue (MTD)');
  const revenueMTDDisplay = revenueMTDCard?.value || '£0';

  // Normalize revenue week data to percentages for bar heights
  const maxRevenue = Math.max(...revenueWeek, 1);
  const revenueBarHeights = revenueWeek.map((v) => Math.max(Math.round((v / maxRevenue) * 100), 5));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Admin Dashboard</h1>
        <p className="text-ink-3 mt-1">Platform overview and key metrics</p>
        <div className="mt-2 flex gap-3">
          <a
            href="/admin/analytics"
            className="inline-block rounded bg-ink px-4 py-2 font-jost text-sm text-white hover:bg-ink/90"
          >
            Funnel Analytics
          </a>
          <a
            href="/admin/dpia"
            className="inline-block rounded border border-ink/20 px-4 py-2 font-jost text-sm text-ink hover:bg-page"
          >
            DPIA
          </a>
        </div>
      </div>

      {/* B1.3: open card-dispute banner — unmissable, above everything else. */}
      {openCardDisputes.length > 0 && (
        <div className="mb-6 rounded-xl border border-danger/40 bg-danger/10 p-4">
          <p className="font-jost text-sm font-semibold text-danger">
            ⚠ {openCardDisputes.length} open card dispute
            {openCardDisputes.length > 1 ? 's' : ''} — evidence deadlines apply
          </p>
          <ul className="mt-2 space-y-1">
            {openCardDisputes.map((d) => (
              <li key={d.disputeId} className="font-jost text-sm text-ink">
                Dispute opened on booking <strong>{d.bookingRef}</strong> ({d.amount})
                {d.dueBy ? (
                  <>
                    {' '}
                    — respond by <strong>{d.dueBy}</strong>
                  </>
                ) : (
                  <> — deadline unknown, check Stripe</>
                )}
              </li>
            ))}
          </ul>
          <a
            href="https://dashboard.stripe.com/disputes"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-jost text-sm font-medium text-danger underline"
          >
            Respond in the Stripe dashboard
          </a>
        </div>
      )}

      {/* Metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((metric) => {
          const colors = colorMap[metric.color];
          return (
            <div
              key={metric.label}
              className={`rounded-xl border p-5 ${colors.bg} border-transparent`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${colors.text} opacity-80`}>{metric.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${colors.text}`}>{metric.value}</p>
                  <p className={`text-xs mt-2 ${colors.text} opacity-60`}>{metric.change}</p>
                </div>
                <svg
                  className={`w-8 h-8 ${colors.icon} opacity-50`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d={metric.icon}
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent bookings table */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Recent Bookings</h2>
            <a
              href="/admin/bookings"
              className="text-sm text-primary hover:text-primary font-medium"
            >
              View All
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                    Booking
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider hidden sm:table-cell">
                    Service
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-ink-3 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-page transition-colors">
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-ink">{booking.customer}</p>
                      <p className="text-xs text-ink-3">
                        {booking.id} &middot; {booking.date}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-sm text-ink-2 hidden sm:table-cell">
                      {booking.service}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-ink">£{booking.amount}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[booking.status] || ''}`}
                      >
                        {booking.status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Revenue chart */}
          <div className="bg-surface rounded-xl border border-line p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Revenue (Last 7 Days)</h2>
            <div className="h-40 flex items-end gap-2">
              {revenueBarHeights.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-purple-500 rounded-t-md"
                    style={{ height: `${h}%`, minHeight: '8px' }}
                  />
                  <span className="text-xs text-ink-3">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-line text-center">
              <p className="text-2xl font-bold text-ink">{revenueMTDDisplay}</p>
              <p className="text-sm text-ink-3">Month to date</p>
            </div>
          </div>

          {/* Recent signups */}
          <div className="bg-surface rounded-xl border border-line overflow-hidden">
            <div className="px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-ink">Recent Signups</h2>
            </div>
            <div className="divide-y divide-line">
              {recentSignups.map((signup) => (
                <div key={signup.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{signup.name}</p>
                    <p className="text-xs text-ink-3">{signup.email}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        signup.type === 'cleaner'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-primary-soft text-primary'
                      }`}
                    >
                      {signup.type === 'cleaner' ? 'Cleaner' : 'Customer'}
                    </span>
                    <p className="text-xs text-ink-3 mt-0.5">{signup.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
