import { NextRequest } from 'next/server';
import { assertBridgeAccess, proxyHotelApi, readBridgeAuthFromRequest } from '../_lib';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const auth = readBridgeAuthFromRequest(request, body);
  const denied = assertBridgeAccess(auth);
  if (denied) return denied;
  const { __bridgeAuth, ...payload } = body || {};
  return proxyHotelApi('/guests', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}
