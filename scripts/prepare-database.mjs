import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const env={...process.env,PRISMA_SCHEMA_ENGINE_BINARY:path.resolve('node_modules/@prisma/engines/schema-engine-windows.exe'),PRISMA_QUERY_ENGINE_LIBRARY:path.resolve('node_modules/@prisma/engines/query_engine-windows.dll.node')};
if(process.platform!=='win32'){delete env.PRISMA_SCHEMA_ENGINE_BINARY;delete env.PRISMA_QUERY_ENGINE_LIBRARY;}
const run=(args)=>{const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js',...args],{encoding:'utf8',env,windowsHide:true});if(r.status!==0)throw new Error(r.stderr||r.error?.message||r.stdout);return r.stdout;};
const migration='prisma/migrations/202609160001_initial';
if(!existsSync(migration+'/migration.sql')){mkdirSync(migration,{recursive:true});writeFileSync(migration+'/migration.sql',run(['migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script']));}
console.log(run(['migrate','deploy']));
console.log(run(['generate']));
