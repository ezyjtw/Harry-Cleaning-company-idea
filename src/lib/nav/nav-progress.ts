'use client';

// H41 (reframe — the clicks work, they're sometimes SLOW with no feedback):
// a tiny pub/sub so any NavLink can announce "a navigation started" the moment
// its handler fires, and a single global progress bar can react instantly.
// The bar clears itself on the next route change (see NavProgress).

type Listener = () => void;
const listeners = new Set<Listener>();
let activeToken = 0;

/** Announce a navigation has begun. Returns a token identifying this start. */
export function startNavProgress(): number {
  activeToken += 1;
  listeners.forEach((l) => l());
  return activeToken;
}

export function subscribeNavProgress(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function currentNavToken(): number {
  return activeToken;
}
