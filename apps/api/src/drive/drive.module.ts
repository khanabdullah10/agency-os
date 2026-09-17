import { Body, Controller, Get, Module, Post, BadRequestException } from '@nestjs/common';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor } from '../core/types';
import { driveDto } from '../core/schemas';
import { audit } from '../core/audit';
@Controller('drive')
class DriveController {
 constructor(private db:Database,private access:Access){}
 @Get() @Require('drive.view')
 async list(@CurrentActor()a:Actor) {
  const records=await this.db.driveLink.findMany({where:{client:this.access.clientWhere(a),...(a.isClient?{clientVisible:true}:{})},include:{client:{select:{id:true,name:true,color:true}}},orderBy:{createdAt:'desc'},take:500});
  return a.isClient?records.map(v=>({id:v.id,title:v.title,url:v.url,category:v.category,client:v.client,contentId:v.contentId,createdAt:v.createdAt})):records;
 }
 @Post() @Require('drive.manage')
 async create(@CurrentActor()a:Actor,@Body()raw:unknown) {
  this.access.internal(a);const d=driveDto.parse(raw);await this.access.client(a,d.clientId);
  if(d.contentId&&(await this.access.content(a,d.contentId)).clientId!==d.clientId)throw new BadRequestException('Content and link must belong to the same client.');
  if(d.taskId){const task=await this.db.task.findUnique({where:{id:d.taskId}});if(!task||task.clientId!==d.clientId||(d.contentId&&task.contentId!==d.contentId))throw new BadRequestException('Task and link context must match.');}
  if(d.revisionId){const revision=await this.db.revision.findUnique({where:{id:d.revisionId},include:{content:true}});if(!revision||revision.content.clientId!==d.clientId||revision.contentId!==d.contentId)throw new BadRequestException('Revision and content must match.');}
  return this.db.atomic(async tx=>{const link=await tx.driveLink.create({data:{...d,addedById:a.id}});await audit(tx,a,'drive.link_added','drive',link.id,{clientId:d.clientId,contentId:d.contentId,clientVisible:d.clientVisible,next:{title:d.title,url:d.url}});return link;});
 }
}
@Module({controllers:[DriveController]})export class DriveLinksModule {}

