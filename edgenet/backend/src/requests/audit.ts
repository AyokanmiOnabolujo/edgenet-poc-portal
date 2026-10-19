import { EntityManager } from 'typeorm';
import { Activity, ActivityAction, User } from '../entities';

/** Writes an audit row. Always call it inside the transaction that makes the change, so both commit or neither does. */
export function logActivity(
  m: EntityManager, requestId: string, actor: User, action: ActivityAction, message: string,
  extra: { fromValue?: string | null; toValue?: string | null; remarks?: string | null } = {},
) {
  return m.save(m.create(Activity, { request: { id: requestId }, actor, action, message, ...extra }));
}
