'use client';

import { Box, Typography } from '@mui/material';
import { ReservationForm } from '@/components/reservation/ReservationForm';
import type { BookingBridgeAuthParams } from '@/lib/booking-bridge';

const BRIDGE_EVENT_ORIGIN = '*';

function notifyParent(type: string, payload?: Record<string, any>) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({ type, ...(payload || {}) }, BRIDGE_EVENT_ORIGIN);
}

export function ZaloBookingBridgeClient({ auth }: { auth: BookingBridgeAuthParams }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <ReservationForm
        open
        onClose={() => notifyParent('chihomehotel-booking-close')}
        mode="bridge"
        bridgeAuth={auth}
        initialSource="zalo"
        sourceLocked
        initialThreadId={auth.threadId}
        draftKey={auth.draftKey}
        onSubmitted={(result) => notifyParent('chihomehotel-booking-created', { reservation: result?.data || result || null })}
      />
      {!auth.threadId ? (
        <Box sx={{ px: 3, pb: 3 }}>
          <Typography variant="body2" color="error.main">Thiếu threadId từ zlsever.</Typography>
        </Box>
      ) : null}
    </Box>
  );
}
