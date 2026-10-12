import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { User } from '../entities';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { CurrentUser, JwtAuthGuard } from './roles';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
  @Get('me') @UseGuards(JwtAuthGuard) me(@CurrentUser() user: User) { return user; }
}
