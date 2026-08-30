'use client';

import React, { useState, useEffect } from 'react';
import { RouteGuard } from '@/components/layout/RouteGuard';
import {
  Box, Tabs, Tab, Paper, Typography, Stack, TextField, Button, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Switch, FormControlLabel, Alert,
  InputAdornment, Avatar,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UploadIcon from '@mui/icons-material/Upload';
import {
  useApiKeys, useCreateApiKey, useRevokeApiKey,
  useSystemSettings, useUpdateSystemSettings, useUploadSystemImage,
  useWebhooks, useCreateWebhook, useUpdateWebhook, useDeleteWebhook, useTestWebhook,
} from '@/hooks/api';
import { useToast } from '@/providers/ToastProvider';
import { useAppearance } from '@/providers/AppThemeProvider';
import { THEME_PRESETS } from '@/theme/theme';
import dayjs from 'dayjs';

function TabPanel({ value, index, children }: any) {
  return value === index ? <Box sx={{ pt: 4 }}>{children}</Box> : null;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box>
      <Typography variant="h6" fontWeight={680} mb={1}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
    </Box>
  );
}

function GeneralTab() {
  const { toast } = useToast();
  const { setAppearance } = useAppearance();
  const { data: settingsData, isLoading } = useSystemSettings();
  const updateMut = useUpdateSystemSettings();
  const uploadMut = useUploadSystemImage();

  const settings = settingsData?.data ?? {};
  const [form, setForm] = React.useState<{
    business_name: string;
    business_address: string;
    business_phone: string;
    business_email: string;
    app_display_name: string;
    system_logo_url: string;
    admin_avatar_url: string;
    theme_mode: string;
    theme_primary_color: string;
    theme_radius: string;
    addon_public_show_guest_info: string;
    addon_public_background_url: string;
    addon_public_hero_url: string;
    addon_public_overlay_opacity: string;
    addon_public_card_opacity: string;
  }>({
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    app_display_name: '',
    system_logo_url: '',
    admin_avatar_url: '',
    theme_mode: 'dark',
    theme_primary_color: THEME_PRESETS[0].primary,
    theme_radius: '22',
    addon_public_show_guest_info: 'true',
    addon_public_background_url: '',
    addon_public_hero_url: '',
    addon_public_overlay_opacity: '78',
    addon_public_card_opacity: '54',
  });

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setForm({
        business_name: settings.business_name ?? '',
        business_address: settings.business_address ?? '',
        business_phone: settings.business_phone ?? '',
        business_email: settings.business_email ?? '',
        app_display_name: settings.app_display_name ?? 'Opera Residences',
        system_logo_url: settings.system_logo_url ?? '',
        admin_avatar_url: settings.admin_avatar_url ?? '',
        theme_mode: settings.theme_mode === 'light' ? 'light' : 'dark',
        theme_primary_color: settings.theme_primary_color ?? THEME_PRESETS[0].primary,
        theme_radius: settings.theme_radius ?? '22',
        addon_public_show_guest_info: settings.addon_public_show_guest_info === 'false' ? 'false' : 'true',
        addon_public_background_url: settings.addon_public_background_url ?? '',
        addon_public_hero_url: settings.addon_public_hero_url ?? '',
        addon_public_overlay_opacity: settings.addon_public_overlay_opacity ?? '78',
        addon_public_card_opacity: settings.addon_public_card_opacity ?? '54',
      });
    }
  }, [settingsData]);

  const handleUpload = async (kind: 'system_logo_url' | 'admin_avatar_url' | 'addon_public_background_url' | 'addon_public_hero_url', file?: File | null) => {
    if (!file) return;
    try {
      const res = await uploadMut.mutateAsync(file);
      const url = res?.data?.url ?? '';
      setForm((prev) => ({ ...prev, [kind]: url }));
      if (kind === 'system_logo_url' || kind === 'admin_avatar_url') setAppearance({ [kind]: url });
      toast('Upload ảnh thành công', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Upload ảnh thất bại', 'error');
    }
  };

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync(form);
      setAppearance({
        app_display_name: form.app_display_name,
        system_logo_url: form.system_logo_url,
        admin_avatar_url: form.admin_avatar_url,
        theme_mode: form.theme_mode as 'dark' | 'light',
        theme_primary_color: form.theme_primary_color,
        theme_radius: form.theme_radius,
      });
      toast('Lưu cài đặt thành công', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi khi lưu', 'error');
    }
  };

  if (isLoading) return <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Paper sx={{ p: { xs: 3, md: 4 }, maxWidth: 760, borderRadius: '28px', background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)' }}>
      <Stack spacing={5}>
        <Box>
          <SectionHeading title="Thông tin doanh nghiệp" />
          <Stack spacing={3} sx={{ mt: 3 }}>
            <TextField label="Tên doanh nghiệp" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            <TextField label="Địa chỉ" value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} />
            <TextField label="Số điện thoại" value={form.business_phone} onChange={(e) => setForm({ ...form, business_phone: e.target.value })} />
            <TextField label="Email" type="email" value={form.business_email} onChange={(e) => setForm({ ...form, business_email: e.target.value })} />
          </Stack>
        </Box>

        <Box>
          <SectionHeading title="Giao diện" subtitle="Tinh chỉnh lớp hiển thị theo hướng sáng, thoáng, cân bằng và ít màu nhấn hơn." />
          <Stack spacing={3} sx={{ mt: 3 }}>
            <TextField label="Tên hiển thị ứng dụng" value={form.app_display_name} onChange={(e) => setForm({ ...form, app_display_name: e.target.value })} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Avatar src={form.system_logo_url || undefined} variant="rounded" sx={{ width: 64, height: 64, borderRadius: '18px', bgcolor: 'action.hover' }} />
              <Stack spacing={1.25} sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>Logo hệ thống</Typography>
                <Typography variant="caption" color="text.secondary">Ảnh này sẽ hiện bên trái chữ ChiHome.</Typography>
                <Button component="label" variant="outlined" startIcon={uploadMut.isPending ? <CircularProgress size={16} /> : <UploadIcon />} disabled={uploadMut.isPending} sx={{ width: { xs: '100%', sm: 'fit-content' } }}>
                  Tải logo lên
                  <input hidden type="file" accept="image/*" onChange={(e) => handleUpload('system_logo_url', e.target.files?.[0])} />
                </Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Avatar src={form.admin_avatar_url || undefined} sx={{ width: 64, height: 64, bgcolor: 'action.hover' }} />
              <Stack spacing={1.25} sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>Avatar admin</Typography>
                <Typography variant="caption" color="text.secondary">Ảnh này sẽ dùng cho tài khoản admin trong giao diện.</Typography>
                <Button component="label" variant="outlined" startIcon={uploadMut.isPending ? <CircularProgress size={16} /> : <UploadIcon />} disabled={uploadMut.isPending} sx={{ width: { xs: '100%', sm: 'fit-content' } }}>
                  Tải avatar lên
                  <input hidden type="file" accept="image/*" onChange={(e) => handleUpload('admin_avatar_url', e.target.files?.[0])} />
                </Button>
              </Stack>
            </Stack>
            <TextField select label="Chế độ giao diện" value={form.theme_mode} onChange={(e) => setForm({ ...form, theme_mode: e.target.value })}>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </TextField>
            <TextField select label="Preset giao diện" value={form.theme_primary_color} onChange={(e) => setForm({ ...form, theme_primary_color: e.target.value })} helperText="Palette trung tính, sáng và tối giản cho giao diện luxury glass">
              {THEME_PRESETS.map((preset) => (
                <MenuItem key={preset.id} value={preset.primary}>{preset.label}</MenuItem>
              ))}
            </TextField>
            <TextField select label="Độ bo góc" value={form.theme_radius} onChange={(e) => setForm({ ...form, theme_radius: e.target.value })}>
              <MenuItem value="16">Tinh gọn</MenuItem>
              <MenuItem value="22">Cân bằng</MenuItem>
              <MenuItem value="28">Mềm sang</MenuItem>
            </TextField>
          </Stack>
        </Box>

        <Box>
          <SectionHeading title="QR gọi món" subtitle="Tuỳ chỉnh thông tin hiển thị trên trang public khi khách quét QR trong phòng." />
          <Stack spacing={2} sx={{ mt: 3 }}>
            <FormControlLabel
              control={<Switch checked={form.addon_public_show_guest_info !== 'false'} onChange={(e) => setForm({ ...form, addon_public_show_guest_info: e.target.checked ? 'true' : 'false' })} />}
              label="Hiển thị tên khách + giờ in/out trên trang quét QR"
            />
            <Alert severity="info">Mã phòng luôn hiển thị bắt buộc. Khi tắt mục này, khách chỉ thấy mã phòng và danh sách sản phẩm để đặt hàng.</Alert>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Avatar src={form.addon_public_background_url || undefined} variant="rounded" sx={{ width: 96, height: 64, borderRadius: '18px', bgcolor: 'action.hover' }} />
              <Stack spacing={1.25} sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>Ảnh background trang khách</Typography>
                <Typography variant="caption" color="text.secondary">Ảnh nền toàn trang khi khách mở giao diện gọi món.</Typography>
                <Button component="label" variant="outlined" startIcon={uploadMut.isPending ? <CircularProgress size={16} /> : <UploadIcon />} disabled={uploadMut.isPending} sx={{ width: { xs: '100%', sm: 'fit-content' } }}>
                  Tải background lên
                  <input hidden type="file" accept="image/*" onChange={(e) => handleUpload('addon_public_background_url', e.target.files?.[0])} />
                </Button>
              </Stack>
            </Stack>
            <TextField label="Link background trang khách" value={form.addon_public_background_url} onChange={(e) => setForm({ ...form, addon_public_background_url: e.target.value })} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Avatar src={form.addon_public_hero_url || undefined} variant="rounded" sx={{ width: 96, height: 64, borderRadius: '18px', bgcolor: 'action.hover' }} />
              <Stack spacing={1.25} sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700}>Ảnh bìa Room Service</Typography>
                <Typography variant="caption" color="text.secondary">Ảnh hero ở đầu trang gọi món của khách.</Typography>
                <Button component="label" variant="outlined" startIcon={uploadMut.isPending ? <CircularProgress size={16} /> : <UploadIcon />} disabled={uploadMut.isPending} sx={{ width: { xs: '100%', sm: 'fit-content' } }}>
                  Tải ảnh bìa lên
                  <input hidden type="file" accept="image/*" onChange={(e) => handleUpload('addon_public_hero_url', e.target.files?.[0])} />
                </Button>
              </Stack>
            </Stack>
            <TextField label="Link ảnh bìa Room Service" value={form.addon_public_hero_url} onChange={(e) => setForm({ ...form, addon_public_hero_url: e.target.value })} />

            <TextField label="Độ mờ lớp phủ background (%)" type="number" inputProps={{ min: 0, max: 100 }} value={form.addon_public_overlay_opacity} onChange={(e) => setForm({ ...form, addon_public_overlay_opacity: e.target.value })} helperText="Số càng cao nền càng tối/dễ đọc chữ hơn." />
            <TextField label="Độ mờ nền thẻ sản phẩm (%)" type="number" inputProps={{ min: 0, max: 100 }} value={form.addon_public_card_opacity} onChange={(e) => setForm({ ...form, addon_public_card_opacity: e.target.value })} helperText="Số càng cao thẻ sản phẩm càng đậm." />
          </Stack>
        </Box>

        <Box>
          <Button variant="contained" onClick={handleSave} disabled={updateMut.isPending} sx={{ minWidth: 160 }}>
            {updateMut.isPending ? <CircularProgress size={20} color="inherit" /> : 'Lưu cài đặt'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

const ALL_EVENTS = [
  'reservation.created', 'reservation.updated', 'reservation.cancelled',
  'reservation.checked_in', 'reservation.checked_out', 'reservation.room_changed',
];

function WebhooksTab() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useWebhooks();
  const webhooks: any[] = data?.data ?? [];
  const createMut = useCreateWebhook();
  const updateMut = useUpdateWebhook();
  const deleteMut = useDeleteWebhook();
  const testMut = useTestWebhook();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', url: '', secret: '', isActive: true });

  const openCreate = () => { setEditTarget(null); setForm({ name: 'n8n Integration', url: '', secret: '', isActive: true }); setDialogOpen(true); };
  const openEdit = (wh: any) => { setEditTarget(wh); setForm({ name: wh.name, url: wh.url, secret: wh.secret ?? '', isActive: wh.isActive }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.name || !form.url) { toast('Vui lòng điền đủ tên và URL', 'warning'); return; }
    try {
      if (editTarget) {
        await updateMut.mutateAsync({ id: editTarget.id, ...form });
        toast('Đã cập nhật webhook');
      } else {
        await createMut.mutateAsync({ ...form, events: ALL_EVENTS });
        toast('Đã tạo webhook');
      }
      setDialogOpen(false);
      refetch();
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast('Đã xoá webhook', 'warning');
      setDeleteTarget(null);
      refetch();
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi', 'error');
    }
  };

  const handleTest = async (id: string) => {
    try { await testMut.mutateAsync(id); toast('Đã gửi test ping đến webhook'); }
    catch (e: any) { toast(e?.message ?? 'Lỗi kết nối', 'error'); }
  };

  const handleToggle = async (wh: any) => {
    try {
      await updateMut.mutateAsync({ id: wh.id, isActive: !wh.isActive });
      refetch();
    } catch {}
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" fontWeight={680}>Webhook / n8n</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Hệ thống sẽ tự động gửi events đến URL được cấu hình khi có booking, check-in, check-out...
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>Thêm Webhook</Button>
      </Box>

      <Alert severity="info" sx={{ mb: 4 }}>
        <strong>Events hỗ trợ:</strong> {ALL_EVENTS.join(' · ')}
      </Alert>

      {isLoading ? (
        <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box>
      ) : webhooks.length === 0 ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: '28px' }}>
          <Typography color="text.secondary">Chưa có webhook nào. Nhấn "Thêm Webhook" để bắt đầu.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: '28px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {webhooks.map((wh: any) => (
                <TableRow key={wh.id} hover>
                  <TableCell><Typography fontWeight={600}>{wh.name}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wh.url}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Switch size="small" checked={wh.isActive} onChange={() => handleToggle(wh)} />
                      <Chip label={wh.isActive ? 'Active' : 'Inactive'} size="small" />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Test kết nối (gửi ping)">
                        <IconButton size="small" color="primary" onClick={() => handleTest(wh.id)} disabled={!wh.isActive}>
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Chỉnh sửa">
                        <IconButton size="small" onClick={() => openEdit(wh)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Xoá">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget({ id: wh.id, name: wh.name })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={680}>{editTarget ? 'Sửa Webhook' : 'Thêm Webhook mới'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField fullWidth label="Tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="n8n Integration" />
            <TextField fullWidth label="Webhook URL *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://your-n8n.instance/webhook/..." />
            <TextField fullWidth label="Secret Token" type="password" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} helperText="Tùy chọn – dùng để verify HMAC SHA-256 signature" />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Kích hoạt ngay" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
            {createMut.isPending || updateMut.isPending ? <CircularProgress size={20} color="inherit" /> : editTarget ? 'Lưu thay đổi' : 'Tạo webhook'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={680}>Xoá webhook</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            {deleteTarget ? `Bạn có chắc muốn xoá webhook "${deleteTarget.name}" không?` : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteMut.isPending}>Huỷ</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteMut.isPending}>
            {deleteMut.isPending ? 'Đang xoá...' : 'Xác nhận xoá'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ApiKeysTab() {
  const { data, isLoading, refetch } = useApiKeys();
  const apiKeys: any[] = data?.data ?? [];
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const createMut = useCreateApiKey();
  const revokeMut = useRevokeApiKey();

  const handleCreate = async () => {
    if (!newKeyName) return;
    try {
      const result = await createMut.mutateAsync({ name: newKeyName });
      const key = result?.data?.key ?? result?.key ?? null;
      if (key) setNewKeyResult({ key, name: newKeyName });
      setNewKeyName('');
      setDialogOpen(false);
      refetch();
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi tạo API key', 'error');
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeMut.mutateAsync(revokeTarget.id);
      toast('Đã thu hồi API key', 'warning');
      setRevokeTarget(null);
      refetch();
    } catch (e: any) {
      toast(e?.message ?? 'Lỗi', 'error');
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    toast('Đã copy API key vào clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box>
      {newKeyResult && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: '28px', border: '1px solid var(--border-strong)', bgcolor: 'var(--surface-elevated)' }}>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'var(--surface-strong)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography fontSize={16}>⚠️</Typography>
            </Box>
            <Box>
              <Typography fontWeight={680}>Lưu API Key ngay</Typography>
              <Typography variant="body2" color="text.secondary">Key "{newKeyResult.name}" chỉ hiển thị một lần trước khi đóng ô này.</Typography>
            </Box>
          </Stack>
          <TextField
            fullWidth
            value={newKeyResult.key}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace', fontSize: 13, bgcolor: 'var(--surface-strong)' },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={copied ? 'Đã copy!' : 'Copy key'}>
                    <IconButton onClick={() => copyKey(newKeyResult.key)} color={copied ? 'success' : 'default'}>
                      {copied ? <CheckCircleIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          <Button size="small" variant="outlined" sx={{ mt: 3 }} onClick={() => setNewKeyResult(null)}>
            Tôi đã lưu key này
          </Button>
        </Paper>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" fontWeight={680}>API Keys</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>Tạo API Key</Button>
      </Box>

      {isLoading ? (
        <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: '28px' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Prefix</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Dùng lần cuối</TableCell>
                <TableCell>Tạo lúc</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" py={4}>Chưa có API key nào</Typography>
                  </TableCell>
                </TableRow>
              ) : apiKeys.map((k: any) => (
                <TableRow key={k.id} hover>
                  <TableCell><Typography fontWeight={600}>{k.name}</Typography></TableCell>
                  <TableCell><Typography fontFamily="monospace" variant="body2">{k.keyPrefix}...</Typography></TableCell>
                  <TableCell><Chip label={k.isActive ? 'Active' : 'Revoked'} size="small" /></TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{k.lastUsedAt ? dayjs(k.lastUsedAt).format('DD/MM HH:mm') : 'Chưa dùng'}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{dayjs(k.createdAt).format('DD/MM/YYYY')}</Typography></TableCell>
                  <TableCell>
                    {k.isActive && (
                      <Tooltip title="Thu hồi">
                        <IconButton size="small" color="error" onClick={() => setRevokeTarget({ id: k.id, name: k.name })}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={680}>Tạo API Key mới</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Tên API Key"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="VD: n8n Integration, External App..."
            sx={{ mt: 2 }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newKeyName || createMut.isPending}>
            {createMut.isPending ? <CircularProgress size={20} color="inherit" /> : 'Tạo key'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={680}>Thu hồi API key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
            {revokeTarget ? `Bạn có chắc muốn thu hồi API key "${revokeTarget.name}" không? Key này sẽ ngừng hoạt động ngay.` : ''}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setRevokeTarget(null)} disabled={revokeMut.isPending}>Huỷ</Button>
          <Button variant="contained" color="error" onClick={handleRevoke} disabled={revokeMut.isPending}>
            {revokeMut.isPending ? 'Đang thu hồi...' : 'Xác nhận thu hồi'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0);

  return (
    <RouteGuard require="system">
      <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <SettingsIcon color="primary" />
          <Typography variant="h5" fontWeight={680}>Cài đặt hệ thống</Typography>
        </Box>

        <Paper sx={{ borderRadius: '32px', background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 2, md: 3 } }}>
            <Tab label="Thông tin chung" />
            <Tab label="Webhook / n8n" />
            <Tab label="API Keys" />
          </Tabs>
          <Box sx={{ p: { xs: 2, md: 4 } }}>
            <TabPanel value={tab} index={0}><GeneralTab /></TabPanel>
            <TabPanel value={tab} index={1}><WebhooksTab /></TabPanel>
            <TabPanel value={tab} index={2}><ApiKeysTab /></TabPanel>
          </Box>
        </Paper>
      </Box>
    </RouteGuard>
  );
}
