'use client';
import { Suspense, useEffect, useState } from 'react';
import {
  Box, Typography, TextField, InputAdornment, Button, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, IconButton, Chip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem,
  Stack, CircularProgress, Divider, FormControlLabel, Switch, TableContainer,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import { useGuests, useGuest, useCreateGuest, useUpdateGuest, useDeleteGuest } from '@/hooks/api';
import { LoadingState, EmptyState } from '@/components/common/States';
import { useToast } from '@/providers/ToastProvider';
import PersonIcon from '@mui/icons-material/Person';
import dayjs from 'dayjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { StatusChip } from '@/components/common/StatusChip';

const EMPTY_FORM = {
  fullName: '', email: '', phone: '', gender: '', company: '', idNumber: '', nationality: 'Vietnamese',
  notes: '', isVip: false, idType: 'NATIONAL_ID', taxCode: '', address: '', dateOfBirth: '',
};

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  NON_BINARY: 'Khác',
};

function GuestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
    setGenderFilter(searchParams.get('gender') ?? '');
  }, [searchParams]);

  const { data, isLoading } = useGuests({ q: q || undefined, limit: 50 });
  const guests = (data?.data?.data ?? []).filter((guest: any) => !genderFilter || guest.gender === genderFilter);
  const { data: guestDetailData, isLoading: guestDetailLoading } = useGuest(selectedGuestId ?? '');
  const guestDetail = guestDetailData?.data;

  const create = useCreateGuest();
  const update = useUpdateGuest();
  const remove = useDeleteGuest();

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (g: any) => {
    setEditTarget(g);
    setForm({
      ...EMPTY_FORM,
      ...g,
      dateOfBirth: g?.dateOfBirth ? dayjs(g.dateOfBirth).format('YYYY-MM-DD') : '',
    });
    setFormOpen(true);
  };
  const openDetail = (guestId: string) => { setSelectedGuestId(guestId); setDetailOpen(true); };

  const handleSave = async () => {
    if (!form.fullName.trim()) { toast('Tên khách là bắt buộc', 'warning'); return; }
    try {
      const payload = {
        ...form,
        dateOfBirth: form.dateOfBirth || undefined,
      };
      if (editTarget) await update.mutateAsync({ id: editTarget.id, ...payload });
      else             await create.mutateAsync(payload);
      toast(editTarget ? 'Cập nhật thành công' : 'Tạo khách hàng thành công');
      setFormOpen(false);
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast('Đã xoá khách hàng', 'warning');
      if (selectedGuestId === deleteTarget.id) setDetailOpen(false);
      setDeleteTarget(null);
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi', 'error');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Khách hàng</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Thêm khách</Button>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          fullWidth placeholder="Tìm theo tên, điện thoại, email, CMND..."
          value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          sx={{ maxWidth: { xs: '100%', md: 500 } }}
        />
        <TextField
          select
          label="Giới tính"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          sx={{ minWidth: { xs: '100%', md: 220 } }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="MALE">Nam</MenuItem>
          <MenuItem value="FEMALE">Nữ</MenuItem>
          <MenuItem value="NON_BINARY">Khác</MenuItem>
        </TextField>
      </Stack>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {isLoading ? (
          <LoadingState />
        ) : guests.length === 0 ? (
          <EmptyState icon={<PersonIcon sx={{ fontSize: 48 }} />} title="Không tìm thấy khách hàng" subtitle="Thử tìm với từ khoá khác" />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                <TableCell>Khách hàng</TableCell>
                <TableCell>Liên hệ</TableCell>
                <TableCell>CMND/Hộ chiếu</TableCell>
                <TableCell>Công ty</TableCell>
                <TableCell>Số lần đặt</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {guests.map((g: any) => (
                <TableRow key={g.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(g.id)}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>
                        {g.fullName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>{g.fullName}</Typography>
                          {g.isVip && <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                        </Box>
                        <Typography variant="caption" color="text.secondary">{g.nationality}{g.gender ? ` · ${GENDER_LABELS[g.gender] ?? g.gender}` : ''}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{g.phone}</Typography>
                    <Typography variant="caption" color="text.secondary">{g.email}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2">{g.idNumber ?? '—'}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{g.company ?? '—'}</Typography></TableCell>
                  <TableCell><Chip label={g._count?.reservationGuests ?? 0} size="small" /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEdit(g); }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Chi tiết khách hàng</DialogTitle>
        <DialogContent dividers>
          {guestDetailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : !guestDetail ? (
            <Typography color="text.secondary">Không tải được thông tin khách hàng.</Typography>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" fontWeight={700}>{guestDetail.fullName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {guestDetail.phone || '—'} · {guestDetail.email || '—'}
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}><Typography variant="body2"><strong>CMND/Hộ chiếu:</strong> {guestDetail.idNumber || '—'}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="body2"><strong>Quốc tịch:</strong> {guestDetail.nationality || '—'}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="body2"><strong>Giới tính:</strong> {guestDetail.gender ? (GENDER_LABELS[guestDetail.gender] ?? guestDetail.gender) : '—'}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="body2"><strong>Công ty:</strong> {guestDetail.company || '—'}</Typography></Grid>
                <Grid item xs={12} md={6}><Typography variant="body2"><strong>VIP:</strong> {guestDetail.isVip ? 'Có' : 'Không'}</Typography></Grid>
              </Grid>
              <Divider />
              <Box>
                <Typography variant="subtitle1" fontWeight={700} mb={1.5}>Lịch sử đặt phòng gần đây</Typography>
                {guestDetail.reservationGuests?.length ? (
                  <Stack spacing={1}>
                    {guestDetail.reservationGuests.map((rg: any) => {
                      const r = rg.reservation;
                      return (
                        <Paper
                          key={rg.id}
                          variant="outlined"
                          sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                          onClick={() => router.push(`/bookings?reservationId=${r.id}`)}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                            <Box>
                              <Typography fontWeight={700} color="primary">{r.reservationCode}</Typography>
                              <Typography variant="body2">{r.room?.number || '—'} · {dayjs(r.checkInDate).format('DD/MM/YYYY')} - {dayjs(r.checkOutDate).format('DD/MM/YYYY')}</Typography>
                              <Typography variant="caption" color="text.secondary">Tổng tiền: {Number(r.totalAmount).toLocaleString('vi-VN')}đ</Typography>
                            </Box>
                            <StatusChip status={r.status} />
                          </Box>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">Chưa có lịch sử đặt phòng.</Typography>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Đóng</Button>
          {guestDetail && <Button color="error" onClick={() => setDeleteTarget(guestDetail)}>Xoá khách</Button>}
          {guestDetail && <Button variant="contained" onClick={() => { setDetailOpen(false); openEdit(guestDetail); }}>Sửa thông tin</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Xoá khách hàng</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            {deleteTarget
              ? `Bạn có chắc muốn xoá khách hàng ${deleteTarget.fullName} không? Chỉ xoá được khi khách chưa có lịch sử booking.`
              : ''}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>Huỷ</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={remove.isPending}>
            {remove.isPending ? 'Đang xoá...' : 'Xác nhận xoá'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Form dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Sửa thông tin khách' : 'Thêm khách hàng mới'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12}><TextField fullWidth label="Tên đầy đủ *" value={form.fullName} onChange={set('fullName')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Điện thoại" value={form.phone} onChange={set('phone')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Email" value={form.email} onChange={set('email')} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Giới tính" value={form.gender} onChange={set('gender')}>
                <MenuItem value="">Chưa khai báo</MenuItem>
                <MenuItem value="MALE">Nam</MenuItem>
                <MenuItem value="FEMALE">Nữ</MenuItem>
                <MenuItem value="NON_BINARY">Khác</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Loại giấy tờ" value={form.idType} onChange={set('idType')}>
                <MenuItem value="NATIONAL_ID">CCCD / CMND</MenuItem>
                <MenuItem value="PASSPORT">Hộ chiếu</MenuItem>
                <MenuItem value="DRIVER_LICENSE">GPLX</MenuItem>
                <MenuItem value="OTHER">Khác</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Số CMND/Hộ chiếu" value={form.idNumber} onChange={set('idNumber')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Quốc tịch" value={form.nationality} onChange={set('nationality')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="date" label="Ngày sinh" value={form.dateOfBirth} onChange={set('dateOfBirth')} InputLabelProps={{ shrink: true }} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Công ty" value={form.company} onChange={set('company')} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Mã số thuế" value={form.taxCode} onChange={set('taxCode')} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Địa chỉ" value={form.address} onChange={set('address')} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Ghi chú" value={form.notes} onChange={set('notes')} /></Grid>
            <Grid item xs={12}><FormControlLabel control={<Switch checked={!!form.isVip} onChange={(e) => setForm((f: any) => ({ ...f, isVip: e.target.checked }))} />} label="Khách VIP" /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleSave} disabled={create.isPending || update.isPending}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function GuestsPage() {
  return (
    <Suspense>
      <GuestsPageContent />
    </Suspense>
  );
}
