import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TimelineService } from './timeline.service';
import { TimelineExportDto } from './dto/timeline-export.dto';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Timeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) { }

  @Get()
  @ApiOperation({ summary: 'Dữ liệu timeline (reservations trong khoảng thời gian)' })
  getData(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('buildingId') buildingId: string,
    @Query('status') status: string,
  ) {
    return this.timelineService.getTimelineData({ from, to, buildingId, status });
  }

  @Get('export')
  @ApiOperation({ summary: 'Xuất dữ liệu timeline ra Excel/CSV' })
  async export(@Query() query: TimelineExportDto, @Res() res: Response) {
    return this.timelineService.exportTimeline(query, res);
  }
}
