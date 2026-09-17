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

// Ensure root node_modules is always resolvable
const path = require('node:path');
const rootModules = path.resolve(__dirname, 'node_modules');
if (require('node:fs').existsSync(rootModules)) {
  process.env.NODE_PATH = [rootModules, process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter);
  require('node:module').Module._initPaths();
}

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
  console.log(`  Listening on: ${port}`);
  console.log(`  Environment:  ${process.env.NODE_ENV}`);
  console.log(`  App URL:      ${process.env.APP_URL || 'Not configured'}`);
  console.log('----------------------------------------------------');
});

// Export mount interface
global.__AGENCY_OS_SERVER__ = server;
global.__AGENCY_OS_MOUNT__ = (router) => {
  appRouter = router;
  isReady = true;
  console.log('[Agency OS] Unified server fully mounted and active.');
};

// Now require the compiled backend
require('./apps/api/dist/main.js');

// Apply database migrations in the background so server.listen() is never delayed
if (process.env.DATABASE_URL) {
  setTimeout(() => {
    try {
      console.log('[Agency OS] Background: verifying database schema...');
      const { exec } = require('node:child_process');
      exec('npx prisma migrate deploy', (err) => {
        if (err) {
          console.warn('[Agency OS] Notice: Database migration check:', err.message);
        } else {
          console.log('[Agency OS] Database schema verified and up-to-date.');
        }
      });
    } catch (err) {
      console.warn('[Agency OS] Notice: Database migration check:', err.message);
    }
  }, 2000);
}
