export const dynamic = 'force-dynamic';

import { Alert, Box, Container, Paper, Typography } from '@mui/material';
import { ZaloBookingBridgeClient } from '@/components/reservation/ZaloBookingBridgeClient';
import { validateBookingBridgeAuth, type BookingBridgeAuthParams } from '@/lib/booking-bridge';

function BridgeAccessDenied({ message }: { message: string }) {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Không thể mở form đặt phòng
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {message}
        </Alert>
        <Box sx={{ mt: 2, color: 'text.secondary' }}>
          Vui lòng quay lại Zalo User Server và mở lại popup từ đúng hội thoại.
        </Box>
      </Paper>
    </Container>
  );
}

export default function ZaloBookingBridgePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const auth: BookingBridgeAuthParams = {
    source: typeof searchParams?.source === 'string' ? searchParams.source : 'zalo',
    threadId: typeof searchParams?.threadId === 'string' ? searchParams.threadId : '',
    accountId: typeof searchParams?.accountId === 'string' ? searchParams.accountId : '',
    draftKey: typeof searchParams?.draftKey === 'string' ? searchParams.draftKey : '',
    expires: typeof searchParams?.expires === 'string' ? searchParams.expires : '',
    sig: typeof searchParams?.sig === 'string' ? searchParams.sig : '',
  };

  const bridgeSecret = String(process.env.CHIHOME_BOOKING_BRIDGE_SECRET || process.env.BOOKING_BRIDGE_SECRET || '').trim();
  const validated = validateBookingBridgeAuth(auth, bridgeSecret);
  if (!validated.ok) {
    return <BridgeAccessDenied message={validated.error} />;
  }

  return <ZaloBookingBridgeClient auth={validated.auth} />;
}
