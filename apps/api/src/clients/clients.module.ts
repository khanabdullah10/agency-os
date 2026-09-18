import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor, safeUser } from '../core/types';
import { clientDto, clientUpdateDto } from '../core/schemas';
import { audit } from '../core/audit';
import { hashPassword } from '../auth/password';
@Injectable()
export class ClientsService {
 constructor(private db:Database,private access:Access){}
 async list(a:Actor) {
  const clients=await this.db.client.findMany({where:this.access.clientWhere(a),include:{_count:{select:{content:true}},team:{include:{user:{select:safeUser}}}},orderBy:{name:'asc'}});
  return clients.map(c=>a.isClient?{id:c.id,name:c.name,industry:c.industry,color:c.color,avatarUrl:c.avatarUrl,platforms:c.platforms,active:c.active,_count:c._count}:c);
 }
 async detail(a:Actor,id:string) {
  await this.access.client(a,id);
  const c=await this.db.client.findUniqueOrThrow({where:{id},include:{team:{include:{user:{select:{...safeUser,role:{select:{name:true}}}}}},accounts:true,_count:{select:{content:true,tasks:true}},users:{include:{user:{select:safeUser}}}}});
  return a.isClient?{id:c.id,name:c.name,color:c.color,avatarUrl:c.avatarUrl,industry:c.industry,website:c.website,platforms:c.platforms,brand:c.brand,accounts:c.accounts,active:c.active}:c;
 }
 async checkTeam(a:Actor,team:{userId:string;responsibility:string}[]) {
  const keys=team.map(t=>t.userId+':'+t.responsibility);
  if(new Set(keys).size!==keys.length)throw new BadRequestException('Duplicate team assignments.');
  if(team.filter(t=>t.responsibility==='smm').length!==1)throw new BadRequestException('Assign exactly one dedicated SMM.');
  for(const t of team) await this.access.internalUser(a,t.userId);
 }
 async create(a:Actor,raw:unknown) {
  this.access.internal(a); const d=clientDto.parse(raw);
  await this.checkTeam(a,d.team);
  const {login,team,socialAccounts,...data}=d;
  const passwordHash=login?await hashPassword(login.password):undefined;
  return this.db.atomic(async tx=>{
   const c=await tx.client.create({data:{...data,agencyId:a.agencyId,team:{create:team},accounts:{create:socialAccounts}}});
   let clientUserId:string|undefined;
   if(login) {
    const role=await tx.role.findFirstOrThrow({where:{agencyId:a.agencyId,isClient:true}});
    const u=await tx.user.create({data:{agencyId:a.agencyId,roleId:role.id,name:login.name,email:login.email.toLowerCase(),passwordHash:passwordHash!,avatarUrl:login.avatarUrl,clientUsers:{create:{clientId:c.id}}}});
    clientUserId=u.id;
   }
   const internalIds=[...new Set([a.id,...team.map(t=>t.userId)])];
   await tx.chatThread.create({data:{agencyId:a.agencyId,clientId:c.id,title:c.name+' · internal',kind:'CLIENT_INTERNAL',clientVisible:false,members:{create:internalIds.map(userId=>({userId}))}}});
   if(data.brand.assetsUrl)await tx.driveLink.create({data:{clientId:c.id,title:'Brand assets',url:data.brand.assetsUrl,category:'Brand Asset',addedById:a.id,clientVisible:true}});
   if(data.brand.logoUrl)await tx.driveLink.create({data:{clientId:c.id,title:'Logo',url:data.brand.logoUrl,category:'Brand Asset',addedById:a.id,clientVisible:true}});
   await audit(tx,a,'client.onboarded','client',c.id,{clientId:c.id,next:{name:c.name,teamCount:team.length}});
   return c;
  });
 }
 async update(a:Actor,id:string,raw:unknown) {
  this.access.internal(a); const old=await this.access.client(a,id); const d=clientUpdateDto.parse(raw);
  if(d.active===false)this.access.permission(a,'client.archive');
  if(d.team)await this.checkTeam(a,d.team);
  const {team,socialAccounts,...data}=d;
  return this.db.atomic(async tx=>{
   if(team){await tx.clientTeamMember.deleteMany({where:{clientId:id}});await tx.clientTeamMember.createMany({data:team.map(t=>({...t,clientId:id}))});}
   if(socialAccounts){await tx.socialAccount.deleteMany({where:{clientId:id}});await tx.socialAccount.createMany({data:socialAccounts.map(t=>({...t,clientId:id}))});}
   const updated=await tx.client.update({where:{id},data:{...data,...(d.active!==undefined?{archivedAt:d.active?null:new Date()}:{})}});
   await audit(tx,a,'client.updated','client',id,{clientId:id,previous:{name:old.name,active:old.active},next:{name:updated.name,active:updated.active,changedFields:Object.keys(d)}});
   return updated;
  });
 }
 async delete(a:Actor,id:string) {
  this.access.internal(a);
  if (!a.isSuperAdmin) throw new ForbiddenException('Only Super Admins can permanently delete a client workspace.');
  const old=await this.access.client(a,id);

  return this.db.atomic(async tx=>{
   const contentList=await tx.contentItem.findMany({where:{clientId:id},select:{id:true}});
   const contentIds=contentList.map(c=>c.id);

   const threadList=await tx.chatThread.findMany({where:{clientId:id},select:{id:true}});
   const threadIds=threadList.map(t=>t.id);

   if(contentIds.length>0) {
    await tx.analyticsEntry.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.publishingRecord.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.revision.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.approval.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.contentComment.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.contentStatusHistory.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.contentVersion.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.shoot.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.script.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.task.deleteMany({where:{contentId:{in:contentIds}}});
    await tx.contentItem.deleteMany({where:{id:{in:contentIds}}});
   }

   await tx.task.deleteMany({where:{clientId:id}});

   if(threadIds.length>0) {
    await tx.chatMessage.deleteMany({where:{threadId:{in:threadIds}}});
    await tx.chatMember.deleteMany({where:{threadId:{in:threadIds}}});
    await tx.chatThread.deleteMany({where:{id:{in:threadIds}}});
   }

   await tx.report.deleteMany({where:{clientId:id}});
   await tx.driveLink.deleteMany({where:{clientId:id}});
   await tx.socialAccount.deleteMany({where:{clientId:id}});
   await tx.clientTeamMember.deleteMany({where:{clientId:id}});

   const clientUsers=await tx.clientUser.findMany({where:{clientId:id}});
   await tx.clientUser.deleteMany({where:{clientId:id}});
   for(const cu of clientUsers) {
    const remaining=await tx.clientUser.count({where:{userId:cu.userId}});
    if(remaining===0) {
     await tx.session.deleteMany({where:{userId:cu.userId}});
     await tx.user.delete({where:{id:cu.userId}}).catch(()=>{});
    }
   }

   await tx.activityLog.deleteMany({where:{clientId:id}});
   await tx.client.delete({where:{id}});

   await audit(tx,a,'client.deleted','client',id,{previous:{name:old.name}});
   return {ok:true,id};
  });
 }
}
@Controller('clients')
class ClientsController {
 constructor(private service:ClientsService){}
 @Get() @Require('client.view') list(@CurrentActor()a:Actor){return this.service.list(a);}
 @Get(':id') @Require('client.view') detail(@CurrentActor()a:Actor,@Param('id')id:string){return this.service.detail(a,id);}
 @Post() @Require('client.create') create(@CurrentActor()a:Actor,@Body()d:unknown){return this.service.create(a,d);}
 @Patch(':id') @Require('client.edit') update(@CurrentActor()a:Actor,@Param('id')id:string,@Body()d:unknown){return this.service.update(a,id,d);}
 @Delete(':id') @Require('client.archive') remove(@CurrentActor()a:Actor,@Param('id')id:string){return this.service.delete(a,id);}
}
@Module({providers:[ClientsService],controllers:[ClientsController],exports:[ClientsService]}) export class ClientsModule {}
