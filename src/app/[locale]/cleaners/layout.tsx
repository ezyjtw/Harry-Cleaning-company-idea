import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata = PAGE_METADATA.cleaners;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
