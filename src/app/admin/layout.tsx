import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — Sejati Mock Server',
  description: 'Admin panel untuk mengelola dummy API endpoint dan monitoring hit logs',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
