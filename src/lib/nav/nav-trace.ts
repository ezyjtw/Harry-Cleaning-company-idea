'use client';

// H39 diagnostic trap (TEMPORARY — remove once the dead-click root cause is
// confirmed and fixed). Every navigation surface records each click here: to
// the console (prefix [RENA-NAV]) and to a localStorage ring buffer, so an
// intermittent dead click leaves a fingerprint that can be pasted after the
// fact. Run __renaNavDump() in the browser console to get the full buffer as
// a JSON string ready to paste.

export interface NavTraceEntry {
  id: string;
  t: string; // ISO timestamp
  [key: string]: unknown;
}

const KEY = 'rena-nav-trace';
const CAP = 60;
let seq = 0;

// Module-level view of the most recent push that has not yet resolved (routed
// or fallen back). If a click lands while this is set, the entry records it —
// that is the direct fingerprint for the "hanging in-flight transition
// blocks subsequent pushes" theory.
let activePush: { id: string; target: string; startedAt: number } | null = null;

function readAll(): NavTraceEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function writeAll(list: NavTraceEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-CAP)));
  } catch {
    /* storage unavailable — console logging still works */
  }
}

export function recordNav(fields: Record<string, unknown>): string {
  const id = `${Date.now()}-${++seq}`;
  const entry: NavTraceEntry = { id, t: new Date().toISOString(), ...fields };
  if (fields.kind === 'push') {
    entry.blockedByInflight = activePush
      ? { ...activePush, ageMs: Date.now() - activePush.startedAt }
      : null;
    activePush = { id, target: String(fields.href || ''), startedAt: Date.now() };
  }
  // eslint-disable-next-line no-console
  console.info('[RENA-NAV]', entry);
  writeAll([...readAll(), entry]);
  return id;
}

export function updateNav(id: string, patch: Record<string, unknown>) {
  const list = readAll();
  const entry = list.find((e) => e.id === id);
  if (entry) {
    Object.assign(entry, patch);
    writeAll(list);
  }
  // eslint-disable-next-line no-console
  console.info('[RENA-NAV]', { id, ...patch });
  if (activePush?.id === id && patch.outcome) activePush = null;
}

declare global {
  interface Window {
    __renaNavDump?: () => string;
  }
}

if (typeof window !== 'undefined') {
  window.__renaNavDump = () => {
    const dump = JSON.stringify(readAll(), null, 1);
    // eslint-disable-next-line no-console
    console.info(dump);
    return dump;
  };
}
