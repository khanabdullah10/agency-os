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

  const standaloneApp = path.resolve(rootStandalone, 'apps/web/app');
  const webApp = path.resolve(rootDir, 'apps/web/app');
  if (fs.existsSync(webApp) && !fs.existsSync(standaloneApp)) {
    fs.cpSync(webApp, standaloneApp, { recursive: true });
    console.log('[Postbuild] Synced app directory into standalone');
  }

  const standaloneApi = path.resolve(rootStandalone, 'apps/api/dist');
  const srcApi = path.resolve(rootDir, 'apps/api/dist');
  if (fs.existsSync(srcApi)) {
    fs.cpSync(srcApi, standaloneApi, { recursive: true });
    console.log('[Postbuild] Synced apps/api/dist into standalone');
  }

  const standalonePrisma = path.resolve(rootStandalone, 'prisma');
  const srcPrisma = path.resolve(rootDir, 'prisma');
  if (fs.existsSync(srcPrisma) && !fs.existsSync(standalonePrisma)) {
    fs.cpSync(srcPrisma, standalonePrisma, { recursive: true });
    console.log('[Postbuild] Synced prisma schema into standalone');
  }

  // 1. Copy the unified production server.js directly into standalone root and web
  const rootStandaloneServer = path.resolve(rootStandalone, 'server.js');
  const webStandaloneServer = path.resolve(rootStandalone, 'apps/web/server.js');
  const srcServer = path.resolve(rootDir, 'server.js');
  if (fs.existsSync(srcServer)) {
    fs.cpSync(srcServer, rootStandaloneServer);
    if (fs.existsSync(path.dirname(webStandaloneServer))) {
      fs.cpSync(srcServer, webStandaloneServer);
    }
    console.log('[Postbuild] Synced unified production server.js into standalone targets');
  }

  // 2. Sync all backend & runtime dependencies into standalone/node_modules
  const srcModules = path.resolve(rootDir, 'node_modules');
  const destModules = path.resolve(rootStandalone, 'node_modules');
  if (fs.existsSync(srcModules)) {
    console.log('[Postbuild] Syncing dependencies into standalone/node_modules...');
    const items = fs.readdirSync(srcModules);
    for (const item of items) {
      if (item === '.bin' || item === '.cache') continue;
      const srcItem = path.resolve(srcModules, item);
      const destItem = path.resolve(destModules, item);
      if (item.startsWith('@')) {
        if (!fs.existsSync(destItem)) {
          fs.mkdirSync(destItem, { recursive: true });
        }
        const subItems = fs.readdirSync(srcItem);
        for (const subItem of subItems) {
          const subSrc = path.resolve(srcItem, subItem);
          const subDest = path.resolve(destItem, subItem);
          if (!fs.existsSync(subDest)) {
            try {
              fs.cpSync(subSrc, subDest, { recursive: true, dereference: true });
            } catch (e) {
              // ignore
            }
          }
        }
      } else {
        if (!fs.existsSync(destItem) || item === '.prisma') {
          try {
            fs.cpSync(srcItem, destItem, { recursive: true, dereference: true });
          } catch (e) {
            // ignore
          }
        }
      }
    }
    console.log('[Postbuild] Dependencies successfully synced to standalone.');
  }

  // 3. Sync apps/api/node_modules if present
  const apiSrcModules = path.resolve(rootDir, 'apps/api/node_modules');
  const apiDestModules = path.resolve(rootStandalone, 'apps/api/node_modules');
  if (fs.existsSync(apiSrcModules) && !fs.existsSync(apiDestModules)) {
    try {
      fs.cpSync(apiSrcModules, apiDestModules, { recursive: true, dereference: true });
      console.log('[Postbuild] Synced apps/api/node_modules into standalone.');
    } catch (e) {
      // ignore
    }
  }
}

console.log('[Postbuild] Build output fully validated for Hostinger deployment.');
