import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { STATUSES, Status, User } from '../entities';
import { AssignDto, CreateRequestDto, StatusDto } from './dto';
import { RequestsService } from './requests.service';

@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequestsController {
  constructor(private s: RequestsService) {}

  @Get() list(@CurrentUser() me: User, @Query('status') status?: string) {
    return this.s.list(me, (STATUSES as readonly string[]).includes(status) ? (status as Status) : undefined);
  }
  @Get('report') @Roles('account_manager') report(@CurrentUser() me: User) { return this.s.report(me); }
  @Get(':id') get(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(me, id); }
  @Post() @Roles('account_manager') create(@CurrentUser() me: User, @Body() dto: CreateRequestDto) { return this.s.create(me, dto); }
  @Patch(':id/status') status(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    return this.s.setStatus(me, id, dto.status, dto.remarks);
  }
  @Patch(':id/assign') @Roles('account_manager') assign(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.s.assign(me, id, dto.engineerId);
  }
}
