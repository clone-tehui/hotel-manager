'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { BookingBridgeAuthParams } from '@/lib/booking-bridge';

interface BridgeRequestOptions {
  auth: BookingBridgeAuthParams;
  params?: Record<string, string | number | undefined | null>;
  body?: any;
  method?: 'GET' | 'POST';
}

function buildAuthSearchParams(auth: BookingBridgeAuthParams) {
  return new URLSearchParams({
    source: auth.source,
    threadId: auth.threadId,
    accountId: auth.accountId,
    draftKey: auth.draftKey,
    expires: auth.expires,
    sig: auth.sig,
  });
}

async function bridgeRequest(path: string, options: BridgeRequestOptions) {
  const query = buildAuthSearchParams(options.auth);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === undefined || value === null || value === '') continue;
      query.set(key, String(value));
    }
  }

  const res = await fetch(`/api/booking-bridge${path}?${query.toString()}`, {
    method: options.method || 'GET',
    headers: options.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: options.method === 'POST' ? JSON.stringify({ ...(options.body || {}), __bridgeAuth: options.auth }) : undefined,
    cache: 'no-store',
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || 'Không gọi được booking bridge');
  }
  return payload;
}

export const useBridgeQuickRoomSearch = (params: any, enabled: boolean, auth: BookingBridgeAuthParams | null) =>
  useQuery({
    queryKey: ['bridge-quick-room-search', auth?.draftKey || '', params],
    queryFn: () => bridgeRequest('/quick-room-search', {
      auth: auth as BookingBridgeAuthParams,
      params,
    }),
    enabled: enabled && !!auth,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

export const useBridgeRoom = (id: string, auth: BookingBridgeAuthParams | null) =>
  useQuery({
    queryKey: ['bridge-room', auth?.draftKey || '', id],
    queryFn: () => bridgeRequest(`/rooms/${encodeURIComponent(id)}`, { auth: auth as BookingBridgeAuthParams }),
    enabled: !!id && !!auth,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

export const useBridgeCreateGuest = (auth: BookingBridgeAuthParams | null) =>
  useMutation({
    mutationFn: (body: any) => bridgeRequest('/guests', { auth: auth as BookingBridgeAuthParams, method: 'POST', body }),
  });

export const useBridgeCreateReservation = (auth: BookingBridgeAuthParams | null) =>
  useMutation({
    mutationFn: (body: any) => bridgeRequest('/reservations', { auth: auth as BookingBridgeAuthParams, method: 'POST', body }),
  });
