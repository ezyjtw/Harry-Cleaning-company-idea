import type { Metadata } from 'next';

// A1-P1: checkout surface — never index. The page itself is a client
// component, so the robots directive lives in this pass-through layout.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
