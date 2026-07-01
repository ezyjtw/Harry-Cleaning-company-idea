import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { getChartOfAccounts } from '@/lib/services/xero.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/xero/accounts — admin-only. Reads James's EXISTING chart of
// accounts from his Xero org (read-only) for the mapping UI (chunk b). We never
// invent accounts. Auto-refreshes the token if needed (via getChartOfAccounts).
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const accounts = await getChartOfAccounts();
    if (accounts === null) {
      return NextResponse.json({ error: 'Xero is not connected.' }, { status: 409 });
    }
    return NextResponse.json({ accounts });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[xero] getAccounts failed:', err);
    return NextResponse.json({ error: 'Could not read the chart of accounts.' }, { status: 502 });
  }
}
