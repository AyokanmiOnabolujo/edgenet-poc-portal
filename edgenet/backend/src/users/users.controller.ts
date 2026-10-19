import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { Doc } from '../docs';
import { User } from '../entities';
import { ChangePasswordDto, UpdateProfileDto, UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private s: UsersService) {}

  @Doc('Approved engineers with their workload', { who: 'Account Manager.', errors: [401, 403] })
  @Get('engineers') @Roles('account_manager') engineers(@CurrentUser() me: User) { return this.s.engineers(me); }

  @Doc('Engineers waiting for approval', { who: 'Account Manager.', errors: [401, 403] })
  @Get('pending') @Roles('account_manager') pending(@CurrentUser() me: User) { return this.s.pending(me); }

  @Doc('Approve a pending engineer', { who: 'Account Manager.', description: 'They can sign in afterwards.', errors: [400, 401, 403, 404] })
  @Patch(':id/approve') @Roles('account_manager') approve(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string) { return this.s.approve(me, id); }

  @Doc('Reject a pending engineer', { who: 'Account Manager.', description: 'Deletes the unapproved registration; the person can register again.', errors: [400, 401, 403, 404], ok: { example: { ok: true } } })
  @Delete('pending/:id') @Roles('account_manager') reject(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string) { return this.s.reject(me, id); }

  @Doc('Update your name and email', { who: 'Any signed-in user.', errors: [400, 401, 409] })
  @Patch('me') update(@CurrentUser() me: User, @Body() dto: UpdateProfileDto) { return this.s.updateProfile(me, dto); }

  @Doc('Change your password', { who: 'Any signed-in user.', errors: [400, 401], ok: { example: { ok: true } } })
  @Patch('me/password') password(@CurrentUser() me: User, @Body() dto: ChangePasswordDto) { return this.s.changePassword(me, dto); }
}
