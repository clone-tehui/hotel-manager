import { NextRequest } from 'next/server';
import { assertBridgeAccess, proxyHotelApi, readBridgeAuthFromRequest } from '../../_lib';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  const auth = readBridgeAuthFromRequest(request);
  const denied = assertBridgeAccess(auth);
  if (denied) return denied;
  return proxyHotelApi(`/rooms/${encodeURIComponent(context.params.id)}`);
}
