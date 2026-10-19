import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { Doc } from '../docs';
import { User } from '../entities';
import { AllocateDto, CreateResourceDto, UpdateResourceDto, WindowDto } from './dto';
import { ResourcesService } from './resources.service';

const RESPONSIBLE = 'The Account Manager, or the engineer assigned to the request.';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('resources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourcesController {
  constructor(private s: ResourcesService) {}

  @Doc('List inventory with free capacity', {
    who: 'Any signed-in user in the organisation.',
    description: '`inUse` is the most units booked on any one day between `start` and `end` (default: today); `available` is what is left.',
    errors: [400, 401],
    ok: { example: [{ id: '…', name: 'Dell R750 #1', type: 'Physical server', unit: 'server', capacity: 1, state: 'available', inUse: 1, available: 0 }] },
  })
  @Get() list(@CurrentUser() me: User, @Query() q: WindowDto) { return this.s.list(me, q.start, q.end ?? q.start); }

  @Doc('Add an inventory item', { who: 'Account Manager.', errors: [400, 401, 403] })
  @Post() @Roles('account_manager') create(@CurrentUser() me: User, @Body() dto: CreateResourceDto) { return this.s.create(me, dto); }

  @Doc('Update an inventory item', { who: 'Account Manager.', description: 'Capacity cannot go below what is already allocated. Retire items instead of deleting them.', errors: [400, 401, 403, 404, 409] })
  @Patch(':id') @Roles('account_manager') update(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateResourceDto) {
    return this.s.update(me, id, dto);
  }
}

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('requests/:id/allocations')
@UseGuards(JwtAuthGuard)
export class AllocationsController {
  constructor(private s: ResourcesService) {}

  @Doc('Allocations of a request', { who: 'Any signed-in user in the organisation.', errors: [400, 401, 404] })
  @Get() list(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string) { return this.s.forRequest(me, id); }

  @Doc('Allocate inventory to a request', {
    who: `${RESPONSIBLE} Only while the request is New, Provisioning or Testing.`,
    description: 'Dates default to the request\'s and are inclusive. Refused with 409 if the item is not available or the quantity would exceed capacity on any day; the 409 body lists the clashing bookings, as in this example.',
    errors: [400, 401, 403, 404, 409],
    error: { status: 409, example: { statusCode: 409, error: 'Conflict', message: 'Only 0 of 1 server of Dell R750 #1 are free on every day from 2026-11-10 to 2026-11-20; you asked for 1.', available: 0, conflicts: [{ request: 'POC-0007', projectName: 'Rival PoC', startDate: '2026-11-01', endDate: '2026-11-10', quantity: 1 }] } },
  })
  @Post() allocate(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AllocateDto) {
    return this.s.allocate(me, id, dto);
  }

  @Doc('Release an allocation', { who: RESPONSIBLE, description: 'Only active allocations can be released, so it cannot happen twice.', errors: [400, 401, 403, 404, 409] })
  @Patch(':allocationId/release') release(
    @CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Param('allocationId', ParseUUIDPipe) allocationId: string,
  ) {
    return this.s.release(me, id, allocationId);
  }
}
