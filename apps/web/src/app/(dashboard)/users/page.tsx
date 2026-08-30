'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/layout/RouteGuard';
import {
  Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Stack, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import KeyIcon from '@mui/icons-material/Key';
import SearchIcon from '@mui/icons-material/Search';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import dayjs from 'dayjs';
import { useUsers, useCreateUser, useUpdateUser, useSetUserPassword, useLockUser, useUnlockUser } from '@/hooks/api';
import { LoadingState, EmptyState } from '@/components/common/States';
import { useToast } from '@/providers/ToastProvider';

const ROLES = ['ADMIN', 'USER'] as const;
const ROLE_COLORS: Record<string, any> = { ADMIN: 'error', USER: 'primary' };
const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', USER: 'User' };

export default function UsersPage() {
  const [search, setSearch]       = useState('');
  const [dialogOpen, setDialog]   = useState(false);
  const [pwDialog, setPwDialog]   = useState(false);
  const [editing, setEditing]     = useState<any | null>(null);
  const [newPw, setNewPw]         = useState('');
  const [form, setForm]           = useState({ email: '', password: '', fullName: '', role: 'USER' });
  const { toast } = useToast();

  const { data, isLoading, refetch } = useUsers({ q: search || undefined, limit: 100 });
  const users: any[] = data?.data?.data ?? [];

  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const setpwMut  = useSetUserPassword();
  const lockMut   = useLockUser();
  const unlockMut = useUnlockUser();

  const openCreate = () => { setEditing(null); setForm({ email: '', password: '', fullName: '', role: 'USER' }); setDialog(true); };
  const openEdit   = (u: any) => { setEditing(u); setForm({ email: u.email, password: '', fullName: u.fullName, role: u.role }); setDialog(true); };
  const openSetPw  = (u: any) => { setEditing(u); setNewPw(''); setPwDialog(true); };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, fullName: form.fullName, role: form.role });
        toast('Cập nhật người dùng thành công');
      } else {
        await createMut.mutateAsync({ email: form.email, password: form.password, fullName: form.fullName, role: form.role as any });
        toast('Tạo người dùng thành công');
      }
      setDialog(false); refetch();
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  const handleSetPw = async () => {
    if (!newPw || newPw.length < 8) { toast('Mật khẩu phải ít nhất 8 ký tự', 'error'); return; }
    try {
      await setpwMut.mutateAsync({ id: editing.id, password: newPw });
      toast('Đặt lại mật khẩu thành công');
      setPwDialog(false);
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  const handleLockToggle = async (u: any) => {
    try {
      if (u.isLocked) { await unlockMut.mutateAsync(u.id); toast(`Đã mở khoá tài khoản ${u.fullName}`); }
      else             { await lockMut.mutateAsync(u.id);   toast(`Đã khoá tài khoản ${u.fullName}`, 'warning'); }
      refetch();
    } catch (e: any) { toast(e?.message ?? 'Lỗi', 'error'); }
  };

  return (
    <RouteGuard require="system">
      <Box sx={{ p: { xs: 2, md: 3, lg: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Người dùng</Typography>
          <Typography variant="body2" color="text.secondary">{users.length} tài khoản</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Thêm người dùng</Button>
      </Box>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth size="small"
          placeholder="Tìm theo tên, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
      </Paper>

      {isLoading ? (
        <LoadingState message="Đang tải người dùng..." />
      ) : users.length === 0 ? (
        <EmptyState icon={<ManageAccountsIcon sx={{ fontSize: 48 }} />} title="Không có người dùng" subtitle="Thêm tài khoản đầu tiên" />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 700 }}>Tên đầy đủ</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Vai trò</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Đăng nhập lần cuối</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{u.fullName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{u.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={ROLE_LABELS[u.role] ?? u.role} color={ROLE_COLORS[u.role] ?? 'default'} size="small" />
                  </TableCell>
                  <TableCell>
                    {u.isLocked
                      ? <Chip label="Đã khoá" color="error" size="small" />
                      : <Chip label="Hoạt động" color="success" size="small" />}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {u.lastLoginAt ? dayjs(u.lastLoginAt).format('DD/MM/YYYY HH:mm') : 'Chưa đăng nhập'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                      <Tooltip title="Sửa thông tin">
                        <IconButton size="small" onClick={() => openEdit(u)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Đặt lại mật khẩu">
                        <IconButton size="small" color="primary" onClick={() => openSetPw(u)}><KeyIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title={u.isLocked ? 'Mở khoá' : 'Khoá tài khoản'}>
                        <IconButton size="small" color={u.isLocked ? 'success' : 'error'} onClick={() => handleLockToggle(u)}>
                          {u.isLocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editing ? 'Sửa người dùng' : 'Thêm người dùng mới'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField label="Tên đầy đủ *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            {!editing && (
              <>
                <TextField label="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <TextField label="Mật khẩu *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} helperText="Ít nhất 8 ký tự" />
              </>
            )}
            {editing && (
              <TextField label="Email" value={form.email} disabled helperText="Email không thể thay đổi" />
            )}
            <FormControl fullWidth>
              <InputLabel>Vai trò</InputLabel>
              <Select value={form.role} label="Vai trò" onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialog(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.fullName || (!editing && (!form.email || !form.password))}>
            {editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={pwDialog} onClose={() => setPwDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Đặt lại mật khẩu</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Đặt mật khẩu mới cho <strong>{editing?.fullName}</strong>
          </Typography>
          <TextField
            autoFocus fullWidth label="Mật khẩu mới" type="password"
            value={newPw} onChange={(e) => setNewPw(e.target.value)}
            helperText="Ít nhất 8 ký tự"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setPwDialog(false)}>Huỷ</Button>
          <Button variant="contained" color="warning" onClick={handleSetPw}>Đặt lại mật khẩu</Button>
        </DialogActions>
      </Dialog>
    </Box>
    </RouteGuard>
  );
}
