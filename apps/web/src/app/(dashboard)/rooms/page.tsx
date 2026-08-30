'use client';
import { Suspense, useEffect, useState } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, IconButton, Chip, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, ToggleButton, ToggleButtonGroup, Stack, Tooltip, FormControl, InputLabel, Select,
  TextField, useMediaQuery, Alert, CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useRooms, useRoomTypes, useBuildings, useCreateRoom, useUpdateRoom, useDeleteRoom } from '@/hooks/api';
import { StatusChip } from '@/components/common/StatusChip';
import { LoadingState, EmptyState } from '@/components/common/States';
import { useToast } from '@/providers/ToastProvider';
import { api } from '@/lib/api';
import HotelIcon from '@mui/icons-material/Hotel';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { RoomDrawer } from '@/components/room/RoomDrawer';
import { RoomImagesDialog } from '@/components/room/RoomImagesDialog';

const EMPTY_FORM = { number: '', floor: '', roomTypeId: '', buildingId: '', price: '', discountablePrice: '', monthlyCost: '', description: '', note: '', status: 'VACANT' };
const STATUS_LABELS: Record<string, string> = {
  VACANT: 'Trống', RESERVED: 'Đã đặt', OCCUPIED: 'Có khách', DIRTY: 'Cần dọn', MAINTENANCE: 'Bảo trì',
};

const getRoomImageCount = (room: any) => Number(room?._count?.images ?? room?.images?.length ?? 0);
const formatCurrency = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return `${num.toLocaleString('vi-VN')}đ`;
};

function RoomsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { canManageAssets } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [statusFilter, setStatusFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [imagesTarget, setImagesTarget] = useState<any>(null);
  const [qrTarget, setQrTarget] = useState<any>(null);
  const [qrResult, setQrResult] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setStatusFilter(searchParams.get('status') ?? '');
    setBuildingFilter(searchParams.get('buildingId') ?? '');
  }, [searchParams]);

  const queryParams: any = { limit: 200 };
  if (statusFilter) queryParams.status = statusFilter;
  if (buildingFilter) queryParams.buildingId = buildingFilter;

  const { data, isLoading, refetch } = useRooms(queryParams);
  const rooms: any[] = data?.data?.data ?? [];
  const { data: rtData } = useRoomTypes();
  const roomTypes: any[] = rtData?.data ?? [];
  const { data: bData } = useBuildings();
  const buildings: any[] = bData?.data ?? [];

  const create = useCreateRoom();
  const update = useUpdateRoom();
  const softDelete = useDeleteRoom();

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (r: any) => {
    setEditTarget(r);
    setForm({
      number: r.number,
      floor: r.floor ?? '',
      roomTypeId: r.roomTypeId,
      buildingId: r.buildingId,
      price: r.price != null ? String(Number(r.price)) : '',
      discountablePrice: r.discountablePrice != null ? String(Number(r.discountablePrice)) : '',
      monthlyCost: r.monthlyCost != null ? String(Number(r.monthlyCost)) : '',
      description: r.description ?? '',
      note: r.note ?? '',
      status: r.status ?? 'VACANT',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.number || !form.roomTypeId || (!editTarget && !form.buildingId)) {
      toast('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning'); return;
    }
    try {
      const payload = {
        number: form.number.trim(),
        floor: Number(form.floor) || null,
        price: form.price === '' ? null : Number(form.price),
        discountablePrice: form.discountablePrice === '' ? null : Number(form.discountablePrice),
        monthlyCost: form.monthlyCost === '' ? null : Number(form.monthlyCost),
        description: form.description,
        note: form.note,
        status: form.status,
      };
      // Do not submit unchanged booking-sensitive relations while editing.
      // This keeps cost/price/note updates allowed for rooms that already have bookings.
      if (editTarget) {
        const patch: any = { id: editTarget.id, ...payload };
        if (form.roomTypeId !== editTarget.roomTypeId) patch.roomTypeId = form.roomTypeId;
        await update.mutateAsync(patch);
      } else {
        await create.mutateAsync({ ...payload, roomTypeId: form.roomTypeId, buildingId: form.buildingId });
      }
      toast(editTarget ? 'Cập nhật căn hộ thành công' : 'Tạo căn hộ thành công');
      setFormOpen(false); refetch();
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  const handleToggleMaintenance = async (room: any) => {
    const newStatus = room.status === 'MAINTENANCE' ? 'VACANT' : 'MAINTENANCE';
    try {
      await update.mutateAsync({ id: room.id, status: newStatus });
      toast(`Căn ${room.number}: ${newStatus === 'MAINTENANCE' ? 'chuyển sang bảo trì' : 'đã sẵn sàng'}`);
      refetch();
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  const handleToggleActive = async (room: any) => {
    try {
      await update.mutateAsync({ id: room.id, isActive: !room.isActive });
      toast(`Căn ${room.number}: ${!room.isActive ? 'đã kích hoạt' : 'đã tạm ngừng'}`);
      refetch();
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await softDelete.mutateAsync(deleteTarget.id);
      toast(`Đã xoá căn ${deleteTarget.number}`, 'warning');
      setDeleteTarget(null);
      refetch();
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };


  const openQr = async (room: any) => {
    setQrTarget(room);
    setQrResult(null);
    setQrLoading(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res = await api.get(`/addons/rooms/${room.id}/qr`, origin ? { origin } : undefined);
      setQrResult(res?.data ?? res);
    } catch (e: any) {
      toast(e?.message ?? 'Không tạo được mã QR', 'error');
    } finally {
      setQrLoading(false);
    }
  };

  const copyQrLink = async () => {
    if (!qrResult?.url) return;
    try {
      await navigator.clipboard.writeText(qrResult.url);
      toast('Đã copy link QR');
    } catch {
      toast('Không copy được link', 'error');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" spacing={2} mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Căn hộ</Typography>
          <Typography variant="body2" color="text.secondary">{rooms.length} căn đang hiển thị</Typography>
        </Box>
        {canManageAssets && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Thêm căn hộ</Button>}
      </Stack>

      <Paper sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 180 } }}>
            <InputLabel>Toà nhà</InputLabel>
            <Select value={buildingFilter} label="Toà nhà" onChange={(e) => setBuildingFilter(e.target.value)}>
              <MenuItem value="">Tất cả toà</MenuItem>
              {buildings.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
            </Select>
          </FormControl>
          <ToggleButtonGroup size="small" exclusive value={statusFilter} onChange={(_, v) => setStatusFilter(v ?? '')} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <ToggleButton value="">Tất cả</ToggleButton>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <ToggleButton key={k} value={k}>{v}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {isLoading ? <LoadingState /> : rooms.length === 0 ? (
        <EmptyState icon={<HotelIcon sx={{ fontSize: 48 }} />} title="Không có căn hộ nào" subtitle="Thay đổi bộ lọc hoặc thêm căn mới" />
      ) : isDesktop ? (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Mã căn</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Toà nhà</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tầng</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Loại</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Giá bán</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Giá có thể giảm</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Kích hoạt</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room: any) => (
                <TableRow key={room.id} hover sx={{ opacity: room.isActive ? 1 : 0.55 }}>
                  <TableCell>
                    <Typography fontWeight={700} fontFamily="monospace" color="primary" sx={{ cursor: 'pointer' }} onClick={() => router.push(`/bookings?q=${encodeURIComponent(room.number)}`)}>
                      {room.number}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={room.building?.code ?? '—'} size="small" variant="outlined" color="primary" sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
                    <Typography variant="caption" display="block" color="text.secondary">{room.building?.name}</Typography>
                  </TableCell>
                  <TableCell>Tầng {room.floor ?? '—'}</TableCell>
                  <TableCell><Typography variant="body2">{room.roomType?.name}</Typography></TableCell>
                  <TableCell>{formatCurrency(room.price)}</TableCell>
                  <TableCell>{formatCurrency(room.discountablePrice)}</TableCell>
                  <TableCell><StatusChip status={room.status} /></TableCell>
                  <TableCell>
                    <Chip label={room.isActive ? 'Active' : 'Inactive'} color={room.isActive ? 'success' : 'default'} size="small" onClick={canManageAssets ? () => handleToggleActive(room) : undefined} sx={{ cursor: canManageAssets ? 'pointer' : 'default' }} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                      <Tooltip title="Chi tiết căn hộ"><IconButton size="small" onClick={() => setSelectedRoomId(room.id)}><InfoIcon fontSize="small" /></IconButton></Tooltip>
                      {canManageAssets && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Tooltip title="Quản lý ảnh">
                            <Button size="small" variant="outlined" startIcon={<PhotoLibraryIcon fontSize="small" />} onClick={() => setImagesTarget(room)}>
                              Ảnh
                            </Button>
                          </Tooltip>
                          <Chip label={getRoomImageCount(room)} size="small" color="primary" variant="outlined" />
                        </Stack>
                      )}
                      {canManageAssets && <Tooltip title="QR gọi món cho khách"><IconButton size="small" color="primary" onClick={() => openQr(room)}><QrCode2Icon fontSize="small" /></IconButton></Tooltip>}
                      {canManageAssets && <Tooltip title="Sửa thông tin"><IconButton size="small" onClick={() => openEdit(room)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                      {canManageAssets && <Tooltip title={room.status === 'MAINTENANCE' ? 'Kết thúc bảo trì' : 'Chuyển sang bảo trì'}><IconButton size="small" color={room.status === 'MAINTENANCE' ? 'warning' : 'default'} onClick={() => handleToggleMaintenance(room)}><BuildIcon fontSize="small" /></IconButton></Tooltip>}
                      {canManageAssets && <Tooltip title="Xoá căn (soft delete)"><IconButton size="small" color="error" onClick={() => setDeleteTarget(room)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {rooms.map((room: any) => (
            <Paper key={room.id} variant="outlined" sx={{ p: 1.5, opacity: room.isActive ? 1 : 0.6 }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box>
                    <Typography fontWeight={700} fontFamily="monospace" color="primary.main">{room.number}</Typography>
                    <Typography variant="body2">{room.roomType?.name ?? '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">{room.building?.name ?? '—'} · Tầng {room.floor ?? '—'}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">Giá bán: {formatCurrency(room.price)} · Giá giảm: {formatCurrency(room.discountablePrice)}</Typography>
                  </Box>
                  <StatusChip status={room.status} />
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip label={room.isActive ? 'Đang khai thác' : 'Tạm ngừng'} color={room.isActive ? 'success' : 'default'} size="small" onClick={canManageAssets ? () => handleToggleActive(room) : undefined} />
                  {room.building?.code && <Chip label={room.building.code} size="small" variant="outlined" color="primary" />}
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Button variant="outlined" size="small" startIcon={<InfoIcon />} onClick={() => setSelectedRoomId(room.id)}>Chi tiết</Button>
                  {canManageAssets && (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Button variant="outlined" size="small" startIcon={<PhotoLibraryIcon />} onClick={() => setImagesTarget(room)}>Ảnh</Button>
                      <Chip label={getRoomImageCount(room)} size="small" color="primary" variant="outlined" />
                    </Stack>
                  )}
                  {canManageAssets && <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => openEdit(room)}>Sửa</Button>}
                  {canManageAssets && <Button variant="outlined" size="small" startIcon={<QrCode2Icon />} onClick={() => openQr(room)}>QR gọi món</Button>}
                  {canManageAssets && <Button variant="outlined" size="small" color={room.status === 'MAINTENANCE' ? 'warning' : 'inherit'} startIcon={<BuildIcon />} onClick={() => handleToggleMaintenance(room)}>{room.status === 'MAINTENANCE' ? 'Kết thúc bảo trì' : 'Bảo trì'}</Button>}
                  {canManageAssets && <Button variant="outlined" size="small" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteTarget(room)}>Xoá</Button>}
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <RoomDrawer roomId={selectedRoomId} onClose={() => setSelectedRoomId(null)} />
      <RoomImagesDialog roomId={imagesTarget?.id ?? null} roomLabel={imagesTarget?.number} open={!!imagesTarget} onClose={() => setImagesTarget(null)} />

      <Dialog open={!!qrTarget} onClose={() => setQrTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>QR gọi món · Phòng {qrTarget?.number}</DialogTitle>
        <DialogContent>
          {qrLoading ? (
            <Box sx={{ py: 5, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
          ) : qrResult?.active ? (
            <Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
              <Box component="img" src={qrResult.qrImageUrl} alt={`QR gọi món phòng ${qrTarget?.number}`} sx={{ width: 260, maxWidth: '100%', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
              <Chip label={`Mã phòng: ${qrResult.roomNumber ?? qrTarget?.number}`} color="primary" sx={{ fontWeight: 800 }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Khách quét mã này để mở menu sản phẩm và đặt hàng trực tiếp, không cần đăng nhập.
              </Typography>
              <TextField fullWidth size="small" label="Link QR" value={qrResult.url ?? ''} InputProps={{ readOnly: true }} />
            </Stack>
          ) : (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {qrResult?.message ?? 'Phòng chưa có khách đang check-in nên QR gọi món chưa hoạt động.'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setQrTarget(null)}>Đóng</Button>
          {qrResult?.active && <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={copyQrLink}>Copy link</Button>}
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Xoá căn hộ</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            {deleteTarget ? `Bạn có chắc muốn xoá mềm căn ${deleteTarget.number} không? Căn sẽ không còn hiển thị, nhưng lịch sử booking vẫn được giữ.` : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={softDelete.isPending}>Huỷ</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={softDelete.isPending}>
            {softDelete.isPending ? 'Đang xoá...' : 'Xác nhận xoá'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editTarget ? 'Sửa căn hộ' : 'Thêm căn hộ mới'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth label="Mã căn *" value={form.number} onChange={set('number')} />
              <TextField fullWidth label="Tầng" value={form.floor} onChange={set('floor')} />
            </Stack>
            {!editTarget && (
              <FormControl fullWidth>
                <InputLabel>Toà nhà *</InputLabel>
                <Select value={form.buildingId} label="Toà nhà *" onChange={set('buildingId')}>
                  {buildings.map((b: any) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel>Loại phòng *</InputLabel>
              <Select value={form.roomTypeId} label="Loại phòng *" onChange={set('roomTypeId')}>
                {roomTypes.map((rt: any) => <MenuItem key={rt.id} value={rt.id}>{rt.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField fullWidth type="number" label="Giá bán/đêm (đ)" value={form.price} onChange={set('price')} inputProps={{ min: 0, step: 1000 }} />
              <TextField fullWidth type="number" label="Giá có thể giảm/đêm (đ)" value={form.discountablePrice} onChange={set('discountablePrice')} inputProps={{ min: 0, step: 1000 }} />
            </Stack>
            <TextField
              fullWidth
              type="number"
              label="Giá vốn tháng (đ)"
              value={form.monthlyCost}
              onChange={set('monthlyCost')}
              inputProps={{ min: 0, step: 1000 }}
              helperText="Chỉ dùng nội bộ để tính hoàn vốn/lãi trên Dashboard; không hiển thị trong danh sách hoặc chi tiết căn hộ."
            />
            <TextField fullWidth label="Mô tả" value={form.description} onChange={set('description')} />
            <TextField fullWidth label="Ghi chú" value={form.note} onChange={set('note')} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setFormOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleSave} disabled={create.isPending || update.isPending}>Lưu</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function RoomsPage() {
  return (
    <Suspense>
      <RoomsPageContent />
    </Suspense>
  );
}
