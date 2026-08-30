import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('addon_order.paid')
  async handleAddonOrderPaid(payload: any) {
    return this.handleEvent('addon_order.paid', payload);
  }

  @OnEvent('reservation.created')
  async handleReservationCreated(payload: any) { return this.handleEvent('reservation.created', payload); }

  @OnEvent('reservation.updated')
  async handleReservationUpdated(payload: any) { return this.handleEvent('reservation.updated', payload); }

  @OnEvent('reservation.cancelled')
  async handleReservationCancelled(payload: any) { return this.handleEvent('reservation.cancelled', payload); }

  @OnEvent('reservation.checked_in')
  async handleReservationCheckedIn(payload: any) { return this.handleEvent('reservation.checked_in', payload); }

  @OnEvent('reservation.checked_out')
  async handleReservationCheckedOut(payload: any) { return this.handleEvent('reservation.checked_out', payload); }

  @OnEvent('reservation.room_changed')
  async handleReservationRoomChanged(payload: any) { return this.handleEvent('reservation.room_changed', payload); }

  @OnEvent('payment.deposit_recorded')
  async handlePaymentDepositRecorded(payload: any) { return this.handleEvent('payment.deposit_recorded', payload); }

  @OnEvent('room.status_changed')
  async handleRoomStatusChanged(payload: any) { return this.handleEvent('room.status_changed', payload); }

  async handleEvent(event: string, payload: any) {
    const webhooks = await this.prisma.webhookIntegration.findMany({
      where: {
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    if (webhooks.length === 0) return;

    for (const webhook of webhooks) {
      await this.deliverWebhook(webhook, event, payload);
    }
  }

  async deliverWebhook(webhook: any, event: string, payload: any, attempt = 1) {
    const maxRetries = 3;
    const currentWebhook = attempt > 1
      ? await this.prisma.webhookIntegration.findUnique({ where: { id: webhook.id } })
      : webhook;

    if (!currentWebhook || !currentWebhook.isActive) {
      this.logger.warn(`Skip webhook delivery because webhook ${webhook.id} no longer exists or is inactive.`);
      return;
    }

    const envelope = event === 'addon_order.paid'
      ? {
          event,
          timestamp: new Date().toISOString(),
          ...payload,
          paymentTime: payload?.paidAt ?? null,
        }
      : { event, payload, timestamp: new Date().toISOString() };
    const body = JSON.stringify(envelope);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'HotelManager-Webhook/1.0',
    };

    if (currentWebhook.secret) {
      const signature = crypto.createHmac('sha256', currentWebhook.secret).update(body).digest('hex');
      headers['X-Webhook-Signature'] = signature;
    }

    let success = false;
    let statusCode = null;
    let responseText = null;

    try {
      const res = await axios.post(currentWebhook.url, body, {
        headers,
        timeout: 5000,
      });
      statusCode = res.status;
      responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      success = res.status >= 200 && res.status < 300;
    } catch (error: any) {
      statusCode = error.response?.status || null;
      responseText = error.message;
      success = false;
    }

    if (!success && attempt < maxRetries) {
      this.logger.warn(`Webhook to ${currentWebhook.url} failed (attempt ${attempt}). Retrying...`);
      // Simple exponential backoff: 2s, 4s
      setTimeout(() => {
        void this.deliverWebhook(webhook, event, payload, attempt + 1).catch((error) => {
          this.logger.error(`Webhook retry crashed for ${webhook.id}: ${error?.message ?? error}`);
        });
      }, attempt * 2000);
      return; // Will log on the final attempt
    }

    // Log the final delivery status
    try {
      await this.prisma.webhookDeliveryLog.create({
        data: {
          webhookId: currentWebhook.id,
          event,
          payload,
          statusCode,
          response: responseText?.substring(0, 500),
          success,
          attemptCount: attempt,
          deliveredAt: success ? new Date() : null,
        },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2003', 'P2025'].includes(error.code)) {
        this.logger.warn(`Skip webhook delivery log because webhook ${currentWebhook.id} was removed during async delivery.`);
        return;
      }
      throw error;
    }

    if (!success) {
      this.logger.error(`Webhook to ${currentWebhook.url} failed finally after ${attempt} attempts.`);
    } else {
      this.logger.log(`Webhook to ${currentWebhook.url} delivered successfully.`);
    }
  }

  async testWebhook(webhookId: string) {
    const webhook = await this.prisma.webhookIntegration.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new Error('Webhook not found');
    await this.deliverWebhook(webhook, 'ping', { message: 'Test webhook from Hotel Manager' });
    return { success: true, message: 'Test triggered' };
  }
}
