'use client';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export function LoadingState({ message = 'Đang tải dữ liệu...' }: { message?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 3 }}>
      <CircularProgress size={42} thickness={4} color="primary" />
      <Typography color="text.secondary" variant="body1" fontWeight={500} sx={{ animation: 'pulse 1.5s infinite ease-in-out' }}>
        {message}
      </Typography>
    </Box>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, px: 3, textAlign: 'center', gap: 1.5 }}>
      <Box sx={{ color: 'text.secondary', opacity: 0.6, transform: 'scale(1.5)', mb: 2 }}>
        {icon || <InboxIcon fontSize="large" />}
      </Box>
      <Typography variant="h6" fontWeight={700} color="text.primary">{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400 }}>{subtitle}</Typography>}
    </Box>
  );
}
