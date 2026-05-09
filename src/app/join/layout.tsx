import { PAGE_METADATA } from '@/lib/seo/metadata';

export const metadata = PAGE_METADATA.join;

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
