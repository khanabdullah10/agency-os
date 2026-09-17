export type Actor = {
  id: string; agencyId: string; name: string; email: string; roleId: string; roleName: string;
  isSuperAdmin: boolean; isClient: boolean; permissions: string[]; clientIds: string[];
  sessionId: string; mustChangePassword: boolean; avatarUrl?: string | null;
};
export const has = (a: Actor, permission: string) => a.isSuperAdmin || a.permissions.includes(permission);
export type TeamAssignments = { smm?: string; writer?: string; designer?: string; editor?: string; videographer?: string };
export type Rules = { smm: boolean; admin: boolean; superAdmin: boolean; client: boolean };
export const defaultRules: Rules = { smm: true, admin: false, superAdmin: false, client: true };
export const offsets = { script: 8, clientScript: 7, shoot: 5, edit: 3, internal: 3, clientFinal: 2, ready: 1 };
export const contentCode = (id: number) => 'CNT-' + String(id).padStart(4, '0');
export const safeUser = { id: true, name: true, avatarColor: true, avatarUrl: true } as const;

