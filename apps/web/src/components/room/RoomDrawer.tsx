'use client';

import { useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, Divider, Stack, Chip,
  Skeleton, Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import dayjs from 'dayjs';
import { useRoom } from '@/hooks/api';
import { StatusChip } from '@/components/common/StatusChip';
import { ReservationDrawer } from '@/components/reservation/ReservationDrawer';

interface Props {
  roomId: string | null;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.75, gap: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} textAlign="right">{value ?? '—'}</Typography>
    </Box>
  );
}

function formatCurrency(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return `${num.toLocaleString('vi-VN')}đ`;
}

export function RoomDrawer({ roomId, onClose }: Props) {
  const open = !!roomId;
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const { data, isLoading } = useRoom(roomId ?? '');
  const room = data?.data;
  const reservations: any[] = room?.reservations ?? [];

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 460 } } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>{room?.number ?? '...'}</Typography>
              {room && <StatusChip status={room.status} />}
            </Box>
            <IconButton onClick={onClose}><CloseIcon /></IconButton>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
            {isLoading ? (
              <Stack gap={1}>{[...Array(8)].map((_, i) => <Skeleton key={i} height={28} />)}</Stack>
            ) : room ? (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    Thông tin căn hộ
                  </Typography>
                  <InfoRow label="Toà nhà" value={room.building?.name} />
                  <InfoRow label="Mã toà" value={room.building?.code} />
                  <InfoRow label="Loại phòng" value={room.roomType?.name} />
                  <InfoRow label="Tầng" value={room.floor ?? '—'} />
                  <InfoRow label="Giá bán" value={formatCurrency(room.price)} />
                  <InfoRow label="Giá có thể giảm" value={formatCurrency(room.discountablePrice)} />
                  <InfoRow label="Sức chứa" value={`${room.roomType?.maxGuests ?? '—'} khách`} />
                  <InfoRow label="Kích hoạt" value={room.isActive ? 'Đang khai thác' : 'Tạm ngừng'} />
                  {room.description && <InfoRow label="Mô tả" value={room.description} />}
                  {room.note && <InfoRow label="Ghi chú" value={room.note} />}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                    Booking đang liên quan
                  </Typography>
                  <Stack spacing={1.25} mt={1.25}>
                    {reservations.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">Hiện không có booking active nào gắn với căn này.</Typography>
                    ) : reservations.map((reservation: any) => (
                      <Paper
                        key={reservation.id}
                        variant="outlined"
                        onClick={() => setSelectedReservationId(reservation.id)}
                        sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          <Box>
                            <Typography fontWeight={700} color="primary">{reservation.reservationCode}</Typography>
                            <Typography variant="body2">{reservation.primaryGuestName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(reservation.checkInDate).format('DD/MM/YYYY')} - {dayjs(reservation.checkOutDate).format('DD/MM/YYYY')}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <InfoIcon color="action" fontSize="small" />
                            <StatusChip status={reservation.status} />
                          </Stack>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            ) : (
              <Typography color="text.secondary">Không tải được thông tin căn hộ.</Typography>
            )}
          </Box>
        </Box>
      </Drawer>

      <ReservationDrawer reservationId={selectedReservationId} onClose={() => setSelectedReservationId(null)} />
    </>
  );
}
