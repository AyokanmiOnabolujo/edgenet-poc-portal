import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { Doc } from '../docs';
import { STATUSES, Status, User } from '../entities';
import { AssignDto, CheckDto, CreateRequestDto, PageDto, ReportDto, StatusDto } from './dto';
import { RequestsService } from './requests.service';

const AM = 'Account Manager.';
const RESPONSIBLE = 'The Account Manager, or the engineer assigned to the request.';
const ANYONE = 'Any signed-in user in the organisation.';

@ApiTags('PoC requests')
@ApiBearerAuth()
@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequestsController {
  constructor(private s: RequestsService) {}

  @Doc('List requests', { who: ANYONE, description: 'Newest first. Each row includes `nextStatuses` (the moves you can make) and `deadline`.', errors: [401] })
  @ApiQuery({ name: 'status', required: false, enum: STATUSES })
  @Get() list(@CurrentUser() me: User, @Query('status') status?: string) {
    return this.s.list(me, (STATUSES as readonly string[]).includes(status) ? (status as Status) : undefined);
  }

  @Doc('Deadline alerts', {
    who: `${ANYONE} Engineers only see requests assigned to them.`,
    description: 'Open requests that are overdue, due within `DEADLINE_WARNING_DAYS`, or still new after their start date, most urgent first. "Today" is in `APP_TIMEZONE`.',
    errors: [401],
    ok: { example: { today: '2026-10-19', timeZone: 'Africa/Lagos', warnDays: 7, counts: { overdue: 1, dueSoon: 0, lateStart: 1 }, items: [{ id: '…', number: 12, projectName: 'Edge cache PoC', endDate: '2026-10-16', deadline: { daysLeft: -3, overdue: true, dueSoon: false, lateStart: true } }] } },
  })
  @Get('alerts') alerts(@CurrentUser() me: User) { return this.s.alerts(me); }

  @Doc('Analytics report', {
    who: AM,
    description: 'Aggregated in the database. Filters apply to request metrics; `utilisation` is today\'s inventory. Definitions: backend/src/requests/report.ts.',
    errors: [400, 401, 403],
    ok: { example: { total: 5, active: 3, completed: 1, cancelled: 1, completionRate: 50, overdue: 1, dueSoon: 1, lateStart: 1, avgProcessingDays: 12.5, timedCompletions: 1, byStatus: { new_request: 2, provisioning: 0, testing: 1, completed: 1, decommissioned: 1 }, utilisation: [{ type: 'Software licence', unit: 'seat', capacity: 4, inUse: 3, percent: 75 }] } },
  })
  @Get('report') @Roles('account_manager') report(@CurrentUser() me: User, @Query() q: ReportDto) { return this.s.report(me, q); }

  @Doc('Request history (audit trail)', { who: ANYONE, description: 'Newest first, paged. Entries cannot be edited or deleted through the API.', errors: [400, 401, 404] })
  @Get(':id/activity') activity(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Query() q: PageDto) {
    return this.s.activity(me, id, q.page, q.limit);
  }

  @Doc('Get a request', {
    who: ANYONE,
    description: 'Includes the latest 20 activity entries (`activityTotal` for the count), the decommissioning `checklist`, `deadline`, `nextStatuses` and what you may do (`canAllocate`, `canRelease`, `canEditChecklist`).',
    errors: [400, 401, 404],
  })
  @Get(':id') get(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string) { return this.s.get(me, id); }

  @Doc('Raise a request', { who: AM, description: 'Logged in the audit trail as `created` (and `assigned` if an engineer is given).', errors: [400, 401, 403] })
  @Post() @Roles('account_manager') create(@CurrentUser() me: User, @Body() dto: CreateRequestDto) { return this.s.create(me, dto); }

  @Doc('Move a request to another stage', {
    who: `${RESPONSIBLE} Cancelling an unfinished PoC (to Decommissioned) is for the Account Manager only.`,
    description: 'Only moves in the workflow are accepted (see README). `remarks` is required when sending work back or cancelling. Decommissioned requires the checklist to be complete and every allocation released.',
    errors: [400, 401, 403, 404, 409],
    ok: { example: { id: '…', status: 'testing', nextStatuses: [{ to: 'completed', needsReason: false, cancel: false, blocked: null }] } },
  })
  @Patch(':id/status') status(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    return this.s.setStatus(me, id, dto.status, dto.remarks);
  }

  @Doc('Tick or untick a decommissioning task', {
    who: RESPONSIBLE,
    description: 'Keys: client_notified, access_revoked, data_handled (required), equipment_verified, closure_report (optional). resources_released ticks itself. Closed once the request is decommissioned.',
    errors: [400, 401, 403, 404, 409],
  })
  @Patch(':id/checklist/:key') check(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Param('key') key: string, @Body() dto: CheckDto) {
    return this.s.setCheck(me, id, key, dto.done, dto.notes);
  }

  @Doc('Assign, reassign or unassign the engineer', { who: AM, description: 'Send `engineerId: null` to unassign. Only approved engineers in your organisation.', errors: [400, 401, 403, 404, 409] })
  @Patch(':id/assign') @Roles('account_manager') assign(@CurrentUser() me: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.s.assign(me, id, dto.engineerId);
  }
}
