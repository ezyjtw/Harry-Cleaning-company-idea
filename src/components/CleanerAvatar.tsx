'use client';

import { useState } from 'react';

/**
 * Shared cleaner avatar. Renders the photo cropped with object-cover; on a load
 * error (or missing photo) it falls back to a serif initial on primary-soft.
 * alt="" so a broken image never spills alt text over the card. `size` is px.
 */
export default function CleanerAvatar({
  photo,
  name,
  size,
  className,
}: {
  photo?: string | null;
  name: string;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ring = className ?? '';

  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        onError={() => setFailed(true)}
        className={`rounded-full object-cover ${ring}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full bg-primary-soft font-newsreader font-medium text-primary ${ring}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {name.charAt(0)}
    </div>
  );
}
