import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

class CreateApiKeyDto {
  @IsString() name: string;
  @IsOptional() scopes?: string[];
}

@ApiTags('API Keys')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách API keys (không trả về full key)' })
  findAll() {
    return this.apiKeysService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo API key mới – full key chỉ hiện 1 lần' })
  create(@Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Thu hồi API key' })
  revoke(@Param('id') id: string) {
    return this.apiKeysService.revoke(id);
  }
}
