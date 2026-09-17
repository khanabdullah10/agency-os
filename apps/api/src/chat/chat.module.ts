import { Body, Controller, Get, Injectable, Module, Param, Patch, Post, Delete, Query, ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor, has, safeUser } from '../core/types';
import { messageDto, threadDto } from '../core/schemas';
import { audit } from '../core/audit';
import { NotificationsService } from '../notifications/notifications.module';
@Injectable()
export class ChatService {
 constructor(private db:Database,private access:Access,private notices:NotificationsService){}
 async thread(a:Actor,id:string) {
  this.access.internal(a);
  const t=await this.db.chatThread.findFirst({where:{id,agencyId:a.agencyId},include:{members:{include:{user:{select:{...safeUser,lastSeenAt:true}}}}}});
  if(!t||!t.members.some(m=>m.userId===a.id))throw new ForbiddenException('You are not a member of this conversation.');
  if(t.clientId)await this.access.client(a,t.clientId);
  return t;
 }
 async list(a:Actor) {
  this.access.internal(a);
  const threads=await this.db.chatThread.findMany({where:{agencyId:a.agencyId,members:{some:{userId:a.id}},OR:[{clientId:null},{client:this.access.clientWhere(a)}]},include:{members:{where:{userId:a.id}},messages:{orderBy:{createdAt:'desc'},take:1,select:{body:true,createdAt:true,deletedAt:true}}},orderBy:{updatedAt:'desc'},take:100});
  return Promise.all(threads.map(async t=>({id:t.id,title:t.title,kind:t.kind,clientId:t.clientId,contentId:t.contentId,clientVisible:false,lastMessage:t.messages[0]?.deletedAt?'Message deleted':t.messages[0]?.body||'',updatedAt:t.updatedAt,unread:await this.db.chatMessage.count({where:{threadId:t.id,authorId:{not:a.id},createdAt:{gt:t.members[0]?.lastReadAt||new Date(0)},deletedAt:null}})})));
 }
 async messages(a:Actor,id:string,search?:string,before?:string) {
  const t=await this.thread(a,id);
  const messages=await this.db.chatMessage.findMany({where:{threadId:id,...(search?{body:{contains:search},deletedAt:null}:{}),...(before?{createdAt:{lt:new Date(before)}}:{})},include:{author:{select:safeUser},replyTo:{select:{id:true,body:true,deletedAt:true,author:{select:safeUser}}}},orderBy:{createdAt:'desc'},take:100});
  return {thread:{id:t.id,title:t.title,kind:t.kind,clientVisible:false,members:t.members.map(m=>({id:m.user.id,name:m.user.name,avatarColor:m.user.avatarColor,lastSeenAt:m.user.lastSeenAt,lastReadAt:m.lastReadAt}))},messages:messages.reverse().map(m=>({...m,body:m.deletedAt?'This message was deleted':m.body,replyTo:m.replyTo?{...m.replyTo,body:m.replyTo.deletedAt?'Message deleted':m.replyTo.body}:null}))};
 }
 async create(a:Actor,raw:unknown) {
  this.access.internal(a);this.access.permission(a,'chat.create');
  const d=threadDto.parse(raw);
  if(['CLIENT_INTERNAL','CONTENT','TASK'].includes(d.kind)&&!d.clientId)throw new BadRequestException('This conversation requires a client workspace.');
  if(d.kind==='DIRECT'&&new Set([...d.memberIds,a.id]).size!==2)throw new BadRequestException('A direct conversation needs exactly two people.');
  if(d.clientId)await this.access.client(a,d.clientId);
  if(d.contentId&&(await this.access.content(a,d.contentId)).clientId!==d.clientId)throw new BadRequestException('Content and client must match.');
  if(d.kind==='CONTENT'&&!d.contentId)throw new BadRequestException('Choose the linked content.');
  if(d.kind==='TASK'&&!d.taskId)throw new BadRequestException('Choose the linked task.');
  if(d.taskId){const t=await this.db.task.findUnique({where:{id:d.taskId}});if(!t||t.clientId!==d.clientId||d.contentId&&t.contentId!==d.contentId)throw new BadRequestException('Task and client must match.');}
  const members=[...new Set([...d.memberIds,a.id])];
  for(const id of members) {
   const u=await this.db.user.findFirst({where:{id,agencyId:a.agencyId,active:true},include:{role:true,clientUsers:true,teams:true}});
   if(!u)throw new BadRequestException('A selected member is unavailable.');
   if(u.role.isClient)throw new ForbiddenException('Client accounts cannot participate in chat.');
   if(d.clientId&&!u.role.isSuperAdmin&&!u.teams.some(c=>c.clientId===d.clientId))throw new ForbiddenException('Assign internal members to this client team first.');
  }
  const {memberIds,...data}=d;
  return this.db.atomic(async tx=>{const t=await tx.chatThread.create({data:{...data,agencyId:a.agencyId,clientVisible:false,members:{create:members.map(userId=>({userId}))}}});await audit(tx,a,'chat.thread_created','chat',t.id,{clientId:t.clientId||undefined,contentId:t.contentId||undefined,next:{kind:t.kind}});return t;});
 }
 async send(a:Actor,id:string,raw:unknown) {
  const t=await this.thread(a,id),d=messageDto.parse(raw);
  if(d.replyToId&&!await this.db.chatMessage.findFirst({where:{id:d.replyToId,threadId:id}}))throw new BadRequestException('Reply to a message in this conversation.');
  if(d.mentions.some(u=>!t.members.some(m=>m.userId===u)))throw new BadRequestException('Only conversation members may be mentioned.');
  return this.db.atomic(async tx=>{
   const m=await tx.chatMessage.create({data:{...d,threadId:id,authorId:a.id}});
   await tx.chatThread.update({where:{id},data:{updatedAt:new Date()}});
   await this.notices.emit(tx,t.members.map(m=>m.userId).filter(u=>u!==a.id),{event:'chat.message',title:'New message in '+t.title,body:a.name+' sent a message',href:'/chat?thread='+id,key:'chat:'+m.id});
   await audit(tx,a,'chat.message_sent','message',m.id,{clientId:t.clientId||undefined,contentId:t.contentId||undefined});return m;
  });
 }
 async edit(a:Actor,id:string,messageId:string,raw?:unknown) {
  const t=await this.thread(a,id);const m=await this.db.chatMessage.findFirstOrThrow({where:{id:messageId,threadId:id}});
  if(m.authorId!==a.id&&!(raw===undefined&&has(a,'chat.moderate')))throw new ForbiddenException('You can edit only your own messages.');
  if(m.deletedAt)throw new BadRequestException('This message has been deleted.');
  const d=raw!==undefined?z.object({body:z.string().trim().min(1).max(5000)}).strict().parse(raw):null;
  return this.db.atomic(async tx=>{await audit(tx,a,d?'chat.message_edited':'chat.message_deleted','message',m.id,{clientId:t.clientId||undefined,contentId:t.contentId||undefined,previous:{body:m.body},next:d||{deleted:true}});return tx.chatMessage.update({where:{id:messageId},data:d?{body:d.body,editedAt:new Date()}:{body:'',deletedAt:new Date()}});});
 }
 async read(a:Actor,id:string){await this.thread(a,id);await this.db.chatMember.update({where:{threadId_userId:{threadId:id,userId:a.id}},data:{lastReadAt:new Date()}});await this.db.user.update({where:{id:a.id},data:{lastSeenAt:new Date()}});return {ok:true};}
 async typing(a:Actor,id:string){await this.thread(a,id);const p=this.notices.pusher();if(p)await p.trigger('private-thread-'+id,'typing',{userId:a.id,name:a.name});return {ok:true};}
 async authorize(a:Actor,raw:unknown) {
  const d=z.object({socket_id:z.string().regex(/^\d+\.\d+$/),channel_name:z.string().max(150)}).strict().parse(raw);
  if(d.channel_name.startsWith('private-thread-'))await this.thread(a,d.channel_name.replace('private-thread-',''));
  else if(d.channel_name!=='private-user-'+a.id)throw new ForbiddenException('This realtime channel is not accessible.');
  const p=this.notices.pusher();if(!p)throw new ServiceUnavailableException('Realtime provider is not configured. Messages remain available through refresh.');
  return p.authorizeChannel(d.socket_id,d.channel_name);
 }
}
@Controller('chat')
class ChatController {
 constructor(private s:ChatService,private n:NotificationsService){}
 @Get('config') config(){return {enabled:!!this.n.pusher(),key:process.env.PUSHER_KEY||null,cluster:process.env.PUSHER_CLUSTER||'ap2'};}
 @Post('authorize') auth(@CurrentActor()a:Actor,@Body()d:unknown){return this.s.authorize(a,d);}
 @Get() @Require('chat.view') list(@CurrentActor()a:Actor){return this.s.list(a);}
 @Post() @Require('chat.view') create(@CurrentActor()a:Actor,@Body()d:unknown){return this.s.create(a,d);}
 @Get(':id/messages') @Require('chat.view') messages(@CurrentActor()a:Actor,@Param('id')id:string,@Query('search')search:string,@Query('before')before:string){return this.s.messages(a,id,search,before);}
 @Post(':id/messages') @Require('chat.view') send(@CurrentActor()a:Actor,@Param('id')id:string,@Body()d:unknown){return this.s.send(a,id,d);}
 @Patch(':id/messages/:messageId') @Require('chat.view') edit(@CurrentActor()a:Actor,@Param('id')id:string,@Param('messageId')m:string,@Body()d:unknown){return this.s.edit(a,id,m,d);}
 @Delete(':id/messages/:messageId') @Require('chat.view') remove(@CurrentActor()a:Actor,@Param('id')id:string,@Param('messageId')m:string){return this.s.edit(a,id,m);}
 @Post(':id/read') @Require('chat.view') read(@CurrentActor()a:Actor,@Param('id')id:string){return this.s.read(a,id);}
 @Post(':id/typing') @Require('chat.view') typing(@CurrentActor()a:Actor,@Param('id')id:string){return this.s.typing(a,id);}
}
@Module({providers:[ChatService],controllers:[ChatController]})export class ChatModule {}

