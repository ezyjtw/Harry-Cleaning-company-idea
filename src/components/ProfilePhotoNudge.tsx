'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// H98 (Harry-ruled): photo-less LIVE cleaners get a friendly dashboard nudge —
// never a go-live block. Customers choose cleaners by the human they see, so
// the card sells the upside and links straight to the photo upload. Renders
// nothing while loading, when a photo exists, or on a fetch hiccup, and
// disappears for good the moment a photo is set.
export default function ProfilePhotoNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!cancelled && u && u.role === 'CLEANER' && !u.image) setShow(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-primary/20 bg-primary-soft/50 px-4 py-3">
      <p className="font-jost text-sm text-ink">
        <span className="font-medium">Add a profile photo</span> — cleaners with photos get chosen
        far more often. It takes a minute.
      </p>
      <Link
        href="/cleaner/profile"
        className="rounded-[8px] bg-primary px-3 py-1.5 font-jost text-sm text-white transition hover:bg-primary-hover"
      >
        Add photo
      </Link>
    </div>
  );
}
