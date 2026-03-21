import type { Metadata } from 'next';
import '@/styles/globals.css';

const pwaDisabled = process.env.NEXT_PUBLIC_DISABLE_PWA === 'true';

export const metadata: Metadata = {
  title: 'Order Ahead Platform',
  description: 'Technical foundation for a transactional order-ahead platform.',
  applicationName: 'Order Ahead',
  ...(pwaDisabled ? {} : { manifest: '/manifest.json' }),
};

type RootLayoutProps = Readonly<{ children: React.ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
