import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sejati Mock Server',
  description: 'Dummy API server untuk debugging Sejati AI chatbot tool-calling',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: 0, background: '#080c14' }}>{children}</body>
    </html>
  );
}
