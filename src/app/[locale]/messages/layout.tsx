export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto h-[calc(100vh-4rem)] max-w-6xl">{children}</div>;
}
