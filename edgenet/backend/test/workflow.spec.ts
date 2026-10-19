import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PocRequest, Status, User } from '../src/entities';
import { checkTransition, Closure, isResponsible, nextStatuses } from '../src/requests/workflow';

const am = { id: 'am', role: 'account_manager' } as User;
const eng = { id: 'eng', role: 'engineer' } as User;
const other = { id: 'other', role: 'engineer' } as User;
const req = (status: Status, assigned: User | null = eng) => ({ status, assignedEngineer: assigned }) as PocRequest;
const done: Closure = { openTasks: 0, activeAllocations: 0 };
const open: Closure = { openTasks: 2, activeAllocations: 1 };

describe('workflow', () => {
  it('allows the forward path and the testing rework loop', () => {
    expect(() => checkTransition(eng, req('new_request'), 'provisioning', done)).not.toThrow();
    expect(() => checkTransition(eng, req('provisioning'), 'testing', done)).not.toThrow();
    expect(() => checkTransition(eng, req('testing'), 'completed', done)).not.toThrow();
    expect(() => checkTransition(eng, req('testing'), 'provisioning', done, 'VM image wrong')).not.toThrow();
    expect(() => checkTransition(eng, req('completed'), 'decommissioned', done)).not.toThrow();
  });

  it('rejects skipped, backward and post-final moves', () => {
    expect(() => checkTransition(am, req('new_request'), 'testing', done)).toThrow(ConflictException);
    expect(() => checkTransition(am, req('completed'), 'testing', done)).toThrow(ConflictException);
    expect(() => checkTransition(am, req('decommissioned'), 'new_request', done)).toThrow(ConflictException);
  });

  it('requires an engineer before provisioning and a reason for rework', () => {
    expect(() => checkTransition(am, req('new_request', null), 'provisioning', done)).toThrow(BadRequestException);
    expect(() => checkTransition(am, req('testing'), 'provisioning', done)).toThrow(BadRequestException);
    expect(() => checkTransition(am, req('testing'), 'provisioning', done, '   ')).toThrow(BadRequestException);
  });

  it('blocks decommissioning until the checklist is done and resources are released', () => {
    expect(() => checkTransition(am, req('completed'), 'decommissioned', open)).toThrow(/2 required checklist tasks still open and 1 resource allocation/);
    expect(() => checkTransition(am, req('completed'), 'decommissioned', { openTasks: 0, activeAllocations: 1 })).toThrow(BadRequestException);
    expect(nextStatuses(am, req('completed'), open)[0].blocked).toMatch(/Finish the decommissioning checklist/);
  });

  it('lets only the Account Manager cancel an unfinished PoC, with a reason, still behind the checklist', () => {
    for (const s of ['new_request', 'provisioning', 'testing'] as Status[]) {
      expect(checkTransition(am, req(s), 'decommissioned', done, 'Client withdrew').cancel).toBe(true);
    }
    expect(() => checkTransition(eng, req('testing'), 'decommissioned', done, 'Client withdrew')).toThrow(ForbiddenException);
    expect(() => checkTransition(am, req('testing'), 'decommissioned', done)).toThrow(/reason for cancelling/);
    expect(() => checkTransition(am, req('testing'), 'decommissioned', open, 'Client withdrew')).toThrow(/checklist/);
    expect(checkTransition(am, req('completed'), 'decommissioned', done).cancel).toBeFalsy();
  });

  it('lets the Account Manager and the assigned engineer act, nobody else', () => {
    expect(isResponsible(am, req('testing'))).toBe(true);
    expect(isResponsible(eng, req('testing'))).toBe(true);
    expect(isResponsible(other, req('testing'))).toBe(false);
    expect(nextStatuses(other, req('testing'), done)).toEqual([]);
  });

  it('offers each user exactly the moves they can make, with blockers explained', () => {
    const row = (u: User, s: Status, c = done) => nextStatuses(u, req(s), c).map((t) => [t.to, t.needsReason, t.cancel]);
    expect(row(am, 'testing')).toEqual([['completed', false, false], ['provisioning', true, false], ['decommissioned', true, true]]);
    expect(row(eng, 'testing')).toEqual([['completed', false, false], ['provisioning', true, false]]);
    expect(nextStatuses(am, req('new_request', null), done)[0].blocked).toMatch(/Assign an engineer/);
    expect(nextStatuses(am, req('decommissioned'), done)).toEqual([]);
  });
});
