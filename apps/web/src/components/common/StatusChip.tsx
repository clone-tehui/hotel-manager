'use client';
import { Chip, ChipProps } from '@mui/material';

const STATUS_MAP: Record<string, { label: string; color: ChipProps['color']; hex: string }> = {
  PENDING:         { label: 'Chờ xác nhận', color: 'default',  hex: '#90CAF9' },
  BOOKED:          { label: 'Đã đặt',        color: 'primary',  hex: '#6C8EFF' },
  PENDING_CHECKIN: { label: 'Sắp check-in',  color: 'warning',  hex: '#FFB547' },
  IN_HOUSE:        { label: 'Đang ở',        color: 'success',  hex: '#4CAF82' },
  CHECKED_OUT:     { label: 'Đã trả phòng',  color: 'default',  hex: '#8A95B0' },
  CANCELLED:       { label: 'Đã huỷ',        color: 'error',    hex: '#FF6B6B' },
  // Room statuses
  VACANT:      { label: 'Trống',    color: 'success', hex: '#4CAF82' },
  RESERVED:    { label: 'Đã đặt',  color: 'primary', hex: '#6C8EFF' },
  OCCUPIED:    { label: 'Có khách', color: 'warning', hex: '#FFB547' },
  DIRTY:       { label: 'Cần dọn', color: 'default', hex: '#8A95B0' },
  MAINTENANCE: { label: 'Bảo trì', color: 'error',   hex: '#FF6B6B' },
};

export function getStatusMeta(status: string) {
  return STATUS_MAP[status] ?? { label: status, color: 'default' as const, hex: '#8A95B0' };
}

export function StatusChip({ status, size = 'small' }: { status: string; size?: 'small' | 'medium' }) {
  const meta = getStatusMeta(status);
  return <Chip label={meta.label} color={meta.color} size={size} sx={{ fontWeight: 600 }} />;
}
