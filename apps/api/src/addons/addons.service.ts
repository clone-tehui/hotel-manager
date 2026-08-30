import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, AddonOrderStatus, SepayWebhookStatus } from '@prisma/client';
import { createHmac, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_STAY_STATUSES = ['IN_HOUSE'] as const;
const MAX_ITEM_QUANTITY = 99;
const PUBLIC_GUEST_INFO_SETTING_KEY = 'addon_public_show_guest_info';

function toDecimal(value: unknown, fallback = 0) {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num) || num < 0) throw new BadRequestException('Giá trị tiền không hợp lệ');
  return new Prisma.Decimal(num.toFixed(2));
}

function toInt(value: unknown, fallback = 0) {
  const num = Number(value ?? fallback);
  if (!Number.isInteger(num) || num < 0) throw new BadRequestException('Số lượng không hợp lệ');
  return num;
}

function decimalNumber(value: any) {
  return Number(value ?? 0);
}

function maskGuestName(name?: string | null) {
  const clean = String(name || '').trim();
  if (!clean) return 'Khách lưu trú';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`;
  return `${parts[0]} ${parts.slice(1).map((part) => `${part.slice(0, 1)}.`).join(' ')}`;
}

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim();
  return text.length ? text : null;
}

function buildingOrderPrefix(building?: { code?: string | null; name?: string | null } | null) {
  const name = String(building?.name || '').trim().toLowerCase();
  if (name.includes('opera')) return 'OP';

  const code = String(building?.code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (code) return code.slice(0, 4);

  const initials = String(building?.name || '')
    .split(/\s+/)
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1))
    .join('')
    .toUpperCase();
  return initials.slice(0, 4) || 'CH';
}

function roomOrderPrefix(roomNumber?: string | null) {
  return String(roomNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'ROOM';
}

function compactOrderCode(room?: { number?: string | null; building?: { code?: string | null; name?: string | null } | null }) {
  const suffixNumber = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const suffixLetter = String.fromCharCode(65 + (randomBytes(1)[0] % 26));
  return `CH${buildingOrderPrefix(room?.building)}${roomOrderPrefix(room?.number)}${suffixNumber}${suffixLetter}`;
}

function extractSepayAmount(payload: any) {
  const raw = payload?.transferAmount ?? payload?.amount ?? payload?.money ?? payload?.value ?? payload?.data?.amount;
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function extractSepayContent(payload: any) {
  return String(
    payload?.content ?? payload?.description ?? payload?.transferContent ?? payload?.transaction_content ?? payload?.data?.content ?? '',
  ).trim();
}

function extractSepayTransactionId(payload: any) {
  return String(payload?.id ?? payload?.transactionId ?? payload?.referenceCode ?? payload?.data?.id ?? '').trim() || null;
}

function currentPublicHistoryWindow(now = new Date()) {
  const saigonParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (type: string) => saigonParts.find((part) => part.type === type)?.value || '';
  const noonUtcMs = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')), 5, 0, 0, 0);
  const currentNoon = new Date(noonUtcMs);
  const from = now >= currentNoon ? currentNoon : new Date(noonUtcMs - 24 * 60 * 60 * 1000);
  const resetAt = now >= currentNoon ? new Date(noonUtcMs + 24 * 60 * 60 * 1000) : currentNoon;
  return { from, resetAt };
}

@Injectable()
export class AddonsService {
  constructor(private prisma: PrismaService, private events: EventEmitter2) {}

  private tokenSecret() {
    return process.env.ADDON_ORDER_TOKEN_SECRET || process.env.JWT_SECRET || 'chihome-addon-order-local-secret';
  }

  private buildRoomToken(roomId: string) {
    return createHmac('sha256', this.tokenSecret()).update(`room-order:${roomId}`).digest('hex').slice(0, 40);
  }

  private async getActiveStay(roomId: string) {
    return this.prisma.reservation.findFirst({
      where: { roomId, deletedAt: null, status: { in: [...ACTIVE_STAY_STATUSES] } },
      include: { room: { include: { building: true } } },
      orderBy: { actualCheckIn: 'desc' },
    });
  }

  private assertToken(roomId: string, token: string) {
    if (!token || token !== this.buildRoomToken(roomId)) {
      throw new UnauthorizedException('Link QR không hợp lệ');
    }
  }

  private async shouldShowGuestInfoOnPublicOrder() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: PUBLIC_GUEST_INFO_SETTING_KEY } });
    return setting?.value !== 'false';
  }

  private async getPublicOrderAppearance() {
    const keys = [
      'addon_public_background_url',
      'addon_public_hero_url',
      'addon_public_overlay_opacity',
      'addon_public_card_opacity',
    ];
    const settings = await this.prisma.systemSetting.findMany({ where: { key: { in: keys } } });
    const map = Object.fromEntries(settings.map((item) => [item.key, item.value]));
    return {
      backgroundUrl: map.addon_public_background_url || '/order/bg-mobile.jpg',
      heroUrl: map.addon_public_hero_url || '/order/hero-mobile.jpg',
      overlayOpacity: Math.min(Math.max(Number(map.addon_public_overlay_opacity ?? 78), 0), 100),
      cardOpacity: Math.min(Math.max(Number(map.addon_public_card_opacity ?? 54), 0), 100),
    };
  }

  private async buildRoomMenu(roomId: string) {
    const products = await this.prisma.addonProduct.findMany({
      where: { isActive: true },
      include: {
        category: true,
        roomOverrides: { where: { roomId }, take: 1 },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    });

    const visible = products
      .map((product) => {
        const override = product.roomOverrides[0];
        if (override && !override.isAvailable) return null;
        const effectivePrice = override?.customPrice ?? product.price;
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          categoryId: product.categoryId,
          categoryName: product.category?.name ?? 'Khác',
          basePrice: decimalNumber(product.price),
          price: decimalNumber(effectivePrice),
          hasRoomOverride: Boolean(override?.customPrice),
          sortOrder: product.sortOrder,
        };
      })
      .filter(Boolean) as any[];

    const categories = Array.from(new Map(visible.map((item) => [item.categoryId || 'uncategorized', {
      id: item.categoryId || 'uncategorized',
      name: item.categoryName,
      products: [] as any[],
    }])).values());

    for (const item of visible) {
      const category = categories.find((entry) => entry.id === (item.categoryId || 'uncategorized'));
      category?.products.push(item);
    }

    return { categories, products: visible };
  }

  async listCategories() {
    return this.prisma.addonCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async createCategory(dto: any) {
    return this.prisma.addonCategory.create({
      data: {
        name: String(dto.name || '').trim(),
        description: normalizeText(dto.description),
        sortOrder: toInt(dto.sortOrder, 0),
        isActive: dto.isActive !== false,
      },
    });
  }

  async updateCategory(id: string, dto: any) {
    await this.ensureCategory(id);
    return this.prisma.addonCategory.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? String(dto.name || '').trim() : undefined,
        description: dto.description !== undefined ? normalizeText(dto.description) : undefined,
        sortOrder: dto.sortOrder !== undefined ? toInt(dto.sortOrder, 0) : undefined,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : undefined,
      },
    });
  }

  async deleteCategory(id: string) {
    await this.ensureCategory(id);
    return this.prisma.addonCategory.update({ where: { id }, data: { isActive: false } });
  }

  private async ensureCategory(id: string) {
    const found = await this.prisma.addonCategory.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Danh mục không tồn tại');
    return found;
  }

  async listProducts() {
    return this.prisma.addonProduct.findMany({
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createProduct(dto: any) {
    if (!String(dto.name || '').trim()) throw new BadRequestException('Tên sản phẩm là bắt buộc');
    return this.prisma.addonProduct.create({
      data: {
        categoryId: dto.categoryId || null,
        name: String(dto.name || '').trim(),
        description: normalizeText(dto.description),
        imageUrl: normalizeText(dto.imageUrl),
        price: toDecimal(dto.price),
        sortOrder: toInt(dto.sortOrder, 0),
        isActive: dto.isActive !== false,
      },
      include: { category: true },
    });
  }

  async updateProduct(id: string, dto: any) {
    await this.ensureProduct(id);
    return this.prisma.addonProduct.update({
      where: { id },
      data: {
        categoryId: dto.categoryId !== undefined ? (dto.categoryId || null) : undefined,
        name: dto.name !== undefined ? String(dto.name || '').trim() : undefined,
        description: dto.description !== undefined ? normalizeText(dto.description) : undefined,
        imageUrl: dto.imageUrl !== undefined ? normalizeText(dto.imageUrl) : undefined,
        price: dto.price !== undefined ? toDecimal(dto.price) : undefined,
        sortOrder: dto.sortOrder !== undefined ? toInt(dto.sortOrder, 0) : undefined,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : undefined,
      },
      include: { category: true },
    });
  }

  async deleteProduct(id: string) {
    await this.ensureProduct(id);
    return this.prisma.addonProduct.update({ where: { id }, data: { isActive: false } });
  }

  private async ensureProduct(id: string) {
    const found = await this.prisma.addonProduct.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Sản phẩm không tồn tại');
    return found;
  }

  async getRoomMenuAdmin(roomId: string) {
    await this.ensureRoom(roomId);
    const menu = await this.buildRoomMenu(roomId);
    const overrides = await this.prisma.roomAddonProductOverride.findMany({ where: { roomId } });
    return { ...menu, overrides };
  }

  async upsertRoomProductOverride(roomId: string, productId: string, dto: any) {
    await this.ensureRoom(roomId);
    await this.ensureProduct(productId);
    return this.prisma.roomAddonProductOverride.upsert({
      where: { roomId_productId: { roomId, productId } },
      create: {
        roomId,
        productId,
        isAvailable: dto.isAvailable !== false,
        customPrice: dto.customPrice === null || dto.customPrice === '' || dto.customPrice === undefined ? null : toDecimal(dto.customPrice),
      },
      update: {
        isAvailable: dto.isAvailable !== undefined ? Boolean(dto.isAvailable) : undefined,
        customPrice: dto.customPrice === undefined ? undefined : (dto.customPrice === null || dto.customPrice === '' ? null : toDecimal(dto.customPrice)),
      },
    });
  }

  async resetRoomProductOverride(roomId: string, productId: string) {
    await this.prisma.roomAddonProductOverride.deleteMany({ where: { roomId, productId } });
    return { ok: true };
  }

  private async ensureRoom(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { building: true } });
    if (!room) throw new NotFoundException('Phòng không tồn tại');
    return room;
  }

  async getRoomQr(roomId: string, origin: string) {
    const [room, reservation] = await Promise.all([this.ensureRoom(roomId), this.getActiveStay(roomId)]);
    const token = this.buildRoomToken(roomId);
    const base = process.env.ADDON_ORDER_PUBLIC_BASE_URL || origin;
    const url = `${base.replace(/\/$/, '')}/order?room_id=${encodeURIComponent(roomId)}&token=${encodeURIComponent(token)}`;
    return {
      active: true,
      roomId,
      roomNumber: room.number,
      buildingName: room.building?.name,
      guestName: reservation?.primaryGuestName ?? null,
      reservationId: reservation?.id ?? null,
      token,
      url,
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=640x640&data=${encodeURIComponent(url)}`,
    };
  }

  async getRoomSalesInfo(roomId: string) {
    await this.ensureRoom(roomId);
    const orders = await this.prisma.addonOrder.findMany({
      where: { roomId },
      include: { items: true, reservation: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const totalPaid = orders.filter((order) => ['PAID', 'PREPARING', 'DELIVERED'].includes(order.status)).reduce((sum, order) => sum + decimalNumber(order.totalAmount), 0);
    const totalPending = orders.filter((order) => order.status === 'PENDING_PAYMENT').reduce((sum, order) => sum + decimalNumber(order.totalAmount), 0);
    return { active: true, orders, totalPaid, totalPending };
  }

  async listOrders(query: any) {
    const where: any = {};
    if (query.roomId) where.roomId = query.roomId;
    if (query.reservationId) where.reservationId = query.reservationId;
    if (query.status) where.status = query.status;
    return this.prisma.addonOrder.findMany({
      where,
      include: { room: { include: { building: true } }, reservation: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(query.limit) || 100, 300),
    });
  }

  async updateOrderStatus(id: string, status: AddonOrderStatus) {
    return this.prisma.addonOrder.update({ where: { id }, data: { status }, include: { items: true } });
  }

  async cancelAllPendingOrders() {
    const result = await this.prisma.addonOrder.updateMany({
      where: { status: AddonOrderStatus.PENDING_PAYMENT },
      data: { status: AddonOrderStatus.CANCELLED },
    });
    return { cancelled: result.count };
  }

  async getPublicSession(roomId: string, token: string) {
    const [room, reservation] = await Promise.all([this.ensureRoom(roomId), this.getActiveStay(roomId)]);
    this.assertToken(roomId, token);
    const [menu, showGuestInfo, appearance] = await Promise.all([
      this.buildRoomMenu(roomId),
      this.shouldShowGuestInfoOnPublicOrder(),
      this.getPublicOrderAppearance(),
    ]);
    return {
      room: {
        id: room.id,
        number: room.number,
        buildingName: room.building?.name,
      },
      guest: {
        displayName: showGuestInfo && reservation ? reservation.primaryGuestName : null,
        maskedName: reservation ? maskGuestName(reservation.primaryGuestName) : null,
      },
      reservation: reservation ? {
        id: reservation.id,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        actualCheckIn: reservation.actualCheckIn,
        actualCheckOut: reservation.actualCheckOut,
      } : null,
      display: { showGuestInfo: Boolean(showGuestInfo && reservation) },
      appearance,
      menu,
      payment: this.publicPaymentConfig(),
    };
  }

  async createPublicOrder(dto: any) {
    const roomId = String(dto.room_id || dto.roomId || '').trim();
    const token = String(dto.token || '').trim();
    const items = Array.isArray(dto.items) ? dto.items : [];
    if (!roomId || !token) throw new BadRequestException('Thiếu room_id/token');
    if (!items.length) throw new BadRequestException('Giỏ hàng đang trống');

    const room = await this.ensureRoom(roomId);
    const reservation = await this.getActiveStay(roomId);
    this.assertToken(roomId, token);

    const normalized = items.map((item) => ({
      productId: String(item.product_id || item.productId || '').trim(),
      quantity: Math.min(toInt(item.quantity, 1), MAX_ITEM_QUANTITY),
      note: normalizeText(item.note),
    })).filter((item) => item.productId && item.quantity > 0);
    if (!normalized.length) throw new BadRequestException('Giỏ hàng không hợp lệ');

    const productIds: string[] = Array.from(new Set(normalized.map((item) => item.productId)));
    const [products, overrides] = await Promise.all([
      this.prisma.addonProduct.findMany({ where: { id: { in: productIds }, isActive: true } }),
      this.prisma.roomAddonProductOverride.findMany({ where: { roomId, productId: { in: productIds } } }),
    ]);
    const byId = new Map(products.map((product) => [product.id, product]));
    const overrideByProductId = new Map(overrides.map((override) => [override.productId, override]));

    const orderItems = normalized.map((line) => {
      const product = byId.get(line.productId);
      if (!product) throw new BadRequestException('Có sản phẩm không còn bán');
      const override = overrideByProductId.get(product.id);
      if (override && !override.isAvailable) throw new BadRequestException(`Sản phẩm ${product.name} không bán ở phòng này`);
      const unitPrice = override?.customPrice ?? product.price;
      const lineTotal = new Prisma.Decimal(unitPrice).mul(line.quantity);
      return {
        productId: product.id,
        productName: product.name,
        unitPrice,
        quantity: line.quantity,
        lineTotal,
        note: line.note,
      };
    });
    const totalAmount = orderItems.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
    if (totalAmount.lte(0)) throw new BadRequestException('Tổng tiền không hợp lệ');

    const window = currentPublicHistoryWindow();
    const existingPending = await this.prisma.addonOrder.findFirst({
      where: {
        roomId,
        status: AddonOrderStatus.PENDING_PAYMENT,
        createdAt: { gte: window.from },
      },
      include: { items: true, room: { include: { building: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPending) {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.addonOrderItem.deleteMany({ where: { orderId: existingPending.id } });
        return tx.addonOrder.update({
          where: { id: existingPending.id },
          data: {
            reservationId: reservation?.id ?? existingPending.reservationId ?? null,
            guestName: reservation?.primaryGuestName ?? existingPending.guestName ?? null,
            totalAmount,
            customerNote: normalizeText(dto.note),
            items: { create: orderItems },
          },
          include: { items: true, room: { include: { building: true } } },
        });
      });
      return {
        order: this.publicOrderSummary(updated),
        payment: this.buildPaymentPayload(updated.paymentReference, decimalNumber(updated.totalAmount)),
        reusedPendingOrder: true,
      };
    }

    const orderCode = compactOrderCode(room);
    const created = await this.prisma.addonOrder.create({
      data: {
        orderCode,
        paymentReference: orderCode,
        roomId,
        reservationId: reservation?.id ?? null,
        guestName: reservation?.primaryGuestName ?? null,
        totalAmount,
        customerNote: normalizeText(dto.note),
        items: { create: orderItems },
      },
      include: { items: true, room: { include: { building: true } } },
    });

    return { order: created, payment: this.buildPaymentPayload(created.paymentReference, decimalNumber(created.totalAmount)) };
  }

  private publicOrderSummary(order: any) {
    return {
      id: order.id,
      orderCode: order.orderCode,
      status: order.status,
      totalAmount: decimalNumber(order.totalAmount),
      customerNote: order.customerNote,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      sepayTransactionId: order.sepayTransactionId,
      room: order.room ? { id: order.room.id, number: order.room.number, buildingName: order.room.building?.name ?? null } : undefined,
      reservationId: order.reservationId,
      items: (order.items || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        unitPrice: decimalNumber(item.unitPrice),
        quantity: item.quantity,
        lineTotal: decimalNumber(item.lineTotal),
        note: item.note,
      })),
    };
  }

  async getPublicOrderStatus(orderCode: string, roomId: string, token: string) {
    const cleanOrderCode = String(orderCode || '').trim().toUpperCase();
    const cleanRoomId = String(roomId || '').trim();
    const cleanToken = String(token || '').trim();
    if (!cleanOrderCode || !cleanRoomId || !cleanToken) throw new BadRequestException('Thiếu thông tin kiểm tra đơn');
    this.assertToken(cleanRoomId, cleanToken);

    const order = await this.prisma.addonOrder.findFirst({
      where: { orderCode: cleanOrderCode, roomId: cleanRoomId },
      include: { items: true, room: { include: { building: true } }, reservation: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    return { order: this.publicOrderSummary(order) };
  }

  async cancelPublicPendingOrder(orderCode: string, roomId: string, token: string) {
    const cleanOrderCode = String(orderCode || '').trim().toUpperCase();
    const cleanRoomId = String(roomId || '').trim();
    const cleanToken = String(token || '').trim();
    if (!cleanOrderCode || !cleanRoomId || !cleanToken) throw new BadRequestException('Thiếu thông tin huỷ đơn');
    this.assertToken(cleanRoomId, cleanToken);

    const order = await this.prisma.addonOrder.findFirst({
      where: { orderCode: cleanOrderCode, roomId: cleanRoomId, status: AddonOrderStatus.PENDING_PAYMENT },
      include: { items: true, room: { include: { building: true } } },
    });
    if (!order) return { cancelled: false };

    const updated = await this.prisma.addonOrder.update({
      where: { id: order.id },
      data: { status: AddonOrderStatus.CANCELLED },
      include: { items: true, room: { include: { building: true } } },
    });
    return { cancelled: true, order: this.publicOrderSummary(updated) };
  }

  async getPublicActiveOrder(roomId: string, token: string) {
    const cleanRoomId = String(roomId || '').trim();
    const cleanToken = String(token || '').trim();
    if (!cleanRoomId || !cleanToken) throw new BadRequestException('Thiếu room_id/token');
    this.assertToken(cleanRoomId, cleanToken);

    const window = currentPublicHistoryWindow();
    const order = await this.prisma.addonOrder.findFirst({
      where: {
        roomId: cleanRoomId,
        status: AddonOrderStatus.PENDING_PAYMENT,
        createdAt: { gte: window.from },
      },
      include: { items: true, room: { include: { building: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      resetAt: window.resetAt,
      from: window.from,
      order: order ? this.publicOrderSummary(order) : null,
      payment: order ? this.buildPaymentPayload(order.paymentReference, decimalNumber(order.totalAmount)) : null,
    };
  }

  async getPublicPaymentHistory(roomId: string, token: string) {
    const cleanRoomId = String(roomId || '').trim();
    const cleanToken = String(token || '').trim();
    if (!cleanRoomId || !cleanToken) throw new BadRequestException('Thiếu room_id/token');
    this.assertToken(cleanRoomId, cleanToken);

    const window = currentPublicHistoryWindow();
    const orders = await this.prisma.addonOrder.findMany({
      where: {
        roomId: cleanRoomId,
        paidAt: { gte: window.from },
        status: { in: [AddonOrderStatus.PAID, AddonOrderStatus.PREPARING, AddonOrderStatus.DELIVERED] },
      },
      include: { items: true, room: { include: { building: true } } },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });

    return {
      resetAt: window.resetAt,
      from: window.from,
      orders: orders.map((order) => this.publicOrderSummary(order)),
    };
  }

  private publicPaymentConfig() {
    return {
      bankId: process.env.ADDON_ORDER_VIETQR_BANK_ID || null,
      accountNo: process.env.ADDON_ORDER_VIETQR_ACCOUNT_NO || null,
      accountName: process.env.ADDON_ORDER_VIETQR_ACCOUNT_NAME || null,
    };
  }

  private buildPaymentPayload(reference: string, amount: number) {
    const cfg = this.publicPaymentConfig();
    const missing = !cfg.bankId || !cfg.accountNo;
    const transferDescription = String(cfg.bankId || '').toLowerCase() === 'vietinbank' ? `SEVQR ${reference}` : reference;
    const qrParams = new URLSearchParams({
      acc: cfg.accountNo || '',
      bank: cfg.bankId || '',
      amount: String(Math.round(amount)),
      des: transferDescription,
      template: 'compact',
    });
    const qrImageUrl = missing ? null : `https://qr.sepay.vn/img?${qrParams.toString()}`;
    return { ...cfg, reference, amount, qrImageUrl, missingConfig: missing };
  }

  private async buildPaidOrderWebhookPayload(orderId: string, sepayLogId?: string) {
    const order = await this.prisma.addonOrder.findUnique({
      where: { id: orderId },
      include: {
        room: { include: { building: true } },
        reservation: true,
        items: true,
      },
    });
    if (!order) return null;

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      paymentReference: order.paymentReference,
      status: order.status,
      totalAmount: decimalNumber(order.totalAmount),
      customerNote: order.customerNote,
      guestName: order.guestName,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      sepayTransactionId: order.sepayTransactionId,
      sepayWebhookLogId: sepayLogId ?? null,
      room: {
        id: order.room.id,
        number: order.room.number,
        buildingId: order.room.buildingId,
        buildingName: order.room.building?.name ?? null,
        buildingCode: order.room.building?.code ?? null,
      },
      reservation: order.reservation ? {
        id: order.reservation.id,
        reservationCode: order.reservation.reservationCode,
        primaryGuestName: order.reservation.primaryGuestName,
        checkInDate: order.reservation.checkInDate,
        checkOutDate: order.reservation.checkOutDate,
        actualCheckIn: order.reservation.actualCheckIn,
        actualCheckOut: order.reservation.actualCheckOut,
      } : null,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: decimalNumber(item.unitPrice),
        quantity: item.quantity,
        lineTotal: decimalNumber(item.lineTotal),
        note: item.note,
      })),
    };
  }

  async handleSepayWebhook(payload: any) {
    const amount = extractSepayAmount(payload);
    const content = extractSepayContent(payload);
    const transactionId = extractSepayTransactionId(payload);
    const match = content.match(/CH[A-Z0-9]+/i);
    const reference = match?.[0]?.toUpperCase();

    if (!reference) {
      return this.prisma.sepayWebhookLog.create({ data: { payload, amount: amount === null ? null : toDecimal(amount), transferContent: content, transactionId, status: SepayWebhookStatus.UNMATCHED, error: 'Không tìm thấy mã đơn CH...' } });
    }

    const order = await this.prisma.addonOrder.findUnique({ where: { paymentReference: reference } });
    if (!order) {
      return this.prisma.sepayWebhookLog.create({ data: { payload, amount: amount === null ? null : toDecimal(amount), transferContent: content, transactionId, status: SepayWebhookStatus.UNMATCHED, error: `Không tìm thấy đơn ${reference}` } });
    }

    const expectedAmount = Math.round(decimalNumber(order.totalAmount));
    if (amount === null || Number(amount) < expectedAmount) {
      return this.prisma.sepayWebhookLog.create({ data: { payload, orderId: order.id, amount: amount === null ? null : toDecimal(amount), transferContent: content, transactionId, status: SepayWebhookStatus.AMOUNT_MISMATCH, error: `Số tiền chuyển khoản nhỏ hơn đơn ${reference}: nhận ${amount ?? 'không rõ'}, cần tối thiểu ${expectedAmount}` } });
    }

    if (order.status === AddonOrderStatus.PAID || order.paidAt) {
      return this.prisma.sepayWebhookLog.create({ data: { payload, orderId: order.id, amount: toDecimal(amount), transferContent: content, transactionId, status: SepayWebhookStatus.IGNORED, error: `Đơn ${reference} đã ghi nhận thanh toán trước đó`, resolvedAt: new Date() } });
    }

    const updated = await this.prisma.addonOrder.update({ where: { id: order.id }, data: { status: AddonOrderStatus.PAID, paidAt: new Date(), sepayTransactionId: transactionId || undefined } });
    const log = await this.prisma.sepayWebhookLog.create({ data: { payload, orderId: order.id, amount: toDecimal(amount), transferContent: content, transactionId, status: SepayWebhookStatus.MATCHED, resolvedAt: new Date() } });
    const paidPayload = await this.buildPaidOrderWebhookPayload(updated.id, log.id);
    if (paidPayload) this.events.emit('addon_order.paid', paidPayload);
    return log;
  }

  async listWebhookLogs(query: any) {
    const where: any = {};
    if (query.status) where.status = query.status;
    return this.prisma.sepayWebhookLog.findMany({
      where,
      include: { order: { include: { room: true, reservation: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(query.limit) || 100, 300),
    });
  }

  async manualConfirmWebhook(logId: string) {
    const log = await this.prisma.sepayWebhookLog.findUnique({ where: { id: logId } });
    if (!log?.orderId) throw new BadRequestException('Webhook log chưa gắn được đơn hàng');
    await this.prisma.addonOrder.update({ where: { id: log.orderId }, data: { status: AddonOrderStatus.PAID, paidAt: new Date() } });
    return this.prisma.sepayWebhookLog.update({ where: { id: logId }, data: { status: SepayWebhookStatus.MANUAL_CONFIRMED, resolvedAt: new Date(), error: null } });
  }
}
