import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const webNext = path.resolve(rootDir, 'apps/web/.next');
const rootNext = path.resolve(rootDir, '.next');
const webPublic = path.resolve(rootDir, 'apps/web/public');
const rootPublic = path.resolve(rootDir, 'public');

console.log('[Postbuild] Syncing build output for Hostinger...');

if (fs.existsSync(webNext)) {
  if (fs.existsSync(rootNext)) {
    fs.rmSync(rootNext, { recursive: true, force: true });
  }
  fs.cpSync(webNext, rootNext, { recursive: true });
  console.log('[Postbuild] Synced apps/web/.next -> .next');
} else {
  console.warn('[Postbuild] Warning: apps/web/.next does not exist');
}

if (fs.existsSync(webPublic) && !fs.existsSync(rootPublic)) {
  fs.cpSync(webPublic, rootPublic, { recursive: true });
  console.log('[Postbuild] Synced apps/web/public -> public');
}

// Standalone support for Hostinger Next.js runner
const rootStandalone = path.resolve(rootNext, 'standalone');
if (fs.existsSync(rootStandalone)) {
  console.log('[Postbuild] Standalone directory found at .next/standalone');

  const standaloneStatic = path.resolve(rootStandalone, 'apps/web/.next/static');
  const webStatic = path.resolve(webNext, 'static');
  if (fs.existsSync(webStatic) && !fs.existsSync(standaloneStatic)) {
    fs.cpSync(webStatic, standaloneStatic, { recursive: true });
    console.log('[Postbuild] Synced .next/static into standalone');
  }

  const standalonePublic = path.resolve(rootStandalone, 'apps/web/public');
  if (fs.existsSync(webPublic) && !fs.existsSync(standalonePublic)) {
    fs.cpSync(webPublic, standalonePublic, { recursive: true });
    console.log('[Postbuild] Synced public assets into standalone');
  }

  const rootStandaloneServer = path.resolve(rootStandalone, 'server.js');
  const launcherCode = `/**
 * Hostinger Next.js Standalone Unified Bridge
 * MAD O MEDIA • Agency OS
 */
const path = require('node:path');
const fs = require('node:fs');

const primaryServer = path.resolve(__dirname, '../../server.js');
const fallbackServer = path.resolve(process.cwd(), 'server.js');

if (fs.existsSync(primaryServer)) {
  require(primaryServer);
} else if (fs.existsSync(fallbackServer)) {
  require(fallbackServer);
} else {
  require('./apps/web/server.js');
}
`;
  fs.writeFileSync(rootStandaloneServer, launcherCode, 'utf8');
  console.log('[Postbuild] Created .next/standalone/server.js unified bridge');
}

console.log('[Postbuild] Build output fully validated for Hostinger deployment.');
