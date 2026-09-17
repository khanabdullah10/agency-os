import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('====================================================');
  console.log('  MAD O MEDIA • PRODUCTION PRE-FLIGHT VERIFICATION');
  console.log('====================================================\n');

  let passed = true;
  const check = (label, ok, errText = '') => {
    if (ok) {
      console.log(`  [PASS] ${label}`);
    } else {
      console.log(`  [FAIL] ${label} -> ${errText}`);
      passed = false;
    }
  };

  // 1. Environment mode
  const isProd = process.env.NODE_ENV === 'production';
  check('Environment Mode', isProd, 'NODE_ENV should be set to "production".');

  // 2. App URL HTTPS check
  const appUrl = process.env.APP_URL || '';
  const isHttps = appUrl.startsWith('https://');
  check('Production Domain HTTPS', isHttps, `APP_URL must start with "https://" (Current: "${appUrl}")`);

  // 3. JWT_SECRET
  const jwt = process.env.JWT_SECRET || '';
  check('JWT_SECRET Strength', jwt.length >= 32, 'Must contain at least 32 characters. Run "npm run secrets:generate".');

  // 4. CRON_SECRET
  const cron = process.env.CRON_SECRET || '';
  check('CRON_SECRET Configured', cron.length >= 16, 'CRON_SECRET must be set. Run "npm run secrets:generate".');

  // 5. SEED_DEMO safety
  const noDemo = process.env.SEED_DEMO !== 'true';
  check('Zero-Demo Protection', noDemo, 'SEED_DEMO must be "false" for a clean production workspace.');

  // 6. Proxy Trust
  const proxy = Number(process.env.TRUST_PROXY || 0);
  check('Reverse Proxy Trust', proxy >= 1, 'TRUST_PROXY should be 1 behind Hostinger Nginx proxy.');

  // 7. Build Artifacts
  const apiDist = existsSync(path.resolve('apps/api/dist/main.js'));
  check('API Build Artifacts', apiDist, 'apps/api/dist/main.js not found. Run "npm run build".');

  const webDist = existsSync(path.resolve('apps/web/.next'));
  check('Web Build Artifacts', webDist, 'apps/web/.next not found. Run "npm run build".');

  // 8. Database Connection
  console.log('\nTesting Database Connectivity...');
  if (!process.env.DATABASE_URL) {
    check('Database URL', false, 'DATABASE_URL is missing.');
  } else {
    const db = new PrismaClient();
    try {
      await db.$connect();
      check('Hostinger MySQL Connection', true);
      const userCount = await db.user.count();
      const clientCount = await db.client.count();
      console.log(`  -> Connected successfully! Current DB stats: ${userCount} users, ${clientCount} clients.`);
    } catch (e) {
      check('Hostinger MySQL Connection', false, e.message);
    } finally {
      await db.$disconnect();
    }
  }

  console.log('\n====================================================');
  if (passed) {
    console.log('  ALL PRE-FLIGHT CHECKS PASSED! READY FOR PRODUCTION.');
  } else {
    console.log('  ATTENTION: Resolve failed items before going live.');
  }
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Pre-flight error:', err);
  process.exit(1);
});
