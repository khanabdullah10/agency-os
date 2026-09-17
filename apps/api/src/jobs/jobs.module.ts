import { Controller, Module, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Database } from '../core/database';
import { Public, secureEqual } from '../core/security';
import { NotificationsService } from '../notifications/notifications.module';
@Controller('jobs')
class JobsController {
 constructor(private db:Database,private notices:NotificationsService){}
 @Public() @Post('run')
 async run(@Req()req:any) {
  if(!process.env.CRON_SECRET||!secureEqual(req.headers.authorization||'','Bearer '+process.env.CRON_SECRET))throw new UnauthorizedException();
  const lease='maintenance';const now=new Date();
  await this.db.jobLease.upsert({where:{key:lease},create:{key:lease,lockedUntil:new Date(0)},update:{}});
  if(!(await this.db.jobLease.updateMany({where:{key:lease,lockedUntil:{lt:now}},data:{lockedUntil:new Date(Date.now()+600000)}})).count)return {ok:true,skipped:'Another job is running'};
  try {
   const tasks=await this.db.task.findMany({where:{dueAt:{lt:now},status:{notIn:['COMPLETED','CANCELLED','OVERDUE','ON_HOLD']},client:{active:true}},include:{client:{include:{team:true,agency:true}}},take:500});
   for(const task of tasks)await this.db.atomic(async tx=>{
    if(!(await tx.task.updateMany({where:{id:task.id,status:task.status},data:{status:'OVERDUE',previousStatus:task.status}})).count)return;
    await tx.taskStatusHistory.create({data:{taskId:task.id,actorId:'SYSTEM',previous:task.status,next:'OVERDUE'}});
    await tx.activityLog.create({data:{agencyId:task.client.agencyId,clientId:task.clientId,contentId:task.contentId,entityType:'task',entityId:task.id,action:'task.overdue',previous:{status:task.status},next:{status:'OVERDUE'}}});
    const recipients=[task.assigneeId,...task.client.team.filter(t=>t.responsibility==='smm').map(t=>t.userId)];
    if((task.client.agency.settings as any)?.overdueEscalation){const admins=await tx.user.findMany({where:{agencyId:task.client.agencyId,active:true,role:{OR:[{isSuperAdmin:true},{permissions:{some:{permissionKey:'approval.admin'}}}]}}});recipients.push(...admins.map(u=>u.id));}
    await this.notices.emit(tx,recipients,{event:'task.overdue',title:'Task is overdue',body:task.title,href:'/tasks?task='+task.id,key:'overdue:'+task.id+':'+task.dueAt.toISOString()});
   });
   const due=await this.db.contentItem.findMany({where:{deletedAt:null,status:{in:['READY_TO_PUBLISH','SCHEDULED','FINAL_CLIENT_APPROVED']},publishAt:{lte:new Date(Date.now()+86400000)},client:{active:true}},take:500});
   for(const c of due)await this.db.atomic(tx=>this.notices.emit(tx,[(c.assignees as any).smm],{event:'content.publish_due',title:'Publishing deadline approaching',body:c.title,href:'/content/'+c.id,key:'publish-due:'+c.id+':'+now.toISOString().slice(0,10)}));
   await this.db.session.deleteMany({where:{expiresAt:{lt:now}}});
   const delivery=await this.notices.dispatch();
   return {ok:true,overdue:tasks.length,reminders:due.length,...delivery};
  }finally{await this.db.jobLease.update({where:{key:lease},data:{lockedUntil:new Date(0)}});}
 }
}
@Module({controllers:[JobsController]})export class JobsModule {}

