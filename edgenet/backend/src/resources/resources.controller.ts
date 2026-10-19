import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { User } from '../entities';
import { AllocateDto, CreateResourceDto, UpdateResourceDto, WindowDto } from './dto';
import { ResourcesService } from './resources.service';

@Controller('resources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourcesController {
  constructor(private s: ResourcesService) {}
  @Get() list(@CurrentUser() me: User, @Query() q: WindowDto) { return this.s.list(me, q.start, q.end ?? q.start); }
  @Post() @Roles('account_manager') create(@CurrentUser() me: User, @Body() dto: CreateResourceDto) { return this.s.create(me, dto); }
  @Patch(':id') @Roles('account_manager') update(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto) {
    return this.s.update(me, id, dto);
  }
}

@Controller('requests/:id/allocations')
@UseGuards(JwtAuthGuard)
export class AllocationsController {
  constructor(private s: ResourcesService) {}
  @Get() list(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string) { return this.s.forRequest(me, id); }
  @Post() allocate(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AllocateDto) {
    return this.s.allocate(me, id, dto);
  }
  @Patch(':allocationId/release') release(
    @CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Param('allocationId', ParseUUIDPipe) allocationId: string,
  ) {
    return this.s.release(me, id, allocationId);
  }
}
