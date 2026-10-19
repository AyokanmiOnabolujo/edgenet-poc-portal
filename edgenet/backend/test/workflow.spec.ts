import { BadRequestException, ConflictException } from '@nestjs/common';
import { PocRequest, Status, User } from '../src/entities';
import { isResponsible, checkTransition, nextStatuses } from '../src/requests/workflow';

const am = { id: 'am', role: 'account_manager' } as User;
const eng = { id: 'eng', role: 'engineer' } as User;
const other = { id: 'other', role: 'engineer' } as User;
const req = (status: Status, assigned: User | null = eng) => ({ status, assignedEngineer: assigned }) as PocRequest;

describe('workflow', () => {
  it('allows the forward path and the testing rework loop', () => {
    expect(() => checkTransition(req('new_request'), 'provisioning')).not.toThrow();
    expect(() => checkTransition(req('provisioning'), 'testing')).not.toThrow();
    expect(() => checkTransition(req('testing'), 'completed')).not.toThrow();
    expect(() => checkTransition(req('testing'), 'provisioning', 'VM image wrong')).not.toThrow();
    expect(() => checkTransition(req('completed'), 'decommissioned')).not.toThrow();
  });

  it('rejects skipped, backward and post-final moves', () => {
    expect(() => checkTransition(req('new_request'), 'testing')).toThrow(ConflictException);
    expect(() => checkTransition(req('completed'), 'testing')).toThrow(ConflictException);
    expect(() => checkTransition(req('decommissioned'), 'new_request')).toThrow(ConflictException);
  });

  it('requires an engineer before provisioning and a reason for rework', () => {
    expect(() => checkTransition(req('new_request', null), 'provisioning')).toThrow(BadRequestException);
    expect(() => checkTransition(req('testing'), 'provisioning')).toThrow(BadRequestException);
    expect(() => checkTransition(req('testing'), 'provisioning', '   ')).toThrow(BadRequestException);
  });

  it('lets the Account Manager and the assigned engineer move, nobody else', () => {
    expect(isResponsible(am, req('testing'))).toBe(true);
    expect(isResponsible(eng, req('testing'))).toBe(true);
    expect(isResponsible(other, req('testing'))).toBe(false);
    expect(nextStatuses(other, req('testing'))).toEqual([]);
  });

  it('offers the UI exactly the allowed moves, with blockers explained', () => {
    expect(nextStatuses(am, req('testing')).map((t) => [t.to, t.needsReason])).toEqual([['completed', false], ['provisioning', true]]);
    expect(nextStatuses(am, req('new_request', null))[0].blocked).toMatch(/Assign an engineer/);
    expect(nextStatuses(am, req('decommissioned'))).toEqual([]);
  });
});
