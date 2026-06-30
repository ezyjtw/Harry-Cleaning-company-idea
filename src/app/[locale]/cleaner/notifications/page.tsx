import NotificationPreferencesPanel from '@/components/account/NotificationPreferencesPanel';

// A11b: cleaner notification preferences. Same per-user panel + API as the
// customer page, rendered inside the cleaner portal layout.
export default function CleanerNotificationsPage() {
  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <NotificationPreferencesPanel />
    </div>
  );
}
