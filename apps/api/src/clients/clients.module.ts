import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor, safeUser } from '../core/types';
import { clientDto, clientUpdateDto } from '../core/schemas';
import { audit } from '../core/audit';
import { hashPassword } from '../auth/password';
import { NotificationsService } from '../notifications/notifications.module';
@Injectable()
export class ClientsService {
 constructor(private db:Database,private access:Access,private notices:NotificationsService){}
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
    const superAdmins=await tx.user.findMany({where:{agencyId:a.agencyId,active:true,role:{isSuperAdmin:true}},select:{id:true}});
    const superAdminIds=superAdmins.map(s=>s.id);
    const internalIds=[...new Set([a.id,...team.map(t=>t.userId),...superAdminIds])];
    await tx.chatThread.create({data:{agencyId:a.agencyId,clientId:c.id,title:c.name+' · internal',kind:'CLIENT_INTERNAL',clientVisible:false,members:{create:internalIds.map(userId=>({userId}))}}});
    if(data.brand.assetsUrl)await tx.driveLink.create({data:{clientId:c.id,title:'Brand assets',url:data.brand.assetsUrl,category:'Brand Asset',addedById:a.id,clientVisible:true}});
    if(data.brand.logoUrl)await tx.driveLink.create({data:{clientId:c.id,title:'Logo',url:data.brand.logoUrl,category:'Brand Asset',addedById:a.id,clientVisible:true}});
    for(const t of team){
     await this.notices.emit(tx,[t.userId],{event:'client.assigned',title:'Assigned to Client',body:'You are assigned with the client '+c.name,href:'/clients/'+c.id,key:'client:assigned:'+c.id+':'+t.userId},a.agencyId,a.id);
    }
    await this.notices.emit(tx,superAdminIds,{event:'client.onboarded',title:'Client Onboarded',body:c.name+' onboarded with '+team.length+' team member(s)',href:'/clients/'+c.id,key:'client:onboarded:'+c.id},a.agencyId,a.id);
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
    if(team){
     const previousTeam=await tx.clientTeamMember.findMany({where:{clientId:id}});
     const prevIds=new Set(previousTeam.map(t=>t.userId));
     await tx.clientTeamMember.deleteMany({where:{clientId:id}});
     await tx.clientTeamMember.createMany({data:team.map(t=>({...t,clientId:id}))});
     const defaultThread=await tx.chatThread.findFirst({where:{clientId:id,kind:'CLIENT_INTERNAL'}});
     if(defaultThread){
      for(const t of team){
       await tx.chatMember.upsert({where:{threadId_userId:{threadId:defaultThread.id,userId:t.userId}},create:{threadId:defaultThread.id,userId:t.userId},update:{}});
      }
     }
     const newMembers=team.filter(t=>!prevIds.has(t.userId));
     for(const t of newMembers){
      await this.notices.emit(tx,[t.userId],{event:'client.assigned',title:'Assigned to Client',body:'You are assigned with the client '+(d.name||old.name),href:'/clients/'+id,key:'client:assigned:'+id+':'+t.userId+':'+Date.now()},a.agencyId,a.id);
     }
    }
    if(socialAccounts){await tx.socialAccount.deleteMany({where:{clientId:id}});await tx.socialAccount.createMany({data:socialAccounts.map(t=>({...t,clientId:id}))});}
    const updated=await tx.client.update({where:{id},data:{...data,...(d.active!==undefined?{archivedAt:d.active?null:new Date()}:{})}});
    await this.notices.emit(tx,[],{event:'client.updated',title:'Client Updated',body:updated.name+' was updated',href:'/clients/'+id,key:'client:updated:'+id+':'+Date.now()},a.agencyId,a.id);
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

    const taskList=await tx.task.findMany({
     where:{OR:[{clientId:id},...(contentIds.length?[{contentId:{in:contentIds}}]:[])]},
     select:{id:true}
    });
    const taskIds=taskList.map(t=>t.id);

    const threadList=await tx.chatThread.findMany({
     where:{OR:[{clientId:id},...(contentIds.length?[{contentId:{in:contentIds}}]:[]),...(taskIds.length?[{taskId:{in:taskIds}}]:[])]},
     select:{id:true}
    });
    const threadIds=threadList.map(t=>t.id);

    const clientUsers=await tx.clientUser.findMany({where:{clientId:id}});

    // Temporarily bypass foreign key constraints for this atomic transaction
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    try {
     // 1. Activity logs referencing this client or its content
     await tx.activityLog.deleteMany({
      where:{OR:[{clientId:id},...(contentIds.length?[{contentId:{in:contentIds}}]:[])]}
     });

     // 2. Drive links
     await tx.driveLink.deleteMany({
      where:{OR:[{clientId:id},...(contentIds.length?[{contentId:{in:contentIds}}]:[]),...(taskIds.length?[{taskId:{in:taskIds}}]:[])]}
     });

     // 3. Chat messages, members, and threads
     if(threadIds.length>0) {
      await tx.chatMessage.updateMany({where:{threadId:{in:threadIds}},data:{replyToId:null}});
      await tx.chatMessage.deleteMany({where:{threadId:{in:threadIds}}});
      await tx.chatMember.deleteMany({where:{threadId:{in:threadIds}}});
      await tx.chatThread.deleteMany({where:{id:{in:threadIds}}});
     }
     await tx.chatThread.deleteMany({where:{clientId:id}});

     // 4. Task comments, status history, and tasks
     if(taskIds.length>0) {
      await tx.contentComment.deleteMany({where:{taskId:{in:taskIds}}});
      await tx.taskStatusHistory.deleteMany({where:{taskId:{in:taskIds}}});
      await tx.task.deleteMany({where:{id:{in:taskIds}}});
     }
     await tx.task.deleteMany({where:{clientId:id}});

     // 5. Content child entities and content items
     if(contentIds.length>0) {
      await tx.contentComment.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.analyticsEntry.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.publishingRecord.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.approval.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.revision.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.contentVersion.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.shoot.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.script.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.contentStatusHistory.deleteMany({where:{contentId:{in:contentIds}}});
      await tx.contentItem.deleteMany({where:{id:{in:contentIds}}});
     }
     await tx.contentItem.deleteMany({where:{clientId:id}});

     // 6. Client meta records
     await tx.report.deleteMany({where:{clientId:id}});
     await tx.socialAccount.deleteMany({where:{clientId:id}});
     await tx.clientTeamMember.deleteMany({where:{clientId:id}});

     // 7. Client users & orphaned client portal accounts
     await tx.clientUser.deleteMany({where:{clientId:id}});
     for(const cu of clientUsers) {
      const remaining=await tx.clientUser.count({where:{userId:cu.userId}});
      if(remaining===0) {
       await tx.session.deleteMany({where:{userId:cu.userId}}).catch(()=>{});
       await tx.userPermission.deleteMany({where:{userId:cu.userId}}).catch(()=>{});
       await tx.notificationPreference.deleteMany({where:{userId:cu.userId}}).catch(()=>{});
       const notifs=await tx.notification.findMany({where:{userId:cu.userId},select:{id:true}});
       if(notifs.length>0) {
        await tx.notificationDelivery.deleteMany({where:{notificationId:{in:notifs.map(n=>n.id)}}}).catch(()=>{});
        await tx.notification.deleteMany({where:{userId:cu.userId}}).catch(()=>{});
       }
       await tx.chatMember.deleteMany({where:{userId:cu.userId}}).catch(()=>{});
       await tx.activityLog.updateMany({where:{actorId:cu.userId},data:{actorId:null}}).catch(()=>{});
       await tx.user.delete({where:{id:cu.userId}}).catch(()=>{});
      }
     }

     // 8. Delete the client record
     await tx.client.delete({where:{id}});
    } finally {
     await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    }

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
