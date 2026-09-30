import { Body, Controller, Delete, Get, Module, OnModuleInit, Param, Post, Query, Req, Res, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response, Request } from 'express';
import ExcelJS from 'exceljs';
import { Database } from '../core/database';
import { Access, CurrentActor } from '../core/security';
import { Actor, has, safeUser } from '../core/types';
import { checkInDto, checkOutDto } from '../core/schemas';
import { audit } from '../core/audit';

function isAdminOrSuperAdmin(a: Actor): boolean {
  return a.isSuperAdmin || a.roleName === 'Super Admin' || a.roleName === 'Admin';
}

function getTodayDateString(timeZone = 'Asia/Kolkata'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatTime(d?: Date | null, timeZone = 'Asia/Kolkata'): string {
  if (!d) return '-';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date(d));
  } catch {
    return new Date(d).toLocaleTimeString();
  }
}

function calculateWorkingHours(start?: Date | null, end?: Date | null): string {
  if (!start || !end) return '-';
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (diffMs <= 0) return '0 hrs 0 mins';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs} hr${hrs === 1 ? '' : 's'} ${mins} min${mins === 1 ? '' : 's'}`;
}

@Controller('attendance')
export class AttendanceController implements OnModuleInit {
  constructor(private db: Database, private access: Access) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    try {
      await (this.db as any).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`Attendance\` (
          \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
          \`agencyId\` VARCHAR(191) NOT NULL,
          \`userId\` VARCHAR(191) NOT NULL,
          \`date\` VARCHAR(191) NOT NULL,
          \`checkInAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`checkOutAt\` DATETIME(3) NULL,
          \`status\` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
          \`latitude\` DOUBLE NULL,
          \`longitude\` DOUBLE NULL,
          \`accuracy\` DOUBLE NULL,
          \`address\` TEXT NULL,
          \`ipAddress\` VARCHAR(191) NULL,
          \`deviceInfo\` TEXT NULL,
          \`notes\` TEXT NULL,
          \`outLatitude\` DOUBLE NULL,
          \`outLongitude\` DOUBLE NULL,
          \`outAddress\` TEXT NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          UNIQUE KEY \`Attendance_userId_date_key\` (\`userId\`, \`date\`),
          INDEX \`Attendance_agencyId_date_idx\` (\`agencyId\`, \`date\`),
          INDEX \`Attendance_checkInAt_idx\` (\`checkInAt\`),
          INDEX \`Attendance_userId_checkInAt_idx\` (\`userId\`, \`checkInAt\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (e: any) {
      // Table check warning handled silently
    }
  }

  @Get('today')
  async today(@CurrentActor() a: Actor) {
    this.access.internal(a);
    const isExempt = isAdminOrSuperAdmin(a) || a.isClient;
    const today = getTodayDateString();

    const record = await this.db.attendance.findUnique({
      where: { userId_date: { userId: a.id, date: today } }
    });

    return {
      today,
      isExempt,
      checkedIn: !!record,
      checkedOut: !!record?.checkOutAt,
      attendance: record
    };
  }

  @Post('check-in')
  async checkIn(@CurrentActor() a: Actor, @Body() raw: unknown, @Req() req: Request) {
    this.access.internal(a);
    if (isAdminOrSuperAdmin(a)) {
      throw new BadRequestException('Admin and Super Admin are exempt from marking attendance.');
    }

    const d = checkInDto.parse(raw);
    const today = getTodayDateString();

    const clientIp = (
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown'
    );

    // Calculate if late: after 10:30 AM local time default
    let calculatedStatus = d.status || 'PRESENT';
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    if (!d.status && (currentHour > 10 || (currentHour === 10 && currentMinute > 30))) {
      calculatedStatus = 'LATE';
    }

    const record = await this.db.attendance.upsert({
      where: { userId_date: { userId: a.id, date: today } },
      create: {
        agencyId: a.agencyId,
        userId: a.id,
        date: today,
        checkInAt: new Date(),
        status: calculatedStatus,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        accuracy: d.accuracy ?? null,
        address: d.address ?? null,
        ipAddress: clientIp,
        deviceInfo: d.deviceInfo ?? (req.headers['user-agent']?.slice(0, 500) || null),
        notes: d.notes ?? null,
      },
      update: {
        status: calculatedStatus,
        latitude: d.latitude ?? undefined,
        longitude: d.longitude ?? undefined,
        accuracy: d.accuracy ?? undefined,
        address: d.address ?? undefined,
        notes: d.notes ?? undefined,
      }
    });

    await this.db.atomic(async tx => {
      await audit(tx, a, 'attendance.check_in', 'attendance', record.id, {
        next: {
          date: today,
          time: record.checkInAt,
          status: record.status,
          address: record.address,
          coords: d.latitude ? `${d.latitude}, ${d.longitude}` : 'no-gps'
        }
      });
    });

    return record;
  }

  @Post('check-out')
  async checkOut(@CurrentActor() a: Actor, @Body() raw: unknown) {
    this.access.internal(a);
    if (isAdminOrSuperAdmin(a)) {
      throw new BadRequestException('Admin and Super Admin are exempt from marking attendance.');
    }

    const d = checkOutDto.parse(raw);
    const today = getTodayDateString();

    const existing = await this.db.attendance.findUnique({
      where: { userId_date: { userId: a.id, date: today } }
    });

    if (!existing) {
      throw new BadRequestException('You have not checked in today yet. Please check in first.');
    }

    const updated = await this.db.attendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: new Date(),
        outLatitude: d.latitude ?? null,
        outLongitude: d.longitude ?? null,
        outAddress: d.address ?? null,
        notes: d.notes ? (existing.notes ? `${existing.notes} | Checkout: ${d.notes}` : d.notes) : existing.notes
      }
    });

    await this.db.atomic(async tx => {
      await audit(tx, a, 'attendance.check_out', 'attendance', updated.id, {
        next: {
          date: today,
          checkInAt: existing.checkInAt,
          checkOutAt: updated.checkOutAt,
          workingHours: calculateWorkingHours(existing.checkInAt, updated.checkOutAt)
        }
      });
    });

    return updated;
  }

  @Get('list')
  async list(
    @CurrentActor() a: Actor,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('olderThan90Days') olderThan90Days?: string
  ) {
    this.access.internal(a);
    const canManage = isAdminOrSuperAdmin(a) || has(a, 'employee.manage');

    const where: any = {
      agencyId: a.agencyId,
    };

    if (!canManage) {
      // Regular employees can only view their own attendance
      where.userId = a.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (from || to) {
      where.date = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {})
      };
    }

    if (olderThan90Days === 'true') {
      const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      where.checkInAt = { lt: cutoff90 };
    }

    if (status) {
      where.status = status;
    }

    const records = await this.db.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            avatarColor: true,
            role: { select: { id: true, name: true, systemKey: true } }
          }
        }
      },
      orderBy: { checkInAt: 'desc' },
      take: 1000
    });

    return records.map(r => ({
      ...r,
      workingHours: calculateWorkingHours(r.checkInAt, r.checkOutAt),
      formattedCheckIn: formatTime(r.checkInAt),
      formattedCheckOut: formatTime(r.checkOutAt),
    }));
  }

  @Get('archive-status')
  async archiveStatus(@CurrentActor() a: Actor) {
    this.access.internal(a);
    const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [totalCount, olderThan90DaysCount, oldestRecord] = await Promise.all([
      this.db.attendance.count({ where: { agencyId: a.agencyId } }),
      this.db.attendance.count({
        where: {
          agencyId: a.agencyId,
          checkInAt: { lt: cutoff90 }
        }
      }),
      this.db.attendance.findFirst({
        where: { agencyId: a.agencyId },
        orderBy: { checkInAt: 'asc' },
        select: { date: true, checkInAt: true }
      })
    ]);

    return {
      totalCount,
      olderThan90DaysCount,
      oldestRecordDate: oldestRecord?.date || null,
      hasArchive: olderThan90DaysCount > 0,
      cutoffDate: cutoff90.toISOString().slice(0, 10),
      isSuperAdmin: a.isSuperAdmin
    };
  }

  @Post('flush-archive')
  async flushArchive(@CurrentActor() a: Actor) {
    this.access.internal(a);
    if (!a.isSuperAdmin) {
      throw new ForbiddenException('Only the Super Admin has authority to flush archived attendance records.');
    }

    const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.db.attendance.deleteMany({
      where: {
        agencyId: a.agencyId,
        checkInAt: { lt: cutoff90 }
      }
    });

    await this.db.atomic(async tx => {
      await audit(tx, a, 'attendance.archive_flushed', 'attendance', 'archive', {
        next: {
          flushedCount: result.count,
          cutoffDate: cutoff90.toISOString().slice(0, 10),
          flushedAt: new Date()
        }
      });
    });

    return {
      ok: true,
      flushedCount: result.count,
      message: `Successfully flushed ${result.count} attendance record${result.count === 1 ? '' : 's'} older than 3 months.`
    };
  }

  @Get('export')
  async export(
    @CurrentActor() a: Actor,
    @Res() res: Response,
    @Query('range') range = 'all',
    @Query('userId') userId?: string
  ) {
    this.access.internal(a);
    const canManage = isAdminOrSuperAdmin(a) || has(a, 'employee.manage');
    if (!canManage) {
      userId = a.id; // Enforce self-export for employees
    }

    const where: any = { agencyId: a.agencyId };
    if (userId) where.userId = userId;

    if (range === 'olderThan90Days') {
      const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      where.checkInAt = { lt: cutoff90 };
    } else if (range === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      where.date = { gte: firstDay };
    }

    const records = await this.db.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: { select: { name: true } }
          }
        }
      },
      orderBy: { checkInAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MAD O MEDIA • Agency OS';
    workbook.lastModifiedBy = a.name;
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetTitle = range === 'olderThan90Days'
      ? '3-Month Attendance Archive'
      : range === 'month'
      ? 'Monthly Attendance'
      : 'Attendance Records';

    const worksheet = workbook.addWorksheet(sheetTitle, {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Employee Name', key: 'name', width: 24 },
      { header: 'Email Address', key: 'email', width: 28 },
      { header: 'Designation / Role', key: 'role', width: 20 },
      { header: 'Attendance Status', key: 'status', width: 18 },
      { header: 'Check In Time', key: 'checkInTime', width: 18 },
      { header: 'Check Out Time', key: 'checkOutTime', width: 18 },
      { header: 'Working Hours', key: 'workingHours', width: 18 },
      { header: 'Check In Geotag Address', key: 'address', width: 38 },
      { header: 'Check In Coordinates', key: 'coords', width: 24 },
      { header: 'GPS Accuracy (m)', key: 'accuracy', width: 16 },
      { header: 'Check Out Geotag Address', key: 'outAddress', width: 38 },
      { header: 'Check Out Coordinates', key: 'outCoords', width: 24 },
      { header: 'Network IP Address', key: 'ipAddress', width: 20 },
      { header: 'Browser / Device Info', key: 'deviceInfo', width: 30 },
      { header: 'Notes & Remarks', key: 'notes', width: 30 },
    ];

    // Style the Header Row (Mad O Media Sleek Dark Header)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' } // Dark Slate 900
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    // Add rows
    records.forEach((r, idx) => {
      const isEven = idx % 2 === 0;
      const coords = r.latitude && r.longitude ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : '-';
      const outCoords = r.outLatitude && r.outLongitude ? `${r.outLatitude.toFixed(6)}, ${r.outLongitude.toFixed(6)}` : '-';
      const workHours = calculateWorkingHours(r.checkInAt, r.checkOutAt);

      const row = worksheet.addRow({
        date: r.date,
        name: r.user.name,
        email: r.user.email,
        role: r.user.role?.name || 'Employee',
        status: r.status,
        checkInTime: formatTime(r.checkInAt),
        checkOutTime: formatTime(r.checkOutAt),
        workingHours: workHours,
        address: r.address || '-',
        coords,
        accuracy: r.accuracy ? `${Math.round(r.accuracy)} m` : '-',
        outAddress: r.outAddress || '-',
        outCoords,
        ipAddress: r.ipAddress || '-',
        deviceInfo: r.deviceInfo || '-',
        notes: r.notes || '-',
      });

      row.height = 24;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 5, 6, 7, 8, 10, 11, 13, 14].includes(colNumber) ? 'center' : 'left'
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (!isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' } // light zebra stripe
          };
        }

        // Color badge for status
        if (colNumber === 5) {
          if (r.status === 'PRESENT') {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF15803D' } };
          } else if (r.status === 'LATE') {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB45309' } };
          } else if (r.status === 'HALF_DAY') {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF4338CA' } };
          }
        }
      });
    });

    const todayStr = getTodayDateString();
    const filename = range === 'olderThan90Days'
      ? `Mad_O_Media_Attendance_Archive_90Days_${todayStr}.xlsx`
      : `Mad_O_Media_Attendance_Report_${todayStr}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(Buffer.from(buffer));
  }
}

@Module({
  controllers: [AttendanceController],
  exports: [],
})
export class AttendanceModule {}
