'use client';
import { Box, Toolbar, CircularProgress } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import Sidebar, { SIDEBAR_WIDTH } from './Sidebar';
import Topbar from './Topbar';

function resolveTitle(pathname: string) {
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/timeline')) return 'Timeline';
  if (pathname.startsWith('/bookings')) return 'Đặt phòng';
  if (pathname.startsWith('/guests')) return 'Khách hàng';
  if (pathname.startsWith('/rooms')) return 'Phòng / Căn hộ';
  if (pathname.startsWith('/buildings')) return 'Toà nhà';
  if (pathname.startsWith('/room-types')) return 'Loại phòng';
  if (pathname.startsWith('/users')) return 'Người dùng';
  if (pathname.startsWith('/settings')) return 'Cài đặt';
  return '';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const title = resolveTitle(pathname);
  const useDesktopSidebar = false;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user, router]);

  useEffect(() => {
    if (useDesktopSidebar) setMobileOpen(false);
  }, [useDesktopSidebar]);

  if (!hydrated || !user) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'background.default' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', backgroundColor: 'transparent' }}>
      <Sidebar isDesktop={useDesktopSidebar} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          width: { xs: '100%', lg: useDesktopSidebar ? `calc(100% - ${SIDEBAR_WIDTH}px)` : '100%' },
        }}
      >
        <>
          <Topbar title={title} isDesktop={useDesktopSidebar} onMenuClick={() => setMobileOpen(true)} />
          <Toolbar sx={{ minHeight: { xs: '84px !important', md: '96px !important' } }} />
        </>
        <Box sx={{ flex: 1, minHeight: 0, height: 'auto', overflow: 'auto', px: { xs: 0, md: 2 }, pb: { xs: 0, md: 2 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
