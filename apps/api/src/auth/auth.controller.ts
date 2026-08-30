import { Controller, Post, Body, Get, Patch, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtStrategyGuard } from './guards/jwt-strategy.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

class ChangePasswordDto {
  @IsString() oldPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập – nhận access_token + refresh_token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới access_token bằng refresh_token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('register')
  @ApiOperation({ summary: 'Tạo tài khoản mới (ADMIN only)' })
  @UseGuards(JwtStrategyGuard, RolesGuard)
  @ApiBearerAuth('JWT')
  @Roles('ADMIN')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtStrategyGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Thông tin người dùng hiện tại' })
  getMe(@Request() req) {
    return this.authService.me(req.user.id);
  }

  @Post('change-password')
  @UseGuards(JwtStrategyGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto.oldPassword, dto.newPassword);
  }
}
