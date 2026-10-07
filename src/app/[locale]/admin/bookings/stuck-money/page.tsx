import Link from 'next/link';

import { getAdminSession } from '@/lib/auth/session';
import { listAbnormalStates } from '@/lib/money/abnormal-states';

import StuckMoneyClient from './StuckMoneyClient';

export const dynamic = 'force-dynamic';

// B4 (RENA-015): the page is the abnormal-states module rendered; every row
// carries its state, age and actions (src/lib/money/abnormal-states.ts).
export default async function StuckMoneyPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div className="p-8 text-center text-danger">
        Admin access required.{' '}
        <Link href="/login" className="underline">
          Login
        </Link>
      </div>
    );
  }

  const rows = await listAbnormalStates();
  return <StuckMoneyClient rows={rows} />;
}
