// B6.2 (RENA-049, RENA-050): the dialog primitive's pure parts, kept free of
// React so they unit test without a DOM: the tabbable query and the stack.

/** Elements that can take keyboard focus, before the visibility filter. */
export const TABBABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',');

/** The slice of an Element the tabbable filter reads. */
export interface TabbableCandidate {
  tabIndex: number;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  getClientRects(): { length: number };
  closest(selector: string): unknown;
}

/**
 * Keep the candidates Tab can reach: not disabled, not a hidden input, not
 * tabindex -1, rendered (has a box), and not inside an inert, hidden or
 * closed subtree. The sentinels carry data-dialog-sentinel and are skipped.
 */
export function filterTabbable<T extends TabbableCandidate>(candidates: readonly T[]): T[] {
  return candidates.filter((el) => {
    if (el.tabIndex < 0) return false;
    if (el.hasAttribute('disabled')) return false;
    if (el.hasAttribute('data-dialog-sentinel')) return false;
    if (el.getAttribute('type') === 'hidden') return false;
    if (el.getClientRects().length === 0) return false;
    if (el.closest('[inert],[hidden],details:not([open]) > :not(summary)')) return false;
    return true;
  });
}

/**
 * Where Tab or Shift+Tab goes from `active`, or null to let the browser move
 * within the dialog. Wraps at both ends; an active element outside the list
 * (the panel itself) goes to the first, or the last on Shift+Tab.
 */
export function nextFocusIndex(count: number, activeIndex: number, shift: boolean): number | null {
  if (count === 0) return null;
  if (activeIndex < 0) return shift ? count - 1 : 0;
  if (shift && activeIndex === 0) return count - 1;
  if (!shift && activeIndex === count - 1) return 0;
  return null;
}

/**
 * The open dialogs, oldest first. The top one owns the focus trap, Escape and
 * the backdrop; closing it hands them back to the one below. Each entry is the
 * dialog's own portal container, a direct child of document.body.
 */
export function createDialogStack<C>() {
  const stack: C[] = [];
  return {
    push(c: C) {
      if (!stack.includes(c)) stack.push(c);
    },
    remove(c: C) {
      const i = stack.indexOf(c);
      if (i >= 0) stack.splice(i, 1);
    },
    top(): C | undefined {
      return stack[stack.length - 1];
    },
    isTop(c: C) {
      return stack.length > 0 && stack[stack.length - 1] === c;
    },
    get size() {
      return stack.length;
    },
  };
}

/** The slice of a body child the inert sync touches. */
export interface InertTarget {
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Make every body child except the top dialog's container inert, and lift
 * inert from anything this primitive set it on that should no longer have it.
 * `owned` records what we set, so an element inert for its own reasons is
 * never touched. With no top (the stack is empty) everything we set is lifted.
 */
export function syncInert<T extends InertTarget>(
  bodyChildren: readonly T[],
  top: T | undefined,
  owned: Set<T>
): void {
  for (const el of bodyChildren) {
    if (top !== undefined && el !== top) {
      if (!el.hasAttribute('inert')) {
        el.setAttribute('inert', '');
        owned.add(el);
      }
    } else if (owned.has(el)) {
      el.removeAttribute('inert');
      owned.delete(el);
    }
  }
  // Anything we inerted that has since left the body.
  for (const el of Array.from(owned)) {
    if (!bodyChildren.includes(el)) {
      el.removeAttribute('inert');
      owned.delete(el);
    }
  }
}
