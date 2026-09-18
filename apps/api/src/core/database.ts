import { Global, Injectable, Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { hashPassword } from '../auth/password';
import fs from 'node:fs';
import path from 'node:path';

@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.ensureSchemaAndAdmin();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async atomic<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T> {
    for(let attempt=0; ; attempt++) {
      try { return await this.$transaction(fn,{ isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:20000 }); }
      catch(e:any) { if(e.code!=='P2034'||attempt>=2) throw e; }
    }
  }

  private async ensureSchemaAndAdmin() {
    try {
      const tables: any[] = await this.$queryRawUnsafe(
        "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User'"
      );

      if (!tables || tables.length === 0) {
        console.log('[Agency OS] Database schema missing in MySQL. Applying migration DDL directly...');
        await this.applyMigrationSql();
      } else {
        console.log('[Agency OS] Database schema verified in MySQL.');
      }

      await this.ensureSuperAdmin();
    } catch (err: any) {
      console.warn('[Agency OS] Schema check notice:', err.message);
      try {
        await this.applyMigrationSql();
        await this.ensureSuperAdmin();
      } catch (innerErr: any) {
        console.warn('[Agency OS] Direct DDL notice:', innerErr.message);
      }
    }
  }

  private async applyMigrationSql() {
    const candidates = [
      path.resolve(process.cwd(), 'prisma/migrations/202609160001_initial/migration.sql'),
      path.resolve(process.cwd(), '.next/standalone/prisma/migrations/202609160001_initial/migration.sql'),
      path.resolve(__dirname, '../../../../prisma/migrations/202609160001_initial/migration.sql'),
      path.resolve(__dirname, '../../../prisma/migrations/202609160001_initial/migration.sql'),
      path.resolve(__dirname, '../../prisma/migrations/202609160001_initial/migration.sql'),
      path.resolve(__dirname, '../prisma/migrations/202609160001_initial/migration.sql')
    ];
    const target = candidates.find(c => fs.existsSync(c));
    if (!target) {
      console.warn('[Agency OS] Could not find migration.sql in candidates:', candidates);
      return;
    }

    const content = fs.readFileSync(target, 'utf8');
    const statements = content
      .split(';')
      .map(s => s.replace(/--.*$/gm, '').trim())
      .filter(s => s.length > 0);

    console.log(`[Agency OS] Applying ${statements.length} DDL statements directly to MySQL...`);
    for (const stmt of statements) {
      try {
        await this.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('Duplicate')) {
          console.warn('[Agency OS] DDL notice:', err.message);
        }
      }
    }
    console.log('[Agency OS] All database tables successfully deployed.');
  }

  private async ensureSuperAdmin() {
    try {
      const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'rahil@mad0media.com').trim().toLowerCase();
      const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'MLjxodYKYAHY86fT!aA9';
      const adminName = (process.env.SEED_ADMIN_NAME || 'Rahil Lakhdawala').trim();

      const agency = await (this as any).agency.upsert({
        where: { id: 'mad-o-media' },
        create: { id: 'mad-o-media', name: 'Mad O Media', settings: { overdueEscalation: true } },
        update: { name: 'Mad O Media' }
      });

      const superAdminRole = await (this as any).role.upsert({
        where: { agencyId_systemKey: { agencyId: agency.id, systemKey: 'SUPER_ADMIN' } },
        create: {
          agencyId: agency.id,
          name: 'Super Admin',
          systemKey: 'SUPER_ADMIN',
          isSuperAdmin: true,
          isClient: false
        },
        update: {}
      });

      // Automatically migrate legacy admin account if present
      const legacyAdmin = await (this as any).user.findFirst({
        where: {
          OR: [
            { email: 'owner@agency.local' },
            { name: 'Aditya Khan' },
            { name: 'Rahil Lakhdawal' }
          ]
        }
      });
      if (legacyAdmin) {
        const targetAdmin = await (this as any).user.findFirst({ where: { email: adminEmail } });
        if (!targetAdmin || targetAdmin.id === legacyAdmin.id) {
          await (this as any).user.update({
            where: { id: legacyAdmin.id },
            data: { email: adminEmail, name: adminName }
          });
          console.log(`[Agency OS] Updated Super Admin: ${adminName} <${adminEmail}>`);
        }
      }

      const passwordHash = await hashPassword(adminPassword);
      await (this as any).user.upsert({
        where: { email: adminEmail },
        create: {
          agencyId: agency.id,
          name: adminName,
          email: adminEmail,
          passwordHash,
          roleId: superAdminRole.id,
          mustChangePassword: true,
          avatarColor: '#0284c7'
        },
        update: {
          name: adminName,
          roleId: superAdminRole.id,
          active: true,
          deletedAt: null
        }
      });
      console.log('[Agency OS] Master Super Admin verified and ready.');
    } catch (e: any) {
      console.warn('[Agency OS] Super admin verification notice:', e.message);
    }
  }
}
@Global() @Module({providers:[Database],exports:[Database]})
export class DatabaseModule {}

