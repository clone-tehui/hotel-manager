import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Thống kê tổng quan dashboard' })
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('report')
  @ApiOperation({ summary: 'Báo cáo dashboard theo khoảng ngày' })
  getReport(@Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboardService.getReport(from, to);
  }
}
