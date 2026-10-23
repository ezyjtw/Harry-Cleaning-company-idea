import { PAGE_METADATA } from '@/lib/seo/metadata';

// RENA-051 (B6.3): static, regenerated hourly (the page is a client component).
export const revalidate = 3600;

export const metadata = PAGE_METADATA.join;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
