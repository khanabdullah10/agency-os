import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../apps/api/src/auth/password';
import { suggestDeadlines, offsets as unused } from './seed-utils';
import { defaultRules, offsets } from '../apps/api/src/core/types';
const db=new PrismaClient();
const permissions:Record<string,string>={
 'client.view':'View accessible client workspaces','client.view_all':'View all agency clients','client.create':'Onboard clients','client.edit':'Edit client profiles and teams','client.archive':'Archive clients',
 'content.view':'View content calendar and items','content.create':'Plan content','content.edit':'Edit content plans','content.edit_all':'Manage any assigned content role','content.approve':'Review content as assigned SMM','content.approve_client':'Approve as client',
 'script.write':'Write and submit scripts','shoot.manage':'Plan and complete shoots','edit.submit':'Add and submit design or edit versions',
 'task.view':'View tasks','task.view_team':'View team tasks','task.create':'Create manual tasks','task.assign':'Assign permitted internal users','task.complete':'Update task progress',
 'chat.view':'View joined conversations','chat.internal':'Access internal chat','chat.client':'Access client-facing chat','chat.create':'Create conversations','chat.moderate':'Moderate messages',
 'drive.view':'View authorized Drive links','drive.manage':'Attach Drive links','employee.view':'View team directory','employee.manage':'Manage users and roles',
 'report.view':'View reports','report.manage':'Record analytics and reports','publish.view':'View publishing queue','publish.manage':'Manage manual publishing',
 'activity.view':'View authorized activity','approval.admin':'Review configured admin approvals','settings.manage':'Manage agency settings'
};
async function main(){
 if(!process.env.SEED_ADMIN_EMAIL||!process.env.SEED_ADMIN_PASSWORD||process.env.SEED_ADMIN_PASSWORD.length<12)throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) before seeding.');
 const demo=process.env.SEED_DEMO==='true';
 if(demo&&process.env.NODE_ENV==='production')throw new Error('Demonstration data is disabled in production.');
 const agency=await db.agency.upsert({where:{id:'mad-o-media'},create:{id:'mad-o-media',name:'Mad O Media',settings:{overdueEscalation:false}},update:{}});
 for(const [key,description]of Object.entries(permissions))await db.permission.upsert({where:{key},create:{key,description},update:{description}});
 const employee=['client.view','content.view','task.view','task.create','task.assign','task.complete','chat.view','chat.internal','chat.create','drive.view','drive.manage','employee.view','activity.view'];
 const smm=[...employee,'client.edit','content.create','content.edit','content.approve','task.view_team','script.write','shoot.manage','edit.submit','chat.client','report.view','report.manage','publish.view','publish.manage'];
 const defs=[
  {key:'SUPER_ADMIN',name:'Super Admin',permissions:Object.keys(permissions),isSuperAdmin:true},
  {key:'ADMIN',name:'Admin',permissions:Object.keys(permissions).filter(k=>!['content.approve_client','settings.manage'].includes(k))},
  {key:'SMM',name:'Social Media Manager',permissions:smm},
  {key:'WRITER',name:'Script Writer',permissions:[...employee,'script.write']},
  {key:'DESIGNER',name:'Graphic Designer',permissions:[...employee,'edit.submit']},
  {key:'EDITOR',name:'Video Editor',permissions:[...employee,'edit.submit']},
  {key:'VIDEOGRAPHER',name:'Videographer',permissions:[...employee,'shoot.manage']},
  {key:'EMPLOYEE',name:'Employee',permissions:employee},
  {key:'CLIENT',name:'Client',permissions:['client.view','content.view','content.approve_client','drive.view','report.view','activity.view'],isClient:true}
 ];
 const roles:Record<string,string>={};
 for(const def of defs) {
  const r=await db.role.upsert({where:{agencyId_systemKey:{agencyId:agency.id,systemKey:def.key}},create:{agencyId:agency.id,name:def.name,systemKey:def.key,isSuperAdmin:!!def.isSuperAdmin,isClient:!!def.isClient,permissions:{create:[...new Set(def.permissions)].map(permissionKey=>({permissionKey}))}},update:{}});
  roles[def.key]=r.id;
 }
 const owner=await db.user.upsert({where:{email:process.env.SEED_ADMIN_EMAIL.toLowerCase()},create:{agencyId:agency.id,name:process.env.SEED_ADMIN_NAME||'Agency Owner',email:process.env.SEED_ADMIN_EMAIL.toLowerCase(),passwordHash:await hashPassword(process.env.SEED_ADMIN_PASSWORD),roleId:roles.SUPER_ADMIN,mustChangePassword:!demo},update:{}});
 if(!demo){console.log('Agency, permissions, roles, and initial Super Admin are ready.');return;}
 if(!process.env.DEMO_PASSWORD||process.env.DEMO_PASSWORD.length<12)throw new Error('DEMO_PASSWORD must contain at least 12 characters.');
 if(await db.client.count({where:{agencyId:agency.id}})){console.log('Existing workspace preserved; demo seed skipped.');return;}
 const demoHash=await hashPassword(process.env.DEMO_PASSWORD);
 const people=[['admin','Kavya Menon','ADMIN','#647c98'],['smm','Aanya Sharma','SMM','#bc805d'],['writer','Rohan Mehta','WRITER','#7c7fb2'],['designer','Meera Nair','DESIGNER','#b276a0'],['editor','Arjun Patel','EDITOR','#72958c'],['shooter','Dev Shah','VIDEOGRAPHER','#ab8d59'],['employee','Isha Rao','EMPLOYEE','#8096ad'],['client','Nina Kapoor','CLIENT','#98a87d'],['client2','Kabir Sethi','CLIENT','#99755c']];
 const users:Record<string,string>={owner:owner.id};
 for(const [key,name,role,color]of people){const u=await db.user.create({data:{agencyId:agency.id,name,email:key+'@agency.local',passwordHash:demoHash,roleId:roles[role],mustChangePassword:false,avatarColor:color}});users[key]=u.id;}
 const brands=[
  ['Willow & Root','Lifestyle & wellness','#7d936d','WR','Growth','Stories that feel like home'],
  ['The Daily Grind','Food & beverage','#a2785c','DG','Growth','A little ritual. A better day.'],
  ['Forma Studio','Architecture & interiors','#7c87a0','FS','Signature','Designed for the way you live'],
  ['Aether Athletics','Fitness & activewear','#b58372','AA','Growth','Make room for your next chapter'],
  ['Bloom Skincare','Beauty & personal care','#b784a0','BS','Signature','Care that goes a little deeper'],
  ['Northbound','Travel & hospitality','#718f9b','NB','Essentials','Find your somewhere']
 ];
 const clients:any[]=[];
 for(let i=0;i<brands.length;i++){
  const [name,industry,color,,packageName,tone]=brands[i];
  const members=[['smm','smm'],['writer','writer'],['designer','designer'],['editor','editor'],['shooter','videographer'],['admin','other']];
  const c=await db.client.create({data:{agencyId:agency.id,name,industry,color,contactName:i===0?'Nina Kapoor':i===1?'Kabir Sethi':'Brand team',email:i===0?'client@agency.local':i===1?'client2@agency.local':'brand'+i+'@agency.local',packageName,platforms:['Instagram','Facebook',...(i%2?['YouTube']:['LinkedIn'])],deliverables:{Reels:8,Posts:8,Stories:12},brand:{colors:color,fonts:'Manrope, Inter',audience:'Thoughtful, design-conscious people aged 24–40',competitors:'Independent brands in the category',pillars:'Brand stories, education, community, product',tone,dos:'Keep the message clear and human.',donts:'Avoid jargon and heavy sales language.',logoUrl:'',assetsUrl:''},approvalRules:{...defaultRules,admin:i===2,superAdmin:i===4},deadlineOffsets:offsets,team:{create:members.map(([u,responsibility])=>({userId:users[u],responsibility}))},...(i<2?{users:{create:{userId:users[i===0?'client':'client2']}}}:{})}});
  clients.push(c);
  const mids=[owner.id,...members.map(([u])=>users[u])];
  const thread=await db.chatThread.create({data:{agencyId:agency.id,clientId:c.id,title:c.name+' · internal',kind:'CLIENT_INTERNAL',clientVisible:false,members:{create:mids.map(userId=>({userId}))}}});
  await db.chatMessage.create({data:{threadId:thread.id,authorId:users.smm,body:'September planning is underway. Let’s keep briefs and feedback linked to their content items.'}});
 }
 const general=await db.chatThread.create({data:{agencyId:agency.id,title:'The studio',kind:'GROUP',members:{create:Object.entries(users).filter(([k])=>!k.startsWith('client')).map(([,userId])=>({userId}))}}});
 for(const [u,body]of [['smm','Morning, team ☀️ The September calendar is ready. Let’s give our review queue a little love today.'],['editor','Willow & Root edits are coming together. I’ll share the next cut after the sound pass.'],['designer','The new carousel direction is looking good. Keeping everything light and editorial.']])await db.chatMessage.create({data:{threadId:general.id,authorId:users[u],body}});
 const titles=['Small rituals, meaningful mornings','Behind the blend: meet our roaster','A home that breathes','Built for the everyday athlete','Your skin, a little calmer','Somewhere off the usual path','Three ways to slow down','The art of a perfect pour','Materials with a story','Move at your own pace','The essentials, explained','A weekend worth getting lost in','A softer start to your day','From bean to your favourite cup','Spaces made for living','Strength looks different on everyone','What goes into every drop','Postcards from the quieter side','Good things take their time','Coffee, conversation, community','The details make the difference','Your next personal best','A routine that feels like you','A new perspective awaits','Introducing the autumn collection','Meet the people behind the craft','Before & after: a living room story','One more reason to show up','The science of a healthy glow','A guide to travelling slowly','Your questions, thoughtfully answered','September, in good company'];
 const statuses=['SCRIPT_WRITING','INTERNAL_SCRIPT_REVIEW','CLIENT_SCRIPT_REVIEW','SHOOT_SCHEDULED','EDITING','INTERNAL_EDIT_REVIEW','CLIENT_REVIEW','CLIENT_CHANGES','READY_TO_PUBLISH','SCHEDULED','PUBLISHED','PUBLISHED'];
 const now=new Date();
 for(let i=0;i<titles.length;i++){
  const client=clients[i%clients.length],status=statuses[i%statuses.length],type=i%3===0?'Instagram Reel':i%3===1?'Carousel':'Static Post';
  const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),Math.min(28,4+Math.floor(i*.77)),[5,8,12][i%3],30));
  const assignees={smm:users.smm,writer:users.writer,designer:users.designer,editor:users.editor,videographer:users.shooter};
  const c=await db.contentItem.create({data:{clientId:client.id,title:titles[i],platform:i%7===0?'LinkedIn':'Instagram',type,pillar:['Brand stories','Education','Community','Product'][i%4],publishAt:date,status,reviewStage:status==='INTERNAL_SCRIPT_REVIEW'||status==='INTERNAL_EDIT_REVIEW'?'SMM':status==='CLIENT_REVIEW'?'CLIENT':status==='CLIENT_SCRIPT_REVIEW'?'CLIENT_SCRIPT':null,assignees,deadlines:suggestDeadlines(date),requiresShoot:status==='SHOOT_SCHEDULED'||i%3===0,notes:'Demo brief: create a thoughtful, brand-led story with a clear takeaway.'}});
  const script={hook:'What if the little things made the biggest difference?',body:'Open with a simple, everyday moment. Show the care behind the product, one detail at a time. Bring the story back to the person watching: a quieter moment, a familiar ritual, something made just for them.',cta:'Save this for a little inspiration.',caption:titles[i]+'. A little inspiration for your everyday. Discover more with '+client.name+'.',hashtags:'#'+client.name.replace(/[^a-zA-Z]/g,'')+' #EverydayInspiration',references:[],notes:'Internal: keep the opening natural and unhurried.',updatedBy:users.writer};
  await db.script.create({data:{contentId:c.id,...script}});
  const shared=!['SCRIPT_WRITING','INTERNAL_SCRIPT_REVIEW'].includes(status);
  if(shared){const {notes,updatedBy,...snapshot}=script;await db.contentItem.update({where:{id:c.id},data:{sharedScript:snapshot,sharedCaption:script.caption,sharedHashtags:script.hashtags}});}
  const progress=['SCRIPT_WRITING','INTERNAL_SCRIPT_REVIEW','CLIENT_SCRIPT_REVIEW'];
  if(!progress.includes(status))progress.push('SCRIPT_APPROVED','EDITING');
  if(['INTERNAL_EDIT_REVIEW','CLIENT_REVIEW','CLIENT_CHANGES','READY_TO_PUBLISH','SCHEDULED','PUBLISHED'].includes(status))progress.push('INTERNAL_EDIT_REVIEW');
  if(['CLIENT_REVIEW','CLIENT_CHANGES','READY_TO_PUBLISH','SCHEDULED','PUBLISHED'].includes(status))progress.push('CLIENT_REVIEW');
  if(['READY_TO_PUBLISH','SCHEDULED','PUBLISHED'].includes(status))progress.push('FINAL_CLIENT_APPROVED','READY_TO_PUBLISH');
  if(status==='SCHEDULED'||status==='PUBLISHED')progress.push(status);
  if(!progress.includes(status))progress.push(status);
  const cut=progress.slice(0,progress.lastIndexOf(status)+1);
  for(let j=0;j<cut.length;j++)await db.contentStatusHistory.create({data:{contentId:c.id,actorId:users.smm,previous:j?cut[j-1]:'PLANNING',next:cut[j],event:'demo.workflow_seeded',createdAt:new Date(date.getTime()-(cut.length-j)*3600000)}});
  // Example links deliberately point at Drive's real home, not invented files.
  let versionId:string|undefined;
  if(['INTERNAL_EDIT_REVIEW','CLIENT_REVIEW','CLIENT_CHANGES','READY_TO_PUBLISH','SCHEDULED','PUBLISHED'].includes(status)){
   const v=await db.contentVersion.create({data:{contentId:c.id,number:1,driveUrl:'https://drive.google.com/drive/u/0/home',addedById:users.editor,notes:'Demonstration version: replace this Drive home link with your actual file.',clientVisible:status!=='INTERNAL_EDIT_REVIEW'}});versionId=v.id;
  }
  if(status==='SHOOT_SCHEDULED')await db.shoot.create({data:{contentId:c.id,scheduledAt:new Date(date.getTime()-5*86400000),location:client.name+' studio',shotList:'Opening detail • Product in use • Behind the scenes • Brand closing frame',orientation:'Portrait'}});
  if(['CLIENT_REVIEW','CLIENT_CHANGES','READY_TO_PUBLISH','SCHEDULED','PUBLISHED'].includes(status))await db.approval.create({data:{contentId:c.id,versionId,stage:'SMM',decision:'APPROVED',reviewerId:users.smm,cycle:0,comment:'Demo approval: clear messaging and on-brand pacing.'}});
  if(status==='CLIENT_CHANGES')await db.revision.create({data:{contentId:c.id,number:1,requestedById:users.smm,assigneeId:users.editor,source:'CLIENT_FINAL',comments:'Please let the opening breathe a little longer and make the final CTA more prominent.',timestampComments:[{timestamp:'00:14',comment:'Hold this shot a little longer.'}],referenceUrls:[]}});
  if(['READY_TO_PUBLISH','SCHEDULED','PUBLISHED'].includes(status))await db.publishingRecord.create({data:{contentId:c.id,finalDriveUrl:'https://drive.google.com/drive/u/0/home',caption:script.caption,hashtags:script.hashtags,status:status==='PUBLISHED'?'PUBLISHED':status==='SCHEDULED'?'SCHEDULED':'READY',scheduledAt:status==='SCHEDULED'?date:null,publishedAt:status==='PUBLISHED'?date:null,publishedUrl:status==='PUBLISHED'?'https://www.instagram.com/':null}});
  const kind=status==='SCRIPT_WRITING'?'SCRIPT':status==='SHOOT_SCHEDULED'?'SHOOT':status.includes('SCRIPT_REVIEW')?'SMM_REVIEW':['READY_TO_PUBLISH','SCHEDULED','PUBLISHED'].includes(status)?'PUBLISH':status==='INTERNAL_EDIT_REVIEW'||status==='CLIENT_REVIEW'?'SMM_REVIEW':'EDIT';
  const who=kind==='SCRIPT'?users.writer:kind==='SHOOT'?users.shooter:kind==='EDIT'?users.editor:users.smm;
  const deadlines=suggestDeadlines(date);
  await db.task.create({data:{clientId:client.id,contentId:c.id,title:kind.replace('_',' ')+' · '+c.title,createdById:null,assigneeId:who,kind,systemKey:'content:'+c.id+':'+kind,status:status==='PUBLISHED'?'COMPLETED':status==='CLIENT_CHANGES'?'CHANGES_REQUIRED':status.includes('REVIEW')?'FOR_REVIEW':'IN_PROGRESS',dueAt:new Date(kind==='SCRIPT'?deadlines.script:kind==='SHOOT'?deadlines.shoot:kind==='EDIT'?deadlines.edit:deadlines.ready),priority:i%4===0?'HIGH':'MEDIUM'}});
  if(status==='PUBLISHED')await db.analyticsEntry.create({data:{contentId:c.id,date,reach:1800+i*531,impressions:2600+i*632,views:2200+i*729,likes:132+i*18,comments:9+i*2,shares:15+i*3,saves:22+i*4,followerGrowth:10+i}});
  await db.activityLog.create({data:{agencyId:agency.id,actorId:users.smm,clientId:client.id,contentId:c.id,entityType:'content',entityId:String(c.id),action:status==='PUBLISHED'?'content.published':status==='CLIENT_REVIEW'?'content.client_review_required':'content.planned',clientVisible:status==='PUBLISHED'||status==='CLIENT_REVIEW',createdAt:new Date(now.getTime()-i*17*60000)}});
 }
 for(let i=0;i<3;i++)await db.notification.create({data:{userId:owner.id,event:'approval.required',title:['Content is ready for review','The September calendar is taking shape','Welcome to your agency workspace'][i],body:['A new edit is waiting for internal approval.','32 content items are connected to their production workflows.','This local workspace contains fictional demonstration data.'][i],href:i===2?'/dashboard':'/approvals',dedupeKey:'demo:owner:'+i}});
 console.log('Fictional development workspace seeded: six clients, nine team/client accounts, 32 connected content items.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());

