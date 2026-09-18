import { Body, Controller, Get, Module, Param, Patch, Post, ForbiddenException, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor, has, safeUser } from '../core/types';
import { userDto, updateUserDto } from '../core/schemas';
import { audit } from '../core/audit';
import { hashPassword } from '../auth/password';
@Controller('users')
class UsersController {
 constructor(private db:Database,private access:Access){}
 @Get() @Require('employee.view')
 list(@CurrentActor()a:Actor){
  this.access.internal(a);
  return this.db.user.findMany({
   where:{agencyId:a.agencyId,deletedAt:null},
   select:{...safeUser,email:true,active:true,phone:true,whatsapp:true,whatsappOptIn:true,roleId:true,
    permissions:{select:{permissionKey:true,allowed:true}},
    role:{select:{name:true,isSuperAdmin:true,isClient:true}},
    teams:{select:{clientId:true,responsibility:true}},
    _count:{select:{assignedTasks:{where:{status:{notIn:['COMPLETED','CANCELLED']}}}}}
   },orderBy:{name:'asc'}
  });
 }
 @Post() @Require('employee.manage')
 async create(@CurrentActor()a:Actor,@Body()raw:unknown) {
  this.access.internal(a);const d=userDto.parse(raw);const role=await this.db.role.findFirst({where:{id:d.roleId,agencyId:a.agencyId}});
  if(!role||(role.isSuperAdmin&&!a.isSuperAdmin))throw new ForbiddenException('Only a Super Admin can grant Super Admin access.');
  if(!a.isSuperAdmin) {const rp=await this.db.rolePermission.findMany({where:{roleId:role.id}});if(rp.some(p=>!has(a,p.permissionKey)))throw new ForbiddenException('You cannot grant permissions you do not have.');}
  if(role.isClient&&!d.clientId)throw new BadRequestException('Client accounts require a client workspace.');
  if(d.clientId)await this.access.client(a,d.clientId);
  if(d.permissions&&!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can grant individual permission overrides.');
  const {password,clientId,permissions,...data}=d;const passwordHash=await hashPassword(password);
  return this.db.atomic(async tx=>{
   const u=await tx.user.create({data:{...data,email:data.email.toLowerCase(),agencyId:a.agencyId,passwordHash,...(role.isClient?{clientUsers:{create:{clientId:clientId!}}}:{})},select:{...safeUser,email:true}});
   if(permissions?.length){
    const uniquePerms=[...new Map(permissions.map(p=>[p.key,p.allowed])).entries()].map(([key,allowed])=>({userId:u.id,permissionKey:key,allowed}));
    await tx.userPermission.createMany({data:uniquePerms});
   }
   await audit(tx,a,'user.created','user',u.id,{next:{name:u.name,roleId:role.id,hasCustomPermissions:!!permissions?.length}});return u;
  });
 }
 @Patch(':id') @Require('employee.manage')
 async update(@CurrentActor()a:Actor,@Param('id')id:string,@Body()raw:unknown) {
  this.access.internal(a);const d=updateUserDto.parse(raw);
  const u=await this.db.user.findFirstOrThrow({where:{id,agencyId:a.agencyId},include:{role:true}});
  if(u.role.isSuperAdmin&&!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can edit this account.');
  if(id===a.id&&(d.active===false||d.roleId&&d.roleId!==a.roleId))throw new BadRequestException('You cannot disable yourself or change your own role here.');
  if(d.roleId){const role=await this.db.role.findFirstOrThrow({where:{id:d.roleId,agencyId:a.agencyId},include:{permissions:true}});
   if(role.isClient!==u.role.isClient)throw new BadRequestException('Internal and client account types cannot be interchanged.');
   if(role.isSuperAdmin&&!a.isSuperAdmin||!a.isSuperAdmin&&role.permissions.some(p=>!has(a,p.permissionKey)))throw new ForbiddenException('You cannot grant this role.');
  }
  if(d.permissions&&!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can grant individual permission overrides.');
  if(u.role.isSuperAdmin&&(d.active===false||d.roleId&&d.roleId!==u.roleId)) {
   const count=await this.db.user.count({where:{agencyId:a.agencyId,active:true,role:{isSuperAdmin:true}}});
   if(count<=1)throw new BadRequestException('Keep at least one active Super Admin.');
  }
  const {permissions,...data}=d;
  return this.db.atomic(async tx=>{
   if(permissions){
    await tx.userPermission.deleteMany({where:{userId:id}});
    const uniquePerms=[...new Map(permissions.map(p=>[p.key,p.allowed])).entries()].map(([key,allowed])=>({userId:id,permissionKey:key,allowed}));
    if(uniquePerms.length) await tx.userPermission.createMany({data:uniquePerms});
   }
   const updated=await tx.user.update({where:{id},data,select:{...safeUser,email:true,active:true}});
   if(d.active===false||d.roleId||permissions)await tx.session.deleteMany({where:{userId:id}});
   await audit(tx,a,'user.updated','user',id,{next:{changedFields:Object.keys(d)}});return updated;
  });
 }
}
@Controller('roles')
class RolesController {
 constructor(private db:Database,private access:Access){}
 @Get() @Require('employee.view') list(@CurrentActor()a:Actor){this.access.internal(a);return this.db.role.findMany({where:{agencyId:a.agencyId},include:{permissions:true}});}
 @Get('permissions') @Require('settings.manage') permissions(){return this.db.permission.findMany({orderBy:{key:'asc'}});}
 @Post() @Require('settings.manage')
 async create(@CurrentActor()a:Actor,@Body()raw:unknown){
  if(!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can manage permission sets.');
  const d=z.object({name:z.string().min(2).max(100),permissions:z.array(z.string()).max(100)}).strict().parse(raw);
  return this.db.atomic(async tx=>{const role=await tx.role.create({data:{name:d.name,agencyId:a.agencyId,permissions:{create:[...new Set(d.permissions)].map(permissionKey=>({permissionKey}))}}});await audit(tx,a,'role.created','role',role.id,{next:{name:d.name,permissions:d.permissions}});return role;});
 }
 @Patch(':id') @Require('settings.manage')
 async update(@CurrentActor()a:Actor,@Param('id')id:string,@Body()raw:unknown) {
  if(!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can manage permission sets.');
  const d=z.object({permissions:z.array(z.string()).max(100)}).strict().parse(raw);
  const r=await this.db.role.findFirstOrThrow({where:{id,agencyId:a.agencyId}});
  if(r.isSuperAdmin||r.isClient)throw new BadRequestException('This protected role cannot be changed.');
  return this.db.atomic(async tx=>{
   await tx.rolePermission.deleteMany({where:{roleId:id}});
   await tx.rolePermission.createMany({data:[...new Set(d.permissions)].map(permissionKey=>({roleId:id,permissionKey}))});
   await audit(tx,a,'role.permissions_updated','role',id,{next:{permissions:d.permissions}});return {ok:true};
  });
 }
}
@Module({controllers:[UsersController,RolesController]}) export class UsersModule {}
