import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator, Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Database } from './database';
import { Actor, has } from './types';
import { verify } from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'node:crypto';
export const Public=()=>SetMetadata('public',true);
export const Require=(...permissions:string[])=>SetMetadata('permissions',permissions);
export const CurrentActor=createParamDecorator((_data,ctx:ExecutionContext):Actor=>ctx.switchToHttp().getRequest().actor);
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function secureEqual(a:string,b:string) { const x=Buffer.from(a); const y=Buffer.from(b); return x.length===y.length&&timingSafeEqual(x,y); }
@Injectable()
export class Access {
 constructor(private db:Database){}
 permission(a:Actor,p:string) { if(!has(a,p)) throw new ForbiddenException('You do not have permission to perform this action.'); }
 internal(a:Actor){ if(a.isClient) throw new ForbiddenException('This action is available to agency members only.'); }
 async client(a:Actor,clientId:string) {
  const c=await this.db.client.findFirst({where:{id:clientId,agencyId:a.agencyId}});
  if(!c || ((a.isClient||!has(a,'client.view_all'))&&!a.clientIds.includes(clientId))) throw new ForbiddenException('This workspace is not accessible.');
  return c;
 }
 clientWhere(a:Actor) {return {agencyId:a.agencyId,...(a.isClient||!has(a,'client.view_all')?{id:{in:a.clientIds}}:{})};}
 async content(a:Actor,id:number) {
  const c=await this.db.contentItem.findFirst({where:{id,deletedAt:null,client:this.clientWhere(a)},include:{client:true}});
  if(!c) throw new ForbiddenException('This content is not accessible.'); return c;
 }
 async internalUser(a:Actor,id:string,clientId?:string) {
  const u=await this.db.user.findFirst({where:{id,agencyId:a.agencyId,active:true,deletedAt:null},include:{role:true,teams:true}});
  if(!u||u.role.isClient) throw new ForbiddenException('Choose an active internal agency member.');
  if(clientId&&!u.role.isSuperAdmin&&!u.teams.some(t=>t.clientId===clientId)) throw new ForbiddenException('Assign this employee to the client team first.');
  return u;
 }
}
@Injectable()
export class AuthGuard implements CanActivate {
 constructor(private db:Database,private reflector:Reflector){}

 private async getSessionWithRetry(id: string) {
  const query = () => this.db.session.findUnique({
   where: { id },
   include: {
    user: {
     include: {
      role: { include: { permissions: true } },
      permissions: true,
      clientUsers: true,
      teams: true
     }
    }
   }
  });

  try {
   return await query();
  } catch (err: any) {
   const msg = String(err?.message || '');
   const isConnectionIssue =
    msg.includes('Response from the Engine was empty') ||
    msg.includes('Engine is not running') ||
    msg.includes('Can\'t reach database server') ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Connection pool') ||
    err?.code === 'P1001' ||
    err?.code === 'P1017' ||
    err?.code === 'P2024';

   if (isConnectionIssue) {
    console.warn('[Agency OS AuthGuard] Database connection reset detected. Reconnecting and retrying...');
    try {
     await this.db.$disconnect();
     await this.db.$connect();
     return await query();
    } catch (retryErr: any) {
     console.error('[Agency OS AuthGuard] Session retry failed after reconnect:', retryErr?.message || retryErr);
     throw retryErr;
    }
   }
   throw err;
  }
 }

 async canActivate(ctx:ExecutionContext) {
  if(this.reflector.getAllAndOverride('public',[ctx.getHandler(),ctx.getClass()])) return true;
  const req=ctx.switchToHttp().getRequest();
  let token:any;
  try {token=verify(req.cookies?.agency_session||'',process.env.JWT_SECRET!,{algorithms:['HS256'],issuer:'agency-os',audience:'agency-os-web'});}
  catch {throw new UnauthorizedException('Please sign in to continue.');}
  const session = await this.getSessionWithRetry(token.sid).catch((err: any) => {
   console.error('[Agency OS AuthGuard] Session lookup error:', err?.message || err);
   throw new UnauthorizedException('Your session could not be verified. Please sign in again.');
  });
  if(!session||session.expiresAt<new Date()||session.userId!==token.sub||!session.user.active||session.user.deletedAt) throw new UnauthorizedException('Your session has expired.');
  const u=session.user;
  const permissions=new Set<string>(u.role.permissions.map((p: { permissionKey: string })=>p.permissionKey));
  u.permissions.forEach((p: { allowed: boolean; permissionKey: string })=>p.allowed?permissions.add(p.permissionKey):permissions.delete(p.permissionKey));
  const clientIds: string[] = (u.role.isClient ? u.clientUsers : u.teams).map((c: { clientId: string }) => c.clientId);
  const actor:Actor={id:u.id,agencyId:u.agencyId,name:u.name,email:u.email,roleId:u.roleId,roleName:u.role.name,isSuperAdmin:u.role.isSuperAdmin,isClient:u.role.isClient,permissions:[...permissions],clientIds,sessionId:session.id,mustChangePassword:u.mustChangePassword,avatarUrl:u.avatarUrl};
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
   if(!secureEqual(digest(req.headers['x-csrf-token']||''),session.csrfHash)) throw new ForbiddenException('Security token expired. Refresh the page and try again.');
  }
  if(u.mustChangePassword&&!req.path.startsWith('/auth/')) throw new ForbiddenException('Change your temporary password before continuing.');
  const required=this.reflector.getAllAndOverride<string[]>('permissions',[ctx.getHandler(),ctx.getClass()])||[];
  if(required.some(p=>!has(actor,p))) throw new ForbiddenException('You do not have permission to access this area.');
  req.actor=actor; return true;
 }
}
@Global() @Module({providers:[Access],exports:[Access]}) export class AccessModule {}
