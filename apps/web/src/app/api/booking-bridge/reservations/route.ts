import { NextRequest } from 'next/server';
import { assertBridgeAccess, proxyHotelApi, readBridgeAuthFromRequest } from '../_lib';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = readBridgeAuthFromRequest(request, body);
  const denied = assertBridgeAccess(auth);
  if (denied) return denied;
  const { __bridgeAuth, ...payload } = body || {};
  const bookingMeta = `[[ZALO_BOOKING_META]]${JSON.stringify({
    source: auth.source,
    threadId: auth.threadId,
    accountId: auth.accountId,
    draftKey: auth.draftKey,
  })}`;
  const existingInternalNotes = String(payload?.internalNotes || '').trim();
  return proxyHotelApi('/reservations', {
    method: 'POST',
    body: JSON.stringify({
      ...(payload || {}),
      internalNotes: existingInternalNotes ? `${bookingMeta}\n${existingInternalNotes}` : bookingMeta,
    }),
  });
}
