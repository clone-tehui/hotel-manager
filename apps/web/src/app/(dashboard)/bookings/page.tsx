'use client';

import { Suspense, useEffect, useState } from 'react';
import {
  Box, Button, Chip, TextField, InputAdornment, MenuItem, Select,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, Typography, Stack, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import dayjs from 'dayjs';
import { useSearchParams } from 'next/navigation';
import { useReservations, useBuildings, useCancelReservation, useCheckIn, useCheckOut } from '@/hooks/api';
import { ReservationDrawer } from '@/components/reservation/ReservationDrawer';
import { ReservationForm } from '@/components/reservation/ReservationForm';
import { LoadingState, EmptyState } from '@/components/common/States';
import { useToast } from '@/providers/ToastProvider';
import BookOnlineIcon from '@mui/icons-material/BookOnline';

const STATUS_LABELS: Record<string, { label: string; color: any }> = {
  PENDING: { label: 'Chờ xác nhận', color: 'warning' },
  BOOKED: { label: 'Đã đặt', color: 'info' },
  PENDING_CHECKIN: { label: 'Sắp đến', color: 'secondary' },
  IN_HOUSE: { label: 'Đang ở', color: 'success' },
  CHECKED_OUT: { label: 'Đã trả', color: 'default' },
  CANCELLED: { label: 'Đã huỷ', color: 'error' },
};

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'NON_BINARY', label: 'Khác' },
] as const;

function BookingsPageContent() {
  const searchParams = useSearchParams();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('');
  const [buildingFilter, setBuilding] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; code: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setStatus(searchParams.get('status') ?? '');
    setBuilding(searchParams.get('buildingId') ?? '');
    setGenderFilter(searchParams.get('gender') ?? '');
    setSearch(searchParams.get('q') ?? '');
    setSelectedId(searchParams.get('reservationId'));
  }, [searchParams]);

  const { data: buildingsData } = useBuildings();
  const buildings: any[] = buildingsData?.data ?? [];

  const params: any = { limit: 200 };
  if (statusFilter) params.status = statusFilter;

  const { data: resData, isLoading, refetch } = useReservations(params);
  const allReservations: any[] = resData?.data?.data ?? [];

  const reservations = allReservations.filter((r) => {
    const primaryGuest = r.guests?.find((guest: any) => guest.isPrimary)?.guest ?? r.guests?.[0]?.guest;
    const matchSearch = !search
      || r.primaryGuestName?.toLowerCase().includes(search.toLowerCase())
      || r.reservationCode?.toLowerCase().includes(search.toLowerCase())
      || r.room?.number?.toLowerCase().includes(search.toLowerCase());
    const matchBuilding = !buildingFilter || r.room?.buildingId === buildingFilter;
    const matchGender = !genderFilter || primaryGuest?.gender === genderFilter;
    return matchSearch && matchBuilding && matchGender;
  });

  const cancelMut = useCancelReservation();
  const checkInMut = useCheckIn();
  const checkOutMut = useCheckOut();

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelMut.mutateAsync({ id: cancelTarget.id, cancelReason: 'Huỷ từ danh sách booking' });
      toast('Đã huỷ booking', 'success');
      setCancelTarget(null);
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi khi huỷ', 'error');
    }
  };

  const handleCheckIn = async (id: string) => {
    try {
      await checkInMut.mutateAsync({ id });
      toast('Check-in thành công', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi check-in', 'error');
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      await checkOutMut.mutateAsync({ id });
      toast('Check-out thành công', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi check-out', 'error');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Quản lý Đặt phòng</Typography>
          <Typography variant="body2" color="text.secondary">{reservations.length} booking{statusFilter ? '' : ' tổng cộng'}</Typography>
        </Box>
        <Stack direction="row" spacing={1} justifyContent={{ xs: 'stretch', sm: 'flex-end' }}>
          <Tooltip title="Làm mới"><IconButton onClick={() => refetch()}><RefreshIcon /></IconButton></Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} sx={{ flex: { xs: 1, sm: 'none' } }}>Đặt phòng mới</Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5}>
          <TextField
            placeholder="Tìm theo tên khách, mã booking, số phòng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 2 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <FormControl sx={{ minWidth: { xs: '100%', sm: 180 } }}>
            <InputLabel>Trạng thái</InputLabel>
            <Select value={statusFilter} label="Trạng thái" onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">Tất cả</MenuItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 180 } }}>
            <InputLabel>Toà nhà</InputLabel>
            <Select value={buildingFilter} label="Toà nhà" onChange={(e) => setBuilding(e.target.value)}>
              <MenuItem value="">Tất cả toà</MenuItem>
              {buildings.map((b: any) => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 220 } }}>
            <InputLabel>Giới tính</InputLabel>
            <Select value={genderFilter} label="Giới tính" onChange={(e) => setGenderFilter(e.target.value)}>
              <MenuItem value="">Tất cả</MenuItem>
              {GENDER_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {isLoading ? (
        <LoadingState message="Đang tải danh sách booking..." />
      ) : reservations.length === 0 ? (
        <EmptyState icon={<BookOnlineIcon sx={{ fontSize: 48 }} />} title="Không có booking nào" subtitle="Thay đổi bộ lọc hoặc tạo booking mới" />
      ) : isDesktop ? (
        <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Mã booking</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Khách</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Căn / Toà</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nhận phòng</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trả phòng</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reservations.map((r: any) => {
                const st = STATUS_LABELS[r.status] ?? { label: r.status, color: 'default' };
                const canCheckin = ['BOOKED', 'PENDING_CHECKIN'].includes(r.status);
                const canCheckout = r.status === 'IN_HOUSE';
                const canCancel = ['PENDING', 'BOOKED', 'PENDING_CHECKIN'].includes(r.status);
                return (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }}>
                    <TableCell onClick={() => setSelectedId(r.id)}><Typography variant="body2" fontWeight={600} color="primary">{r.reservationCode}</Typography></TableCell>
                    <TableCell onClick={() => setSelectedId(r.id)}>
                      <Typography variant="body2" fontWeight={500}>{r.primaryGuestName}</Typography>
                      {r.company && <Typography variant="caption" color="text.secondary">{r.company}</Typography>}
                    </TableCell>
                    <TableCell onClick={() => setSelectedId(r.id)}>
                      <Typography variant="body2" fontWeight={600}>{r.room?.number ?? '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.room?.building?.name ?? ''}</Typography>
                    </TableCell>
                    <TableCell onClick={() => setSelectedId(r.id)}>{dayjs(r.checkInDate).format('DD/MM/YYYY HH:mm')}</TableCell>
                    <TableCell onClick={() => setSelectedId(r.id)}>{dayjs(r.checkOutDate).format('DD/MM/YYYY HH:mm')}</TableCell>
                    <TableCell onClick={() => setSelectedId(r.id)}><Chip label={st.label} color={st.color} size="small" /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Chi tiết"><IconButton size="small" onClick={() => setSelectedId(r.id)}><InfoIcon fontSize="small" /></IconButton></Tooltip>
                        {canCheckin && <Tooltip title="Check-in"><IconButton size="small" color="success" onClick={() => handleCheckIn(r.id)}><LoginIcon fontSize="small" /></IconButton></Tooltip>}
                        {canCheckout && <Tooltip title="Check-out"><IconButton size="small" color="warning" onClick={() => handleCheckOut(r.id)}><LogoutIcon fontSize="small" /></IconButton></Tooltip>}
                        {canCancel && <Tooltip title="Huỷ booking"><IconButton size="small" color="error" onClick={() => setCancelTarget({ id: r.id, code: r.reservationCode })}><CancelIcon fontSize="small" /></IconButton></Tooltip>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Stack spacing={1.5}>
          {reservations.map((r: any) => {
            const st = STATUS_LABELS[r.status] ?? { label: r.status, color: 'default' };
            const canCheckin = ['BOOKED', 'PENDING_CHECKIN'].includes(r.status);
            const canCheckout = r.status === 'IN_HOUSE';
            const canCancel = ['PENDING', 'BOOKED', 'PENDING_CHECKIN'].includes(r.status);
            return (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                    <Box onClick={() => setSelectedId(r.id)} sx={{ cursor: 'pointer' }}>
                      <Typography fontWeight={700} color="primary.main">{r.reservationCode}</Typography>
                      <Typography variant="body2" fontWeight={600}>{r.primaryGuestName}</Typography>
                      {r.company && <Typography variant="caption" color="text.secondary">{r.company}</Typography>}
                    </Box>
                    <Chip label={st.label} color={st.color} size="small" />
                  </Stack>
                  <Typography variant="body2">{r.room?.number ?? '—'} · {r.room?.building?.name ?? '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">Nhận phòng: {dayjs(r.checkInDate).format('DD/MM/YYYY HH:mm')}</Typography>
                  <Typography variant="caption" color="text.secondary">Trả phòng: {dayjs(r.checkOutDate).format('DD/MM/YYYY HH:mm')}</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    <Button variant="outlined" size="small" startIcon={<InfoIcon />} onClick={() => setSelectedId(r.id)}>Chi tiết</Button>
                    {canCheckin && <Button variant="contained" color="success" size="small" startIcon={<LoginIcon />} onClick={() => handleCheckIn(r.id)}>Check-in</Button>}
                    {canCheckout && <Button variant="contained" color="secondary" size="small" startIcon={<LogoutIcon />} onClick={() => handleCheckOut(r.id)}>Check-out</Button>}
                    {canCancel && <Button variant="outlined" color="error" size="small" startIcon={<CancelIcon />} onClick={() => setCancelTarget({ id: r.id, code: r.reservationCode })}>Huỷ</Button>}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Dialog open={!!cancelTarget} onClose={() => setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Huỷ booking</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            {cancelTarget ? `Bạn có chắc muốn huỷ booking ${cancelTarget.code} không? Thao tác này sẽ trả phòng về trạng thái phù hợp và giữ lại lịch sử booking.` : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelMut.isPending}>Đóng</Button>
          <Button variant="contained" color="error" onClick={handleCancel} disabled={cancelMut.isPending}>
            {cancelMut.isPending ? 'Đang huỷ...' : 'Xác nhận huỷ'}
          </Button>
        </DialogActions>
      </Dialog>

      <ReservationDrawer reservationId={selectedId} onClose={() => setSelectedId(null)} />
      <ReservationForm open={formOpen} onClose={() => setFormOpen(false)} />
    </Box>
  );
}

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsPageContent />
    </Suspense>
  );
}
