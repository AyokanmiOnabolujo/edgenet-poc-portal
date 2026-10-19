export type Role = 'account_manager' | 'engineer';
export type Status = 'new_request' | 'provisioning' | 'testing' | 'completed' | 'decommissioned';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface User { id: string; name: string; email: string; role: Role; organisation: string }
export interface Resource { type: string; quantity: number; notes?: string }
/** A stage move the API says this user can make now. `blocked` explains why it cannot happen yet. */
export interface Transition { to: Status; needsReason: boolean; cancel: boolean; blocked: string | null }
/** One decommissioning task. `auto` tasks complete themselves (all resources released). */
export interface ChecklistItem {
  key: string; label: string; mandatory: boolean; auto: boolean; done: boolean;
  completedBy: User | null; completedAt: string | null; notes: string | null;
}
export interface ActivityItem {
  id: string; message: string; createdAt: string; actor?: User | null;
  action: string | null; fromValue: string | null; toValue: string | null; remarks: string | null;
}
export interface PocRequest {
  id: string; number: number; clientName: string; clientEmail: string; clientCompany: string;
  projectName: string; description: string; startDate: string; endDate: string;
  priority: Priority; status: Status; resources: Resource[];
  createdBy: User; assignedEngineer: User | null; createdAt: string;
  activity?: ActivityItem[]; activityTotal?: number; // latest entries only; older pages come from /requests/:id/activity
  nextStatuses: Transition[];
  // Set on GET /requests/:id, for the current user.
  checklist?: ChecklistItem[]; canAllocate?: boolean; canRelease?: boolean; canEditChecklist?: boolean;
}
export type ResourceState = 'available' | 'maintenance' | 'retired';
/** An inventory item, with how many units are in use and free on every day of the requested window. */
export interface InventoryItem {
  id: string; name: string; type: string; unit: string; specs: string; capacity: number; state: ResourceState;
  inUse: number; available: number;
}
export interface Allocation {
  id: string; resource: Omit<InventoryItem, 'inUse' | 'available'>; quantity: number; startDate: string; endDate: string;
  status: 'active' | 'released'; allocatedBy: User; createdAt: string; releasedBy: User | null; releasedAt: string | null;
}
/** Shape of a 409 from POST /requests/:id/allocations when there is not enough free capacity. */
export interface AllocationConflict { request: string; projectName: string; startDate: string; endDate: string; quantity: number }
export interface EngineerRow extends User { active: number; completed: number; total: number }
export interface Report {
  total: number; active: number; completed: number; completionRate: number; unassigned: number;
  byStatus: Record<Status, number>; byPriority: Record<Priority, number>;
  workload: { id: string; name: string; active: number; completed: number; total: number }[];
}

export const STATUSES: Status[] = ['new_request', 'provisioning', 'testing', 'completed', 'decommissioned'];
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];
export const STATUS_LABEL: Record<Status, string> = {
  new_request: 'New Request', provisioning: 'Infrastructure Provisioning', testing: 'In Testing',
  completed: 'Completed', decommissioned: 'Decommissioned',
};
export const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
export const RESOURCE_TYPES = ['Virtual machine', 'Kubernetes cluster', 'Storage volume', 'Network / VPN', 'Load balancer', 'GPU instance', 'Database', 'Physical server', 'Software licence', 'Other'];
export const RESOURCE_STATE_LABEL: Record<ResourceState, string> = { available: 'Available', maintenance: 'In maintenance', retired: 'Retired' };

export const ref = (n: number) => `POC-${String(n).padStart(4, '0')}`;
export const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (d: string) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** How a stage move is offered in a menu. */
export const transitionLabel = (t: Transition) =>
  `${t.cancel ? 'Cancel PoC → ' : ''}${STATUS_LABEL[t.to]}${t.blocked ? ' (blocked)' : ''}`;

/** Body for a stage move, asking for a reason when the move needs one. Null means the user backed out. */
export function statusBody(t: Transition): { status: Status; remarks?: string } | null {
  if (!t.needsReason) return { status: t.to };
  const question = t.cancel ? 'Why is this PoC being cancelled? It will be decommissioned.' : `Why is this request moving back to ${STATUS_LABEL[t.to]}?`;
  const remarks = window.prompt(question)?.trim();
  return remarks ? { status: t.to, remarks } : null;
}
