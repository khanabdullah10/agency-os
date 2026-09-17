import { Body, Controller, Get, Module, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentActor, Require } from '../core/security';
import { Actor } from '../core/types';
import { ContentService } from './content.service';
import { WorkflowService } from './workflow.service';
import { TasksModule } from '../tasks/tasks.module';
@Controller('content')
class ContentController {
 constructor(private service:ContentService,private workflow:WorkflowService){}
 @Get() @Require('content.view') list(@CurrentActor()a:Actor,@Query()q:Record<string,string>){return this.service.list(a,q);}
 @Get(':id') @Require('content.view') get(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number){return this.service.detail(a,id);}
 @Post() @Require('content.create') create(@CurrentActor()a:Actor,@Body()d:unknown){return this.service.create(a,d);}
 @Patch(':id') @Require('content.edit') update(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number,@Body()d:unknown){return this.service.update(a,id,d);}
 @Post(':id/script') @Require('script.write') script(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number,@Body()d:unknown){return this.service.saveScript(a,id,d);}
 @Post(':id/shoot') @Require('shoot.manage') shoot(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number,@Body()d:unknown){return this.service.saveShoot(a,id,d);}
 @Post(':id/versions') @Require('edit.submit') version(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number,@Body()d:unknown){return this.service.version(a,id,d);}
 @Post(':id/actions') @Require('content.view') action(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number,@Body()d:unknown){return this.workflow.run(a,id,d);}
 @Post(':id/comments') @Require('content.view') comment(@CurrentActor()a:Actor,@Param('id',ParseIntPipe)id:number,@Body()d:unknown){return this.service.comment(a,id,d);}
}
@Module({imports:[TasksModule],providers:[ContentService,WorkflowService],controllers:[ContentController],exports:[ContentService]}) export class ContentModule {}

