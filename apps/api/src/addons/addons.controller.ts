import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddonOrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AddonsService } from './addons.service';

@ApiTags('Add-ons')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('addons')
export class AddonsController {
  constructor(private readonly service: AddonsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách danh mục sản phẩm add-on' })
  listCategories() { return this.service.listCategories(); }

  @Post('categories')
  createCategory(@Body() dto: any) { return this.service.createCategory(dto); }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: any) { return this.service.updateCategory(id, dto); }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) { return this.service.deleteCategory(id); }

  @Get('products')
  @ApiOperation({ summary: 'Danh sách sản phẩm add-on' })
  listProducts() { return this.service.listProducts(); }

  @Post('products')
  createProduct(@Body() dto: any) { return this.service.createProduct(dto); }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: any) { return this.service.updateProduct(id, dto); }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) { return this.service.deleteProduct(id); }

  @Get('rooms/:roomId/menu')
  @ApiOperation({ summary: 'Menu hiệu lực và override riêng của từng phòng' })
  getRoomMenu(@Param('roomId') roomId: string) { return this.service.getRoomMenuAdmin(roomId); }

  @Patch('rooms/:roomId/products/:productId')
  @ApiOperation({ summary: 'Bật/tắt sản phẩm hoặc đổi giá riêng cho phòng' })
  upsertRoomOverride(@Param('roomId') roomId: string, @Param('productId') productId: string, @Body() dto: any) {
    return this.service.upsertRoomProductOverride(roomId, productId, dto);
  }

  @Delete('rooms/:roomId/products/:productId')
  resetRoomOverride(@Param('roomId') roomId: string, @Param('productId') productId: string) {
    return this.service.resetRoomProductOverride(roomId, productId);
  }

  @Get('rooms/:roomId/qr')
  @ApiOperation({ summary: 'Tạo link/QR gọi món cho lượt khách đang lưu trú trong phòng' })
  getRoomQr(@Param('roomId') roomId: string, @Req() req: any, @Query('origin') publicOrigin?: string) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    const origin = publicOrigin || `${proto}://${host}`.replace(/\/api$/, '');
    return this.service.getRoomQr(roomId, origin);
  }

  @Get('rooms/:roomId/sales-info')
  @ApiOperation({ summary: 'Thông tin bán hàng của khách đang lưu trú tại phòng' })
  getRoomSalesInfo(@Param('roomId') roomId: string) { return this.service.getRoomSalesInfo(roomId); }

  @Get('orders')
  listOrders(@Query() query: any) { return this.service.listOrders(query); }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body('status') status: AddonOrderStatus) {
    return this.service.updateOrderStatus(id, status);
  }

  @Post('orders/cancel-pending')
  @ApiOperation({ summary: 'Huỷ toàn bộ đơn add-on đang chờ thanh toán để dừng polling QR cũ' })
  cancelPendingOrders() { return this.service.cancelAllPendingOrders(); }

  @Get('sepay/webhook-logs')
  listWebhookLogs(@Query() query: any) { return this.service.listWebhookLogs(query); }

  @Post('sepay/webhook-logs/:id/manual-confirm')
  manualConfirmWebhook(@Param('id') id: string) { return this.service.manualConfirmWebhook(id); }
}

@ApiTags('Public Add-on Order')
@Controller('public/addons')
export class PublicAddonsController {
  constructor(private readonly service: AddonsService) {}

  @Get('session')
  @ApiOperation({ summary: 'Khách quét QR: kiểm tra link và lấy menu phòng' })
  getSession(@Query('room_id') roomIdSnake: string, @Query('roomId') roomIdCamel: string, @Query('token') token: string) {
    return this.service.getPublicSession(roomIdSnake || roomIdCamel, token);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Khách đặt món. Backend tự tính giá theo room/product, không tin giá client.' })
  createOrder(@Body() dto: any) { return this.service.createPublicOrder(dto); }

  @Get('active-order')
  @ApiOperation({ summary: 'Lấy đơn đang chờ thanh toán của phòng trong kỳ hiện tại, để khách F5/thoát vào lại không mất QR' })
  getActiveOrder(@Query('room_id') roomIdSnake: string, @Query('roomId') roomIdCamel: string, @Query('token') token: string) {
    return this.service.getPublicActiveOrder(roomIdSnake || roomIdCamel, token);
  }

  @Get('orders/:orderCode/status')
  @ApiOperation({ summary: 'Khách kiểm tra trạng thái thanh toán của đơn hiện tại' })
  getOrderStatus(@Param('orderCode') orderCode: string, @Query('room_id') roomIdSnake: string, @Query('roomId') roomIdCamel: string, @Query('token') token: string) {
    return this.service.getPublicOrderStatus(orderCode, roomIdSnake || roomIdCamel, token);
  }

  @Post('orders/:orderCode/cancel')
  @ApiOperation({ summary: 'Khách đóng QR khi chưa thanh toán: huỷ đơn chờ thanh toán để dừng polling và tạo QR mới lần sau' })
  cancelPendingOrder(@Param('orderCode') orderCode: string, @Body() dto: any) {
    return this.service.cancelPublicPendingOrder(orderCode, dto?.room_id || dto?.roomId, dto?.token);
  }

  @Get('payment-history')
  @ApiOperation({ summary: 'Lịch sử thanh toán hiển thị trên giao diện khách, tự reset lúc 12:00 trưa mỗi ngày' })
  getPaymentHistory(@Query('room_id') roomIdSnake: string, @Query('roomId') roomIdCamel: string, @Query('token') token: string) {
    return this.service.getPublicPaymentHistory(roomIdSnake || roomIdCamel, token);
  }
}

@ApiTags('SePay Webhook')
@Controller('addons/sepay')
export class SepayWebhookController {
  constructor(private readonly service: AddonsService) {}

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook SePay báo giao dịch chuyển khoản' })
  handleWebhook(
    @Body() body: any,
    @Headers('x-sepay-secret') secret?: string,
    @Headers('x-api-key') apiKey?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const expected = process.env.SEPAY_WEBHOOK_SECRET;
    const authValue = String(authorization || '').trim();
    const authToken = authValue.replace(/^(bearer|apikey|api-key|token)\s+/i, '').trim();
    const candidates = [secret, apiKey, authValue, authToken].map((value) => String(value || '').trim()).filter(Boolean);
    if (expected && !candidates.includes(expected)) throw new UnauthorizedException('Webhook secret không hợp lệ');
    return this.service.handleSepayWebhook(body);
  }
}
