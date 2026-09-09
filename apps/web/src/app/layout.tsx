import type { Metadata } from 'next';
import { ThemeRegistry } from '@/components/ThemeRegistry';
import { Providers } from '@/providers/Providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://chiluxe.vn'),
  title: 'Hotel Manager – Hệ thống quản lý đặt phòng',
  description: 'Hệ thống quản lý đặt phòng lưu trú chuyên nghiệp',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Hotel Manager – Hệ thống quản lý đặt phòng',
    description: 'Hệ thống quản lý đặt phòng lưu trú chuyên nghiệp',
    images: ['/opengraph-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeRegistry>
          <Providers>{children}</Providers>
        </ThemeRegistry>
      </body>
    </html>
  );
}
