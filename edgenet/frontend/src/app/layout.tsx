import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = { title: 'EdgeNet PoC Request Portal' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
