import { NextRequest, NextResponse } from 'next/server';
import { assertBridgeAccess, fetchHotelApiJson, readBridgeAuthFromRequest } from '../_lib';

const ACTIVE_STATUSES = new Set(['PENDING', 'BOOKED', 'IN_HOUSE']);

export async function GET(request: NextRequest) {
  const auth = readBridgeAuthFromRequest(request);
  const denied = assertBridgeAccess(auth);
  if (denied) return denied;

  const path = `/reservations?threadId=${encodeURIComponent(auth.threadId)}&limit=10`;
  const { res, payload } = await fetchHotelApiJson(path);
  if (!res.ok || payload?.ok === false) {
    return NextResponse.json({ ok: false, error: payload?.error || payload?.message || 'Không tải được dữ liệu booking bridge.' }, { status: res.status || 500 });
  }

  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.data)
      ? payload.data.data
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
  const item = items.find((entry: any) => ACTIVE_STATUSES.has(String(entry?.status || '').trim().toUpperCase())) || items[0] || null;
  return NextResponse.json({ ok: true, item }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
