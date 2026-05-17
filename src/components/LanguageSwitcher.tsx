'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useTransition } from 'react';

import type { Locale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  pl: 'PL',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(newLocale: Locale) {
    if (newLocale === locale) return;

    const strippedPath = pathname.replace(/^\/(en|pl)/, '') || '/';
    const newPath =
      newLocale === routing.defaultLocale ? strippedPath : `/${newLocale}${strippedPath}`;

    startTransition(() => {
      router.push(newPath);
    });
  }

  return (
    <div className={`flex items-center gap-1 ${isPending ? 'opacity-50' : ''}`}>
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={`rounded px-2 py-1 font-jost text-[12px] font-medium transition-colors ${
            locale === l ? 'bg-ink text-cream' : 'text-ink-2 hover:bg-cream hover:text-ink'
          }`}
          disabled={isPending}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
