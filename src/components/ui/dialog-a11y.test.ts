import { describe, expect, it } from 'vitest';

import {
  TABBABLE_SELECTOR,
  createDialogStack,
  filterTabbable,
  nextFocusIndex,
  syncInert,
  type InertTarget,
  type TabbableCandidate,
} from './dialog-a11y';

// B6.2 (RENA-049, RENA-050): the dialog's tabbable query and stack, without a DOM.

function el(
  name: string,
  o: {
    tabIndex?: number;
    attrs?: Record<string, string>;
    boxes?: number;
    inInert?: boolean;
  } = {}
): TabbableCandidate & { name: string } {
  const attrs = o.attrs ?? {};
  return {
    name,
    tabIndex: o.tabIndex ?? 0,
    hasAttribute: (a) => a in attrs,
    getAttribute: (a) => attrs[a] ?? null,
    getClientRects: () => ({ length: o.boxes ?? 1 }),
    closest: () => (o.inInert ? {} : null),
  };
}

describe('filterTabbable', () => {
  it('keeps reachable controls in document order', () => {
    const list = [el('a'), el('b'), el('c')];
    expect(filterTabbable(list).map((x) => x.name)).toEqual(['a', 'b', 'c']);
  });

  it('drops disabled, tabindex -1, hidden inputs, unrendered, inert subtrees and the sentinels', () => {
    const list = [
      el('ok'),
      el('disabled', { attrs: { disabled: '' } }),
      el('minus', { tabIndex: -1 }),
      el('hiddenInput', { attrs: { type: 'hidden' } }),
      el('noBox', { boxes: 0 }),
      el('inert', { inInert: true }),
      el('sentinel', { attrs: { 'data-dialog-sentinel': '' } }),
      el('last'),
    ];
    expect(filterTabbable(list).map((x) => x.name)).toEqual(['ok', 'last']);
  });

  it('the selector covers the focusable element kinds', () => {
    for (const s of ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]', 'summary'])
      expect(TABBABLE_SELECTOR.split(',')).toContain(s);
  });
});

describe('nextFocusIndex', () => {
  it('Tab on the last wraps to the first; Shift+Tab on the first wraps to the last', () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0);
    expect(nextFocusIndex(3, 0, true)).toBe(2);
  });
  it('inside the list the browser moves focus', () => {
    expect(nextFocusIndex(3, 1, false)).toBeNull();
    expect(nextFocusIndex(3, 1, true)).toBeNull();
  });
  it('from the panel itself Tab goes first, Shift+Tab last; nothing tabbable is null', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0);
    expect(nextFocusIndex(3, -1, true)).toBe(2);
    expect(nextFocusIndex(0, -1, false)).toBeNull();
  });
});

describe('createDialogStack', () => {
  it('the newest dialog is the top; closing it hands the top back', () => {
    const s = createDialogStack<string>();
    s.push('info');
    s.push('report');
    expect(s.isTop('report')).toBe(true);
    expect(s.isTop('info')).toBe(false);
    s.remove('report');
    expect(s.isTop('info')).toBe(true);
    expect(s.size).toBe(1);
  });
  it('closing a lower dialog leaves the top in place; a double push is one entry', () => {
    const s = createDialogStack<string>();
    s.push('a');
    s.push('a');
    s.push('b');
    s.remove('a');
    expect(s.top()).toBe('b');
    expect(s.size).toBe(1);
    s.remove('b');
    expect(s.top()).toBeUndefined();
    expect(s.isTop('b')).toBe(false);
  });
});

function node(name: string, inert = false): InertTarget & { name: string; inert: boolean } {
  const n = {
    name,
    inert,
    hasAttribute: (a: string) => a === 'inert' && n.inert,
    setAttribute: (a: string) => {
      if (a === 'inert') n.inert = true;
    },
    removeAttribute: (a: string) => {
      if (a === 'inert') n.inert = false;
    },
  };
  return n;
}

describe('syncInert', () => {
  it('inerts every body child but the top dialog, and lifts only what it set', () => {
    const app = node('app');
    const already = node('already-inert', true);
    const d1 = node('dialog1');
    const owned = new Set<InertTarget>();
    syncInert([app, already, d1], d1, owned);
    expect([app.inert, already.inert, d1.inert]).toEqual([true, true, false]);

    // A nested dialog opens: the first one becomes inert too.
    const d2 = node('dialog2');
    syncInert([app, already, d1, d2], d2, owned);
    expect([app.inert, d1.inert, d2.inert]).toEqual([true, true, false]);

    // It closes (removed from the body): the first is live again.
    syncInert([app, already, d1], d1, owned);
    expect([app.inert, d1.inert]).toEqual([true, false]);

    // The last closes: everything we set is lifted; the element inert for its
    // own reasons stays inert.
    syncInert([app, already], undefined, owned);
    expect([app.inert, already.inert]).toEqual([false, true]);
    expect(owned.size).toBe(0);
  });

  it('lifts inert from an owned element that left the body', () => {
    const gone = node('gone');
    const d = node('dialog');
    const owned = new Set<InertTarget>();
    syncInert([gone, d], d, owned);
    expect(gone.inert).toBe(true);
    syncInert([d], d, owned);
    expect(gone.inert).toBe(false);
  });
});
