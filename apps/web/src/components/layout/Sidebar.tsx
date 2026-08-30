'use client';

import { usePathname } from 'next/navigation';
import NextLink from 'next/link';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Chip, Avatar,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import HotelIcon from '@mui/icons-material/Hotel';
import PeopleIcon from '@mui/icons-material/People';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import SettingsIcon from '@mui/icons-material/Settings';
import CategoryIcon from '@mui/icons-material/Category';
import ApartmentIcon from '@mui/icons-material/Apartment';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '@/providers/AuthProvider';
import { useAppearance } from '@/providers/AppThemeProvider';

export const SIDEBAR_WIDTH = 288;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  USER: 'User',
};
const ROLE_COLOR: Record<string, string> = {
  ADMIN: '#E4BE78',
  USER: '#86A9D6',
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isDesktop?: boolean;
}

export default function Sidebar({ mobileOpen = false, onMobileClose, isDesktop = true }: SidebarProps) {
  const pathname = usePathname();
  const { user, canManageSystem, canManageAssets, hydrated } = useAuth();
  const { appearance } = useAppearance();

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hotel_token');
      localStorage.removeItem('hotel_user');
      window.location.href = '/login';
    }
  };

  const role = user?.role === 'ADMIN' ? 'ADMIN' : 'USER';
  const showAdminSections = hydrated && canManageSystem;
  const showAssetSections = hydrated && canManageAssets;

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--bg-primary)', backgroundImage: 'none', opacity: 1 }}>
      <Box
        component={NextLink}
        href="/dashboard"
        onClick={onMobileClose}
        sx={{ px: { xs: 2.5, md: 3 }, py: 3, display: 'flex', alignItems: 'center', gap: 1.75, textDecoration: 'none', color: 'inherit' }}
      >
        {appearance.system_logo_url ? (
          <Avatar src={appearance.system_logo_url} alt={appearance.app_display_name} sx={{ width: 48, height: 48, borderRadius: '18px', boxShadow: 'var(--shadow-soft)', flexShrink: 0 }} />
        ) : (
          <Box sx={{ width: 48, height: 48, borderRadius: '18px', background: 'linear-gradient(135deg, var(--accent-primary), rgba(255,255,255,0.76))', boxShadow: 'var(--shadow-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ApartmentIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} lineHeight={1.15} noWrap>{appearance.app_display_name}</Typography>
        </Box>
      </Box>

      <Divider />

      {user && (
        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar src={role === 'ADMIN' ? (appearance.admin_avatar_url || undefined) : undefined} sx={{ width: 40, height: 40, bgcolor: ROLE_COLOR[role], color: '#111', fontSize: 15, fontWeight: 800, boxShadow: 'var(--shadow-soft)' }}>
            {user.fullName.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{user.fullName}</Typography>
            <Chip label={ROLE_LABEL[role] ?? role} size="small" sx={{ height: 20, fontSize: '0.66rem', fontWeight: 800, bgcolor: `${ROLE_COLOR[role]}22`, color: ROLE_COLOR[role], mt: 0.65 }} />
          </Box>
        </Box>
      )}

      <Divider />

      <Box sx={{ flex: 1, px: 1.75, py: 2, overflowY: 'auto' }}>
        <NavGroup label="Vận hành">
          <NavItem href="/dashboard" label="Dashboard" icon={<DashboardIcon fontSize="small" />} active={isActive('/dashboard')} onClick={onMobileClose} />
          <NavItem href="/timeline" label="Timeline" icon={<CalendarViewWeekIcon fontSize="small" />} active={isActive('/timeline')} chip="Live" onClick={onMobileClose} />
          <NavItem href="/bookings" label="Đặt phòng" icon={<BookOnlineIcon fontSize="small" />} active={isActive('/bookings')} onClick={onMobileClose} />
          <NavItem href="/guests" label="Khách hàng" icon={<PeopleIcon fontSize="small" />} active={isActive('/guests')} onClick={onMobileClose} />
          <NavItem href="/rooms" label="Phòng / Căn hộ" icon={<HotelIcon fontSize="small" />} active={isActive('/rooms')} onClick={onMobileClose} />
        </NavGroup>

        {showAssetSections && (
          <NavGroup label="Quản lý tài sản">
            <NavItem href="/buildings" label="Toà nhà" icon={<ApartmentIcon fontSize="small" />} active={isActive('/buildings')} onClick={onMobileClose} />
            <NavItem href="/room-types" label="Loại phòng" icon={<CategoryIcon fontSize="small" />} active={isActive('/room-types')} onClick={onMobileClose} />
            <NavItem href="/addons" label="Add-on Bán Hàng" icon={<RestaurantMenuIcon fontSize="small" />} active={isActive('/addons')} chip="QR" onClick={onMobileClose} />
          </NavGroup>
        )}

        {showAdminSections && (
          <NavGroup label="Hệ thống">
            <NavItem href="/users" label="Người dùng" icon={<ManageAccountsIcon fontSize="small" />} active={isActive('/users')} onClick={onMobileClose} />
            <NavItem href="/settings" label="Cài đặt" icon={<SettingsIcon fontSize="small" />} active={isActive('/settings')} onClick={onMobileClose} />
          </NavGroup>
        )}
      </Box>

      <Divider />

      <Box sx={{ px: 1.75, py: 1.75 }}>
        <ListItemButton onClick={handleLogout} sx={{ py: 1.1, borderRadius: '16px', color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Đăng xuất" primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isDesktop ? 'permanent' : 'temporary'}
      open={isDesktop ? true : mobileOpen}
      onClose={onMobileClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: isDesktop ? SIDEBAR_WIDTH : 0,
        flexShrink: 0,
        '& .MuiBackdrop-root': {
          bgcolor: 'rgba(15, 23, 42, 0.32)',
        },
        '& .MuiDrawer-paper': {
          width: { xs: 'min(88vw, 328px)', lg: 320 },
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-primary)',
          backgroundImage: 'none',
          opacity: 1,
          backdropFilter: 'none',
        },
      }}
    >
      {content}
    </Drawer>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, mb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, fontSize: '0.64rem' }}>
        {label}
      </Typography>
      <List disablePadding>{children}</List>
    </Box>
  );
}

function NavItem({ href, label, icon, active, chip, onClick }: { href: string; label: string; icon: React.ReactNode; active: boolean; chip?: string; onClick?: () => void }) {
  return (
    <ListItemButton component={NextLink} href={href} selected={active} onClick={onClick} sx={{ py: 1.1, borderRadius: '16px', mb: 0.4 }}>
      <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 700 : 600 }} />
      {chip && <Chip label={chip} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />}
    </ListItemButton>
  );
}
