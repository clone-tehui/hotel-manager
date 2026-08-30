import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength, IsIn } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() fullName: string;
  @IsOptional() @IsString() @IsIn(['ADMIN','USER']) role?: 'ADMIN' | 'USER';
}

class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() @IsIn(['ADMIN','USER']) role?: 'ADMIN' | 'USER';
  @IsOptional() isActive?: boolean;
}

class SetPasswordDto {
  @IsString() @MinLength(8) password: string;
}

@ApiTags('Users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người dùng' })
  findAll(@Query('page') page: number, @Query('limit') limit: number, @Query('q') q: string) {
    return this.usersService.findAll({ page, limit, q });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết người dùng' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(':id/set-password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu người dùng (ADMIN)' })
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.usersService.setPassword(id, dto.password);
  }

  @Post(':id/lock')
  @ApiOperation({ summary: 'Khoá tài khoản' })
  lock(@Param('id') id: string) {
    return this.usersService.lock(id);
  }

  @Post(':id/unlock')
  @ApiOperation({ summary: 'Mở khoá tài khoản' })
  unlock(@Param('id') id: string) {
    return this.usersService.unlock(id);
  }
}
