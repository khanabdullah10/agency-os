import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Database, DatabaseModule } from './core/database';
import { AccessModule, AuthGuard, Public } from './core/security';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { TasksModule } from './tasks/tasks.module';
import { ContentModule } from './content/content.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DriveLinksModule } from './drive/drive.module';
import { ChatModule } from './chat/chat.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { JobsModule } from './jobs/jobs.module';
import { SheetsModule } from './sheets/sheets.module';
import { AttendanceModule } from './attendance/attendance.module';
import { CreativeStudioModule } from './creative-studio/creative-studio.module';
import { SocialPublishingModule } from './social/social.module';
@Controller('health')
class HealthController {
 constructor(private db:Database){}
 @Public() @Get() async health(){await this.db.$queryRaw`SELECT 1`;return {ok:true,service:'Agency OS'};}
}
@Module({imports:[DatabaseModule,AccessModule,NotificationsModule,AuthModule,UsersModule,ClientsModule,TasksModule,ContentModule,DriveLinksModule,ChatModule,ReportsModule,SettingsModule,JobsModule,SheetsModule,AttendanceModule,CreativeStudioModule,SocialPublishingModule],controllers:[HealthController],providers:[{provide:APP_GUARD,useClass:AuthGuard}]})
export class AppModule {}

