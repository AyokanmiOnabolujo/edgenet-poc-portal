import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { User } from '../entities';
import { ChangePasswordDto, UpdateProfileDto, UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private s: UsersService) {}
  @Get('engineers') @Roles('account_manager') engineers(@CurrentUser() me: User) { return this.s.engineers(me); }
  @Patch('me') update(@CurrentUser() me: User, @Body() dto: UpdateProfileDto) { return this.s.updateProfile(me, dto); }
  @Patch('me/password') password(@CurrentUser() me: User, @Body() dto: ChangePasswordDto) { return this.s.changePassword(me, dto); }
}
