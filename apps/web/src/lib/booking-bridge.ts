import crypto from 'crypto';

export interface BookingBridgeAuthParams {
  source: string;
  threadId: string;
  accountId: string;
  draftKey: string;
  expires: string;
  sig: string;
}

export function buildBookingBridgePayload(params: Omit<BookingBridgeAuthParams, 'sig'>) {
  return [
    String(params.source || '').trim(),
    String(params.threadId || '').trim(),
    String(params.accountId || '').trim(),
    String(params.draftKey || '').trim(),
    String(params.expires || '').trim(),
  ].join('|');
}

export function signBookingBridgePayload(params: Omit<BookingBridgeAuthParams, 'sig'>, secret: string) {
  return crypto.createHmac('sha256', secret).update(buildBookingBridgePayload(params)).digest('hex');
}

export function validateBookingBridgeAuth(params: Partial<BookingBridgeAuthParams>, secret: string) {
  const source = String(params.source || '').trim();
  const threadId = String(params.threadId || '').trim();
  const accountId = String(params.accountId || '').trim();
  const draftKey = String(params.draftKey || '').trim();
  const expires = String(params.expires || '').trim();
  const sig = String(params.sig || '').trim();

  if (!secret) return { ok: false, error: 'Bridge secret chưa được cấu hình.' };
  if (!source || !threadId || !accountId || !draftKey || !expires || !sig) {
    return { ok: false, error: 'Thiếu thông tin xác thực bridge.' };
  }

  const expiresMs = Number(expires);
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    return { ok: false, error: 'Phiên bridge đã hết hạn. Hãy mở lại từ zlsever.' };
  }

  const expectedSig = signBookingBridgePayload({ source, threadId, accountId, draftKey, expires }, secret);
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expectedSig);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { ok: false, error: 'Chữ ký bridge không hợp lệ.' };
  }

  return {
    ok: true,
    auth: { source, threadId, accountId, draftKey, expires, sig },
  };
}
