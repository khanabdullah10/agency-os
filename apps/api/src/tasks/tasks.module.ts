import { Body, Controller, Get, Injectable, Module, Param, Patch, Post, Query, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor, has, safeUser, contentCode } from '../core/types';
import { taskDto, taskUpdateDto, commentDto } from '../core/schemas';
import { assertAssignment } from '../core/workflow';
import { audit } from '../core/audit';
import { NotificationsService } from '../notifications/notifications.module';
@Injectable()
export class TasksService {
 constructor(private db:Database,private access:Access,private notifications:NotificationsService){}
 async list(a:Actor,view?:string,clientId?:string) {
  this.access.internal(a);
  const personal=!has(a,'task.view_team');
  return this.db.task.findMany({where:{client:this.access.clientWhere(a),...(clientId?{clientId}:{}),...(personal||view==='mine'?{assigneeId:a.id}:{}),...(view==='assigned'||view==='created'?{createdById:a.id}:{}),...(view==='overdue'?{dueAt:{lt:new Date()},status:{notIn:['COMPLETED','CANCELLED']}}:{}),...(view==='completed'?{status:'COMPLETED'}:{})},include:{client:{select:{id:true,name:true,color:true}},content:{select:{id:true,title:true,status:true}},assignee:{select:safeUser},createdBy:{select:safeUser}},orderBy:[{dueAt:'asc'}],take:500});
 }
 async get(a:Actor,id:string) {
  this.access.internal(a);const t=await this.db.task.findFirst({where:{id,client:this.access.clientWhere(a)},include:{assignee:{select:safeUser},createdBy:{select:safeUser},client:{select:{id:true,name:true}},content:{select:{id:true,title:true,status:true}},comments:{include:{author:{select:safeUser}},orderBy:{createdAt:'asc'}},history:{orderBy:{createdAt:'desc'}},driveLinks:true}});
  if(!t||!has(a,'task.view_team')&&t.assigneeId!==a.id&&t.createdById!==a.id)throw new ForbiddenException('This task is not accessible.');return t;
 }
 async checkAssignment(a:Actor,userId:string,clientId:string) {
  const u=await this.access.internalUser(a,userId,clientId);
  try{assertAssignment(a,u.role);}catch(e:any){throw new ForbiddenException(e.message);}
 }
 async create(a:Actor,raw:unknown) {
  this.access.internal(a);const d=taskDto.parse(raw);const c=await this.access.client(a,d.clientId);
  if(!c.active)throw new BadRequestException('This client is archived.');
  await this.checkAssignment(a,d.assigneeId,d.clientId);
  if(d.contentId){const content=await this.access.content(a,d.contentId);if(content.clientId!==d.clientId)throw new BadRequestException('Task and content must belong to the same client.');}
  if(d.startsAt&&d.startsAt>d.dueAt)throw new BadRequestException('Start date must precede the deadline.');
  const {driveUrl,...data}=d;
  return this.db.atomic(async tx=>{
   const t=await tx.task.create({data:{...data,createdById:a.id,dueAt:new Date(d.dueAt),startsAt:d.startsAt?new Date(d.startsAt):undefined}});
   if(driveUrl)await tx.driveLink.create({data:{clientId:d.clientId,contentId:d.contentId,taskId:t.id,title:'Task reference',url:driveUrl,category:'Reference',addedById:a.id}});
   await audit(tx,a,'task.created','task',t.id,{clientId:t.clientId,contentId:t.contentId||undefined,next:{title:t.title,assigneeId:t.assigneeId}});
   await this.notifications.emit(tx,[t.assigneeId],{event:'task.assigned',title:'New task assigned',body:t.title+' · due '+t.dueAt.toISOString().slice(0,10),href:'/tasks?task='+t.id,key:'task:'+t.id},a.agencyId,a.id);return t;
  });
 }
 async update(a:Actor,id:string,raw:unknown) {
  const old=await this.get(a,id);const d=taskUpdateDto.parse(raw);
  if(d.assigneeId){this.access.permission(a,'task.assign');await this.checkAssignment(a,d.assigneeId,old.clientId);}
  if(d.dueAt||d.priority){this.access.permission(a,'task.assign');}
  if(d.status) {
   if(old.assigneeId!==a.id&&!has(a,'task.assign'))throw new ForbiddenException('Only the assignee or task manager can update this task.');
   if(old.kind!=='MANUAL'&&['COMPLETED','FOR_REVIEW','CHANGES_REQUIRED','CANCELLED'].includes(d.status))throw new BadRequestException('Use the linked content workflow to submit, review, or complete this task.');
   const next:Record<string,string[]>={TO_DO:['ACCEPTED','IN_PROGRESS','ON_HOLD','CANCELLED'],ACCEPTED:['IN_PROGRESS','ON_HOLD','CANCELLED'],IN_PROGRESS:['FOR_REVIEW','COMPLETED','ON_HOLD','CANCELLED'],FOR_REVIEW:['CHANGES_REQUIRED','COMPLETED'],CHANGES_REQUIRED:['IN_PROGRESS','FOR_REVIEW'],ON_HOLD:['TO_DO','IN_PROGRESS','CANCELLED'],OVERDUE:['ACCEPTED','IN_PROGRESS','FOR_REVIEW','COMPLETED','ON_HOLD','CANCELLED'],COMPLETED:[],CANCELLED:[]};
   if(!next[old.status]?.includes(d.status))throw new BadRequestException('This task status transition is not allowed.');
   if(old.status==='FOR_REVIEW'&&!has(a,'task.assign'))throw new ForbiddenException('A task manager must review this submission.');
  }
  return this.db.atomic(async tx=>{
   const updated=await tx.task.updateMany({where:{id,updatedAt:old.updatedAt},data:{...d,...(d.dueAt?{dueAt:new Date(d.dueAt)}:{}),...(d.status?{completedAt:d.status==='COMPLETED'?new Date():null,previousStatus:null}:{})}});
   if(!updated.count)throw new BadRequestException('This task changed. Refresh and try again.');
   if(d.status)await tx.taskStatusHistory.create({data:{taskId:id,actorId:a.id,previous:old.status,next:d.status}});
   await audit(tx,a,'task.updated','task',id,{clientId:old.clientId,contentId:old.contentId||undefined,previous:{status:old.status,assigneeId:old.assigneeId},next:d});
   const team=await tx.clientTeamMember.findMany({where:{clientId:old.clientId,responsibility:'smm'}});
   await this.notifications.emit(tx,[d.assigneeId||old.assigneeId,...team.map(t=>t.userId)],{event:d.status==='COMPLETED'?'task.completed':d.status==='FOR_REVIEW'?'task.review_requested':'task.assigned',title:'Task updated',body:old.title,href:'/tasks?task='+id,key:'task:'+id+':'+Date.now()},a.agencyId,a.id);return {ok:true};
  });
 }
 async system(tx:Prisma.TransactionClient,a:Actor,c:any,kind:string,assigneeId:string,deadline:string) {
  if(!assigneeId)throw new BadRequestException('Assign a '+kind.toLowerCase()+' team member before continuing.');
  const assignee=await tx.user.findFirst({where:{id:assigneeId,agencyId:a.agencyId,active:true,role:{isClient:false}}});
  if(!assignee)throw new BadRequestException('The assigned employee is no longer active.');
  const key='content:'+c.id+':'+kind;
  const previous=await tx.task.findUnique({where:{systemKey:key}});
  const t=await tx.task.upsert({where:{systemKey:key},create:{clientId:c.clientId,contentId:c.id,title:kind.replaceAll('_',' ')+' · '+c.title,kind,assigneeId,createdById:null,dueAt:new Date(deadline),systemKey:key},update:{assigneeId,status:previous?.status==='FOR_REVIEW'?'FOR_REVIEW':'TO_DO',completedAt:null,dueAt:new Date(deadline)}});
  if(previous)await tx.taskStatusHistory.create({data:{taskId:t.id,actorId:a.id,previous:previous.status,next:t.status}});
  await this.notifications.emit(tx,[assigneeId],{event:kind==='SCRIPT'?'task.assigned':kind==='SHOOT'?'shoot.assigned':kind==='EDIT'?'edit.assigned':'task.assigned',title:kind.replaceAll('_',' ')+' task assigned',body:contentCode(c.id)+' · '+c.title+' · due '+t.dueAt.toISOString().slice(0,10),href:'/content/'+c.id,key:key+':'+c.revision},a.agencyId,a.id);return t;
 }
 async status(tx:Prisma.TransactionClient,a:Actor,contentId:number,kinds:string[],status:string) {
  const tasks=await tx.task.findMany({where:{contentId,kind:{in:kinds},status:{not:'CANCELLED'}}});
  for(const t of tasks){await tx.task.update({where:{id:t.id},data:{status,previousStatus:null,completedAt:status==='COMPLETED'?new Date():null}});await tx.taskStatusHistory.create({data:{taskId:t.id,actorId:a.id,previous:t.status,next:status}});}
 }
 async comment(a:Actor,id:string,raw:unknown) {
  const t=await this.get(a,id);const d=commentDto.parse(raw);
  return this.db.atomic(async tx=>{const comment=await tx.contentComment.create({data:{taskId:id,contentId:t.contentId,authorId:a.id,...d,clientVisible:false}});await audit(tx,a,'task.commented','task',id,{clientId:t.clientId,contentId:t.contentId||undefined});return comment;});
 }
}
@Controller('tasks')
class TasksController {
 constructor(private service:TasksService){}
 @Get() @Require('task.view') list(@CurrentActor()a:Actor,@Query('view')v:string,@Query('clientId')c:string){return this.service.list(a,v,c);}
 @Get(':id') @Require('task.view') get(@CurrentActor()a:Actor,@Param('id')id:string){return this.service.get(a,id);}
 @Post() @Require('task.create','task.assign') create(@CurrentActor()a:Actor,@Body()d:unknown){return this.service.create(a,d);}
 @Patch(':id') @Require('task.complete') update(@CurrentActor()a:Actor,@Param('id')id:string,@Body()d:unknown){return this.service.update(a,id,d);}
 @Post(':id/comments') @Require('task.view') comment(@CurrentActor()a:Actor,@Param('id')id:string,@Body()d:unknown){return this.service.comment(a,id,d);}
}
@Module({providers:[TasksService],controllers:[TasksController],exports:[TasksService]}) export class TasksModule {}

