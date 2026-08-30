import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Kiểm tra trạng thái hệ thống' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'hotel-management-api',
    };
  }
}
