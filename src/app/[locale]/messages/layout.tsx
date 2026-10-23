// RENA-051 (B6.3, James-ruled least-invasive): the locale layout no longer
// forces every page dynamic; this signed-in or request-bound segment keeps
// rendering per request, exactly as before.
export const dynamic = 'force-dynamic';

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto h-[calc(100vh-4rem)] max-w-6xl supports-[height:100dvh]:h-[calc(100dvh-4rem)]">
      {children}
    </div>
  );
}
