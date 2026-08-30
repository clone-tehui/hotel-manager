'use client';
import { useAuth } from '@/providers/AuthProvider';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useRouter } from 'next/navigation';

interface Props {
  children: React.ReactNode;
  require: 'system' | 'assets';
}

export function RouteGuard({ children, require }: Props) {
  const router = useRouter();
  const { canManageSystem, canManageAssets, hydrated } = useAuth();

  // Still loading from localStorage — don't render anything yet
  if (!hydrated) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const allowed = require === 'system' ? canManageSystem : canManageAssets;

  if (!allowed) {
    return (
      <Box
        sx={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2, p: 4,
        }}
      >
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(255,107,107,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LockIcon sx={{ fontSize: 36, color: 'error.main' }} />
        </Box>
        <Typography variant="h6" fontWeight={700}>Không có quyền truy cập</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Trang này chỉ dành cho Admin.
        </Typography>
        <Button variant="contained" onClick={() => router.push('/dashboard')}>
          Về trang chủ
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
}
