import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Database } from '../core/database';
import { Access } from '../core/security';
import { Actor, TeamAssignments, Rules, defaultRules, contentCode, has } from '../core/types';
import { actionDto } from '../core/schemas';
import { allowedActions, nextInternalStage } from '../core/workflow';
import { audit } from '../core/audit';
import { TasksService } from '../tasks/tasks.module';
import { NotificationsService } from '../notifications/notifications.module';
@Injectable()
export class WorkflowService {
 constructor(private db:Database,private access:Access,private tasks:TasksService,private notifications:NotificationsService){}
 authorize(a:Actor,c:any,action:string) {
  const team=c.assignees as TeamAssignments;
  if(action==='APPROVE'||action==='REQUEST_CHANGES') {
   if(c.status==='CLIENT_SCRIPT_REVIEW'||c.status==='CLIENT_REVIEW') {
    if(!a.isClient||!a.clientIds.includes(c.clientId))throw new ForbiddenException('Only a user in this client workspace can make the client decision.');
    this.access.permission(a,'content.approve_client');return;
   }
   this.access.internal(a);
   if(c.reviewStage==='SUPER_ADMIN'){if(!a.isSuperAdmin)throw new ForbiddenException('Super Admin approval is required.');return;}
   if(c.reviewStage==='ADMIN'){this.access.permission(a,'approval.admin');return;}
   this.access.permission(a,'content.approve');
   if(!a.isSuperAdmin&&team.smm!==a.id)throw new ForbiddenException('The dedicated SMM must review this submission.');
   return;
  }
  this.access.internal(a);
  const rules:Record<string,[string,string|undefined]>={
   START_SCRIPT:['content.edit',team.smm],SUBMIT_SCRIPT:['script.write',team.writer],
   START_PRODUCTION:['content.edit',team.smm],SCHEDULE_SHOOT:['shoot.manage',team.videographer],
   COMPLETE_SHOOT:['shoot.manage',team.videographer],START_EDITING:['edit.submit',team.editor||team.designer],
   SUBMIT_EDIT:['edit.submit',team.editor||team.designer],READY_TO_PUBLISH:['publish.manage',team.smm],
   SCHEDULE_PUBLISH:['publish.manage',team.smm],PUBLISH:['publish.manage',team.smm],ANALYTICS:['report.manage',team.smm],REPORTING:['report.manage',team.smm]
  };
  const rule=rules[action];if(!rule)throw new BadRequestException('Unknown workflow action.');
  this.access.permission(a,rule[0]);
  if(!has(a,'content.edit_all')&&rule[1]!==a.id&&!(action==='SCHEDULE_SHOOT'&&team.smm===a.id))throw new ForbiddenException('This workflow action belongs to the assigned team member.');
 }
 async run(a:Actor,id:number,raw:unknown) {
  const d=actionDto.parse(raw);await this.access.content(a,id);
  return this.db.atomic(async tx=>{
   const c=await tx.contentItem.findUniqueOrThrow({where:{id},include:{client:{include:{users:true}},script:true,shoot:true,versions:{orderBy:{number:'desc'}},revisions:{where:{status:'OPEN'}}}});
   if(!c.client.active)throw new BadRequestException('This client workspace is archived.');
   if(c.revision!==d.revision)throw new ConflictException('This content changed. Refresh before continuing.');
   if(!allowedActions(c.status).includes(d.action))throw new BadRequestException('This action is not allowed at the current workflow stage.');
   this.authorize(a,c,d.action);
   if(!(await tx.contentItem.updateMany({where:{id,revision:d.revision},data:{revision:{increment:1}}})).count)throw new ConflictException('Another team member already changed this item.');
   const team=c.assignees as TeamAssignments,deadlines=c.deadlines as Record<string,string>,rules={...defaultRules,...c.client.approvalRules as object} as Rules;
   let status=c.status,stage=c.reviewStage;
   const code=contentCode(id),base={clientId:c.clientId,contentId:id};
   const update=async(next:string,event:string,clientVisible=false)=>{
    await tx.contentStatusHistory.create({data:{contentId:id,actorId:a.id,previous:status,next,event}});
    await audit(tx,a,event,'content',String(id),{...base,previous:{status},next:{status:next},clientVisible});
    status=next;
   };
   const notice=async(recipients:(string|undefined)[],event:string,title:string)=>this.notifications.emit(tx,recipients.filter(Boolean) as string[],{event,title,body:code+' · '+c.title,href:'/content/'+id,key:'content:'+id+':'+(c.revision+1)+':'+event+':'+(stage||'')});
   const clients=c.client.users.map(x=>x.userId);
   const production=async()=>{
    if(c.requiresShoot){if(!team.videographer)throw new BadRequestException('Assign a videographer before approving the production plan.');await update('READY_FOR_SHOOT','shoot.assigned');await this.tasks.system(tx,a,c,'SHOOT',team.videographer,deadlines.shoot);}
    else {const employee=team.editor||team.designer;if(!employee)throw new BadRequestException('Assign an editor or designer before starting production.');await update('EDITING','edit.assigned');await this.tasks.system(tx,a,c,team.editor?'EDIT':'DESIGN',employee,deadlines.edit);}
   };
   const final=async()=>{
    const latest=c.versions[0];if(!latest)throw new BadRequestException('A final version is required.');
    await tx.publishingRecord.upsert({where:{contentId:id},create:{contentId:id,finalDriveUrl:latest.driveUrl,caption:c.script?.caption||'',hashtags:c.script?.hashtags||'',status:'READY'},update:{finalDriveUrl:latest.driveUrl,caption:c.script?.caption||'',hashtags:c.script?.hashtags||'',status:'READY'}});
    await this.tasks.status(tx,a,id,['EDIT','DESIGN','SMM_REVIEW'],'COMPLETED');
    await this.tasks.system(tx,a,c,'PUBLISH',team.smm!,deadlines.ready);
    await notice([team.smm],'content.client_approved','Content approved · ready for publishing');
   };
   const shareEdit=async()=>{
    const latest=c.versions[0];if(!latest)throw new BadRequestException('Add an edit version before approval.');
    await tx.contentVersion.update({where:{id:latest.id},data:{clientVisible:true}});
    await tx.contentItem.update({where:{id},data:{sharedCaption:c.script?.caption||'',sharedHashtags:c.script?.hashtags||''}});
    if(rules.client){stage='CLIENT';await update('CLIENT_REVIEW','content.client_review_required',true);await notice(clients,'content.client_review_required','Your content is ready for review');}
    else {stage=null;await update('FINAL_CLIENT_APPROVED','content.approved_under_client_rules');await final();}
   };
   switch(d.action) {
    case 'START_SCRIPT':
     if(!team.writer)throw new BadRequestException('Assign a writer first.');
     await update('SCRIPT_WRITING','script.assigned');
     await this.tasks.system(tx,a,c,'SCRIPT',team.writer,deadlines.script);break;
    case 'SUBMIT_SCRIPT':
     if(!c.script?.body.trim()||!c.script.hook.trim())throw new BadRequestException('Save a hook and script before submitting.');
     stage='SMM';await update('INTERNAL_SCRIPT_REVIEW','script.submitted');
     await this.tasks.status(tx,a,id,['SCRIPT'],'FOR_REVIEW');
     await this.tasks.system(tx,a,c,'SMM_REVIEW',team.smm!,deadlines.internal);
     await tx.revision.updateMany({where:{contentId:id,status:'OPEN',source:{contains:'SCRIPT'}},data:{status:'COMPLETED',resolution:'Revised script submitted for review',completedAt:new Date()}});
     await notice([team.smm],'script.submitted','Script ready for your review');break;
    case 'SCHEDULE_SHOOT':
     if(!c.shoot)throw new BadRequestException('Save the shoot date, location, and shot list first.');
     await update('SHOOT_SCHEDULED','shoot.scheduled');await notice([team.videographer,team.smm],'shoot.assigned','Shoot scheduled');break;
    case 'COMPLETE_SHOOT':
     if(!d.rawUrl)throw new BadRequestException('Add the raw footage Google Drive URL.');
     if(!team.editor)throw new BadRequestException('Assign an editor before completing the shoot.');
     await tx.shoot.update({where:{contentId:id},data:{completedAt:new Date()}});
     await tx.driveLink.create({data:{clientId:c.clientId,contentId:id,title:'Raw footage',category:'Raw Footage',url:d.rawUrl,addedById:a.id}});
     await this.tasks.status(tx,a,id,['SHOOT'],'COMPLETED');
     await update('SHOOT_COMPLETED','shoot.completed');await update('RAW_FOOTAGE_READY','shoot.raw_footage_ready');
     await this.tasks.system(tx,a,c,'EDIT',team.editor,deadlines.edit);await notice([team.smm,team.editor],'shoot.completed','Raw footage is ready');break;
    case 'START_PRODUCTION':await production();break;
    case 'START_EDITING':await update('EDITING','edit.started');await this.tasks.status(tx,a,id,['EDIT','DESIGN'],'IN_PROGRESS');break;
    case 'SUBMIT_EDIT':
     if(!c.versions.length)throw new BadRequestException('Add a Google Drive version before submitting.');
     if(c.revisions.length&&c.versions[0].createdAt<=c.revisions.reduce((latest,r)=>r.createdAt>latest?r.createdAt:latest,new Date(0)))throw new BadRequestException('Add a new version to resolve the requested changes.');
     stage='SMM';await update('INTERNAL_EDIT_REVIEW','edit.submitted');
     await this.tasks.status(tx,a,id,['EDIT','DESIGN'],'FOR_REVIEW');
     await this.tasks.system(tx,a,c,'SMM_REVIEW',team.smm!,deadlines.internal);
     for(const rev of c.revisions)await tx.revision.update({where:{id:rev.id},data:{status:'COMPLETED',resolution:d.comment||'New version submitted for internal review',versionId:c.versions[0].id,completedAt:new Date()}});
     await notice([team.smm],'edit.submitted','New edit ready for internal review');break;
    case 'REQUEST_CHANGES':{
     if(!d.comment?.trim())throw new BadRequestException('Describe the changes required.');
     const script=c.status.includes('SCRIPT'),assignee=script?team.writer:team.editor||team.designer;
     if(!assignee)throw new BadRequestException('Assign the responsible employee before requesting changes.');
     const source=c.status.includes('CLIENT')?(script?'CLIENT_SCRIPT':'CLIENT_FINAL'):(script?'INTERNAL_SCRIPT':'INTERNAL_EDIT');
     await tx.approval.create({data:{contentId:id,versionId:script?undefined:c.versions[0]?.id,stage:source.startsWith('CLIENT')?source:stage||'SMM',decision:'CHANGES_REQUESTED',reviewerId:a.id,comment:d.comment,cycle:c.revision}});
     const max=await tx.revision.aggregate({where:{contentId:id},_max:{number:true}});
     await tx.revision.create({data:{contentId:id,number:(max._max.number||0)+1,requestedById:a.id,assigneeId:assignee,source,comments:d.comment,timestampComments:d.timestampComments||[],referenceUrls:d.referenceUrls||[]}});
     await update(script?'SCRIPT_WRITING':a.isClient?'CLIENT_CHANGES':'INTERNAL_CHANGES',a.isClient?'content.client_changes_requested':script?'script.changes_requested':'edit.changes_requested',a.isClient);
     await this.tasks.status(tx,a,id,[script?'SCRIPT':team.editor?'EDIT':'DESIGN'],'CHANGES_REQUIRED');
     await this.tasks.status(tx,a,id,['SMM_REVIEW'],'COMPLETED');
     await notice([assignee,team.smm],'revision.created','Changes requested on '+code);stage=null;break;
    }
    case 'APPROVE':{
     const script=c.status.includes('SCRIPT'),client=c.status==='CLIENT_SCRIPT_REVIEW'||c.status==='CLIENT_REVIEW';
     await tx.approval.create({data:{contentId:id,versionId:script?undefined:c.versions[0]?.id,stage:client?(script?'CLIENT_SCRIPT':'CLIENT_FINAL'):stage||'SMM',decision:'APPROVED',reviewerId:a.id,comment:d.comment,cycle:c.revision}});
     if(c.status==='INTERNAL_SCRIPT_REVIEW') {
      if(!c.script)throw new BadRequestException('Script is missing.');
      const {hook,body,cta,caption,hashtags,references}=c.script;
      await tx.contentItem.update({where:{id},data:{sharedScript:{hook,body,cta,caption,hashtags,references},sharedCaption:caption,sharedHashtags:hashtags}});
      await this.tasks.status(tx,a,id,['SMM_REVIEW'],'COMPLETED');
      if(rules.client){stage='CLIENT_SCRIPT';await update('CLIENT_SCRIPT_REVIEW','content.client_script_review_required',true);await notice(clients,'approval.required','Your script is ready for review');}
      else {stage=null;await update('SCRIPT_APPROVED','script.approved');await this.tasks.status(tx,a,id,['SCRIPT'],'COMPLETED');await production();}
     }else if(c.status==='CLIENT_SCRIPT_REVIEW') {
      stage=null;await update('SCRIPT_APPROVED','script.approved',true);await this.tasks.status(tx,a,id,['SCRIPT'],'COMPLETED');await notice([team.writer,team.smm],'script.approved','Client approved the script');await production();
     }else if(c.status==='CLIENT_REVIEW') {
      stage=null;await update('FINAL_CLIENT_APPROVED','content.client_approved',true);await final();
     }else {
      const next=nextInternalStage(stage||'SMM',rules);
      await this.tasks.status(tx,a,id,['SMM_REVIEW'],'COMPLETED');
      if(next==='ADMIN'||next==='SUPER_ADMIN') {
       stage=next;await update('INTERNAL_APPROVED','approval.required');
       const reviewers=await tx.user.findMany({where:{agencyId:a.agencyId,active:true,...(next==='SUPER_ADMIN'?{role:{isSuperAdmin:true}}:{role:{OR:[{isSuperAdmin:true},{permissions:{some:{permissionKey:'approval.admin'}}}]}})}});
       if(!reviewers.length)throw new BadRequestException('No active reviewer is available for this approval rule.');
       await notice(reviewers.map(u=>u.id),'approval.required',next.replace('_',' ')+' approval required');
      }else await shareEdit();
     }break;
    }
    case 'READY_TO_PUBLISH':stage=null;await update('READY_TO_PUBLISH','content.ready_to_publish',true);await notice([team.smm],'content.ready_to_publish','Ready to publish');break;
    case 'SCHEDULE_PUBLISH':
     if(!d.scheduledAt)throw new BadRequestException('Choose the publishing date and time.');
     await tx.publishingRecord.update({where:{contentId:id},data:{status:'SCHEDULED',scheduledAt:new Date(d.scheduledAt)}});
     await update('SCHEDULED','content.scheduled',true);break;
    case 'PUBLISH':
     if(!d.publishedUrl)throw new BadRequestException('Paste the published post URL.');
     await tx.publishingRecord.update({where:{contentId:id},data:{status:'PUBLISHED',publishedUrl:d.publishedUrl,publishedAt:new Date(),externalPostId:d.externalPostId,publishedById:a.id}});
     await update('PUBLISHED','content.published',true);await this.tasks.status(tx,a,id,['PUBLISH'],'COMPLETED');await notice([team.smm,...clients],'content.published','Content published');break;
    case 'ANALYTICS':await update('ANALYTICS','content.analytics');break;
    case 'REPORTING':await update('REPORTING','content.reporting');break;
   }
   await tx.contentItem.update({where:{id},data:{status,reviewStage:stage}});
   return {ok:true,status,revision:c.revision+1};
  });
 }
}

