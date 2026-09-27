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
 private async resolveRole(a: Actor, roleIds: string[]) {
  const selectedRoles = await this.db.role.findMany({
   where: { id: { in: roleIds }, agencyId: a.agencyId },
   include: { permissions: true }
  });
  if (!selectedRoles.length) throw new BadRequestException('Role not found.');
  if (selectedRoles.length !== roleIds.length) throw new BadRequestException('One or more selected roles are invalid.');
  if (selectedRoles.some(r => r.isSuperAdmin) && !a.isSuperAdmin) {
   throw new ForbiddenException('Only a Super Admin can grant Super Admin access.');
  }
  if (!a.isSuperAdmin) {
   const rp = selectedRoles.flatMap(r => r.permissions);
   if (rp.some(p => !has(a, p.permissionKey))) {
    throw new ForbiddenException('You cannot grant permissions you do not have.');
   }
  }
  if (selectedRoles.length === 1) return selectedRoles[0];

  if (selectedRoles.some(r => r.isClient) && selectedRoles.some(r => !r.isClient)) {
   throw new BadRequestException('Client accounts cannot be combined with internal agency roles.');
  }

  const combinedName = selectedRoles.map(r => r.name).sort().join(', ');
  const isSuperAdmin = selectedRoles.some(r => r.isSuperAdmin);
  const isClient = selectedRoles.some(r => r.isClient);
  const allPermissionKeys = [...new Set(selectedRoles.flatMap(r => r.permissions.map(p => p.permissionKey)))];

  let combinedRole = await this.db.role.findFirst({
   where: { agencyId: a.agencyId, name: combinedName },
   include: { permissions: true }
  });

  if (!combinedRole) {
   combinedRole = await this.db.role.create({
    data: {
     agencyId: a.agencyId,
     name: combinedName,
     isSuperAdmin,
     isClient,
     permissions: {
      create: allPermissionKeys.map(permissionKey => ({ permissionKey }))
     }
    },
    include: { permissions: true }
   });
  } else {
   const existingKeys = new Set(combinedRole.permissions.map(p => p.permissionKey));
   const missingKeys = allPermissionKeys.filter(k => !existingKeys.has(k));
   if (missingKeys.length > 0) {
    await this.db.rolePermission.createMany({
     data: missingKeys.map(permissionKey => ({ roleId: combinedRole!.id, permissionKey })),
     skipDuplicates: true
    });
   }
  }
  return combinedRole;
 }

 @Get() @Require('employee.view')
 list(@CurrentActor()a:Actor){
  this.access.internal(a);
  return this.db.user.findMany({
   where:{agencyId:a.agencyId,deletedAt:null},
   select:{...safeUser,email:true,active:true,phone:true,whatsapp:true,whatsappOptIn:true,roleId:true,
    permissions:{select:{permissionKey:true,allowed:true}},
    role:{select:{id:true,name:true,isSuperAdmin:true,isClient:true,permissions:{select:{permissionKey:true}}}},
    teams:{select:{clientId:true,responsibility:true}},
    _count:{select:{assignedTasks:{where:{status:{notIn:['COMPLETED','CANCELLED']}}}}}
   },orderBy:{name:'asc'}
  });
 }
 @Post() @Require('employee.manage')
 async create(@CurrentActor()a:Actor,@Body()raw:unknown) {
  this.access.internal(a);
  const d=userDto.parse(raw);
  const roleIds = (d as any).roleIds?.length ? (d as any).roleIds : (d.roleId ? [d.roleId] : []);
  if (!roleIds.length) throw new BadRequestException('A role is required.');
  const role = await this.resolveRole(a, roleIds);
  if(role.isClient&&!d.clientId)throw new BadRequestException('Client accounts require a client workspace.');
  if(d.clientId)await this.access.client(a,d.clientId);
  if(d.permissions&&!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can grant individual permission overrides.');
  const {password,clientId,permissions,...restData}=d;
  const {roleIds:_,...data}=restData as any;
  data.roleId = role.id;
  const passwordHash=await hashPassword(password);
  return this.db.atomic(async tx=>{
   const u=await tx.user.create({data:{...data,email:data.email.toLowerCase(),agencyId:a.agencyId,passwordHash,...(role.isClient?{clientUsers:{create:{clientId:clientId!}}}:{})},select:{...safeUser,email:true}});
   if(permissions?.length){
    const uniquePerms=[...new Map(permissions.map((p: any)=>[p.key,p.allowed])).entries()].map(([key,allowed])=>({userId:u.id,permissionKey:String(key),allowed:Boolean(allowed)}));
    await tx.userPermission.createMany({data:uniquePerms});
   }
   await audit(tx,a,'user.created','user',u.id,{next:{name:u.name,roleId:role.id,roleName:role.name,hasCustomPermissions:!!permissions?.length}});return u;
  });
 }
 @Patch(':id') @Require('employee.manage')
 async update(@CurrentActor()a:Actor,@Param('id')id:string,@Body()raw:unknown) {
  this.access.internal(a);
  const d=updateUserDto.parse(raw);
  const u=await this.db.user.findFirstOrThrow({where:{id,agencyId:a.agencyId},include:{role:true}});
  if(u.role.isSuperAdmin&&!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can edit this account.');
  
  let targetRole: any = null;
  const roleIds = (d as any).roleIds?.length ? (d as any).roleIds : (d.roleId ? [d.roleId] : null);
  if(roleIds && roleIds.length) {
   targetRole = await this.resolveRole(a, roleIds);
   if(targetRole.isClient!==u.role.isClient)throw new BadRequestException('Internal and client account types cannot be interchanged.');
   if(id===a.id && targetRole.id!==a.roleId)throw new BadRequestException('You cannot change your own role here.');
  }
  if(id===a.id&&d.active===false)throw new BadRequestException('You cannot disable yourself here.');
  if(d.permissions&&!a.isSuperAdmin)throw new ForbiddenException('Only a Super Admin can grant individual permission overrides.');
  if(u.role.isSuperAdmin&&(d.active===false||(targetRole&&!targetRole.isSuperAdmin))) {
   const count=await this.db.user.count({where:{agencyId:a.agencyId,active:true,role:{isSuperAdmin:true}}});
   if(count<=1)throw new BadRequestException('Keep at least one active Super Admin.');
  }
  const {permissions,...restData}=d;
  const {roleIds:_,...data}=restData as any;
  if(targetRole) data.roleId = targetRole.id;
  return this.db.atomic(async tx=>{
   if(permissions){
    await tx.userPermission.deleteMany({where:{userId:id}});
    const uniquePerms=[...new Map(permissions.map((p: any)=>[p.key,p.allowed])).entries()].map(([key,allowed])=>({userId:id,permissionKey:String(key),allowed:Boolean(allowed)}));
    if(uniquePerms.length) await tx.userPermission.createMany({data:uniquePerms});
   }
   const updated=await tx.user.update({where:{id},data,select:{...safeUser,email:true,active:true}});
   if(d.active===false||targetRole||permissions)await tx.session.deleteMany({where:{userId:id}});
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
