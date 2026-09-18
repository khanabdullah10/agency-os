/**
 * Hostinger Web App Production Entrypoint
 * MAD O MEDIA • Agency OS
 *
 * This file serves as the primary launcher for Hostinger's Node.js Web App environment.
 * It immediately binds to the required port within < 5ms to satisfy Hostinger's 3-second watchdog.
 */

require('dotenv').config();

const express = require('express');

// Enforce production defaults if not specified
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Ensure node_modules is resolvable from all potential runtime locations
const path = require('node:path');
const fs = require('node:fs');
const modulePaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules'),
  path.resolve(__dirname, '../../node_modules'),
  path.resolve(process.cwd(), 'node_modules'),
  path.resolve(process.cwd(), 'apps/api/node_modules')
];
for (const p of modulePaths) {
  if (fs.existsSync(p)) {
    process.env.NODE_PATH = [p, process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter);
  }
}
require('node:module').Module._initPaths();

// Support both numeric ports and Unix sockets (Passenger / Hostinger)
const rawPort = process.env.PORT || 3000;
const port = (/^\d+$/.test(rawPort)) ? Number(rawPort) : rawPort;

// Global error shields
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Agency OS] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Agency OS] Uncaught Exception:', error);
});

const server = express();
server.disable('x-powered-by');
server.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

let isReady = false;
let appRouter = null;

// Serve Next.js static chunks directly with strict MIME types and immutable caching
const staticCandidates = [
  path.resolve(__dirname, '.next/static'),
  path.resolve(__dirname, 'apps/web/.next/static'),
  path.resolve(process.cwd(), '.next/static'),
  path.resolve(process.cwd(), 'apps/web/.next/static')
];
for (const s of staticCandidates) {
  if (fs.existsSync(s)) {
    server.use('/_next/static', express.static(s, {
      maxAge: '365d',
      immutable: true,
      fallthrough: true
    }));
    break;
  }
}

// Serve public directory assets
const publicCandidates = [
  path.resolve(__dirname, 'public'),
  path.resolve(__dirname, 'apps/web/public'),
  path.resolve(process.cwd(), 'public'),
  path.resolve(process.cwd(), 'apps/web/public')
];
for (const p of publicCandidates) {
  if (fs.existsSync(p)) {
    server.use(express.static(p, {
      maxAge: '7d',
      fallthrough: true
    }));
    break;
  }
}

// Temporary gate while NestJS + Next.js prepare in background
server.use((req, res, next) => {
  if (isReady && appRouter) {
    return appRouter(req, res, next);
  }
  if (req.path === '/health' || req.path === '/api/health') {
    return res.status(200).json({ status: 'initializing' });
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2"></head><body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#09090b;color:#e4e4e7;margin:0;"><div style="text-align:center;"><div style="display:inline-block;width:32px;height:32px;border:3px solid #3f3f46;border-top-color:#e11d48;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px;"></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style><p style="margin:0;font-size:16px;font-weight:600;">Opening Agency OS...</p></div></body></html>');
});

// LISTEN IMMEDIATELY (< 5ms) TO SATISFY HOSTINGER 3-SECOND WATCHDOG
// Must listen on port without explicit host so Passenger intercepts correctly
const listener = server.listen(port, () => {
  console.log('----------------------------------------------------');
  console.log('  MAD O MEDIA • AGENCY OS PRODUCTION SERVER');
  console.log(`  Listening on: ${port} (Watchdog passed)`);
  console.log(`  Environment:  ${process.env.NODE_ENV}`);
  console.log(`  App URL:      ${process.env.APP_URL || 'Not configured'}`);
  console.log('----------------------------------------------------');
});

// Grant executable permissions to all Prisma engine binaries and CLI scripts
function fixPrismaPermissions() {
  const dirs = [
    path.resolve(__dirname, 'node_modules/@prisma'),
    path.resolve(__dirname, 'node_modules/.prisma'),
    path.resolve(__dirname, 'node_modules/prisma'),
    path.resolve(__dirname, 'node_modules/.bin'),
    path.resolve(process.cwd(), 'node_modules/@prisma'),
    path.resolve(process.cwd(), 'node_modules/.prisma'),
    path.resolve(process.cwd(), 'node_modules/prisma'),
    path.resolve(process.cwd(), 'node_modules/.bin')
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

  try {
    const { execSync } = require('node:child_process');
    execSync('chmod -R +x node_modules/@prisma node_modules/.prisma node_modules/prisma node_modules/.bin 2>/dev/null || true', { stdio: 'ignore' });
  } catch {}
}

// Fix permissions early for engine binaries
fixPrismaPermissions();

// Export mount interface
global.__AGENCY_OS_SERVER__ = server;
global.__AGENCY_OS_MOUNT__ = (router) => {
  appRouter = router;
  isReady = true;
  console.log('[Agency OS] Unified server fully mounted and active.');
};

// Now require the compiled backend asynchronously via setImmediate
// This decouples listen() from heavy module loading, guaranteeing Passenger watchdog passes in < 10ms
setImmediate(() => {
  try {
    fixPrismaPermissions();
    const candidates = [
      path.resolve(__dirname, 'apps/api/dist/main.js'),
      path.resolve(process.cwd(), 'apps/api/dist/main.js'),
      path.resolve(__dirname, '../api/dist/main.js'),
      path.resolve(__dirname, '../../apps/api/dist/main.js')
    ];
    const target = candidates.find(c => fs.existsSync(c));
    if (!target) {
      throw new Error('Could not find apps/api/dist/main.js in candidates: ' + JSON.stringify(candidates));
    }
    console.log('[Agency OS] Loading backend from:', target);
    require(target);
  } catch (err) {
    console.error('[Agency OS] Error loading backend:', err.stack || err);
  }
});

// Apply database migrations in the background so server.listen() is never delayed
if (process.env.DATABASE_URL) {
  setTimeout(() => {
    try {
      console.log('[Agency OS] Background: verifying database schema...');
      fixPrismaPermissions();

      const prismaCandidates = [
        path.resolve(__dirname, 'node_modules/prisma/build/index.js'),
        path.resolve(process.cwd(), 'node_modules/prisma/build/index.js'),
        path.resolve(__dirname, '../../node_modules/prisma/build/index.js')
      ];
      const prismaCli = prismaCandidates.find(p => fs.existsSync(p));
      const schemaCandidates = [
        path.resolve(__dirname, 'prisma/schema.prisma'),
        path.resolve(process.cwd(), 'prisma/schema.prisma'),
        path.resolve(__dirname, '../../prisma/schema.prisma')
      ];
      const schemaPath = schemaCandidates.find(p => fs.existsSync(p));
      const schemaArg = schemaPath ? ` --schema="${schemaPath}"` : '';

      const migrateCmd = prismaCli
        ? `"${process.execPath}" "${prismaCli}" migrate deploy${schemaArg}`
        : `npx prisma migrate deploy${schemaArg}`;

      const { exec } = require('node:child_process');

      const runBootstrap = () => {
        try {
          const bootstrapCandidates = [
            path.resolve(__dirname, 'scripts/bootstrap-production.mjs'),
            path.resolve(process.cwd(), 'scripts/bootstrap-production.mjs'),
            path.resolve(__dirname, '../../scripts/bootstrap-production.mjs')
          ];
          const bScript = bootstrapCandidates.find(p => fs.existsSync(p));
          if (bScript) {
            exec(`"${process.execPath}" "${bScript}"`, (bErr, bStdout, bStderr) => {
              if (bErr) {
                console.warn('[Agency OS] Notice: Bootstrap setup:', (bStderr || bStdout || bErr.message).trim());
              } else {
                console.log('[Agency OS] Master Super Admin account verified and ready.');
              }
            });
          }
        } catch (bErr) {
          console.warn('[Agency OS] Notice: Bootstrap setup:', bErr.message);
        }
      };

      exec(migrateCmd, (err, stdout, stderr) => {
        if (err) {
          console.warn('[Agency OS] Notice: Database migration deploy issue:', (stderr || stdout || err.message).trim());
          console.log('[Agency OS] Attempting database synchronization via db push fallback...');
          const pushCmd = prismaCli
            ? `"${process.execPath}" "${prismaCli}" db push --accept-data-loss${schemaArg}`
            : `npx prisma db push --accept-data-loss${schemaArg}`;
          exec(pushCmd, (pErr, pStdout, pStderr) => {
            if (pErr) {
              console.warn('[Agency OS] Notice: db push fallback failed:', (pStderr || pStdout || pErr.message).trim());
            } else {
              console.log('[Agency OS] Database schema synchronized via db push.');
              runBootstrap();
            }
          });
        } else {
          console.log('[Agency OS] Database schema verified and up-to-date.');
          runBootstrap();
        }
      });
    } catch (err) {
      console.warn('[Agency OS] Notice: Database migration check:', err.message);
    }
  }, 1500);
}
