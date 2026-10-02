import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { InventoryLockService } from '../pricing/inventory-lock.service';
import { pricingError } from '../pricing/pricing-error';

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, canonical(value[key])]));
  return value;
}

@Injectable()
export class ChatbotIdempotencyService {
  constructor(private readonly inventory: InventoryLockService) {}

  execute(apiKeyId: string, operation: string, key: unknown, payload: unknown, callback: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) pricingError('IDEMPOTENCY_KEY_REQUIRED');
    const requestHash = createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
    return this.inventory.transaction(async (tx) => {
      await this.inventory.lock(tx, `hotel-idempotency:${JSON.stringify([apiKeyId, operation, key])}`);
      const existing = await tx.chatbotIdempotency.findUnique({ where: { apiKeyId_operation_key: { apiKeyId, operation, key } } });
      if (existing) {
        if (existing.requestHash !== requestHash) pricingError('IDEMPOTENCY_CONFLICT', 409);
        return existing.responseJson;
      }
      const responseJson = JSON.parse(JSON.stringify(await callback(tx)));
      await tx.chatbotIdempotency.create({ data: { apiKeyId, operation, key, requestHash, responseJson, expiresAt: new Date(Date.now() + 7 * 86400000) } });
      return responseJson;
    });
  }
}
