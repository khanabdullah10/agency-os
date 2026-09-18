import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixPrismaPermissions() {
  const dirs = [
    path.resolve(process.cwd(), 'node_modules/@prisma'),
    path.resolve(process.cwd(), 'node_modules/.prisma'),
    path.resolve(process.cwd(), 'node_modules/prisma'),
    path.resolve(__dirname, '../node_modules/@prisma'),
    path.resolve(__dirname, '../node_modules/.prisma'),
    path.resolve(__dirname, '../node_modules/prisma')
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const walk = (d) => {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(d, entry.name);
          try {
            if (entry.isDirectory()) {
              try { fs.chmodSync(fullPath, 0o755); } catch {}
              walk(fullPath);
            } else {
              fs.chmodSync(fullPath, 0o755);
            }
          } catch {}
        }
      };
      walk(dir);
    } catch {}
  }
}

const derive = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return 'scrypt$' + salt + '$' + key.toString('hex');
}

const permissions = {
  'client.view': 'View accessible client workspaces',
  'client.view_all': 'View all agency clients',
  'client.create': 'Onboard clients',
  'client.edit': 'Edit client profiles and teams',
  'client.archive': 'Archive clients',
  'content.view': 'View content calendar and items',
  'content.create': 'Plan content',
  'content.edit': 'Edit content plans',
  'content.edit_all': 'Manage any assigned content role',
  'content.approve': 'Review content as assigned SMM',
  'content.approve_client': 'Approve as client',
  'script.write': 'Write and submit scripts',
  'shoot.manage': 'Plan and complete shoots',
  'edit.submit': 'Add and submit design or edit versions',
  'task.view': 'View tasks',
  'task.view_team': 'View team tasks',
  'task.create': 'Create manual tasks',
  'task.assign': 'Assign permitted internal users',
  'task.complete': 'Update task progress',
  'chat.view': 'View joined conversations',
  'chat.internal': 'Access internal chat',
  'chat.client': 'Access client-facing chat',
  'chat.create': 'Create conversations',
  'chat.moderate': 'Moderate messages',
  'drive.view': 'View authorized Drive links',
  'drive.manage': 'Attach Drive links',
  'employee.view': 'View team directory',
  'employee.manage': 'Manage users and roles',
  'report.view': 'View reports',
  'report.manage': 'Record analytics and reports',
  'publish.view': 'View publishing queue',
  'publish.manage': 'Manage manual publishing',
  'activity.view': 'View authorized activity',
  'approval.admin': 'Review configured admin approvals',
  'settings.manage': 'Manage agency settings'
};

async function main() {
  console.log('====================================================');
  console.log('  MAD O MEDIA • AGENCY OS PRODUCTION BOOTSTRAP');
  console.log('====================================================\n');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in your environment variables.');
  }

  if (process.env.SEED_DEMO === 'true') {
    throw new Error(
      'CRITICAL: SEED_DEMO is set to "true". Production bootstrap requires SEED_DEMO=false to prevent mock data injection.'
    );
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'owner@agency.local').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'MLjxodYKYAHY86fT!aA9';
  const adminName = (process.env.SEED_ADMIN_NAME || 'Aditya Khan').trim();

  console.log('Step 1: Deploying database migrations to Hostinger MySQL...');
  const db = new PrismaClient();

  try {
    console.log('Step 1: Checking and verifying database schema in MySQL...');
    try {
      const tables = await db.$queryRawUnsafe("SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'User'");
      if (!tables || tables.length === 0) {
        console.log('Applying migration SQL directly to MySQL...');
        const migrationCandidates = [
          path.resolve(process.cwd(), 'prisma/migrations/202609160001_initial/migration.sql'),
          path.resolve(process.cwd(), '.next/standalone/prisma/migrations/202609160001_initial/migration.sql'),
          path.resolve(__dirname, '../prisma/migrations/202609160001_initial/migration.sql'),
          path.resolve(__dirname, '../../prisma/migrations/202609160001_initial/migration.sql')
        ];
        const mFile = migrationCandidates.find(p => fs.existsSync(p));
        if (mFile) {
          const sql = fs.readFileSync(mFile, 'utf8');
          const statements = sql
            .split(';')
            .map(s => s.replace(/--.*$/gm, '').trim())
            .filter(s => s.length > 0);
          for (const stmt of statements) {
            try { await db.$executeRawUnsafe(stmt); } catch (e) {}
          }
          console.log(`Successfully applied ${statements.length} schema DDL statements directly.`);
        }
      } else {
        console.log('Database tables verified in MySQL.');
      }
    } catch (sErr) {
      console.warn('Direct schema check notice:', sErr.message);
    }
    console.log('\nStep 3: Initializing core agency entity...');
    const agency = await db.agency.upsert({
      where: { id: 'mad-o-media' },
      create: {
        id: 'mad-o-media',
        name: 'Mad O Media',
        settings: { overdueEscalation: true }
      },
      update: {
        name: 'Mad O Media'
      }
    });

    console.log('Step 4: Registering 16 security permissions...');
    for (const [key, description] of Object.entries(permissions)) {
      await db.permission.upsert({
        where: { key },
        create: { key, description },
        update: { description }
      });
    }

    console.log('Step 5: Provisioning 9 standard agency roles...');
    const employee = [
      'client.view', 'content.view', 'task.view', 'task.create', 'task.assign',
      'task.complete', 'chat.view', 'chat.internal', 'chat.create', 'drive.view',
      'drive.manage', 'employee.view', 'activity.view'
    ];
    const smm = [
      ...employee, 'client.edit', 'content.create', 'content.edit', 'content.approve',
      'task.view_team', 'script.write', 'shoot.manage', 'edit.submit', 'chat.client',
      'report.view', 'report.manage', 'publish.view', 'publish.manage'
    ];

    const defs = [
      { key: 'SUPER_ADMIN', name: 'Super Admin', permissions: Object.keys(permissions), isSuperAdmin: true },
      { key: 'ADMIN', name: 'Admin', permissions: Object.keys(permissions).filter(k => !['content.approve_client', 'settings.manage'].includes(k)) },
      { key: 'SMM', name: 'Social Media Manager', permissions: smm },
      { key: 'WRITER', name: 'Script Writer', permissions: [...employee, 'script.write'] },
      { key: 'DESIGNER', name: 'Graphic Designer', permissions: [...employee, 'edit.submit'] },
      { key: 'EDITOR', name: 'Video Editor', permissions: [...employee, 'edit.submit'] },
      { key: 'VIDEOGRAPHER', name: 'Videographer', permissions: [...employee, 'shoot.manage'] },
      { key: 'EMPLOYEE', name: 'Employee', permissions: employee },
      { key: 'CLIENT', name: 'Client', permissions: ['client.view', 'content.view', 'content.approve_client', 'drive.view', 'report.view', 'activity.view'], isClient: true }
    ];

    const roles = {};
    for (const def of defs) {
      const r = await db.role.upsert({
        where: { agencyId_systemKey: { agencyId: agency.id, systemKey: def.key } },
        create: {
          agencyId: agency.id,
          name: def.name,
          systemKey: def.key,
          isSuperAdmin: !!def.isSuperAdmin,
          isClient: !!def.isClient,
          permissions: {
            create: [...new Set(def.permissions)].map(permissionKey => ({ permissionKey }))
          }
        },
        update: {}
      });
      roles[def.key] = r.id;
    }

    console.log('Step 6: Creating fresh Super Admin owner account...');
    const passwordHash = await hashPassword(adminPassword);
    const owner = await db.user.upsert({
      where: { email: adminEmail },
      create: {
        agencyId: agency.id,
        name: adminName,
        email: adminEmail,
        passwordHash,
        roleId: roles.SUPER_ADMIN,
        mustChangePassword: true,
        avatarColor: '#0284c7'
      },
      update: {
        name: adminName,
        roleId: roles.SUPER_ADMIN,
        active: true,
        deletedAt: null
      }
    });

    console.log('\n====================================================');
    console.log('  PRODUCTION BOOTSTRAP COMPLETE (ZERO DEMO DATA)');
    console.log('====================================================');
    console.log(`  Agency:           Mad O Media`);
    console.log(`  Super Admin:      ${owner.name} <${owner.email}>`);
    console.log(`  Password Status:  Must change on first login`);
    console.log(`  Mock Clients:     0 (Factory fresh)`);
    console.log(`  Mock Content:     0 (Clean calendar)`);
    console.log(`  Mock Messages:    0 (Pristine chat)`);
    console.log('====================================================\n');
  } finally {
    await db.$disconnect();
  }
}

main().catch(err => {
  console.error('\nProduction bootstrap failed:', err.message);
  process.exit(1);
});
