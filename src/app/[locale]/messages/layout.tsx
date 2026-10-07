export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto h-[calc(100vh-4rem)] max-w-6xl supports-[height:100dvh]:h-[calc(100dvh-4rem)]">
      {children}
    </div>
  );
}
