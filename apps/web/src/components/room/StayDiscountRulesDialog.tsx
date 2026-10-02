'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api } from '@/lib/api';

const initial = { minValue: '1', minUnit: 'DAY', maxValue: '', maxUnit: 'DAY', discountPerNight: '0', isActive: true };
const labels: Record<string, string> = { DAY: 'Ngày', MONTH: 'Tháng (30 đêm)', YEAR: 'Năm (365 đêm)' };
const units: Record<string, number> = { DAY: 1, MONTH: 30, YEAR: 365 };

export default function StayDiscountRulesDialog({ roomType, onClose }: { roomType: { id: string; name: string } | null; onClose: () => void }) {
  const [rules, setRules] = useState<any[]>([]);
  const [form, setForm] = useState(initial);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `/room-types/${roomType?.id}/stay-discount-rules`;
  const load = async () => { const response = await api.get(base); setRules(response.data ?? []); };
  useEffect(() => {
    setError(''); setEditId(null); setForm(initial); setRules([]);
    if (roomType) load().catch(() => setError('Không tải được chính sách giảm giá.'));
  }, [roomType?.id]);
  const report = (failure: any) => setError(failure?.error?.code === 'DISCOUNT_RULE_OVERLAP' ? 'Khoảng đêm trùng chính sách đang bật. Các mốc đầu/cuối đều bao gồm.' : failure?.error?.code ?? failure?.message ?? 'Thao tác thất bại.');
  const save = async () => {
    setBusy(true); setError('');
    try {
      const payload = { minValue: Number(form.minValue), minUnit: form.minUnit, maxValue: form.maxValue === '' ? null : Number(form.maxValue), maxUnit: form.maxValue === '' ? null : form.maxUnit, discountPerNight: Number(form.discountPerNight), isActive: form.isActive };
      if (editId) await api.patch(`${base}/${editId}`, payload); else await api.post(base, payload);
      setEditId(null); setForm(initial); await load();
    } catch (failure) { report(failure); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Xóa chính sách giảm giá này?')) return;
    setBusy(true); setError('');
    try { await api.del(`${base}/${id}`); await load(); } catch (failure) { report(failure); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!roomType} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Giảm giá lưu trú — {roomType?.name}</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>Áp dụng chung cho các căn cùng loại khi yêu cầu giảm giá. 1 tháng = 30 đêm, 1 năm = 365 đêm. Các khoảng đang bật không được trùng.</Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={1} sx={{ mb: 3 }}>
          {rules.map((rule) => <Box key={rule.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography>{rule.minNights}–{rule.maxNights ?? '∞'} đêm · giảm {Number(rule.discountPerNight).toLocaleString('vi-VN')}đ/đêm · {rule.isActive ? 'Đang bật' : 'Đã tắt'}</Typography>
            <Stack direction="row"><Button disabled={busy} onClick={() => { setEditId(rule.id); setForm({ minValue: String(rule.minValue), minUnit: rule.minUnit, maxValue: rule.maxValue == null ? '' : String(rule.maxValue), maxUnit: rule.maxUnit ?? 'DAY', discountPerNight: String(rule.discountPerNight), isActive: rule.isActive }); }}>Sửa</Button><Button color="error" disabled={busy} onClick={() => remove(rule.id)}>Xóa</Button></Stack>
          </Box>)}
          {!rules.length && <Typography color="text.secondary">Chưa có chính sách giảm giá.</Typography>}
        </Stack>
        <Typography fontWeight={700} sx={{ mb: 2 }}>{editId ? 'Sửa chính sách' : 'Thêm chính sách'}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
          <TextField label="Từ" type="number" inputProps={{ min: 1 }} value={form.minValue} onChange={(event) => setForm({ ...form, minValue: event.target.value })} />
          <TextField label="Đơn vị" select value={form.minUnit} onChange={(event) => setForm({ ...form, minUnit: event.target.value })}>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
          <TextField label="Đến (trống = không giới hạn)" type="number" inputProps={{ min: 1 }} value={form.maxValue} onChange={(event) => setForm({ ...form, maxValue: event.target.value })} />
          <TextField label="Đơn vị" select disabled={!form.maxValue} value={form.maxUnit} onChange={(event) => setForm({ ...form, maxUnit: event.target.value })}>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
        </Stack>
        <Typography variant="body2" sx={{ mb: 2 }}>Khoảng quy đổi: {Number(form.minValue) * units[form.minUnit]}–{form.maxValue ? Number(form.maxValue) * units[form.maxUnit] : '∞'} đêm.</Typography>
        <TextField label="Giảm mỗi đêm (VND)" type="number" inputProps={{ min: 0 }} value={form.discountPerNight} onChange={(event) => setForm({ ...form, discountPerNight: event.target.value })} />
        <FormControlLabel control={<Checkbox checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />} label="Bật chính sách" />
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Đóng</Button>{editId && <Button onClick={() => { setEditId(null); setForm(initial); }}>Thêm mới</Button>}<Button variant="contained" disabled={busy} onClick={save}>Lưu chính sách</Button></DialogActions>
    </Dialog>
  );
}
