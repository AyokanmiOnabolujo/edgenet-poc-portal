export type Role = 'account_manager' | 'engineer';
export type Status = 'new_request' | 'provisioning' | 'testing' | 'completed' | 'decommissioned';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface User { id: string; name: string; email: string; role: Role; organisation: string }
export interface Resource { type: string; quantity: number; notes?: string }
export interface ActivityItem { id: string; message: string; createdAt: string; actor?: User | null }
export interface PocRequest {
  id: string; number: number; clientName: string; clientEmail: string; clientCompany: string;
  projectName: string; description: string; startDate: string; endDate: string;
  priority: Priority; status: Status; resources: Resource[];
  createdBy: User; assignedEngineer: User | null; createdAt: string; activity?: ActivityItem[];
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
