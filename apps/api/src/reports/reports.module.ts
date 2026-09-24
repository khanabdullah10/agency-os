import { Body, Controller, Get, Module, Param, ParseIntPipe, Post, Query, BadRequestException } from '@nestjs/common';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor, has, safeUser } from '../core/types';
import { metricsDto, reportDto } from '../core/schemas';
import { audit } from '../core/audit';
import { clientStatus } from '../core/workflow';
@Controller()
class ReportingController {
 constructor(private db:Database,private access:Access){}
 @Get('dashboard') @Require('content.view')
 async dashboard(@CurrentActor()a:Actor,@Query('date')dateParam?:string) {
  const clientWhere=this.access.clientWhere(a);
  const now=dateParam&&!isNaN(new Date(dateParam).getTime())?new Date(dateParam):new Date();const month=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1));
  const [clients,content,tasks,notifications,activity]=await Promise.all([
   this.db.client.findMany({where:clientWhere,select:{id:true,name:true,color:true,industry:true,active:true,deliverables:true}}),
   this.db.contentItem.findMany({where:{client:clientWhere,deletedAt:null},select:{id:true,title:true,platform:true,status:true,publishAt:true,assignees:true,clientId:true,client:{select:{id:true,name:true,color:true}},reviewStage:true}}),
   a.isClient?[]:this.db.task.findMany({where:{client:clientWhere,...(!has(a,'task.view_team')?{assigneeId:a.id}:{})},select:{id:true,title:true,status:true,dueAt:true,assigneeId:true,assignee:{select:safeUser},client:{select:{name:true,color:true}},contentId:true,kind:true}}),
   this.db.notification.count({where:{userId:a.id,readAt:null}}),
   this.db.activityLog.findMany({where:{agencyId:a.agencyId,client:clientWhere,...(a.isClient?{clientVisible:true}:{})},include:{actor:{select:safeUser},client:{select:{name:true,color:true}}},orderBy:{createdAt:'desc'},take:8})
  ]);
  const counts:Record<string,number>={};
  const monthly=content.filter(c=>c.publishAt>=month&&c.publishAt<end);
  for(const c of monthly){const status=a.isClient?clientStatus(c.status):c.status;counts[status]=(counts[status]||0)+1;}
  const activeTasks=tasks.filter(t=>!['COMPLETED','CANCELLED'].includes(t.status));
  const published=monthly.filter(c=>['PUBLISHED','ANALYTICS','REPORTING'].includes(c.status));
  const upcoming=content.filter(c=>c.publishAt>=new Date(now.getTime()-86400000)&&!['PUBLISHED','ANALYTICS','REPORTING'].includes(c.status)).sort((a,b)=>a.publishAt.getTime()-b.publishAt.getTime()).slice(0,6);
  const workload=a.isClient?[]:Object.values(activeTasks.reduce((acc:any,t)=>{acc[t.assigneeId]??={user:t.assignee,total:0,overdue:0};acc[t.assigneeId].total++;if(t.dueAt<now)acc[t.assigneeId].overdue++;return acc;},{}));
  return {clients,counts,contentThisMonth:monthly.length,publishedThisMonth:published.length,totalClients:clients.length,activeClients:clients.filter(c=>c.active).length,employeeCount:a.isClient?undefined:await this.db.user.count({where:{agencyId:a.agencyId,active:true,role:{isClient:false},...(has(a,'employee.manage')?{}:{id:{in:workload.map((w:any)=>w.user.id)}})}}),tasksPending:activeTasks.length,tasksOverdue:activeTasks.filter(t=>t.dueAt<now).length,tasks:activeTasks.sort((a,b)=>a.dueAt.getTime()-b.dueAt.getTime()).slice(0,6),workload,notifications,upcoming:upcoming.map(c=>a.isClient?{id:c.id,title:c.title,status:clientStatus(c.status),publishAt:c.publishAt,platform:c.platform,client:c.client}:c),   activity:a.isClient?[]:activity.map(v=>({id:v.id,action:v.action,createdAt:v.createdAt,actor:v.actor,client:v.client,contentId:v.contentId})),monthlyByClient:clients.map(c=>({name:c.name,color:c.color,planned:monthly.filter(x=>x.clientId===c.id).length,published:published.filter(x=>x.clientId===c.id).length}))};
 }
 @Get('reports') @Require('report.view')
 async reports(@CurrentActor()a:Actor,@Query('clientId')clientId?:string) {
  const where={...this.access.clientWhere(a),...(clientId?{id:clientId,...(!has(a,'client.view_all')&&!a.clientIds.includes(clientId)?{id:'__none__'}:{})}:{})};
  const content=await this.db.contentItem.findMany({where:{client:where,deletedAt:null},include:{client:{select:{name:true,color:true}},metrics:{orderBy:{date:'desc'},take:1},_count:{select:{revisions:true}},history:a.isClient?false:{orderBy:{createdAt:'asc'}}}});
  const totals={reach:0,impressions:0,views:0,likes:0,comments:0,shares:0,saves:0,followerGrowth:0};
  const published=content.filter(c=>['PUBLISHED','ANALYTICS','REPORTING'].includes(c.status));
  for(const c of published)if(c.metrics[0])for(const key of Object.keys(totals))totals[key as keyof typeof totals]+=(c.metrics[0] as any)[key]||0;
  const delays:number[]=[];
  if(!a.isClient)for(const c of content){for(let i=0;i<c.history.length-1;i++){if(c.history[i].next.includes('REVIEW'))delays.push((c.history[i+1].createdAt.getTime()-c.history[i].createdAt.getTime())/3600000);}}
  return {totals,planned:content.length,published:published.length,revisionCount:a.isClient?undefined:content.reduce((s,c)=>s+c._count.revisions,0),averageApprovalHours:a.isClient?undefined:delays.length?delays.reduce((s,x)=>s+x,0)/delays.length:null,topContent:published.filter(c=>c.metrics.length).sort((a,b)=>(b.metrics[0]?.views||0)-(a.metrics[0]?.views||0)).slice(0,10).map(c=>({id:c.id,title:c.title,platform:c.platform,client:c.client,metrics:c.metrics[0]})),reports:await this.db.report.findMany({where:{client:where,...(a.isClient?{clientVisible:true}:{})},include:{client:{select:{name:true,color:true}}},orderBy:{periodStart:'desc'},take:100}),byPlatform:[...new Set(content.map(c=>c.platform))].map(platform=>({platform,planned:content.filter(c=>c.platform===platform).length,published:published.filter(c=>c.platform===platform).length}))};
 }
 @Post('reports') @Require('report.manage')
 async createReport(@CurrentActor()a:Actor,@Body()raw:unknown){this.access.internal(a);const d=reportDto.parse(raw);await this.access.client(a,d.clientId);return this.db.atomic(async tx=>{const r=await tx.report.create({data:{...d,periodStart:new Date(d.periodStart),periodEnd:new Date(d.periodEnd)}});await audit(tx,a,'report.created','report',r.id,{clientId:d.clientId,clientVisible:d.clientVisible,next:{title:d.title}});return r;});}
 @Post('content/:id/metrics') @Require('report.manage')
 async metrics(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number,@Body()raw:unknown) {
  this.access.internal(a);const c=await this.access.content(a,id),d=metricsDto.parse(raw);
  if(!['PUBLISHED','ANALYTICS','REPORTING'].includes(c.status))throw new BadRequestException('Metrics can be recorded for published content.');
  const date=new Date(d.date);date.setUTCHours(0,0,0,0);
  return this.db.atomic(async tx=>{const previous=await tx.analyticsEntry.findUnique({where:{contentId_date:{contentId:id,date}}});const m=await tx.analyticsEntry.upsert({where:{contentId_date:{contentId:id,date}},create:{...d,date,contentId:id},update:{...d,date}});await audit(tx,a,'analytics.recorded','analytics',m.id,{clientId:c.clientId,contentId:id,previous:previous?JSON.parse(JSON.stringify(previous)):undefined,next:d});return m;});
 }
 @Get('activity') @Require('activity.view')
 async activity(@CurrentActor()a:Actor,@Query('before')before?:string) {
  this.access.internal(a);
  const logs=await this.db.activityLog.findMany({where:{agencyId:a.agencyId,OR:[{client:this.access.clientWhere(a)},...(has(a,'settings.manage')?[{clientId:null}]:[])],...(before?{createdAt:{lt:new Date(before)}}:{})},include:{actor:{select:safeUser},client:{select:{id:true,name:true,color:true}}},orderBy:{createdAt:'desc'},take:100});
  return logs;
 }
 @Get('search') @Require('content.view')
 async search(@CurrentActor()a:Actor,@Query('q')q='') {
  q=q.trim().slice(0,100);if(q.length<2)return [];
  const clients=a.isClient?[]:await this.db.client.findMany({where:{...this.access.clientWhere(a),name:{contains:q}},select:{id:true,name:true},take:5});
  const content=await this.db.contentItem.findMany({where:{client:this.access.clientWhere(a),deletedAt:null,OR:[{title:{contains:q}},{id:Number(q.replace('CNT-',''))||-1}]},select:{id:true,title:true},take:8});
  const tasks=a.isClient||!has(a,'task.view')?[]:await this.db.task.findMany({where:{client:this.access.clientWhere(a),title:{contains:q},...(!has(a,'task.view_team')?{assigneeId:a.id}:{})},select:{id:true,title:true},take:5});
  const users=a.isClient||!has(a,'employee.view')?[]:await this.db.user.findMany({where:{agencyId:a.agencyId,deletedAt:null,role:{isClient:false},name:{contains:q}},select:{id:true,name:true},take:5});
  return [...clients.map(c=>({id:c.id,title:c.name,type:'Client',href:'/clients/'+c.id})),...content.map(c=>({id:c.id,title:c.title,type:'CNT-'+String(c.id).padStart(4,'0'),href:'/content/'+c.id})),...tasks.map(t=>({id:t.id,title:t.title,type:'Task',href:'/tasks?task='+t.id})),...users.map(u=>({id:u.id,title:u.name,type:'Team member',href:'/team?user='+u.id}))];
 }
}
@Module({controllers:[ReportingController]})export class ReportsModule {}

