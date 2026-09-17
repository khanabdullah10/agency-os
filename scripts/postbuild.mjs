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

console.log('[Postbuild] Build output ready for deployment.');
