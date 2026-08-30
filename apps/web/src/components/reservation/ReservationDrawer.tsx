'use client';
import { useRef, useState } from 'react';
import {
  Drawer, Box, Typography, IconButton, Divider, Button, Stack, Chip,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Skeleton, MenuItem, InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CancelIcon from '@mui/icons-material/Cancel';
import ExtendIcon from '@mui/icons-material/Update';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EditIcon from '@mui/icons-material/Edit';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { StatusChip } from '@/components/common/StatusChip';
import {
  useReservation, useReservationLogs, useCheckIn, useCheckOut,
  useCancelReservation, useExtendReservation, useChangeRoom, useRooms,
} from '@/hooks/api';
import { useToast } from '@/providers/ToastProvider';
import { ReservationForm } from './ReservationForm';

interface Props {
  reservationId: string | null;
  onClose: () => void;
}

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  NON_BINARY: 'Khác',
};

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 0.75, gap: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>{label}</Typography>
      <Box sx={{ typography: 'body2', fontWeight: 500, textAlign: 'right' }}>{value ?? '—'}</Box>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
      {children}
    </Box>
  );
}

export function ReservationDrawer({ reservationId, onClose }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const open = !!reservationId;

  const { data: resData, isLoading } = useReservation(reservationId ?? '');
  const { data: logsData } = useReservationLogs(reservationId ?? '');
  const res  = resData?.data;
  const logs: any[] = Array.isArray(logsData) ? logsData : (logsData?.data ?? []);
  const primaryGuestProfile = res?.guests?.find((guest: any) => guest.isPrimary)?.guest ?? res?.guests?.[0]?.guest;
  const primaryGuestNationality = res?.primaryGuestNationality ?? primaryGuestProfile?.nationality;

  const checkIn   = useCheckIn();
  const checkOut  = useCheckOut();
  const cancel    = useCancelReservation();
  const extend    = useExtendReservation();
  const changeRoom = useChangeRoom();

  const [cancelDialog, setCancelDialog]     = useState(false);
  const [cancelReason, setCancelReason]     = useState('');
  const [extendDialog, setExtendDialog]     = useState(false);
  const [newCheckOut, setNewCheckOut]       = useState('');
  const [changeRoomDialog, setChangeRoomDialog] = useState(false);
  const [newRoomId, setNewRoomId]           = useState('');
  const [changeReason, setChangeReason]     = useState('');
  const [editOpen, setEditOpen]             = useState(false);
  const extendCheckOutRef = useRef<HTMLInputElement | null>(null);

  const openNativePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current;
    if (!input) return;
    input.focus();
    (input as any).showPicker?.();
  };

  // Available rooms for change-room (exclude current)
  const { data: roomsData } = useRooms({ limit: 100, status: 'VACANT', buildingId: res?.room?.building?.id ?? undefined });
  const availableRooms: any[] = (roomsData?.data?.data ?? []).filter((r: any) => r.id !== res?.roomId);

  const handleAction = async (action: () => Promise<any>, msg: string) => {
    try { await action(); toast(msg); }
    catch (e: any) { toast(e?.message ?? 'Có lỗi xảy ra', 'error'); }
  };

  const handleChangeRoom = () => handleAction(async () => {
    await changeRoom.mutateAsync({ id: res!.id, newRoomId, reason: changeReason });
    setChangeRoomDialog(false); setNewRoomId(''); setChangeReason('');
  }, 'Đổi phòng thành công!');

  const canCheckIn   = res && ['BOOKED', 'PENDING_CHECKIN'].includes(res.status);
  const canCheckOut  = res?.status === 'IN_HOUSE';
  const canCancel    = res && ['PENDING', 'BOOKED', 'PENDING_CHECKIN'].includes(res.status);
  const canExtend    = res && ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'].includes(res.status);
  const canChangeRoom = res && ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'].includes(res.status) && res.roomId;
  const canEdit      = res && ['PENDING', 'BOOKED', 'PENDING_CHECKIN'].includes(res.status);

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 500 } } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>{res?.reservationCode ?? '...'}</Typography>
              {res && <StatusChip status={res.status} />}
            </Box>
            <Stack direction="row" spacing={0.5}>
              {canEdit && (
                <IconButton size="small" title="Sửa booking" onClick={() => setEditOpen(true)}><EditIcon fontSize="small" /></IconButton>
              )}
              <IconButton onClick={onClose}><CloseIcon /></IconButton>
            </Stack>
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {isLoading ? (
              <Stack gap={1}>{[...Array(6)].map((_, i) => <Skeleton key={i} height={28} />)}</Stack>
            ) : res ? (
              <>
                <Section title="Khách hàng">
                  <InfoRow
                    label="Tên khách"
                    value={
                      <Typography
                        component="span"
                        variant="body2"
                        fontWeight={700}
                        color="primary"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/guests?q=${encodeURIComponent(res.primaryGuestName || '')}`)}
                      >
                        {res.primaryGuestName}
                      </Typography>
                    }
                  />
                  <InfoRow label="Công ty" value={res.company} />
                  {!!res.guests?.length && (
                    <InfoRow
                      label="Hồ sơ khách"
                      value={
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent="flex-end">
                          {res.guests.map((g: any) => (
                            <Chip
                              key={g.id}
                              size="small"
                              clickable
                              label={g.guest?.fullName || g.guest?.phone || 'Khách'}
                              onClick={() => router.push(`/guests?q=${encodeURIComponent(g.guest?.fullName || g.guest?.phone || '')}`)}
                            />
                          ))}
                        </Stack>
                      }
                    />
                  )}
                  {res.guests?.map((g: any) => (
                    <InfoRow key={g.id} label="SĐT" value={g.guest?.phone} />
                  ))}
                  {!!primaryGuestProfile?.gender && <InfoRow label="Giới tính" value={GENDER_LABELS[primaryGuestProfile.gender] ?? primaryGuestProfile.gender} />}
                  {!!primaryGuestNationality && <InfoRow label="Quốc tịch" value={primaryGuestNationality} />}
                  <InfoRow label="Nguồn" value={res.source} />
                </Section>
                <Divider />

                <Section title="Đặt phòng">
                  <InfoRow
                    label="Căn hộ"
                    value={
                      res.room ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5} alignItems={{ xs: 'flex-end', sm: 'center' }}>
                          <Chip label={res.room.building?.code} size="small" color="primary" variant="outlined" sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
                          <Typography variant="body2" fontWeight={600}>{res.room.number}</Typography>
                          <Typography variant="caption" color="text.secondary">({res.room.roomType?.name})</Typography>
                        </Stack>
                      ) : <Typography variant="body2" color="warning.main">Chưa gán phòng</Typography>
                    }
                  />
                  <InfoRow label="Toà nhà"  value={res.room?.building?.name} />
                  <InfoRow label="Nhận phòng" value={dayjs(res.checkInDate).format('DD/MM/YYYY HH:mm')} />
                  <InfoRow label="Trả phòng"  value={dayjs(res.checkOutDate).format('DD/MM/YYYY HH:mm')} />
                  <InfoRow label="Số đêm"   value={`${res.totalNights} đêm`} />
                  <InfoRow label="Khách"    value={`${res.adults} người lớn, ${res.children} trẻ em`} />
                  {res.notes && <InfoRow label="Ghi chú" value={res.notes} />}
                  {res.cancelReason && <InfoRow label="Lý do huỷ" value={<Typography variant="body2" color="error.main">{res.cancelReason}</Typography>} />}
                </Section>
                <Divider />

                <Section title="Tài chính">
                  <InfoRow label="Giá/đêm"  value={`${Number(res.pricePerNight).toLocaleString('vi-VN')}đ`} />
                  {res.discountAmount > 0 && <InfoRow label="Giảm giá" value={`${Number(res.discountAmount).toLocaleString('vi-VN')}đ`} />}
                  <InfoRow label="Tổng tiền" value={
                    <Typography variant="body2" fontWeight={700} color="primary.main">
                      {Number(res.totalAmount).toLocaleString('vi-VN')}đ
                    </Typography>
                  } />
                  <InfoRow label="Tiền cọc" value={`${Number(res.depositAmount).toLocaleString('vi-VN')}đ`} />
                  {res.payments?.map((p: any) => (
                    <InfoRow key={p.id} label="Đã thanh toán" value={`${Number(p.amount).toLocaleString('vi-VN')}đ (${p.method})`} />
                  ))}
                </Section>
                <Divider />

                <Section title="Lịch sử hoạt động">
                  <Stack gap={0.5} mt={1}>
                    {logs.length === 0 ? (
                      <Typography variant="caption" color="text.disabled">Chưa có hoạt động</Typography>
                    ) : logs.map((log: any) => (
                      <Box key={log.id} sx={{ display: 'flex', gap: 1.5, py: 0.5 }}>
                        <Typography variant="caption" color="text.disabled" sx={{ minWidth: 72 }}>
                          {dayjs(log.createdAt).format('DD/MM HH:mm')}
                        </Typography>
                        <Box>
                          <Typography variant="caption" fontWeight={600}>{log.action}</Typography>
                          {log.user && <Typography variant="caption" color="text.secondary"> · {log.user.fullName ?? log.user.email}</Typography>}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Section>
              </>
            ) : null}
          </Box>

          {/* Actions */}
          {res && (
            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {canCheckIn && (
                <Button size="small" variant="contained" color="success" startIcon={checkIn.isPending ? <CircularProgress size={14} color="inherit" /> : <LoginIcon />}
                  onClick={() => handleAction(() => checkIn.mutateAsync({ id: res.id }), 'Check-in thành công!')}
                  disabled={checkIn.isPending}>Check-in</Button>
              )}
              {canCheckOut && (
                <Button size="small" variant="contained" color="secondary" startIcon={checkOut.isPending ? <CircularProgress size={14} color="inherit" /> : <LogoutIcon />}
                  onClick={() => handleAction(() => checkOut.mutateAsync({ id: res.id }), 'Check-out thành công!')}
                  disabled={checkOut.isPending}>Check-out</Button>
              )}
              {canChangeRoom && (
                <Button size="small" variant="outlined" color="info" startIcon={<SwapHorizIcon />}
                  onClick={() => setChangeRoomDialog(true)}>Đổi phòng</Button>
              )}
              {canExtend && (
                <Button size="small" variant="outlined" startIcon={<ExtendIcon />}
                  onClick={() => { setNewCheckOut(dayjs(res.checkOutDate).format('YYYY-MM-DDTHH:mm')); setExtendDialog(true); }}>
                  Gia hạn
                </Button>
              )}
              {canCancel && (
                <Button size="small" variant="outlined" color="error" startIcon={<CancelIcon />}
                  onClick={() => setCancelDialog(true)}>Huỷ booking</Button>
              )}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Edit booking */}
      {editOpen && <ReservationForm open={editOpen} onClose={() => setEditOpen(false)} reservationId={reservationId ?? undefined} />}

      {/* Cancel dialog */}
      <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Huỷ đặt phòng</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>Lý do huỷ sẽ được ghi vào lịch sử booking.</Typography>
          <TextField autoFocus fullWidth multiline rows={2} label="Lý do huỷ *"
            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCancelDialog(false)}>Bỏ qua</Button>
          <Button variant="contained" color="error" disabled={cancelReason.length < 5 || cancel.isPending}
            onClick={() => handleAction(async () => { await cancel.mutateAsync({ id: res!.id, cancelReason }); setCancelDialog(false); setCancelReason(''); }, 'Đã huỷ đặt phòng')}>
            {cancel.isPending ? <CircularProgress size={18} color="inherit" /> : 'Xác nhận huỷ'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Extend dialog */}
      <Dialog open={extendDialog} onClose={() => setExtendDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Gia hạn đặt phòng</DialogTitle>
        <DialogContent>
          <TextField type="datetime-local" fullWidth label="Giờ checkout mới" value={newCheckOut}
            onChange={(e) => setNewCheckOut(e.target.value)} inputRef={extendCheckOutRef} InputLabelProps={{ shrink: true }} helperText="Mặc định 12:00, có thể chỉnh" sx={{ mt: 1 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton edge="end" onClick={() => openNativePicker(extendCheckOutRef)} aria-label="Mở lịch checkout mới">
                    <CalendarMonthIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setExtendDialog(false)}>Bỏ qua</Button>
          <Button variant="contained" disabled={!newCheckOut || extend.isPending}
            onClick={() => handleAction(async () => { await extend.mutateAsync({ id: res!.id, newCheckOutDate: newCheckOut }); setExtendDialog(false); }, 'Gia hạn thành công!')}>
            {extend.isPending ? <CircularProgress size={18} color="inherit" /> : 'Xác nhận gia hạn'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Room dialog */}
      <Dialog open={changeRoomDialog} onClose={() => setChangeRoomDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Đổi phòng</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Phòng hiện tại: <strong>{res?.room?.number}</strong> — chọn phòng mới cùng toà (đang trống)
          </Typography>
          <Stack spacing={2}>
            <TextField select fullWidth label="Phòng mới *" value={newRoomId} onChange={(e) => setNewRoomId(e.target.value)}>
              {availableRooms.length === 0
                ? <MenuItem disabled value="">Không có phòng trống phù hợp</MenuItem>
                : availableRooms.map((r: any) => (
                    <MenuItem key={r.id} value={r.id}>{r.number} — {r.roomType?.name}</MenuItem>
                  ))
              }
            </TextField>
            <TextField fullWidth label="Lý do đổi phòng" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setChangeRoomDialog(false)}>Huỷ</Button>
          <Button variant="contained" color="info" startIcon={<SwapHorizIcon />}
            disabled={!newRoomId || changeRoom.isPending}
            onClick={handleChangeRoom}>
            {changeRoom.isPending ? <CircularProgress size={18} color="inherit" /> : 'Xác nhận đổi phòng'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
