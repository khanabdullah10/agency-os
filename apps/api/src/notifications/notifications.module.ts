import { Body, Controller, Get, Global, Injectable, Module, Param, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Pusher from 'pusher';
import { Database } from '../core/database';
import { Actor, has } from '../core/types';
import { CurrentActor, Public, Require, secureEqual } from '../core/security';
import { preferenceDto } from '../core/schemas';
export type Notice={event:string;title:string;body:string;href:string;key:string};
@Injectable()
export class NotificationsService {
 constructor(private db:Database){}
 async emit(tx:Prisma.TransactionClient,userIds:string[],notice:Notice) {
  for(const userId of [...new Set(userIds.filter(Boolean))]) {
   const user=await tx.user.findUnique({where:{id:userId},include:{preferences:true}});
   if(!user?.active) continue;
   const pref=user.preferences.find(p=>p.category===notice.event.split('.')[0]);
   const n=await tx.notification.upsert({where:{dedupeKey:notice.key+':'+userId},update:{},create:{userId,event:notice.event,title:notice.title,body:notice.body,href:notice.href,dedupeKey:notice.key+':'+userId}});
   const channels=['REALTIME'];
   if(pref?.email??!notice.event.startsWith('chat.')) channels.push('EMAIL');
   if(pref?.whatsapp&&user.whatsappOptIn&&user.whatsapp) channels.push('WHATSAPP');
   for(const channel of channels) await tx.notificationDelivery.upsert({where:{notificationId_channel:{notificationId:n.id,channel}},update:{},create:{notificationId:n.id,channel}});
  }
 }
 pusher() {
  return process.env.PUSHER_APP_ID&&process.env.PUSHER_KEY&&process.env.PUSHER_SECRET
  ?new Pusher({appId:process.env.PUSHER_APP_ID,key:process.env.PUSHER_KEY,secret:process.env.PUSHER_SECRET,cluster:process.env.PUSHER_CLUSTER||'ap2',useTLS:true}):null;
 }
 async dispatch() {
  const pending=await this.db.notificationDelivery.findMany({where:{status:{in:['PENDING','RETRY']},nextAttemptAt:{lte:new Date()},OR:[{lockedUntil:null},{lockedUntil:{lt:new Date()}}]},take:30,orderBy:{createdAt:'asc'},include:{notification:{include:{user:true}}}});
  let delivered=0,blocked=0;
  for(const delivery of pending) {
   const claimed=await this.db.notificationDelivery.updateMany({where:{id:delivery.id,status:{in:['PENDING','RETRY']},OR:[{lockedUntil:null},{lockedUntil:{lt:new Date()}}]},data:{lockedUntil:new Date(Date.now()+120000)}});
   if(!claimed.count)continue;
   try {
    const n=delivery.notification,u=n.user;
    if(!u.active||u.deletedAt) {await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'CANCELLED',lockedUntil:null}});continue;}
    const pref=await this.db.notificationPreference.findUnique({where:{userId_category:{userId:u.id,category:n.event.split('.')[0]}}});
    let configured=true,providerId:string|undefined;
    if(delivery.channel==='REALTIME') {
     const p=this.pusher(); if(p)await p.trigger('private-user-'+u.id,'notification',{id:n.id,event:n.event}); else configured=false;
    }
    if(delivery.channel==='EMAIL') {
     if(pref?.email===false){await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'CANCELLED',lockedUntil:null}});continue;}
     if(!process.env.RESEND_API_KEY)configured=false;
     else {
      const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
      const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':delivery.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[u.email],subject:n.title,html:'<div style="font-family:Arial;padding:32px;max-width:600px"><p style="color:#ea6b36">MAD O MEDIA · AGENCY OS</p><h1>'+esc(n.title)+'</h1><p>'+esc(n.body)+'</p><a href="'+esc(process.env.APP_URL+n.href)+'">Open in Agency OS →</a></div>'}),signal:AbortSignal.timeout(15000)});
      if(!result.ok)throw new Error('Email provider returned HTTP '+result.status);
      providerId=(await result.json() as any).id;
     }
    }
    if(delivery.channel==='WHATSAPP') {
     if(!u.whatsappOptIn||!u.whatsapp||!pref?.whatsapp){await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'CANCELLED',lockedUntil:null}});continue;}
     if(!process.env.WHATSAPP_TOKEN||!process.env.WHATSAPP_PHONE_NUMBER_ID)configured=false;
     else {
      const result=await fetch('https://graph.facebook.com/'+(process.env.WHATSAPP_API_VERSION||'v23.0')+'/'+process.env.WHATSAPP_PHONE_NUMBER_ID+'/messages',{method:'POST',headers:{Authorization:'Bearer '+process.env.WHATSAPP_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:u.whatsapp.replace(/[^0-9]/g,''),type:'template',template:{name:process.env.WHATSAPP_TEMPLATE||'agency_workflow_update',language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'body',parameters:[{type:'text',text:n.title},{type:'text',text:n.body},{type:'text',text:process.env.APP_URL+n.href}]}]}}),signal:AbortSignal.timeout(15000)});
      if(!result.ok)throw new Error('WhatsApp provider returned HTTP '+result.status);
      providerId=(await result.json() as any).messages?.[0]?.id;
     }
    }
    if(!configured){blocked++;await this.db.notificationDelivery.update({where:{id:delivery.id},data:{lockedUntil:null,nextAttemptAt:new Date(Date.now()+3600000),lastError:'Provider not configured'}});continue;}
    await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:'SENT',providerId,lockedUntil:null,lastError:null,attempts:{increment:1}}});delivered++;
   }catch(e:any){
    const attempts=delivery.attempts+1;
    await this.db.notificationDelivery.update({where:{id:delivery.id},data:{status:attempts>=5?'FAILED':'RETRY',attempts,lockedUntil:null,lastError:String(e.message).slice(0,400),nextAttemptAt:new Date(Date.now()+Math.min(86400000,60000*2**attempts))}});
   }
  }
  return {delivered,blocked};
 }
}
@Controller('notifications')
class NotificationsController {
 constructor(private db:Database){}
 @Get() list(@CurrentActor()a:Actor){return this.db.notification.findMany({where:{userId:a.id},orderBy:{createdAt:'desc'},take:100});}
 @Patch(':id/read') async read(@CurrentActor()a:Actor,@Param('id')id:string){await this.db.notification.updateMany({where:{id,userId:a.id},data:{readAt:new Date()}});return {ok:true};}
 @Post('read-all') async all(@CurrentActor()a:Actor){await this.db.notification.updateMany({where:{userId:a.id,readAt:null},data:{readAt:new Date()}});return {ok:true};}
 @Get('preferences') preferences(@CurrentActor()a:Actor){return this.db.notificationPreference.findMany({where:{userId:a.id}});}
 @Post('preferences') preference(@CurrentActor()a:Actor,@Body()raw:unknown){const d=preferenceDto.parse(raw);return this.db.notificationPreference.upsert({where:{userId_category:{userId:a.id,category:d.category}},create:{userId:a.id,...d},update:d});}
}
@Global() @Module({providers:[NotificationsService],controllers:[NotificationsController],exports:[NotificationsService]}) export class NotificationsModule {}

