export type Role = 'account_manager' | 'engineer';
export type Status = 'new_request' | 'provisioning' | 'testing' | 'completed' | 'decommissioned';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface User { id: string; name: string; email: string; role: Role; organisation: string }
export interface Resource { type: string; quantity: number; notes?: string }
/** A stage move the API says this user can make now. `blocked` explains why it cannot happen yet. */
export interface Transition { to: Status; needsReason: boolean; blocked: string | null }
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
}
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
export const RESOURCE_TYPES = ['Virtual machine', 'Kubernetes cluster', 'Storage volume', 'Network / VPN', 'Load balancer', 'GPU instance', 'Database', 'Other'];

export const ref = (n: number) => `POC-${String(n).padStart(4, '0')}`;
export const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (d: string) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Body for a stage move, asking for a reason when the move needs one. Null means the user cancelled. */
export function statusBody(t: Transition): { status: Status; remarks?: string } | null {
  if (!t.needsReason) return { status: t.to };
  const remarks = window.prompt(`Why is this request moving back to ${STATUS_LABEL[t.to]}?`)?.trim();
  return remarks ? { status: t.to, remarks } : null;
}
