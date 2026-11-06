'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import {
  TABBABLE_SELECTOR,
  createDialogStack,
  filterTabbable,
  nextFocusIndex,
  syncInert,
} from './dialog-a11y';

// B6.2 (RENA-049, RENA-050, James-ruled 2026-10-07): the one accessible
// dialog. Portals into its own container under document.body; while open,
// every other body child is inert (the portal's actual siblings, never an
// assumed #__next), focus is trapped, the body does not scroll, and on close
// focus returns to the opener. Nested dialogs stack: the top owns the trap,
// Escape and the backdrop.

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Id of the visible title; else `label` names the dialog. */
  labelledBy?: string;
  label?: string;
  describedBy?: string;
  /** Escape and backdrop close it. False for a required choice. */
  dismissible?: boolean;
  variant?: 'center' | 'sheet';
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Where focus goes when the opener has left the document. */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** The surface's own overlay and panel classes, replacing the variant's. */
  overlayClassName?: string;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  panelTestId?: string;
  children: ReactNode;
}

const VARIANT = {
  center: {
    overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4',
    panel: 'w-full max-w-md rounded-xl bg-surface p-6 shadow-xl animate-fade-in',
  },
  sheet: {
    overlay: 'fixed inset-0 z-[60] flex items-end justify-center bg-ink/40',
    panel: 'w-full max-w-md rounded-t-2xl bg-surface p-5 pb-8 animate-slide-up',
  },
} as const;

const stack = createDialogStack<HTMLElement>();
const inerted = new Set<Element>();
let scrollLocks = 0;
let savedOverflow = '';

let bodyObserver: MutationObserver | null = null;

// A body child added while a dialog is open (a late portal, Next's route
// announcer) is made inert too: the observer re-syncs on every addition and
// lives only while the stack is non-empty.
function syncBody() {
  syncInert(Array.from(document.body.children), stack.top(), inerted);
  if (stack.size > 0 && !bodyObserver && typeof MutationObserver !== 'undefined') {
    bodyObserver = new MutationObserver(() =>
      syncInert(Array.from(document.body.children), stack.top(), inerted)
    );
    bodyObserver.observe(document.body, { childList: true });
  } else if (stack.size === 0 && bodyObserver) {
    bodyObserver.disconnect();
    bodyObserver = null;
  }
}

function tabbables(root: HTMLElement): HTMLElement[] {
  return filterTabbable(Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)));
}

export default function Dialog({
  open,
  onClose,
  labelledBy,
  label,
  describedBy,
  dismissible = true,
  variant = 'center',
  initialFocusRef,
  returnFocusTo,
  overlayClassName,
  className,
  style,
  testId,
  panelTestId,
  children,
}: DialogProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // The container exists only while open, so a closed dialog leaves the
  // document untouched (and nothing renders on the server).
  useLayoutEffect(() => {
    if (!open) return;
    // Recorded before the content mounts, so an autofocused field inside the
    // dialog is never mistaken for the opener.
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = document.createElement('div');
    el.setAttribute('data-rena-dialog', '');
    document.body.appendChild(el);
    setContainer(el);
    return () => {
      el.remove();
      setContainer(null);
    };
  }, [open]);

  // Stack, inert siblings, scroll lock, focus in and focus back.
  useEffect(() => {
    if (!open || !container) return;
    const opener = openerRef.current;
    const fallback = returnFocusTo;
    stack.push(container);
    syncBody();
    if (scrollLocks === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;

    const panel = panelRef.current;
    // An autofocused field inside keeps its focus; otherwise the initial
    // target, the first tabbable, or the panel itself.
    if (!panel || !panel.contains(document.activeElement)) {
      const target =
        initialFocusRef?.current ?? (panel ? tabbables(panel)[0] : undefined) ?? panel ?? undefined;
      target?.focus();
    }

    return () => {
      stack.remove(container);
      syncBody();
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
      // Only when focus was left with the dialog (it is on the body now): a
      // close that moved focus elsewhere on purpose keeps it there.
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected) return;
      const back = opener && opener.isConnected ? opener : (fallback?.current ?? null);
      back?.focus();
    };
    // Focus targets are read once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, container]);

  useEffect(() => {
    if (!open || !container) return;
    const onKey = (e: KeyboardEvent) => {
      if (!stack.isTop(container)) return;
      if (e.key === 'Escape') {
        if (!dismissible) return;
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const list = tabbables(panel);
      if (list.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const i = list.indexOf(document.activeElement as HTMLElement);
      const next = nextFocusIndex(list.length, i, e.shiftKey);
      if (next !== null) {
        e.preventDefault();
        list[next].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, container, dismissible]);

  // A focus that slips past either end (the sentinels) wraps round.
  const wrapTo = useCallback((end: 'first' | 'last') => {
    const panel = panelRef.current;
    if (!panel) return;
    const list = tabbables(panel);
    const el = end === 'first' ? list[0] : list[list.length - 1];
    (el ?? panel).focus();
  }, []);

  if (!open || !container) return null;

  return createPortal(
    <div
      className={overlayClassName ?? VARIANT[variant].overlay}
      data-testid={testId}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const fromBackdrop = downOnBackdrop.current && e.target === e.currentTarget;
        downOnBackdrop.current = false;
        if (fromBackdrop && dismissible && stack.isTop(container)) onCloseRef.current();
      }}
    >
      <span tabIndex={0} data-dialog-sentinel="" onFocus={() => wrapTo('last')} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-describedby={describedBy}
        tabIndex={-1}
        data-testid={panelTestId}
        style={style}
        className={`${className ?? VARIANT[variant].panel} outline-none`}
      >
        {children}
      </div>
      <span tabIndex={0} data-dialog-sentinel="" onFocus={() => wrapTo('first')} />
    </div>,
    container
  );
}
