'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useEffect,
  useState,
  type ComponentProps,
  type MouseEvent as ReactMouseEvent,
} from 'react';

import { startNavProgress } from '@/lib/nav/nav-progress';
import { recordNav, updateNav } from '@/lib/nav/nav-trace';

// H39: resilient navigation link — the mitigation that ships ahead of the
// root cause. Wraps next/link; on a plain left-click it takes over the push
// and VERIFIES the route actually changed. If nothing moved within 800ms the
// click is not allowed to stay dead: we hard-navigate via window.location.
// Every click also drops a nav-trace fingerprint (see lib/nav/nav-trace.ts).
//
// Interplay with the unsaved-changes guards (profile/availability): those run
// as capture-phase document listeners and stopPropagation() when the user
// cancels — so this handler never fires and no push/fallback happens, which
// is exactly right. The guards log their own consultations to the same trace.

type NavLinkProps = ComponentProps<typeof Link> & {
  /** Which nav surface this link lives on — tags the trace entries. */
  surface: string;
};

const CONFIRM_MS = 500; // spec checkpoint: "did the route change within 500ms?"
const FALLBACK_MS = 800; // hard-navigation deadline

export default function NavLink({
  surface,
  onClick,
  href,
  children,
  className,
  ...rest
}: NavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  // H41: immediate pressed/loading state on the clicked link — set the instant
  // the handler fires, cleared when the route actually changes.
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setPending(false);
  }, [pathname]);

  const handleClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    const target = typeof href === 'string' ? href : (href.pathname ?? '');

    // Modified clicks (new tab etc.) and anything already cancelled upstream:
    // leave the browser/Link default alone, just record that we saw it.
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      recordNav({ kind: 'native', surface, href: target, defaultPrevented: e.defaultPrevented });
      return;
    }

    // Hash/anchor targets scroll in place — no route change to verify, and a
    // hard fallback would fight the scroll. Let Link handle them natively.
    if (target.includes('#')) {
      recordNav({ kind: 'hash', surface, href: target });
      return;
    }

    e.preventDefault();
    // H41: instant feedback — the top progress bar and this link's pressed
    // state both fire before the (possibly slow) route resolves.
    setPending(true);
    startNavProgress();
    const from = window.location.pathname + window.location.search;
    const id = recordNav({ kind: 'push', surface, href: target, from, handlerFired: true });

    let pushError: string | null = null;
    try {
      router.push(target);
    } catch (err) {
      pushError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
    updateNav(id, { pushCalled: pushError === null, pushError });

    const arrived = () => {
      const now = window.location.pathname + window.location.search;
      // Arrived if the URL moved at all, or already shows the target (with or
      // without a locale prefix — '/en/cleaner' ends with '/cleaner').
      return now !== from || now === target || (target !== '/' && now.endsWith(target));
    };

    window.setTimeout(() => {
      updateNav(id, { changedWithin500ms: arrived() });
    }, CONFIRM_MS);

    window.setTimeout(() => {
      if (arrived()) {
        updateNav(id, { outcome: 'routed' });
        return;
      }
      updateNav(id, { outcome: 'fallback-hard-nav', elapsedMs: FALLBACK_MS });
      window.location.href = target;
    }, FALLBACK_MS);
  };

  return (
    <Link
      href={href}
      {...rest}
      className={className}
      onClick={handleClick}
      aria-busy={pending || undefined}
      data-nav-pending={pending || undefined}
      style={pending ? { opacity: 0.6, ...(rest.style ?? {}) } : rest.style}
    >
      {children}
    </Link>
  );
}
