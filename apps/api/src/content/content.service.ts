import { BadRequestException, ConflictException, Injectable, ForbiddenException } from '@nestjs/common';
import { Database } from '../core/database';
import { Access } from '../core/security';
import { Actor, TeamAssignments, has, safeUser, contentCode } from '../core/types';
import { contentDto, contentUpdateDto, scriptDto, shootDto, versionDto, commentDto } from '../core/schemas';
import { suggestDeadlines, clientStatus, assertAssignment } from '../core/workflow';
import { audit } from '../core/audit';
import { TasksService } from '../tasks/tasks.module';
@Injectable()
export class ContentService {
 constructor(private db:Database,private access:Access,private tasks:TasksService){}
 async assignments(a:Actor,clientId:string,assignments:TeamAssignments) {
  for(const userId of [...new Set(Object.values(assignments).filter(Boolean))] as string[]) {
   const user=await this.access.internalUser(a,userId,clientId);
   try{assertAssignment(a,user.role);}catch(e:any){throw new ForbiddenException(e.message);}
  }
 }
 async list(a:Actor,q:Record<string,string>) {
  const filters:any={deletedAt:null,client:this.access.clientWhere(a)};
  if(q.clientId)filters.clientId=q.clientId;
  if(q.platform)filters.platform=q.platform;
  if(q.type)filters.type=q.type;
  if(q.status&&!a.isClient)filters.status=q.status;
  if(q.from||q.to){filters.publishAt={...(q.from?{gte:new Date(q.from)}:{}),...(q.to?{lte:new Date(q.to)}:{})};}
  if(q.search)filters.OR=[{title:{contains:q.search}},{id:Number(q.search.replace('CNT-',''))||-1}];
  const records=await this.db.contentItem.findMany({where:filters,include:{client:{select:{id:true,name:true,color:true}},tasks:{select:{status:true,dueAt:true}},_count:{select:{versions:true,revisions:true}}},orderBy:{publishAt:'asc'},take:1000});
  return records.filter(c=>!q.assignee||Object.values(c.assignees as object).includes(q.assignee)).map(c=>({
   id:c.id,code:contentCode(c.id),clientId:c.clientId,client:c.client,title:c.title,type:c.type,platform:c.platform,pillar:c.pillar,publishAt:c.publishAt,
   status:a.isClient?clientStatus(c.status):c.status,reviewStage:a.isClient?undefined:c.reviewStage,
   assignees:a.isClient?undefined:c.assignees,overdue:a.isClient?undefined:c.tasks.some(t=>!['COMPLETED','CANCELLED'].includes(t.status)&&t.dueAt<new Date()),
   revision:c.revision,_count:a.isClient?undefined:c._count,requiresShoot:c.requiresShoot
  }));
 }
 async detail(a:Actor,id:number) {
  await this.access.content(a,id);
  const c=await this.db.contentItem.findUniqueOrThrow({where:{id},include:{
   client:{select:{id:true,name:true,color:true,brand:true,approvalRules:true}},script:true,shoot:true,
   tasks:{include:{assignee:{select:safeUser}},orderBy:{dueAt:'asc'}},
   versions:{include:{addedBy:{select:safeUser}},orderBy:{number:'desc'}},
   approvals:{include:{reviewer:{select:safeUser}},orderBy:{createdAt:'desc'}},
   revisions:{include:{requestedBy:{select:safeUser},assignee:{select:safeUser}},orderBy:{number:'desc'}},
   driveLinks:true,publishing:true,comments:{include:{author:{select:safeUser}},orderBy:{createdAt:'asc'}},
   history:{orderBy:{createdAt:'desc'}},metrics:{orderBy:{date:'desc'}},
   activities:{include:{actor:{select:safeUser}},orderBy:{createdAt:'desc'},take:100}
  }});
  if(!a.isClient)return {...c,code:contentCode(id)};
  return {
   id:c.id,code:contentCode(id),clientId:c.clientId,client:{id:c.client.id,name:c.client.name,color:c.client.color},
   title:c.title,platform:c.platform,type:c.type,pillar:c.pillar,publishAt:c.publishAt,status:clientStatus(c.status),
   revision:c.revision,script:c.sharedScript,caption:c.sharedCaption,hashtags:c.sharedHashtags,
   versions:c.versions.filter(v=>v.clientVisible).map(v=>({id:v.id,number:v.number,driveUrl:v.driveUrl,createdAt:v.createdAt})),
   approvals:c.approvals.filter(v=>v.stage.startsWith('CLIENT')).map(v=>({id:v.id,stage:v.stage,decision:v.decision,comment:v.comment,createdAt:v.createdAt,reviewer:{name:v.reviewer.name}})),
   revisions:c.revisions.filter(v=>v.source.startsWith('CLIENT')).map(v=>({id:v.id,number:v.number,comments:v.comments,timestampComments:v.timestampComments,referenceUrls:v.referenceUrls,status:v.status,createdAt:v.createdAt,completedAt:v.completedAt})),
   driveLinks:c.driveLinks.filter(v=>v.clientVisible).map(v=>({id:v.id,title:v.title,url:v.url,category:v.category,createdAt:v.createdAt})),
   comments:c.comments.filter(v=>v.clientVisible).map(v=>({id:v.id,body:v.body,timestamp:v.timestamp,referenceUrl:v.referenceUrl,author:{name:v.author.name},createdAt:v.createdAt})),
   publishing:c.publishing?{status:c.publishing.status,publishedUrl:c.publishing.publishedUrl,publishedAt:c.publishing.publishedAt,scheduledAt:c.publishing.scheduledAt,finalDriveUrl:c.publishing.finalDriveUrl,caption:c.publishing.caption,hashtags:c.publishing.hashtags}:null,
   activities:c.activities.filter(v=>v.clientVisible).map(v=>({id:v.id,action:v.action,createdAt:v.createdAt,actor:{name:v.actor?.name||'Agency OS'}})),
   metrics:['PUBLISHED','ANALYTICS','REPORTING'].includes(c.status)?c.metrics:[]
  };
 }
 async create(a:Actor,raw:unknown) {
  this.access.internal(a);const d=contentDto.parse(raw),client=await this.access.client(a,d.clientId);
  if(!client.active)throw new BadRequestException('This client is archived.');
  await this.assignments(a,d.clientId,d.assignees);
  const deadlines={...suggestDeadlines(new Date(d.publishAt),client.deadlineOffsets as any),...d.deadlines};
  return this.db.atomic(async tx=>{
   const c=await tx.contentItem.create({data:{...d,publishAt:new Date(d.publishAt),deadlines,status:d.assignees.writer?'SCRIPT_WRITING':'PLANNING'}});
   if(d.assignees.writer)await this.tasks.system(tx,a,c,'SCRIPT',d.assignees.writer,deadlines.script);
   const ids=[...new Set([a.id,...Object.values(d.assignees)])].filter(Boolean) as string[];
   await tx.chatThread.create({data:{agencyId:a.agencyId,clientId:c.clientId,contentId:c.id,title:contentCode(c.id)+' · '+c.title,kind:'CONTENT',members:{create:ids.map(userId=>({userId}))}}});
   await tx.contentStatusHistory.create({data:{contentId:c.id,actorId:a.id,previous:'',next:c.status,event:'content.created'}});
   await audit(tx,a,'content.created','content',String(c.id),{clientId:c.clientId,contentId:c.id,next:{title:c.title,status:c.status}});
   return {id:c.id};
  });
 }
 async update(a:Actor,id:number,raw:unknown) {
  this.access.internal(a);const c=await this.access.content(a,id),d=contentUpdateDto.parse(raw);
  if(['PUBLISHED','ANALYTICS','REPORTING'].includes(c.status))throw new BadRequestException('Published content is immutable. Create new content for another post.');
  if(!has(a,'content.edit_all')&&(c.assignees as any).smm!==a.id)throw new ForbiddenException('Only the assigned SMM can change this plan.');
  if(d.assignees) {
   if(!['IDEA','PLANNING','SCRIPT_WRITING'].includes(c.status))throw new BadRequestException('Team assignments are locked after script submission.');
   await this.assignments(a,c.clientId,d.assignees);
  }
  if(d.requiresShoot!==undefined&&!['IDEA','PLANNING','SCRIPT_WRITING'].includes(c.status))throw new BadRequestException('The production route is locked after script submission.');
  const {revision,...data}=d;
  return this.db.atomic(async tx=>{
   const updated=await tx.contentItem.updateMany({where:{id,revision},data:{...data,...(d.publishAt?{publishAt:new Date(d.publishAt)}:{}),revision:{increment:1}}});
   if(!updated.count)throw new ConflictException('This content changed. Refresh before saving.');
   if(d.deadlines){for(const t of await tx.task.findMany({where:{contentId:id,status:{notIn:['COMPLETED','CANCELLED']}}})){const key:{[key:string]:string}={SCRIPT:'script',SHOOT:'shoot',EDIT:'edit',DESIGN:'edit',SMM_REVIEW:'internal',PUBLISH:'ready'};if(d.deadlines[key[t.kind]])await tx.task.update({where:{id:t.id},data:{dueAt:new Date(d.deadlines[key[t.kind]])}});}}
   await audit(tx,a,'content.updated','content',String(id),{clientId:c.clientId,contentId:id,next:{changedFields:Object.keys(data)}});
   return {ok:true};
  });
 }
 responsible(a:Actor,c:any,field:string,permission:string) {
  this.access.internal(a);this.access.permission(a,permission);
  if(!has(a,'content.edit_all')&&c.assignees[field]!==a.id)throw new ForbiddenException('Only the assigned team member can make this submission.');
 }
 async saveScript(a:Actor,id:number,raw:unknown) {
  const c=await this.access.content(a,id);this.responsible(a,c,'writer','script.write');const d=scriptDto.parse(raw);
  if(!['PLANNING','SCRIPT_WRITING'].includes(c.status))throw new BadRequestException('Request changes before editing a submitted script.');
  const {revision,...data}=d;
  return this.db.atomic(async tx=>{
   if(!(await tx.contentItem.updateMany({where:{id,revision},data:{revision:{increment:1}}})).count)throw new ConflictException('This content changed. Refresh and try again.');
   const old=await tx.script.findUnique({where:{contentId:id}});
   await tx.script.upsert({where:{contentId:id},create:{contentId:id,...data,updatedBy:a.id},update:{...data,updatedBy:a.id}});
   await audit(tx,a,'script.draft_saved','content',String(id),{clientId:c.clientId,contentId:id,previous:old?{hook:old.hook,body:old.body,cta:old.cta,caption:old.caption,hashtags:old.hashtags}:undefined,next:{hook:data.hook,body:data.body,cta:data.cta,caption:data.caption,hashtags:data.hashtags}});
   return {ok:true};
  });
 }
 async saveShoot(a:Actor,id:number,raw:unknown) {
  const c=await this.access.content(a,id);this.access.internal(a);
  if(!has(a,'content.edit_all')&&![ (c.assignees as any).videographer,(c.assignees as any).smm ].includes(a.id))throw new ForbiddenException('Only the SMM or assigned videographer can plan this shoot.');
  if(!['READY_FOR_SHOOT','SHOOT_SCHEDULED'].includes(c.status))throw new BadRequestException('This content is not ready for shoot planning.');
  const d=shootDto.parse(raw);
  return this.db.atomic(async tx=>{
   const shoot=await tx.shoot.upsert({where:{contentId:id},create:{...d,scheduledAt:new Date(d.scheduledAt),contentId:id},update:{...d,scheduledAt:new Date(d.scheduledAt)}});
   await audit(tx,a,'shoot.details_saved','shoot',shoot.id,{clientId:c.clientId,contentId:id,next:d});return shoot;
  });
 }
 async version(a:Actor,id:number,raw:unknown) {
  const c=await this.access.content(a,id);const assigned=(c.assignees as any);this.responsible(a,c,assigned.editor?'editor':'designer','edit.submit');
  if(!['EDITING','INTERNAL_CHANGES','CLIENT_CHANGES'].includes(c.status))throw new BadRequestException('A new version can be added during editing or revision.');
  const d=versionDto.parse(raw);
  return this.db.atomic(async tx=>{
   if(!(await tx.contentItem.updateMany({where:{id,revision:d.revision},data:{revision:{increment:1}}})).count)throw new ConflictException('This content changed. Refresh before adding another version.');
   const latest=await tx.contentVersion.aggregate({where:{contentId:id},_max:{number:true}});
   const version=await tx.contentVersion.create({data:{contentId:id,number:(latest._max.number||0)+1,driveUrl:d.url,notes:d.notes,addedById:a.id}});
   await audit(tx,a,'edit.version_added','version',version.id,{clientId:c.clientId,contentId:id,next:{number:version.number,url:d.url}});return version;
  });
 }
 async comment(a:Actor,id:number,raw:unknown) {
  const c=await this.access.content(a,id);const d=commentDto.parse(raw);
  return this.db.atomic(async tx=>{
   const comment=await tx.contentComment.create({data:{...d,contentId:id,authorId:a.id,clientVisible:a.isClient||d.clientVisible}});
   await audit(tx,a,'content.commented','comment',comment.id,{clientId:c.clientId,contentId:id,clientVisible:a.isClient||d.clientVisible});return comment;
  });
 }
}

