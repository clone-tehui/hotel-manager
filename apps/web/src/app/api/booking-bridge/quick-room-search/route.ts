import { NextRequest } from 'next/server';
import { assertBridgeAccess, proxyHotelApi, readBridgeAuthFromRequest } from '../_lib';

export async function GET(request: NextRequest) {
  const auth = readBridgeAuthFromRequest(request);
  const denied = assertBridgeAccess(auth);
  if (denied) return denied;

  const target = new URL('/reservations/quick-room-search', 'http://bridge.local');
  for (const key of ['checkInDate', 'checkOutDate', 'roomTypeId', 'buildingId']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return proxyHotelApi(`${target.pathname}${target.search}`);
}
