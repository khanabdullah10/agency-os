import { existsSync, mkdirSync, writeFileSync, readFileSync, openSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const root=process.cwd(),runtime=path.join(root,'.runtime'),data=path.join(runtime,'mysql-data');
mkdirSync(runtime,{recursive:true});
const base=process.env.MYSQL_BASE_DIR||'C:/Program Files/MySQL/MySQL Server 8.0';
const daemon=path.join(base,'bin/mysqld.exe'),client=path.join(base,'bin/mysql.exe');
if(!existsSync(daemon))throw new Error('Set MYSQL_BASE_DIR to a MySQL 8 installation, or configure DATABASE_URL in .env and run db:migrate.');
const accessPath=path.join(runtime,'mysql-access.cnf'),envPath=path.join(root,'.env');
let fresh=!existsSync(path.join(data,'mysql'));
if(fresh) {
 const init=spawnSync(daemon,['--no-defaults','--initialize-insecure','--basedir='+base,'--datadir='+data],{encoding:'utf8',windowsHide:true});
 if(init.status!==0)throw new Error('MySQL initialization failed. '+init.stderr);
}
const check=()=>spawnSync(client,existsSync(accessPath)?['--defaults-extra-file='+accessPath,'--execute=SELECT 1']:['--no-defaults','--host=127.0.0.1','--port=3311','--user=root','--execute=SELECT 1'],{encoding:'utf8',windowsHide:true});
if(check().status!==0){
 const log=openSync(path.join(runtime,'mysql.log'),'a');
 const child=spawn(daemon,['--no-defaults','--basedir='+base,'--datadir='+data,'--port=3311','--bind-address=127.0.0.1','--mysqlx=OFF','--skip-log-bin','--innodb-buffer-pool-size=64M'],{detached:true,windowsHide:true,stdio:['ignore',log,log]});
 child.unref();writeFileSync(path.join(runtime,'mysql-process.json'),JSON.stringify({pid:child.pid,port:3311,dataDirectory:data}));
 let ready=false;for(let i=0;i<30;i++){if(check().status===0){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}
 if(!ready)throw new Error('Local MySQL did not start. See .runtime/mysql.log');
}
if(fresh){
 const rootPass=randomBytes(24).toString('hex'),appPass=randomBytes(24).toString('hex');
 const sql="CREATE DATABASE agency_os CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'agency_os'@'127.0.0.1' IDENTIFIED BY '"+appPass+"'; GRANT ALL PRIVILEGES ON agency_os.* TO 'agency_os'@'127.0.0.1'; ALTER USER 'root'@'localhost' IDENTIFIED BY '"+rootPass+"';";
 const result=spawnSync(client,['--no-defaults','--host=127.0.0.1','--port=3311','--user=root'],{input:sql,encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw new Error('Local database setup failed. '+result.stderr);
 writeFileSync(accessPath,'[client]\nhost=127.0.0.1\nport=3311\nuser=root\npassword='+rootPass+'\n');
 if(!existsSync(envPath)){
  const password=randomBytes(12).toString('base64url')+'!aA9';
  writeFileSync(envPath,['NODE_ENV=development','PORT=3100','APP_URL=http://localhost:3100','BIND_HOST=127.0.0.1','DATABASE_URL=mysql://agency_os:'+appPass+'@127.0.0.1:3311/agency_os','JWT_SECRET='+randomBytes(48).toString('hex'),'CRON_SECRET='+randomBytes(32).toString('hex'),'SEED_ADMIN_EMAIL=rahil@mad0media.com','SEED_ADMIN_NAME=Rahil Lakhdawala','SEED_ADMIN_PASSWORD='+password,'SEED_DEMO=true','DEMO_PASSWORD='+password,'TRUST_PROXY=0'].join('\n')+'\n');
  writeFileSync(path.join(runtime,'LOCAL_ACCESS.md'),'# Local Agency OS access\n\nURL: http://localhost:3100\n\nOwner: owner@agency.local\n\nTemporary local password: '+password+'\n\nOther local accounts use the same generated password: admin@agency.local, smm@agency.local, writer@agency.local, designer@agency.local, editor@agency.local, shooter@agency.local, client@agency.local, client2@agency.local.\n\nThese are fictional development accounts. This file and .env are excluded from Git.\n');
 }
}
console.log('Isolated MySQL database ready on 127.0.0.1:3311. Local access details are in .runtime/LOCAL_ACCESS.md.');

