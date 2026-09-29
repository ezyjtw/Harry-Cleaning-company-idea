'use client';

import NotificationPreferencesPanel from '@/components/account/NotificationPreferencesPanel';
import { CustomerBackLink, useCustomerShell } from '@/components/app/customer';

// A11b: customer notification preferences. Lives under the account layout (its
// nav re-adds the entry the messaging sweep removed). In-shell (R4 lane 1) it
// carries the standing back link + its own title — the account chrome that
// would otherwise name and exit this room is hidden there.
export default function AccountNotificationsPage() {
  const inShell = useCustomerShell();
  return (
    <div className={inShell ? 'space-y-4' : undefined}>
      {inShell && (
        <div>
          <CustomerBackLink />
          <h1 className="mt-2 font-jost text-[26px] font-semibold leading-tight text-ink">
            Notifications
          </h1>
        </div>
      )}
      <NotificationPreferencesPanel />
    </div>
  );
}
