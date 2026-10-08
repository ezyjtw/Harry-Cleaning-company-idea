import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import {
  decideGetApp,
  isGetAppId,
  platformFromUserAgent,
  storeUrlsFor,
  type GetAppId,
} from '@/lib/get-app';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.renacleaning.co.uk';

// B5 (RENA-043): /get-app/pro and /get-app/customer, the doors both apps use to
// send someone to the other app. A phone goes straight to its platform's live
// listing once that listing is configured; otherwise, and on a computer, this
// page says honestly where the app stands.
const COPY: Record<GetAppId, { name: string; lead: string; who: string }> = {
  pro: {
    name: 'Rena Pro',
    lead: 'Rena Pro is the app for independent cleaners on the Rena Cleaning Network.',
    who: 'Cleaners',
  },
  customer: {
    name: 'RENA',
    lead: 'RENA is the app for booking and managing your cleans with the Rena Cleaning Network.',
    who: 'Customers',
  },
};

export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { app: string } }): Metadata {
  if (!isGetAppId(params.app)) return {};
  const c = COPY[params.app];
  return {
    title: `Get ${c.name} | Rena Cleaning Network`,
    description: `${c.lead} Download it on the App Store or Google Play.`,
    alternates: { canonical: `${BASE_URL}/get-app/${params.app}` },
  };
}

export default function GetAppPage({ params }: { params: { app: string } }) {
  if (!isGetAppId(params.app)) notFound();
  const app = params.app;
  const decision = decideGetApp(
    platformFromUserAgent(headers().get('user-agent')),
    storeUrlsFor(app)
  );
  if (decision.kind === 'redirect') redirect(decision.url);

  const c = COPY[app];
  const { ios, android } = decision.urls;
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:py-20">
        <h1 className="font-newsreader text-4xl font-semibold text-ink">Get {c.name}</h1>
        <p className="mt-4 font-jost font-normal leading-relaxed text-ink-2">{c.lead}</p>
        {ios || android ? (
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {ios && (
              <a
                href={ios}
                className="rounded-full bg-ink px-6 py-3 font-jost text-sm font-medium text-cream"
              >
                Download on the App Store
              </a>
            )}
            {android && (
              <a
                href={android}
                className="rounded-full bg-ink px-6 py-3 font-jost text-sm font-medium text-cream"
              >
                Get it on Google Play
              </a>
            )}
          </div>
        ) : (
          <p className="mt-6 font-jost font-normal leading-relaxed text-ink-2">
            {c.name} is on its way to the App Store and Google Play. {c.who} can use everything it
            offers on this website in the meantime.
          </p>
        )}
        <p className="mt-10 font-jost text-sm font-light text-ink-3">
          <Link href="/" className="underline">
            Go to the Rena Cleaning Network website
          </Link>
        </p>
      </div>
    </div>
  );
}
