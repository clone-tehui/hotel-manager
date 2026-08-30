'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch, Tab, Tabs,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import UploadIcon from '@mui/icons-material/Upload';
import { api } from '@/lib/api';
import { useToast } from '@/providers/ToastProvider';

const money = (value: any) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const unwrap = (res: any) => res?.data ?? res;

const EMPTY_PRODUCT = { name: '', categoryId: '', description: '', imageUrl: '', price: '', sortOrder: 0, isActive: true };
const EMPTY_CATEGORY = { name: '', description: '', sortOrder: 0, isActive: true };

export default function AddonsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [roomMenu, setRoomMenu] = useState<any>(null);
  const [roomQr, setRoomQr] = useState<any>(null);
  const [roomSales, setRoomSales] = useState<any>(null);
  const [productDialog, setProductDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [productForm, setProductForm] = useState<any>(EMPTY_PRODUCT);
  const [categoryForm, setCategoryForm] = useState<any>(EMPTY_CATEGORY);

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === selectedRoomId), [rooms, selectedRoomId]);

  const loadBase = async () => {
    const [catRes, productRes, roomRes, orderRes, logRes] = await Promise.all([
      api.get('/addons/categories'),
      api.get('/addons/products'),
      api.get('/rooms', { limit: 300, includeInactive: true }),
      api.get('/addons/orders', { limit: 100 }),
      api.get('/addons/sepay/webhook-logs', { limit: 100 }),
    ]);
    setCategories(unwrap(catRes));
    setProducts(unwrap(productRes));
    setRooms(unwrap(roomRes)?.data ?? unwrap(roomRes) ?? []);
    setOrders(unwrap(orderRes));
    setWebhookLogs(unwrap(logRes));
  };

  const loadRoom = async (roomId = selectedRoomId) => {
    if (!roomId) return;
    const [menuRes, qrRes, salesRes] = await Promise.all([
      api.get(`/addons/rooms/${roomId}/menu`),
      api.get(`/addons/rooms/${roomId}/qr`, { origin: typeof window !== 'undefined' ? window.location.origin : undefined }),
      api.get(`/addons/rooms/${roomId}/sales-info`),
    ]);
    setRoomMenu(unwrap(menuRes));
    setRoomQr(unwrap(qrRes));
    setRoomSales(unwrap(salesRes));
  };

  useEffect(() => { loadBase().catch((e) => toast(e?.message ?? 'Không tải được module add-on', 'error')); }, []);
  useEffect(() => { if (selectedRoomId) loadRoom(selectedRoomId).catch((e) => toast(e?.message ?? 'Không tải được cấu hình phòng', 'error')); }, [selectedRoomId]);

  const openProduct = (item?: any) => {
    setProductForm(item ? {
      name: item.name ?? '',
      categoryId: item.categoryId ?? '',
      description: item.description ?? '',
      imageUrl: item.imageUrl ?? '',
      price: String(Number(item.price ?? 0)),
      sortOrder: item.sortOrder ?? 0,
      isActive: item.isActive !== false,
    } : EMPTY_PRODUCT);
    setProductDialog({ open: true, item });
  };

  const uploadProductImage = async (file?: File | null) => {
    if (!file) return;
    setUploadingProductImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.postForm('/system/settings/upload-image', formData);
      const url = unwrap(res)?.url ?? res?.data?.url ?? '';
      setProductForm((current: any) => ({ ...current, imageUrl: url }));
      toast('Đã tải ảnh sản phẩm lên');
    } catch (e: any) {
      toast(e?.message ?? 'Upload ảnh thất bại', 'error');
    } finally {
      setUploadingProductImage(false);
    }
  };

  const saveProduct = async () => {
    try {
      const payload = { ...productForm, categoryId: productForm.categoryId || null, price: Number(productForm.price || 0), sortOrder: Number(productForm.sortOrder || 0) };
      if (productDialog.item) await api.patch(`/addons/products/${productDialog.item.id}`, payload);
      else await api.post('/addons/products', payload);
      setProductDialog({ open: false });
      await loadBase();
      if (selectedRoomId) await loadRoom(selectedRoomId);
      toast('Đã lưu sản phẩm add-on');
    } catch (e: any) { toast(e?.message ?? 'Không lưu được sản phẩm', 'error'); }
  };

  const openCategory = (item?: any) => {
    setCategoryForm(item ? {
      name: item.name ?? '', description: item.description ?? '', sortOrder: item.sortOrder ?? 0, isActive: item.isActive !== false,
    } : EMPTY_CATEGORY);
    setCategoryDialog({ open: true, item });
  };

  const saveCategory = async () => {
    try {
      const payload = { ...categoryForm, sortOrder: Number(categoryForm.sortOrder || 0) };
      if (categoryDialog.item) await api.patch(`/addons/categories/${categoryDialog.item.id}`, payload);
      else await api.post('/addons/categories', payload);
      setCategoryDialog({ open: false });
      await loadBase();
      toast('Đã lưu danh mục');
    } catch (e: any) { toast(e?.message ?? 'Không lưu được danh mục', 'error'); }
  };

  const updateOverride = async (productId: string, patch: any) => {
    if (!selectedRoomId) return;
    try {
      await api.patch(`/addons/rooms/${selectedRoomId}/products/${productId}`, patch);
      await loadRoom(selectedRoomId);
      toast('Đã cập nhật cấu hình phòng');
    } catch (e: any) { toast(e?.message ?? 'Không cập nhật được phòng', 'error'); }
  };

  const resetOverride = async (productId: string) => {
    if (!selectedRoomId) return;
    try {
      await api.del(`/addons/rooms/${selectedRoomId}/products/${productId}`);
      await loadRoom(selectedRoomId);
      toast('Đã trả sản phẩm về cấu hình chung');
    } catch (e: any) { toast(e?.message ?? 'Không reset được cấu hình', 'error'); }
  };

  const cancelPendingOrder = async (order: any) => {
    if (order?.status !== 'PENDING_PAYMENT') return;
    if (typeof window !== 'undefined' && !window.confirm(`Huỷ pending payment của đơn ${order.orderCode}?`)) return;
    try {
      await api.patch(`/addons/orders/${order.id}/status`, { status: 'CANCELLED' });
      await loadBase();
      if (selectedRoomId) await loadRoom(selectedRoomId);
      toast('Đã huỷ pending payment');
    } catch (e: any) { toast(e?.message ?? 'Không huỷ được pending payment', 'error'); }
  };

  const cancelAllPendingOrders = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Huỷ toàn bộ pending payment hiện tại? Các QR cũ sẽ không còn được khôi phục/poll nữa.')) return;
    try {
      const res = await api.post('/addons/orders/cancel-pending');
      await loadBase();
      if (selectedRoomId) await loadRoom(selectedRoomId);
      toast(`Đã huỷ ${unwrap(res)?.cancelled ?? 0} pending payment`);
    } catch (e: any) { toast(e?.message ?? 'Không huỷ được pending payment', 'error'); }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={900}>Quản lý Add-on Bán Hàng</Typography>
          <Typography color="text.secondary">Module gọi món/bán hàng tại phòng qua QR Code, tách riêng khỏi logic đặt phòng cũ.</Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button color="warning" variant="outlined" onClick={cancelAllPendingOrders}>Huỷ tất cả pending payment</Button>
          <Button startIcon={<AddIcon />} variant="outlined" onClick={() => openCategory()}>Danh mục</Button>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => openProduct()}>Sản phẩm</Button>
        </Stack>
      </Stack>

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
          <Tab label="Sản phẩm" />
          <Tab label="Cấu hình theo phòng" />
          <Tab label="Đơn hàng" />
          <Tab label="Webhook SePay lỗi" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Stack gap={2}>
          <Card><CardContent>
            <Typography variant="h6" fontWeight={800} gutterBottom>Danh mục</Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {categories.map((cat) => <Chip key={cat.id} label={`${cat.name}${cat.isActive ? '' : ' (tắt)'}`} onClick={() => openCategory(cat)} />)}
              {!categories.length && <Typography color="text.secondary">Chưa có danh mục.</Typography>}
            </Stack>
          </CardContent></Card>

          <Paper sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead><TableRow><TableCell>Món/dịch vụ</TableCell><TableCell>Danh mục</TableCell><TableCell>Giá chung</TableCell><TableCell>Ảnh</TableCell><TableCell>Trạng thái</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} hover>
                    <TableCell><Typography fontWeight={700}>{product.name}</Typography><Typography variant="body2" color="text.secondary">{product.description}</Typography></TableCell>
                    <TableCell>{product.category?.name ?? '—'}</TableCell>
                    <TableCell>{money(product.price)}</TableCell>
                    <TableCell>{product.imageUrl ? <Box component="img" src={product.imageUrl} alt="" sx={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 2 }} /> : '—'}</TableCell>
                    <TableCell><Chip size="small" color={product.isActive ? 'success' : 'default'} label={product.isActive ? 'Đang bán' : 'Đã tắt'} /></TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => openProduct(product)}><EditIcon /></IconButton>
                      <IconButton color="error" onClick={async () => { await api.del(`/addons/products/${product.id}`); await loadBase(); }}><DeleteIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Stack>
      )}

      {tab === 1 && (
        <Stack gap={2}>
          <Card><CardContent>
            <FormControl fullWidth>
              <InputLabel>Chọn phòng</InputLabel>
              <Select label="Chọn phòng" value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)}>
                {rooms.map((room) => <MenuItem key={room.id} value={room.id}>{room.building?.code ? `${room.building.code} · ` : ''}{room.number}</MenuItem>)}
              </Select>
            </FormControl>
          </CardContent></Card>

          {selectedRoom && <Stack direction={{ xs: 'column', lg: 'row' }} gap={2}>
            <Card sx={{ flex: 1 }}><CardContent>
              <Stack direction="row" gap={1} alignItems="center"><QrCode2Icon /><Typography variant="h6" fontWeight={800}>QR gọi món — {selectedRoom.number}</Typography></Stack>
              <Divider sx={{ my: 2 }} />
              {roomQr?.active ? <Stack gap={1}>
                <Alert severity="success">QR đang hoạt động cho khách đang lưu trú: {roomQr.guestName}</Alert>
                <Box component="img" src={roomQr.qrImageUrl} alt="QR" sx={{ width: 220, maxWidth: '100%', borderRadius: 3, border: '1px solid', borderColor: 'divider' }} />
                <TextField label="Link QR" value={roomQr.url ?? ''} fullWidth InputProps={{ readOnly: true }} />
                <Button href={roomQr.qrImageUrl} target="_blank" variant="outlined">Tải / in QR</Button>
              </Stack> : <Alert severity="warning">{roomQr?.message ?? 'Chọn phòng để tạo QR.'}</Alert>}
            </CardContent></Card>

            <Card sx={{ flex: 1 }}><CardContent>
              <Stack direction="row" gap={1} alignItems="center"><ReceiptLongIcon /><Typography variant="h6" fontWeight={800}>Thông tin bán hàng</Typography></Stack>
              <Divider sx={{ my: 2 }} />
              {roomSales?.active ? <Stack gap={1}>
                <Typography>Tổng đã thanh toán: <b>{money(roomSales.totalPaid)}</b></Typography>
                <Typography>Đang chờ thanh toán: <b>{money(roomSales.totalPending)}</b></Typography>
                <Typography variant="body2" color="text.secondary">{roomSales.orders?.length ?? 0} đơn trong lượt khách hiện tại.</Typography>
              </Stack> : <Alert severity="info">Phòng chưa có khách đang lưu trú.</Alert>}
            </CardContent></Card>
          </Stack>}

          {selectedRoom && <Paper sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead><TableRow><TableCell>Sản phẩm</TableCell><TableCell>Giá chung</TableCell><TableCell>Giá phòng này</TableCell><TableCell>Đang bán ở phòng</TableCell><TableCell align="right">Reset</TableCell></TableRow></TableHead>
              <TableBody>
                {products.map((product) => {
                  const override = roomMenu?.overrides?.find((item: any) => item.productId === product.id);
                  return <TableRow key={product.id} hover>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{money(product.price)}</TableCell>
                    <TableCell><TextField size="small" placeholder="Theo giá chung" defaultValue={override?.customPrice ? Number(override.customPrice) : ''} onBlur={(e) => updateOverride(product.id, { customPrice: e.target.value === '' ? null : Number(e.target.value), isAvailable: override?.isAvailable ?? true })} /></TableCell>
                    <TableCell><Switch checked={override ? override.isAvailable : true} onChange={(e) => updateOverride(product.id, { isAvailable: e.target.checked, customPrice: override?.customPrice ?? null })} /></TableCell>
                    <TableCell align="right"><Button size="small" onClick={() => resetOverride(product.id)}>Reset</Button></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </Paper>}
        </Stack>
      )}

      {tab === 2 && <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead><TableRow><TableCell>Mã đơn</TableCell><TableCell>Phòng</TableCell><TableCell>Khách</TableCell><TableCell>Tổng</TableCell><TableCell>Trạng thái</TableCell><TableCell>Ngày tạo</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
          <TableBody>{orders.map((order) => <TableRow key={order.id} hover><TableCell>{order.orderCode}</TableCell><TableCell>{order.room?.number}</TableCell><TableCell>{order.guestName}</TableCell><TableCell>{money(order.totalAmount)}</TableCell><TableCell><Chip size="small" color={order.status === 'PENDING_PAYMENT' ? 'warning' : undefined} label={order.status} /></TableCell><TableCell>{new Date(order.createdAt).toLocaleString('vi-VN')}</TableCell><TableCell align="right">{order.status === 'PENDING_PAYMENT' && <Button color="warning" size="small" onClick={() => cancelPendingOrder(order)}>Huỷ pending</Button>}</TableCell></TableRow>)}</TableBody>
        </Table>
      </Paper>}

      {tab === 3 && <Paper sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead><TableRow><TableCell>Thời gian</TableCell><TableCell>Trạng thái</TableCell><TableCell>Nội dung CK</TableCell><TableCell>Số tiền</TableCell><TableCell>Lỗi</TableCell><TableCell align="right">Thao tác</TableCell></TableRow></TableHead>
          <TableBody>{webhookLogs.map((log) => <TableRow key={log.id} hover><TableCell>{new Date(log.createdAt).toLocaleString('vi-VN')}</TableCell><TableCell><Chip size="small" label={log.status} /></TableCell><TableCell>{log.transferContent || '—'}</TableCell><TableCell>{log.amount ? money(log.amount) : '—'}</TableCell><TableCell>{log.error}</TableCell><TableCell align="right">{log.orderId && log.status !== 'MATCHED' && <Button size="small" onClick={async () => { await api.post(`/addons/sepay/webhook-logs/${log.id}/manual-confirm`); await loadBase(); }}>Xác nhận thủ công</Button>}</TableCell></TableRow>)}</TableBody>
        </Table>
      </Paper>}

      <Dialog open={productDialog.open} onClose={() => setProductDialog({ open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>{productDialog.item ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
        <DialogContent><Stack gap={2} sx={{ pt: 1 }}>
          <TextField label="Tên món/dịch vụ" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
          <FormControl><InputLabel>Danh mục</InputLabel><Select label="Danh mục" value={productForm.categoryId} onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}><MenuItem value="">Không phân loại</MenuItem>{categories.map((cat) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}</Select></FormControl>
          <TextField label="Giá bán" type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
            {productForm.imageUrl ? <Box component="img" src={productForm.imageUrl} alt="" sx={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} /> : <Box sx={{ width: 88, height: 88, borderRadius: 2, border: '1px dashed', borderColor: 'divider', display: 'grid', placeItems: 'center', color: 'text.secondary' }}>Ảnh</Box>}
            <Stack gap={1} sx={{ flex: 1 }}>
              <Button component="label" variant="outlined" startIcon={<UploadIcon />} disabled={uploadingProductImage} sx={{ width: { xs: '100%', sm: 'fit-content' } }}>
                {uploadingProductImage ? 'Đang tải...' : 'Tải ảnh sản phẩm lên'}
                <input hidden type="file" accept="image/*" onChange={(e) => uploadProductImage(e.target.files?.[0])} />
              </Button>
              <TextField label="Link hình ảnh" value={productForm.imageUrl} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} helperText="Có thể tải ảnh lên hoặc dán link nếu cần." />
            </Stack>
          </Stack>
          <TextField label="Mô tả" multiline minRows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
          <Stack direction="row" alignItems="center" gap={1}><Switch checked={productForm.isActive} onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })} />Đang bán</Stack>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setProductDialog({ open: false })}>Huỷ</Button><Button variant="contained" onClick={saveProduct}>Lưu</Button></DialogActions>
      </Dialog>

      <Dialog open={categoryDialog.open} onClose={() => setCategoryDialog({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>{categoryDialog.item ? 'Sửa danh mục' : 'Thêm danh mục'}</DialogTitle>
        <DialogContent><Stack gap={2} sx={{ pt: 1 }}><TextField label="Tên danh mục" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /><TextField label="Mô tả" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} /><TextField label="Thứ tự" type="number" value={categoryForm.sortOrder} onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: e.target.value })} /><Stack direction="row" alignItems="center" gap={1}><Switch checked={categoryForm.isActive} onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })} />Đang bật</Stack></Stack></DialogContent>
        <DialogActions><Button onClick={() => setCategoryDialog({ open: false })}>Huỷ</Button><Button variant="contained" onClick={saveCategory}>Lưu</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
