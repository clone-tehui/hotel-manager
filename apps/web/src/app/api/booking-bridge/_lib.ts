import { NextRequest, NextResponse } from 'next/server';
import { BookingBridgeAuthParams, validateBookingBridgeAuth } from '@/lib/booking-bridge';

const RAW_API_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3001').replace(/\/$/, '');
export const API_BASE = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE.slice(0, -4) : RAW_API_BASE;
export const API_KEY = String(process.env.HOTEL_BRIDGE_API_KEY || '').trim();
const BRIDGE_SECRET = String(process.env.CHIHOME_BOOKING_BRIDGE_SECRET || process.env.BOOKING_BRIDGE_SECRET || '').trim();

export function readBridgeAuthFromRequest(request: NextRequest, body?: any): BookingBridgeAuthParams {
  const search = request.nextUrl.searchParams;
  const raw = body?.__bridgeAuth && typeof body.__bridgeAuth === 'object' ? body.__bridgeAuth : {};
  return {
    source: String(raw.source || search.get('source') || '').trim(),
    threadId: String(raw.threadId || search.get('threadId') || '').trim(),
    accountId: String(raw.accountId || search.get('accountId') || '').trim(),
    draftKey: String(raw.draftKey || search.get('draftKey') || '').trim(),
    expires: String(raw.expires || search.get('expires') || '').trim(),
    sig: String(raw.sig || search.get('sig') || '').trim(),
  };
}

export function assertBridgeAccess(auth: BookingBridgeAuthParams) {
  if (!API_KEY) {
    return NextResponse.json({ ok: false, error: 'Bridge API key chưa được cấu hình.' }, { status: 503 });
  }
  const validated = validateBookingBridgeAuth(auth, BRIDGE_SECRET);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 401 });
  }
  return null;
}

export async function proxyHotelApi(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', API_KEY);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const payload = await res.text();
  return new NextResponse(payload, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function fetchHotelApiJson(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('x-api-key', API_KEY);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload };
}
