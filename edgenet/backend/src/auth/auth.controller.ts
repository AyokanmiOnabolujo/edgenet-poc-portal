import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Doc } from '../docs';
import { User } from '../entities';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { CurrentUser, JwtAuthGuard } from './roles';

const exampleUser = { id: '3f1c2b8e-9a41-4c7e-8d2a-5b6e7f801234', name: 'Amaka Obi', email: 'amaka@example.test', role: 'account_manager', organisation: 'Demo Networks', approved: true };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Doc('Register', {
    who: 'Anyone.',
    description: 'An Account Manager starts an organisation (one per organisation) and gets a token. An engineer joining an existing organisation is registered pending and gets no token until that organisation\'s Account Manager approves them.',
    errors: [400, 409],
    ok: { status: 201, example: { pending: true, message: "Your account is waiting for approval by your organisation's Account Manager." } },
  })
  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Doc('Sign in', {
    who: 'Anyone with an approved account.',
    description: 'Returns a token valid for 7 days. Send it as `Authorization: Bearer <token>`.',
    errors: [400, 401, 403],
    ok: { status: 201, example: { token: 'eyJhbGciOiJIUzI1NiIs…', user: exampleUser } },
  })
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @ApiBearerAuth()
  @Doc('Current user', { who: 'Any signed-in user.', errors: [401], ok: { example: exampleUser } })
  @Get('me') @UseGuards(JwtAuthGuard) me(@CurrentUser() user: User) { return user; }
}
