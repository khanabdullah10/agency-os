import { Body, Controller, Get, Module, Patch } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor } from '../core/types';
import { audit } from '../core/audit';
@Controller('settings') @Require('settings.manage')
class SettingsController {
 constructor(private db:Database,private access:Access){}
 @Get() async get(@CurrentActor()a:Actor){this.access.internal(a);return {agency:await this.db.agency.findUnique({where:{id:a.agencyId}}),integrations:{email:!!process.env.RESEND_API_KEY,whatsapp:!!process.env.WHATSAPP_TOKEN&&!!process.env.WHATSAPP_PHONE_NUMBER_ID,realtime:!!process.env.PUSHER_APP_ID&&!!process.env.PUSHER_SECRET,cron:!!process.env.CRON_SECRET},deliveries:await this.db.notificationDelivery.groupBy({by:['channel','status'],where:{notification:{user:{agencyId:a.agencyId}}},_count:true})};}
 @Patch() async update(@CurrentActor()a:Actor,@Body()raw:unknown){this.access.internal(a);const d=z.object({name:z.string().min(2).max(100),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Use a valid IANA timezone.'),settings:z.object({overdueEscalation:z.boolean()}).strict()}).strict().parse(raw);return this.db.atomic(async tx=>{const s=await tx.agency.update({where:{id:a.agencyId},data:d});await audit(tx,a,'settings.updated','agency',a.agencyId,{next:d});return s;});}
}
@Module({controllers:[SettingsController]})export class SettingsModule {}

