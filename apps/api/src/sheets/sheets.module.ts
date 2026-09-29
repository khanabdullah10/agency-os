import { Body, Controller, Delete, Get, Module, OnModuleInit, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../core/database';
import { Access, CurrentActor } from '../core/security';
import { Actor } from '../core/types';
import fs from 'node:fs';
import path from 'node:path';

const defaultSheetData = {
  activeTab: 'tab_1',
  tabs: [
    {
      id: 'tab_1',
      name: 'Master Records',
      color: '#0f9d58',
      rowCount: 50,
      colCount: 20,
      colWidths: {
        A: 100,
        B: 240,
        C: 150,
        D: 180,
        E: 160,
        F: 130,
        G: 130,
        H: 130,
        I: 260,
      },
      data: {
        A1: { v: 'Record #', bold: true, bg: '#f1f5f9', align: 'center' },
        B1: { v: 'Task / Item Name', bold: true, bg: '#f1f5f9' },
        C1: { v: 'Category', bold: true, bg: '#f1f5f9' },
        D1: { v: 'Client / Account', bold: true, bg: '#f1f5f9' },
        E1: { v: 'Assigned To', bold: true, bg: '#f1f5f9' },
        F1: { v: 'Due Date', bold: true, bg: '#f1f5f9', align: 'center' },
        G1: { v: 'Budget ($)', bold: true, bg: '#f1f5f9', align: 'right' },
        H1: { v: 'Status', bold: true, bg: '#f1f5f9', align: 'center' },
        I1: { v: 'Notes & Drive Links', bold: true, bg: '#f1f5f9' },

        A2: { v: 'REC-001', align: 'center' },
        B2: { v: 'Brand Refresh & Color Palette' },
        C2: { v: 'Design' },
        D2: { v: 'Acme Corp' },
        E2: { v: 'Lead Designer' },
        F2: { v: '2026-10-05', align: 'center' },
        G2: { v: '1200', align: 'right' },
        H2: { v: 'In Progress', align: 'center', bg: '#fef3c7', color: '#b45309' },
        I2: { v: 'Drafting guidelines in Drive' },

        A3: { v: 'REC-002', align: 'center' },
        B3: { v: 'October Reel Scripts (4x)' },
        C3: { v: 'Content' },
        D3: { v: 'Zenith Labs' },
        E3: { v: 'Copywriter' },
        F3: { v: '2026-10-08', align: 'center' },
        G3: { v: '800', align: 'right' },
        H3: { v: 'Approved', align: 'center', bg: '#dcfce7', color: '#15803d' },
        I3: { v: 'Ready for video shoot' },

        A4: { v: 'REC-003', align: 'center' },
        B4: { v: 'Performance Ad Campaign Q4' },
        C4: { v: 'Marketing' },
        D4: { v: 'Aura Fitness' },
        E4: { v: 'Media Buyer' },
        F4: { v: '2026-10-12', align: 'center' },
        G4: { v: '2500', align: 'right' },
        H4: { v: 'Pending Review', align: 'center', bg: '#ede9fe', color: '#6d28d9' },
        I4: { v: 'Ad copy approved, assets pending' },

        A5: { v: 'REC-004', align: 'center' },
        B5: { v: 'Quarterly Influencer Collabs' },
        C5: { v: 'Outreach' },
        D5: { v: 'Glow Skincare' },
        E5: { v: 'SMM Team' },
        F5: { v: '2026-10-15', align: 'center' },
        G5: { v: '1500', align: 'right' },
        H5: { v: 'Planned', align: 'center', bg: '#e0f2fe', color: '#0369a1' },
        I5: { v: 'Shortlisting 10 creators' },

        A6: { v: 'Total Budget', bold: true, align: 'center' },
        B6: { v: '' },
        C6: { v: '' },
        D6: { v: '' },
        E6: { v: '' },
        F6: { v: '' },
        G6: { v: '=SUM(G2:G5)', bold: true, align: 'right', bg: '#f8fafc' },
        H6: { v: '' },
        I6: { v: '' },
      },
    },
    {
      id: 'tab_2',
      name: 'Client Deliverables',
      color: '#3b82f6',
      rowCount: 50,
      colCount: 20,
      colWidths: { A: 120, B: 240, C: 160, D: 140, E: 140, F: 200 },
      data: {
        A1: { v: 'Client Code', bold: true, bg: '#f1f5f9' },
        B1: { v: 'Deliverable Title', bold: true, bg: '#f1f5f9' },
        C1: { v: 'Platform', bold: true, bg: '#f1f5f9' },
        D1: { v: 'Target Date', bold: true, bg: '#f1f5f9', align: 'center' },
        E1: { v: 'Status', bold: true, bg: '#f1f5f9', align: 'center' },
        F1: { v: 'Link / Reference', bold: true, bg: '#f1f5f9' },
      },
    },
  ],
};

@Controller('sheets')
export class SheetsController implements OnModuleInit {
  private fallbackDir: string;

  constructor(private db: Database, private access: Access) {
    this.fallbackDir = path.resolve(process.cwd(), '.sheets_cache');
    try {
      if (!fs.existsSync(this.fallbackDir)) {
        fs.mkdirSync(this.fallbackDir, { recursive: true });
      }
    } catch {}
  }

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    try {
      await (this.db as any).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`Spreadsheet\` (
          \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
          \`agencyId\` VARCHAR(191) NOT NULL,
          \`title\` VARCHAR(191) NOT NULL DEFAULT 'Master Records',
          \`data\` LONGTEXT NOT NULL,
          \`updatedBy\` VARCHAR(191) NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          INDEX \`Spreadsheet_agencyId_idx\` (\`agencyId\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (e: any) {
      // Table check warning logged silently for dev offline mode
    }
  }

  private getFallbackFile(agencyId: string, id: string): string {
    return path.join(this.fallbackDir, `${agencyId}_${id}.json`);
  }

  @Get()
  async list(@CurrentActor() a: Actor) {
    this.access.internal(a);
    let items: any[] = [];
    try {
      items = await (this.db as any).$queryRawUnsafe(
        'SELECT id, agencyId, title, updatedBy, createdAt, updatedAt FROM `Spreadsheet` WHERE agencyId = ? ORDER BY updatedAt DESC',
        a.agencyId
      );
    } catch {}

    // Fallback file check if DB query had no items or wasn't connected
    if (!items || items.length === 0) {
      try {
        const files = fs.readdirSync(this.fallbackDir);
        for (const file of files) {
          if (file.startsWith(a.agencyId + '_') && file.endsWith('.json')) {
            const raw = fs.readFileSync(path.join(this.fallbackDir, file), 'utf8');
            const parsed = JSON.parse(raw);
            items.push({
              id: parsed.id,
              agencyId: parsed.agencyId,
              title: parsed.title,
              updatedBy: parsed.updatedBy,
              updatedAt: parsed.updatedAt || new Date().toISOString(),
            });
          }
        }
      } catch {}
    }

    // If still no spreadsheets exist for this agency, initialize default Master Records
    if (!items || items.length === 0) {
      const defaultId = 'sheet_master';
      const initial = {
        id: defaultId,
        agencyId: a.agencyId,
        title: 'Master Records',
        data: JSON.stringify(defaultSheetData),
        updatedBy: a.name,
      };

      try {
        await (this.db as any).$executeRawUnsafe(
          'INSERT INTO `Spreadsheet` (id, agencyId, title, data, updatedBy) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title)',
          initial.id,
          initial.agencyId,
          initial.title,
          initial.data,
          initial.updatedBy
        );
      } catch {}

      try {
        fs.writeFileSync(this.getFallbackFile(a.agencyId, defaultId), JSON.stringify(initial), 'utf8');
      } catch {}

      items = [{
        id: defaultId,
        agencyId: a.agencyId,
        title: 'Master Records',
        updatedBy: a.name,
        updatedAt: new Date().toISOString(),
      }];
    }

    return items;
  }

  @Get(':id')
  async get(@CurrentActor() a: Actor, @Param('id') id: string) {
    this.access.internal(a);
    let record: any = null;
    try {
      const rows: any[] = await (this.db as any).$queryRawUnsafe(
        'SELECT * FROM `Spreadsheet` WHERE id = ? AND agencyId = ? LIMIT 1',
        id,
        a.agencyId
      );
      if (rows && rows.length > 0) record = rows[0];
    } catch {}

    if (!record) {
      try {
        const raw = fs.readFileSync(this.getFallbackFile(a.agencyId, id), 'utf8');
        record = JSON.parse(raw);
      } catch {}
    }

    if (!record && id === 'sheet_master') {
      // Re-seed default
      record = {
        id: 'sheet_master',
        agencyId: a.agencyId,
        title: 'Master Records',
        data: JSON.stringify(defaultSheetData),
        updatedBy: a.name,
        updatedAt: new Date().toISOString(),
      };
      try {
        await (this.db as any).$executeRawUnsafe(
          'INSERT INTO `Spreadsheet` (id, agencyId, title, data, updatedBy) VALUES (?, ?, ?, ?, ?)',
          record.id,
          record.agencyId,
          record.title,
          record.data,
          record.updatedBy
        );
      } catch {}
      try {
        fs.writeFileSync(this.getFallbackFile(a.agencyId, id), JSON.stringify(record), 'utf8');
      } catch {}
    }

    if (!record) {
      return {
        id,
        agencyId: a.agencyId,
        title: 'Records Sheet',
        data: defaultSheetData,
        updatedBy: a.name,
        updatedAt: new Date().toISOString(),
      };
    }

    let parsedData = defaultSheetData;
    if (typeof record.data === 'string') {
      try {
        parsedData = JSON.parse(record.data);
      } catch {
        parsedData = defaultSheetData;
      }
    } else if (record.data && typeof record.data === 'object') {
      parsedData = record.data;
    }

    return {
      id: record.id,
      agencyId: record.agencyId,
      title: record.title,
      data: parsedData,
      updatedBy: record.updatedBy,
      updatedAt: record.updatedAt,
    };
  }

  @Put(':id')
  async update(@CurrentActor() a: Actor, @Param('id') id: string, @Body() raw: unknown) {
    this.access.internal(a);
    const body = z.object({
      title: z.string().min(1).max(150).optional(),
      data: z.any(),
    }).parse(raw);

    const title = body.title || 'Master Records';
    const dataString = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);
    const now = new Date();

    try {
      await (this.db as any).$executeRawUnsafe(
        'INSERT INTO `Spreadsheet` (id, agencyId, title, data, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE title = VALUES(title), data = VALUES(data), updatedBy = VALUES(updatedBy), updatedAt = VALUES(updatedAt)',
        id,
        a.agencyId,
        title,
        dataString,
        a.name,
        now
      );
    } catch (e: any) {
      // Direct DDL/table recreation attempt if missing
      try {
        await this.ensureTable();
        await (this.db as any).$executeRawUnsafe(
          'INSERT INTO `Spreadsheet` (id, agencyId, title, data, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ' +
          'ON DUPLICATE KEY UPDATE title = VALUES(title), data = VALUES(data), updatedBy = VALUES(updatedBy), updatedAt = VALUES(updatedAt)',
          id,
          a.agencyId,
          title,
          dataString,
          a.name,
          now
        );
      } catch {}
    }

    try {
      fs.writeFileSync(
        this.getFallbackFile(a.agencyId, id),
        JSON.stringify({
          id,
          agencyId: a.agencyId,
          title,
          data: body.data,
          updatedBy: a.name,
          updatedAt: now.toISOString(),
        }),
        'utf8'
      );
    } catch {}

    return {
      id,
      title,
      updatedBy: a.name,
      updatedAt: now.toISOString(),
      ok: true,
    };
  }

  @Post()
  async create(@CurrentActor() a: Actor, @Body() raw: unknown) {
    this.access.internal(a);
    const body = z.object({
      title: z.string().min(1).max(150),
      template: z.string().optional(),
    }).parse(raw);

    const newId = 'sheet_' + Math.random().toString(36).substring(2, 10);
    const now = new Date();
    const data = JSON.parse(JSON.stringify(defaultSheetData));
    data.tabs[0].name = body.title;

    try {
      await (this.db as any).$executeRawUnsafe(
        'INSERT INTO `Spreadsheet` (id, agencyId, title, data, updatedBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        newId,
        a.agencyId,
        body.title,
        JSON.stringify(data),
        a.name,
        now,
        now
      );
    } catch {}

    try {
      fs.writeFileSync(
        this.getFallbackFile(a.agencyId, newId),
        JSON.stringify({
          id: newId,
          agencyId: a.agencyId,
          title: body.title,
          data,
          updatedBy: a.name,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
        'utf8'
      );
    } catch {}

    return {
      id: newId,
      title: body.title,
      updatedBy: a.name,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  @Delete(':id')
  async delete(@CurrentActor() a: Actor, @Param('id') id: string) {
    this.access.internal(a);
    try {
      await (this.db as any).$executeRawUnsafe(
        'DELETE FROM `Spreadsheet` WHERE id = ? AND agencyId = ?',
        id,
        a.agencyId
      );
    } catch {}

    try {
      const f = this.getFallbackFile(a.agencyId, id);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}

    return { ok: true, id };
  }
}

@Module({
  controllers: [SheetsController],
})
export class SheetsModule {}
