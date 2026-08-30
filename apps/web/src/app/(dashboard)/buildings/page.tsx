'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/layout/RouteGuard';
import {
  Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Stack, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useBuildings, useCreateBuilding, useUpdateBuilding, useDeleteBuilding } from '@/hooks/api';
import { LoadingState, EmptyState } from '@/components/common/States';
import { useToast } from '@/providers/ToastProvider';

const EMPTY_FORM = { code: '', name: '', address: '', note: '', isActive: true };

export default function BuildingsPage() {
  const { data, isLoading, refetch } = useBuildings();
  const buildings: any[] = data?.data ?? [];
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);

  const createMut = useCreateBuilding();
  const updateMut = useUpdateBuilding();
  const deleteMut = useDeleteBuilding();

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit   = (b: any) => { setEditing(b); setForm({ code: b.code, name: b.name, address: b.address ?? '', note: b.note ?? '', isActive: b.isActive }); setDialogOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, code: form.code, name: form.name, address: form.address, note: form.note, isActive: form.isActive });
        toast('Cập nhật toà nhà thành công');
      } else {
        await createMut.mutateAsync({
          code: form.code,
          name: form.name,
          address: form.address,
          note: form.note,
        });
        toast('Tạo toà nhà thành công');
      }
      setDialogOpen(false);
      refetch();
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi khi lưu', 'error');
    }
  };

  const handleToggleActive = async (b: any) => {
    try {
      await updateMut.mutateAsync({ id: b.id, isActive: !b.isActive });
      toast(`Toà ${b.name} đã ${!b.isActive ? 'kích hoạt' : 'tạm ngừng'}`);
      refetch();
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast('Đã xoá toà nhà', 'warning');
      setDeleteTarget(null);
      refetch();
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi', 'error');
    }
  };

  return (
    <RouteGuard require="assets">
      <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Toà nhà</Typography>
          <Typography variant="body2" color="text.secondary">{buildings.length} toà nhà trong hệ thống</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Thêm toà nhà</Button>
      </Box>

      {isLoading ? (
        <LoadingState message="Đang tải danh sách toà nhà..." />
      ) : buildings.length === 0 ? (
        <EmptyState icon={<ApartmentIcon sx={{ fontSize: 48 }} />} title="Chưa có toà nhà" subtitle="Nhấn + để thêm toà nhà đầu tiên" />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Mã</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tên toà nhà</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Địa chỉ</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Ghi chú</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {buildings.map((b: any) => (
                <TableRow key={b.id} hover>
                  <TableCell>
                    <Chip label={b.code} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontFamily: 'monospace' }} />
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{b.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{b.address || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{b.note || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={b.isActive ? 'Đang hoạt động' : 'Đã tạm ngừng'}
                      color={b.isActive ? 'success' : 'default'}
                      size="small"
                      onClick={() => handleToggleActive(b)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                      <Tooltip title="Sửa thông tin">
                        <IconButton size="small" onClick={() => openEdit(b)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Xoá toà nhà">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(b)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editing ? 'Sửa toà nhà' : 'Thêm toà nhà mới'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="Mã toà nhà *"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="VD: OPERA"
              helperText="Admin có thể chỉnh để đồng bộ mã vận hành thực tế"
            />
            <TextField
              label="Tên toà nhà *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: The Opera"
            />
            <TextField
              label="Địa chỉ"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="VD: 161 Hai Bà Trưng, Q1"
            />
            <TextField
              label="Ghi chú"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              multiline rows={2}
              placeholder="Ghi chú nội bộ"
            />
            {editing && (
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                label={form.isActive ? 'Đang hoạt động' : 'Tạm ngừng khai thác'}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.code || createMut.isPending || updateMut.isPending || deleteMut.isPending}>
            {editing ? 'Lưu thay đổi' : 'Tạo toà nhà'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Xoá toà nhà</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            {deleteTarget
              ? `Bạn có chắc muốn xoá toà nhà ${deleteTarget.name} không? Chỉ xoá được khi toà này không còn căn/phòng nào.`
              : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteMut.isPending}>Huỷ</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? 'Đang xoá...' : 'Xác nhận xoá'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </RouteGuard>
  );
}
