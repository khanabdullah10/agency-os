import { Rules, offsets } from './types';
export const statuses = ['IDEA','PLANNING','SCRIPT_WRITING','INTERNAL_SCRIPT_REVIEW','CLIENT_SCRIPT_REVIEW','SCRIPT_APPROVED','READY_FOR_SHOOT','SHOOT_SCHEDULED','SHOOT_COMPLETED','RAW_FOOTAGE_READY','EDITING','INTERNAL_EDIT_REVIEW','INTERNAL_CHANGES','INTERNAL_APPROVED','CLIENT_REVIEW','CLIENT_CHANGES','FINAL_CLIENT_APPROVED','READY_TO_PUBLISH','SCHEDULED','PUBLISHED','ANALYTICS','REPORTING'] as const;
export const actions = ['START_SCRIPT','SUBMIT_SCRIPT','APPROVE','REQUEST_CHANGES','START_PRODUCTION','SCHEDULE_SHOOT','COMPLETE_SHOOT','START_EDITING','SUBMIT_EDIT','READY_TO_PUBLISH','SCHEDULE_PUBLISH','PUBLISH','ANALYTICS','REPORTING'] as const;
export type Action = typeof actions[number];
export function allowedActions(status: string): Action[] {
 const map: Record<string, Action[]> = {
 IDEA:['START_SCRIPT'], PLANNING:['START_SCRIPT'], SCRIPT_WRITING:['SUBMIT_SCRIPT'],
 INTERNAL_SCRIPT_REVIEW:['APPROVE','REQUEST_CHANGES'], CLIENT_SCRIPT_REVIEW:['APPROVE','REQUEST_CHANGES'],
 SCRIPT_APPROVED:['START_PRODUCTION'], READY_FOR_SHOOT:['SCHEDULE_SHOOT'], SHOOT_SCHEDULED:['COMPLETE_SHOOT'],
 SHOOT_COMPLETED:['START_EDITING'], RAW_FOOTAGE_READY:['START_EDITING'], EDITING:['SUBMIT_EDIT'],
 INTERNAL_EDIT_REVIEW:['APPROVE','REQUEST_CHANGES'], INTERNAL_CHANGES:['SUBMIT_EDIT'],
 INTERNAL_APPROVED:['APPROVE','REQUEST_CHANGES'], CLIENT_REVIEW:['APPROVE','REQUEST_CHANGES'],
 CLIENT_CHANGES:['SUBMIT_EDIT'], FINAL_CLIENT_APPROVED:['READY_TO_PUBLISH'],
 READY_TO_PUBLISH:['SCHEDULE_PUBLISH','PUBLISH'], SCHEDULED:['PUBLISH'], PUBLISHED:['ANALYTICS'], ANALYTICS:['REPORTING'], REPORTING:[]
 }; return map[status] || [];
}
export function nextInternalStage(current: string, rules: Rules): string {
 if (current === 'SMM' && rules.admin) return 'ADMIN';
 if ((current === 'SMM' || current === 'ADMIN') && rules.superAdmin) return 'SUPER_ADMIN';
 return rules.client ? 'CLIENT' : 'DONE';
}
export function suggestDeadlines(publishAt: Date, custom: Partial<typeof offsets> = {}) {
 const values = { ...offsets, ...custom };
 return Object.fromEntries(Object.entries(values).map(([key, days]) => [key, new Date(publishAt.getTime() - days * 86400000).toISOString()]));
}
export function assertAssignment(creator: {isSuperAdmin:boolean; isClient:boolean}, assignee: {isSuperAdmin:boolean; isClient:boolean}) {
 if (creator.isClient) throw new Error('Clients cannot assign internal tasks.');
 if (assignee.isClient) throw new Error('Internal tasks cannot be assigned to a client.');
 if (assignee.isSuperAdmin && !creator.isSuperAdmin) throw new Error('Only a Super Admin can assign tasks to a Super Admin.');
}
export function validateDriveUrl(value: string) {
 try { const u = new URL(value); return u.protocol === 'https:' && ['drive.google.com','docs.google.com'].includes(u.hostname) && !u.username && !u.password; } catch { return false; }
}
export const clientStatus = (status: string) => ({
 INTERNAL_SCRIPT_REVIEW:'PREPARING_SCRIPT', SCRIPT_WRITING:'PREPARING_SCRIPT', INTERNAL_EDIT_REVIEW:'IN_PRODUCTION',
 INTERNAL_CHANGES:'IN_PRODUCTION', INTERNAL_APPROVED:'IN_PRODUCTION', EDITING:'IN_PRODUCTION',
 RAW_FOOTAGE_READY:'IN_PRODUCTION', SHOOT_COMPLETED:'IN_PRODUCTION'
}[status] || status);

