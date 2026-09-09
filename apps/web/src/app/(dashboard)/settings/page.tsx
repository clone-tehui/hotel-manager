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
  useAiCeoStatus, useAiCeoRuns, useAiCeoRun, useCancelAiCeoRun, useUpdateAiCeoConfig, useRunAiCeo, useAiCeoCampaigns, useTransitionAiCeoCampaign, useMeasureAiCeoCampaign,
  useOtaConnectors, useConfigureOtaConnector, usePreviewOtaConnector, useExecuteOtaConnector, useOtaConnectorAudits,
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

function AiCeoTab() {
  const { toast } = useToast();
  const { data: statusData, isLoading } = useAiCeoStatus();
  const { data: runsData } = useAiCeoRuns();
  const updateMut = useUpdateAiCeoConfig();
  const runMut = useRunAiCeo();
  const cancelMut = useCancelAiCeoRun();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: selectedRunData, isLoading: isRunLoading } = useAiCeoRun(selectedRunId || undefined);
  const { data: campaignsData } = useAiCeoCampaigns();
  const transitionMut = useTransitionAiCeoCampaign();
  const measureMut = useMeasureAiCeoCampaign();
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string>('ALL');
  const [decisionTarget, setDecisionTarget] = useState<{ id: string; action: 'APPROVED' | 'REJECTED' | 'CANCELLED' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const status = statusData?.data ?? statusData ?? {};
  const runs: any[] = runsData?.data ?? runsData ?? [];
  const [form, setForm] = useState({ model: '', apiKey: '', enabled: false, maxTokens: 6000, runControls: { maxRunsPerDay: 4, maxBatchesPerRun: 8, maxConcurrentRuns: 1, failureThreshold: 3, cooldownMs: 900000 } });
  useEffect(() => { if (status?.model) setForm((current) => ({ ...current, model: status.model, enabled: Boolean(status.enabled), maxTokens: Number(status.maxTokens || 6000), runControls: status.runControls ?? current.runControls })); }, [status?.model, status?.enabled, status?.maxTokens, status?.runControls]);
  const save = async () => { try { await updateMut.mutateAsync(form); setForm((current) => ({ ...current, apiKey: '' })); toast('Đã lưu cấu hình AI CEO', 'success'); } catch (e: any) { toast(e?.message ?? 'Không lưu được cấu hình AI', 'error'); } };
  const run = async () => { try { await runMut.mutateAsync(undefined); toast('AI CEO đã phân tích và tạo chiến dịch đề xuất', 'success'); } catch (e: any) { toast(e?.message ?? 'AI CEO chưa chạy được', 'error'); } };
  const selectedRun: any = selectedRunData?.data ?? selectedRunData ?? null;
  const isTerminal = (status?: string) => ['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL'].includes(status || '');
  const requestCancel = async (id: string) => { try { await cancelMut.mutateAsync(id); toast('Đã yêu cầu dừng run an toàn; batch đang chạy sẽ kết thúc theo policy.', 'success'); } catch (e: any) { toast(e?.message ?? 'Không thể yêu cầu dừng run', 'error'); } };
  const allCampaigns: any[] = campaignsData?.data ?? campaignsData ?? [];
  const campaigns = campaignStatusFilter === 'ALL' ? allCampaigns : allCampaigns.filter((c: any) => c.status === campaignStatusFilter);
  const counts = allCampaigns.reduce((acc: Record<string, number>, c: any) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
  const openDecision = (id: string, action: 'APPROVED' | 'REJECTED' | 'CANCELLED') => { setDecisionTarget({ id, action }); setDecisionReason(''); };
  const submitDecision = async () => { if (!decisionTarget || !decisionReason.trim()) return; try { await transitionMut.mutateAsync({ id: decisionTarget.id, status: decisionTarget.action, reason: decisionReason.trim() }); toast(`Đã chuyển trạng thái chiến dịch sang ${decisionTarget.action}`, 'success'); setDecisionTarget(null); setDecisionReason(''); } catch (e: any) { toast(e?.message ?? 'Không thể cập nhật trạng thái chiến dịch', 'error'); } };
  const requestMeasure = async (id: string) => { try { const r = await measureMut.mutateAsync(id); const m = r?.data?.measurement ?? r?.measurement; toast(m?.outcome ? `Đã đo lường: ${m.outcome}` : 'Đã ghi nhận phép đo', 'success'); } catch (e: any) { toast(e?.message ?? 'Không thể đo lường chiến dịch', 'error'); } };
  if (isLoading) return <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  return <Stack spacing={3}>
    <Alert severity="info">AI CEO hiện ở chế độ <b>chỉ đọc và đề xuất</b>. Agent không có tool tự đổi giá OTA. Mọi chiến dịch đều cần quản lý duyệt.</Alert>
    <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: '28px' }}><Stack spacing={2.5}>
      <SectionHeading title="Model & tay chân của AI CEO" subtitle="OpenRouter model + memory PostgreSQL + công cụ đọc dữ liệu ChiHome. API key được mã hoá ở backend và không bao giờ hiển thị lại." />
      <TextField label="OpenRouter model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="openai/gpt-4.1-mini" />
      <TextField label={status.configured ? 'OpenRouter API key (đã cấu hình — chỉ nhập nếu muốn thay)' : 'OpenRouter API key'} type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-or-v1-..." helperText="Secret không được trả về trình duyệt sau khi lưu." />
      <TextField label="Giới hạn output token" type="number" inputProps={{ min: 1000, max: 12000 }} value={form.maxTokens} onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })} />
      <FormControlLabel control={<Switch checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />} label="Bật AI CEO" />
      <Alert severity="warning">Chi phí USD chỉ được ghi nhận sau khi OpenRouter trả <code>usage.cost</code>. Hệ thống không tự ước tính tiền trước khi chạy.</Alert>
      <Typography variant="subtitle2">Giới hạn vận hành (không phải giới hạn tiền)</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Số run tối đa / ngày" type="number" inputProps={{ min: 1, max: 24 }} value={form.runControls.maxRunsPerDay} onChange={(e) => setForm({ ...form, runControls: { ...form.runControls, maxRunsPerDay: Number(e.target.value) } })} fullWidth /><TextField label="Batch tối đa / run" type="number" inputProps={{ min: 1, max: 100 }} value={form.runControls.maxBatchesPerRun} onChange={(e) => setForm({ ...form, runControls: { ...form.runControls, maxBatchesPerRun: Number(e.target.value) } })} fullWidth /><TextField label="Run đồng thời" type="number" inputProps={{ min: 1, max: 5 }} value={form.runControls.maxConcurrentRuns} onChange={(e) => setForm({ ...form, runControls: { ...form.runControls, maxConcurrentRuns: Number(e.target.value) } })} fullWidth /></Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Lỗi liên tiếp trước khi tạm dừng provider" type="number" inputProps={{ min: 1, max: 10 }} value={form.runControls.failureThreshold} onChange={(e) => setForm({ ...form, runControls: { ...form.runControls, failureThreshold: Number(e.target.value) } })} fullWidth /><TextField label="Thời gian tạm dừng provider (phút)" type="number" inputProps={{ min: 1, max: 1440 }} value={Math.round(form.runControls.cooldownMs / 60000)} onChange={(e) => setForm({ ...form, runControls: { ...form.runControls, cooldownMs: Number(e.target.value) * 60000 } })} fullWidth /></Stack>
      <Typography variant="caption" color="text.secondary">Trạng thái provider: {status.providerCircuit?.openedUntil ? `đang tạm dừng tới ${dayjs(status.providerCircuit.openedUntil).format('DD/MM HH:mm')}` : `sẵn sàng · lỗi liên tiếp: ${status.providerCircuit?.failures ?? 0}`}. Chi phí thực tế sẽ lấy từ OpenRouter sau từng request nếu provider trả về.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="contained" onClick={save} disabled={updateMut.isPending}>{updateMut.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}</Button><Button variant="outlined" startIcon={<PlayArrowIcon />} onClick={run} disabled={!status.configured || !status.enabled || runMut.isPending}>{runMut.isPending ? 'AI đang đọc dữ liệu…' : 'Chạy phân tích ngay'}</Button></Stack>
      <Stack direction="row" gap={1} flexWrap="wrap"><Chip label={status.configured ? 'OpenRouter: đã cấu hình' : 'OpenRouter: chưa có key'} color={status.configured ? 'success' : 'warning'} /><Chip label={`Memory: ${status.memoryCount ?? 0}`} /><Chip label={`Chiến dịch: ${status.campaignCount ?? 0}`} /><Chip label="Advisory only" color="info" /></Stack>
      <Typography variant="caption" color="text.secondary">Tools: {(status.tools ?? []).join(' · ') || '—'}</Typography>
    </Stack></Paper>
    <Paper sx={{ p: 3, borderRadius: '28px' }}><SectionHeading title="Vận hành & lịch sử lần chạy" subtitle="Theo dõi phase, tiến độ, batch và lỗi; yêu cầu dừng không thay đổi booking/OTA." /><Stack spacing={1.25} sx={{ mt: 2 }}>{runs.length ? runs.map((item: any) => <Box key={item.id} sx={{ p: 1.5, border: '1px solid', borderColor: selectedRunId === item.id ? 'primary.main' : 'divider', borderRadius: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography variant="body2" fontWeight={700}>{item.model}</Typography><Typography variant="caption" color="text.secondary">{dayjs(item.startedAt).format('DD/MM/YYYY HH:mm')} · {(item.periodKeys ?? []).join(', ')}</Typography></Box><Stack direction="row" gap={1} alignItems="center"><Chip size="small" label={item.status} color={item.status === 'COMPLETED' ? 'success' : item.status === 'FAILED' ? 'error' : 'warning'} /><Button size="small" onClick={() => setSelectedRunId(item.id)}>Chi tiết</Button>{!isTerminal(item.status) && <Button size="small" color="warning" onClick={() => requestCancel(item.id)} disabled={cancelMut.isPending}>Dừng</Button>}</Stack></Stack><Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}><Chip size="small" variant="outlined" label={`Phase: ${item.currentPhase ?? '—'}`} /><Chip size="small" variant="outlined" label={`Tiến độ: ${item.progress ?? 0}%`} /><Chip size="small" variant="outlined" label={`Batch: ${item.completedBatches ?? 0}/${item.totalBatches ?? 0} xong · ${item.failedBatches ?? 0} lỗi`} /></Stack>{item.error && <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.75 }}>{item.error}</Typography>}</Box>) : <Typography variant="body2" color="text.secondary">Chưa có lần phân tích nào.</Typography>}</Stack></Paper>
    <Dialog open={!!selectedRunId} onClose={() => setSelectedRunId(null)} fullWidth maxWidth="md"><DialogTitle>Chi tiết run AI CEO</DialogTitle><DialogContent dividers>{isRunLoading || !selectedRun ? <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box> : <Stack spacing={2}><Stack direction="row" gap={1} flexWrap="wrap"><Chip label={selectedRun.status} color={selectedRun.status === 'COMPLETED' ? 'success' : selectedRun.status === 'FAILED' ? 'error' : 'warning'} /><Chip label={`Phase: ${selectedRun.currentPhase ?? '—'}`} /><Chip label={`Tiến độ: ${selectedRun.progress ?? 0}%`} /><Chip label={`Batches: ${selectedRun.completedBatches ?? 0}/${selectedRun.totalBatches ?? 0} · lỗi ${selectedRun.failedBatches ?? 0}`} /></Stack>{selectedRun.error && <Alert severity="error">{selectedRun.error}</Alert>}<Typography variant="subtitle2">Các batch</Typography><Stack spacing={1}>{(selectedRun.batches ?? []).map((batch: any) => <Paper key={batch.id} variant="outlined" sx={{ p: 1.25 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={700}>Batch {batch.sequence} · {batch.roomIds?.length ?? 0} căn</Typography><Chip size="small" label={batch.status} color={batch.status === 'COMPLETED' ? 'success' : batch.status === 'FAILED' ? 'error' : 'warning'} /></Stack><Typography variant="caption" color="text.secondary">Retry: {batch.retryCount ?? 0} · input {batch.promptTokens ?? '—'} / output {batch.completionTokens ?? '—'} tokens</Typography>{batch.error && <Typography variant="caption" color="error.main" display="block">{batch.error}</Typography>}</Paper>)}</Stack></Stack>}</DialogContent><DialogActions><Button onClick={() => setSelectedRunId(null)}>Đóng</Button>{selectedRun && !isTerminal(selectedRun.status) && <Button color="warning" onClick={() => requestCancel(selectedRun.id)} disabled={cancelMut.isPending}>Yêu cầu dừng</Button>}</DialogActions></Dialog>
    <Paper sx={{ p: 3, borderRadius: '28px' }}><SectionHeading title="Chiến dịch đề xuất & đo lường" subtitle="Duyệt / từ chối / huỷ chiến dịch; chỉ đo lường sau khi kỳ kết thúc. Mọi thay đổi giá/OTA phải do người duyệt thực hiện bên ngoài AI." /><Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>{['ALL', 'PROPOSED', 'APPROVED', 'REJECTED', 'RUNNING', 'REVIEW_DUE', 'COMPLETED', 'MEASURED'].map((s) => <Chip key={s} label={`${s} (${s === 'ALL' ? allCampaigns.length : counts[s] || 0})`} color={campaignStatusFilter === s ? 'primary' : 'default'} variant={campaignStatusFilter === s ? 'filled' : 'outlined'} onClick={() => setCampaignStatusFilter(s)} sx={{ cursor: 'pointer' }} />)}</Stack><Stack spacing={1.25} sx={{ mt: 2 }}>{campaigns.length ? campaigns.map((c: any) => { const allowed = ['PROPOSED', 'APPROVED', 'RUNNING', 'REVIEW_DUE']; const canMeasure = ['APPROVED', 'RUNNING', 'REVIEW_DUE'].includes(c.status); return <Paper key={c.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography variant="body2" fontWeight={700}>Căn {c.roomNumber} · {c.periodKey}</Typography><Typography variant="caption" color="text.secondary">{dayjs(c.periodFrom).format('DD/MM/YYYY')} → {dayjs(c.periodTo).format('DD/MM/YYYY')} · Review due {dayjs(c.reviewDueAt).format('DD/MM HH:mm')}</Typography><Typography variant="caption" display="block">Mục tiêu: {c.objective}</Typography></Box><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Chip size="small" label={c.status} color={['APPROVED', 'MEASURED'].includes(c.status) ? 'success' : ['REJECTED', 'CANCELLED'].includes(c.status) ? 'error' : 'warning'} />{c.measurementOutcome && <Chip size="small" label={`Đo: ${c.measurementOutcome}`} variant="outlined" />}{c.status === 'PROPOSED' && <Button size="small" color="success" variant="contained" onClick={() => openDecision(c.id, 'APPROVED')} disabled={transitionMut.isPending}>Duyệt</Button>}{c.status === 'PROPOSED' && <Button size="small" color="error" onClick={() => openDecision(c.id, 'REJECTED')} disabled={transitionMut.isPending}>Từ chối</Button>}{allowed.includes(c.status) && !['REJECTED', 'CANCELLED', 'COMPLETED', 'MEASURED'].includes(c.status) && <Button size="small" color="warning" onClick={() => openDecision(c.id, 'CANCELLED')} disabled={transitionMut.isPending}>Huỷ</Button>}{canMeasure && <Button size="small" variant="outlined" onClick={() => requestMeasure(c.id)} disabled={measureMut.isPending}>Đo lường</Button>}</Stack></Stack>{c.strategy?.assessment && <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>Đánh giá: {c.strategy.assessment}</Typography>}{c.measurementStatus && <Typography variant="caption" display="block" color={c.measurementStatus === 'MEASURED' ? 'success.main' : 'warning.main'}>Trạng thái đo: {c.measurementStatus}{c.measurementOutcome ? ` · ${c.measurementOutcome}` : ''}</Typography>}</Paper>; }) : <Typography variant="body2" color="text.secondary">Chưa có chiến dịch nào trong bộ lọc này.</Typography>}</Stack></Paper>
    <Dialog open={!!decisionTarget} onClose={() => setDecisionTarget(null)} maxWidth="sm" fullWidth><DialogTitle>{decisionTarget?.action === 'APPROVED' ? 'Duyệt chiến dịch' : decisionTarget?.action === 'REJECTED' ? 'Từ chối chiến dịch' : 'Huỷ chiến dịch'}</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ pb: 1.5 }}>Hành động này sẽ ghi nhận lý do vào lịch sử chuyển trạng thái. AI không tự động thay đổi giá/OTA.</Typography><TextField label="Lý do (bắt buộc)" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} fullWidth multiline minRows={2} /></DialogContent><DialogActions><Button onClick={() => setDecisionTarget(null)}>Đóng</Button><Button variant="contained" color={decisionTarget?.action === 'REJECTED' ? 'error' : decisionTarget?.action === 'CANCELLED' ? 'warning' : 'success'} disabled={!decisionReason.trim() || transitionMut.isPending} onClick={submitDecision}>{transitionMut.isPending ? 'Đang lưu…' : 'Xác nhận'}</Button></DialogActions></Dialog>
  </Stack>;
}


function OtaConnectorsTab() {
  const { toast } = useToast();
  const { data, isLoading } = useOtaConnectors();
  const configureMut = useConfigureOtaConnector();
  const previewMut = usePreviewOtaConnector();
  const executeMut = useExecuteOtaConnector();
  const [credentials, setCredentials] = useState({ partnerId: '', clientId: '', clientSecret: '' });
  const [enabled, setEnabled] = useState(false);
  const [auditId, setAuditId] = useState<string | null>(null);
  const { data: auditData } = useOtaConnectorAudits(auditId || undefined);
  const rows: any[] = data?.data ?? data ?? [];
  const airbnb = rows.find((row) => row.channel === 'AIRBNB');
  const save = async () => { try { await configureMut.mutateAsync({ channel: 'AIRBNB', credentials, enabled }); setCredentials({ partnerId: '', clientId: '', clientSecret: '' }); toast('Đã lưu placeholder xác thực Airbnb dưới dạng mã hoá.', 'success'); } catch (e: any) { toast(e?.message ?? 'Không thể lưu cấu hình OTA', 'error'); } };
  const preview = async () => { if (!airbnb) return; try { const result: any = await previewMut.mutateAsync(airbnb.id); toast(result?.reason ?? 'Preview cục bộ hoàn tất; không gửi request ra OTA.', 'info'); } catch (e: any) { toast(e?.message ?? 'Không preview được connector', 'error'); } };
  const execute = async () => { if (!airbnb) return; try { await executeMut.mutateAsync(airbnb.id); } catch (e: any) { toast(e?.message ?? 'Chưa có adapter OTA để thực thi', 'warning'); } };
  if (isLoading) return <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box>;
  return <Stack spacing={3}>
    <Alert severity="warning"><b>OTA framework an toàn:</b> AI CEO không có quyền chạy connector. Bản hiện tại chưa có adapter Airbnb, nên mọi preview chỉ kiểm tra local và không hề gọi OTA/đổi booking/giá.</Alert>
    <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: '28px' }}><Stack spacing={2.25}>
      <SectionHeading title="Airbnb — Partner connector" subtitle="Chỉ nhập credential do Airbnb/partner cấp. Giá trị được mã hoá ở backend và không bao giờ hiện lại trên trình duyệt." />
      <TextField label="Partner ID" value={credentials.partnerId} onChange={(e) => setCredentials({ ...credentials, partnerId: e.target.value })} autoComplete="off" />
      <TextField label="Client ID" value={credentials.clientId} onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })} autoComplete="off" />
      <TextField label="Client secret" type="password" value={credentials.clientSecret} onChange={(e) => setCredentials({ ...credentials, clientSecret: e.target.value })} autoComplete="new-password" helperText="Không dùng API key cá nhân; chỉ dùng credential đối tác đã được phê duyệt." />
      <FormControlLabel control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />} label="Đánh dấu connector sẵn sàng khi adapter được phê duyệt" />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button variant="contained" onClick={save} disabled={configureMut.isPending || !credentials.partnerId || !credentials.clientId || !credentials.clientSecret}>{configureMut.isPending ? 'Đang lưu…' : 'Lưu credential mã hoá'}</Button>{airbnb && <Button variant="outlined" onClick={preview} disabled={previewMut.isPending}>Local preview (không gọi OTA)</Button>}{airbnb && <Button color="warning" variant="contained" onClick={execute} disabled={executeMut.isPending}>Thực thi chiến lược</Button>}</Stack>
      {airbnb && <Stack direction="row" gap={1} flexWrap="wrap"><Chip label={airbnb.configured ? 'Credential: đã cấu hình' : 'Credential: chưa cấu hình'} color={airbnb.configured ? 'success' : 'warning'} /><Chip label={`Adapter: NONE`} color="warning" /><Chip label="External request: blocked" color="error" /></Stack>}
    </Stack></Paper>
    <Paper sx={{ p: 3, borderRadius: '28px' }}><SectionHeading title="Audit connector" subtitle="Lưu vết configure/preview/block theo actor; không lưu giá trị credential." />
      <Stack spacing={1.25} sx={{ mt: 2 }}>{airbnb ? <><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Chip label="AIRBNB" color="primary" /><Typography variant="body2">{airbnb.displayName} · {airbnb.configured ? 'đã có placeholder' : 'chưa cấu hình'} · adapter NONE</Typography><Button size="small" onClick={() => setAuditId(airbnb.id)}>Xem audit</Button></Stack>{auditId && <Stack spacing={1}>{((auditData?.data ?? auditData ?? []) as any[]).map((a) => <Paper key={a.id} variant="outlined" sx={{ p: 1.25 }}><Typography variant="body2" fontWeight={700}>{a.action}</Typography><Typography variant="caption" color="text.secondary">{dayjs(a.createdAt).format('DD/MM/YYYY HH:mm:ss')} · external request: {String(a.result?.externalRequest ?? false)}</Typography></Paper>)}</Stack>}</> : <Typography variant="body2" color="text.secondary">Chưa có connector nào. Lưu placeholder Airbnb để khởi tạo audit.</Typography>}</Stack>
    </Paper>
  </Stack>;
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
            <Tab label="AI CEO" />
            <Tab label="OTA Connectors" />
          </Tabs>
          <Box sx={{ p: { xs: 2, md: 4 } }}>
            <TabPanel value={tab} index={0}><GeneralTab /></TabPanel>
            <TabPanel value={tab} index={1}><WebhooksTab /></TabPanel>
            <TabPanel value={tab} index={2}><ApiKeysTab /></TabPanel>
            <TabPanel value={tab} index={3}><AiCeoTab /></TabPanel>
            <TabPanel value={tab} index={4}><OtaConnectorsTab /></TabPanel>
          </Box>
        </Paper>
      </Box>
    </RouteGuard>
  );
}
