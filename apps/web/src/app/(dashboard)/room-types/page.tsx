'use client';
import { useState } from 'react';
import { RouteGuard } from '@/components/layout/RouteGuard';
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, IconButton, Chip, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, TableContainer,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import { useRoomTypes, useCreateRoomType, useUpdateRoomType } from '@/hooks/api';
import { LoadingState, EmptyState } from '@/components/common/States';
import { useToast } from '@/providers/ToastProvider';
import CategoryIcon from '@mui/icons-material/Category';

const EMPTY = { name: '', description: '', basePrice: '', maxGuests: 2, amenities: '' };

export default function RoomTypesPage() {
  const { toast } = useToast();
  const { data, isLoading } = useRoomTypes();
  const roomTypes = data?.data ?? [];


  const create = useCreateRoomType();
  const update = useUpdateRoomType();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState(EMPTY);

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setFormOpen(true); };
  const openEdit = (rt: any) => {
    setEditTarget(rt);
    setForm({ name: rt.name, description: rt.description ?? '', basePrice: String(rt.basePrice), maxGuests: rt.maxGuests, amenities: (rt.amenities ?? []).join(', ') });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.basePrice) { toast('Thiếu thông tin bắt buộc', 'warning'); return; }
    const payload = {
      name: form.name,
      description: form.description || undefined,
      basePrice: Number(form.basePrice),
      maxGuests: Number(form.maxGuests),
      amenities: form.amenities ? form.amenities.split(',').map((a) => a.trim()).filter(Boolean) : [],
    };
    try {
      if (editTarget) await update.mutateAsync({ id: editTarget.id, ...payload });
      else             await create.mutateAsync(payload);
      toast(editTarget ? 'Cập nhật thành công' : 'Tạo loại phòng thành công');
      setFormOpen(false);
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  return (
    <RouteGuard require="assets">
      <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Loại phòng</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Thêm loại phòng</Button>
      </Box>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {isLoading ? <LoadingState /> : roomTypes.length === 0 ? (
          <EmptyState icon={<CategoryIcon sx={{ fontSize: 48 }} />} title="Chưa có loại phòng nào" />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 840 }}>
            <TableHead>
              <TableRow>
                <TableCell>Loại phòng</TableCell>
                <TableCell>Giá cơ bản/đêm</TableCell>
                <TableCell>Sức chứa tối đa</TableCell>
                <TableCell>Tiện nghi</TableCell>
                <TableCell>Số phòng</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roomTypes.map((rt: any) => (
                <TableRow key={rt.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{rt.name}</Typography>
                    {rt.description && <Typography variant="caption" color="text.secondary">{rt.description}</Typography>}
                  </TableCell>
                  <TableCell><Typography fontWeight={600} color="primary.main">{Number(rt.basePrice).toLocaleString('vi-VN')}đ</Typography></TableCell>
                  <TableCell>{rt.maxGuests} người</TableCell>
                  <TableCell>
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {(rt.amenities ?? []).slice(0, 4).map((a: string) => (
                        <Chip key={a} label={a} size="small" icon={<CheckIcon />} variant="outlined" />
                      ))}
                      {rt.amenities?.length > 4 && <Chip size="small" label={`+${rt.amenities.length - 4}`} />}
                    </Stack>
                  </TableCell>
                  <TableCell><Chip label={rt._count?.rooms ?? 0} size="small" /></TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(rt)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? 'Sửa loại phòng' : 'Thêm loại phòng mới'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={8}><TextField fullWidth label="Tên loại phòng *" value={form.name} onChange={set('name')} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth type="number" label="Sức chứa" value={form.maxGuests} onChange={set('maxGuests')} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Mô tả" value={form.description} onChange={set('description')} /></Grid>
            <Grid item xs={12}><TextField fullWidth type="number" label="Giá cơ bản/đêm (đ) *" value={form.basePrice} onChange={set('basePrice')} /></Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Tiện nghi (cách nhau bằng dấu phẩy)" value={form.amenities} onChange={set('amenities')} helperText="Ví dụ: WiFi, TV, Điều hòa, Minibar" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleSave} disabled={create.isPending || update.isPending}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </RouteGuard>
  );
}
