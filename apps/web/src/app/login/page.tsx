'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, CircularProgress, Stack,
} from '@mui/material';
import HotelIcon from '@mui/icons-material/Hotel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Avatar } from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { api } from '@/lib/api';
import { useAppearance } from '@/providers/AppThemeProvider';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { appearance } = useAppearance();
  const { setAuthUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      const token = res?.access_token ?? res?.data?.access_token;
      const user = res?.user ?? res?.data?.user;
      if (!token) throw new Error('Không nhận được token từ server');
      if (!user) throw new Error('Không nhận được thông tin tài khoản từ server');
      localStorage.setItem('hotel_token', token);
      setAuthUser(user);
      router.replace('/timeline');
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: 'radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(255,255,255,0.10), transparent 26%), var(--bg-primary)' }}>
      <Card sx={{ width: '100%', maxWidth: 470, p: 1, borderRadius: '28px', background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))' }}>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Stack direction="row" spacing={1.75} alignItems="center" mb={4}>
            {appearance.system_logo_url ? (
              <Avatar src={appearance.system_logo_url} alt={appearance.app_display_name} sx={{ width: 54, height: 54, borderRadius: '20px', boxShadow: 'var(--shadow-soft)' }} />
            ) : (
              <Box sx={{ width: 54, height: 54, borderRadius: '20px', background: 'linear-gradient(135deg, var(--accent-primary), rgba(255,255,255,0.85))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-soft)' }}>
                <HotelIcon sx={{ color: '#fff', fontSize: 26 }} />
              </Box>
            )}
            <Box>
              <Typography variant="h6" fontWeight={800}>{appearance.app_display_name}</Typography>
            </Box>
          </Stack>

          <Typography variant="h4" fontWeight={800} mb={0.75}>Đăng nhập</Typography>
          <Typography variant="body2" color="text.secondary" mb={3.5}>Không gian vận hành cao cấp cho đội ngũ khách sạn.</Typography>

          <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
            <TextField id="login-email" label="Email" type="email" value={email} fullWidth required onChange={(e) => setEmail(e.target.value)} />
            <TextField
              id="login-password"
              label="Mật khẩu"
              type={showPw ? 'text' : 'password'}
              value={password}
              fullWidth
              required
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPw(!showPw)} size="small">
                      {showPw ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {error && <Typography color="error" variant="body2">{error}</Typography>}
            <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ mt: 1 }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Đăng nhập'}
            </Button>
          </Box>

        </CardContent>
      </Card>
    </Box>
  );
}
