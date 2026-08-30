'use client';

import NextLink from 'next/link';
import {
  AppBar, Toolbar, Typography, IconButton, Box, Avatar, Chip, Tooltip, Stack,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { SIDEBAR_WIDTH } from './Sidebar';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppThemeProvider';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', USER: 'User' };
const ROLE_COLOR: Record<string, string> = { ADMIN: '#E4BE78', USER: '#9CB5E3' };

interface TopbarProps {
  title?: string;
  isDesktop?: boolean;
  onMenuClick?: () => void;
}

export default function Topbar({ title, isDesktop = true, onMenuClick }: TopbarProps) {
  const { user } = useAuth();
  const { appearance } = useAppearance();
  const now = new Date();
  const dateStr = now.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const initial = user?.fullName?.charAt(0)?.toUpperCase() ?? 'U';
  const roleKey = user?.role ?? 'USER';

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { xs: '100%', lg: isDesktop ? `calc(100% - ${SIDEBAR_WIDTH}px)` : '100%' },
        ml: { xs: 0, lg: isDesktop ? `${SIDEBAR_WIDTH}px` : 0 },
        backgroundColor: 'transparent',
      }}
    >
      <Toolbar sx={{ gap: { xs: 1, md: 2 }, minHeight: { xs: '68px !important', md: '76px !important' }, px: { xs: 1.5, md: 2.5 } }}>
        <Box sx={{ width: '100%', px: { xs: 0.5, md: 1 }, py: 1.25, borderRadius: '22px', border: '1px solid var(--border-soft)', background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))', boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)', display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
          {onMenuClick && (
            <IconButton edge="start" onClick={onMenuClick} aria-label="Mở menu điều hướng">
              <MenuIcon />
            </IconButton>
          )}

          <Box component={NextLink} href="/dashboard" sx={{ flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
            {title && <Typography variant="h6" fontWeight={800} noWrap>{title}</Typography>}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }} noWrap>{dateStr}</Typography>
          </Box>

          <Tooltip title="Thông báo">
            <IconButton size="small">
              <NotificationsNoneIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Box component={NextLink} href="/dashboard" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
            <Stack sx={{ display: { xs: 'none', sm: 'flex' }, minWidth: 0 }} alignItems="flex-end">
              <Typography variant="body2" fontWeight={700} noWrap>{user?.fullName ?? 'Đang tải...'}</Typography>
              <Chip label={ROLE_LABEL[roleKey] ?? roleKey} size="small" sx={{ height: 20, fontSize: '0.66rem', fontWeight: 800, bgcolor: `${ROLE_COLOR[roleKey] ?? '#9CB5E3'}22`, color: ROLE_COLOR[roleKey] ?? '#9CB5E3' }} />
            </Stack>
            <Avatar src={roleKey === 'ADMIN' ? (appearance.admin_avatar_url || undefined) : undefined} sx={{ width: 38, height: 38, background: 'linear-gradient(135deg, var(--accent-primary), rgba(255,255,255,0.8))', color: '#fff', fontSize: 14, fontWeight: 800, boxShadow: 'var(--shadow-soft)' }}>
              {initial}
            </Avatar>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
