import { Controller, Injectable, Module, OnModuleDestroy, OnModuleInit, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Database } from '../core/database';
import { Public, secureEqual } from '../core/security';
import { NotificationsService } from '../notifications/notifications.module';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private intervalTimer?: NodeJS.Timeout;

  constructor(
    private db: Database,
    private notices: NotificationsService
  ) {}

  onModuleInit() {
    // Check every 60 seconds so the 10:15 AM reminder triggers automatically in all environments
    this.intervalTimer = setInterval(() => {
      this.checkDailyAttendanceReminders().catch(() => {});
    }, 60000);
  }

  onModuleDestroy() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }

  /**
   * Dispatches 10:15 AM sarcastic attendance reminders to non-exempt employees who have not marked attendance yet today.
   * If forced is true (e.g. triggered on-demand by Admin), it ignores the 10:15-10:59 AM time window check.
   */
  async checkDailyAttendanceReminders(forced = false): Promise<number> {
    try {
      const agencies = await this.db.agency.findMany({ select: { id: true, timezone: true } });
      let totalNotified = 0;

      for (const agency of agencies) {
        const tz = agency.timezone || 'Asia/Kolkata';
        const now = new Date();
        let hour = 0;
        let minute = 0;

        try {
          const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }).formatToParts(now);
          hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
          minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
        } catch {
          hour = now.getHours();
          minute = now.getMinutes();
        }

        // Active reminder window: 10:15 AM to 10:59 AM (cutoff for PRESENT is 11:00 AM)
        const isTimeWindow = (hour === 10 && minute >= 15);
        if (!isTimeWindow && !forced) {
          continue;
        }

        let today = '';
        try {
          today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
        } catch {
          today = now.toISOString().slice(0, 10);
        }

        // Find users who have already marked attendance today in this agency
        const loggedAttendance = await this.db.attendance.findMany({
          where: { agencyId: agency.id, date: today },
          select: { userId: true }
        });
        const checkedInSet = new Set(loggedAttendance.map(a => a.userId));

        // Find all active internal staff users who are required to mark attendance (non-exempt)
        // Admin, Super Admin, and Clients are exempt
        const employees = await this.db.user.findMany({
          where: {
            agencyId: agency.id,
            active: true,
            deletedAt: null,
            role: {
              isClient: false,
              isSuperAdmin: false,
              name: { notIn: ['Super Admin', 'Admin'] }
            }
          },
          select: { id: true, name: true }
        });

        const missingEmployees = employees.filter(e => !checkedInSet.has(e.id));
        if (missingEmployees.length === 0) continue;

        const sarcasticPunchlines = [
          "Don't forget to mark your attendance before 11:00 AM! Unless you're voluntarily donating today's salary to the agency coffee fund ☕💸. Clock in now before accounts starts trimming your paycheck!",
          "Still haven't marked attendance? 🧐 The system is eagerly preparing to deduct your salary. Clock in now before you work for free today! ⏰",
          "Reminder: Your salary loves you, but it requires proof of life before 11:00 AM! 📉 Tap here to mark your attendance before HR 'customizes' your paycheck! 💸",
          "Did you forget to mark attendance, or are you working for pure spiritual karma today? 😇 Mark your attendance now before the 11:00 AM cutoff penalty kicks in!"
        ];
        const dayNumber = Number(today.replace(/-/g, '')) || 0;
        const bodyText = sarcasticPunchlines[dayNumber % sarcasticPunchlines.length];

        for (const emp of missingEmployees) {
          await this.db.atomic(async tx => {
            await this.notices.emit(
              tx,
              [emp.id],
              {
                event: 'attendance.reminder',
                title: '⏰ Mark Attendance... Or Donate Your Salary? 💸',
                body: bodyText,
                href: '/attendance',
                key: forced ? `attendance:reminder:${today}:${Date.now()}` : `attendance:reminder:${today}`
              },
              agency.id
            );
          });
          totalNotified++;
        }
      }

      if (totalNotified > 0) {
        await this.notices.dispatch();
      }
      return totalNotified;
    } catch (err: any) {
      console.warn('[Agency OS] Attendance reminder notice:', err?.message || err);
      return 0;
    }
  }
}

@Controller('jobs')
export class JobsController {
 constructor(
   private db: Database,
   private notices: NotificationsService,
   private jobsService: JobsService
 ) {}

 @Public() @Post('run')
 async run(@Req() req: any) {
  if (!process.env.CRON_SECRET || !secureEqual(req.headers.authorization || '', 'Bearer ' + process.env.CRON_SECRET)) {
    throw new UnauthorizedException();
  }
  const lease = 'maintenance';
  const now = new Date();
  await this.db.jobLease.upsert({ where: { key: lease }, create: { key: lease, lockedUntil: new Date(0) }, update: {} });
  if (!(await this.db.jobLease.updateMany({ where: { key: lease, lockedUntil: { lt: now } }, data: { lockedUntil: new Date(Date.now() + 600000) } })).count) {
    return { ok: true, skipped: 'Another job is running' };
  }
  try {
   const tasks = await this.db.task.findMany({
     where: { dueAt: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED', 'OVERDUE', 'ON_HOLD'] }, client: { active: true } },
     include: { client: { include: { team: true, agency: true } } },
     take: 500
   });
   for (const task of tasks) await this.db.atomic(async tx => {
    if (!(await tx.task.updateMany({ where: { id: task.id, status: task.status }, data: { status: 'OVERDUE', previousStatus: task.status } })).count) return;
    await tx.taskStatusHistory.create({ data: { taskId: task.id, actorId: 'SYSTEM', previous: task.status, next: 'OVERDUE' } });
    await tx.activityLog.create({ data: { agencyId: task.client.agencyId, clientId: task.clientId, contentId: task.contentId, entityType: 'task', entityId: task.id, action: 'task.overdue', previous: { status: task.status }, next: { status: 'OVERDUE' } } });
    const recipients = [task.assigneeId, ...task.client.team.filter(t => t.responsibility === 'smm').map(t => t.userId)];
    if ((task.client.agency.settings as any)?.overdueEscalation) {
      const admins = await tx.user.findMany({ where: { agencyId: task.client.agencyId, active: true, role: { OR: [{ isSuperAdmin: true }, { permissions: { some: { permissionKey: 'approval.admin' } } }] } } });
      recipients.push(...admins.map(u => u.id));
    }
    await this.notices.emit(tx, recipients, { event: 'task.overdue', title: 'Task is overdue', body: task.title, href: '/tasks?task=' + task.id, key: 'overdue:' + task.id + ':' + task.dueAt.toISOString() });
   });

   const due = await this.db.contentItem.findMany({ where: { deletedAt: null, status: { in: ['READY_TO_PUBLISH', 'SCHEDULED', 'FINAL_CLIENT_APPROVED'] }, publishAt: { lte: new Date(Date.now() + 86400000) }, client: { active: true } }, take: 500 });
   for (const c of due) await this.db.atomic(tx => this.notices.emit(tx, [(c.assignees as any).smm], { event: 'content.publish_due', title: 'Publishing deadline approaching', body: c.title, href: '/content/' + c.id, key: 'publish-due:' + c.id + ':' + now.toISOString().slice(0, 10) }));

   // Clean up truly expired sessions (inactive for 90+ days)
   await this.db.session.deleteMany({ where: { expiresAt: { lt: now } } });

   // 10:15 AM Sarcastic Attendance Reminders
   const attendanceReminded = await this.jobsService.checkDailyAttendanceReminders();

   const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
   const oldAttendanceCount = await this.db.attendance.count({ where: { checkInAt: { lt: cutoff90 } } });
   if (oldAttendanceCount > 0) {
    const superAdmins = await this.db.user.findMany({ where: { active: true, role: { isSuperAdmin: true } }, select: { id: true, agencyId: true } });
    for (const sa of superAdmins) {
     await this.db.atomic(tx =>
      this.notices.emit(
       tx,
       [sa.id],
       {
        event: 'attendance.archive_ready',
        title: '3-Month Attendance Stored',
        body: `${oldAttendanceCount} attendance records are older than 3 months. Please download the Excel file and flush the data.`,
        href: '/attendance',
        key: 'attendance:archive:' + now.toISOString().slice(0, 7)
       },
       sa.agencyId,
       sa.id
      )
     );
    }
   }
   const delivery = await this.notices.dispatch();
   return { ok: true, overdue: tasks.length, reminders: due.length, attendanceReminded, attendanceArchive: oldAttendanceCount, ...delivery };
  } finally {
    await this.db.jobLease.update({ where: { key: lease }, data: { lockedUntil: new Date(0) } });
  }
 }
}

@Module({
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}
