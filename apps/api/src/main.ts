import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import next from 'next';
import path from 'node:path';
import { AppModule } from './app.module';
import { Errors } from './core/errors';
async function bootstrap() {
 const production=process.env.NODE_ENV==='production';
 if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must contain at least 32 characters.');
 if(!process.env.APP_URL)throw new Error('APP_URL is required.');
 if(production&&!process.env.APP_URL.startsWith('https://'))throw new Error('Production APP_URL must use HTTPS.');
 const origin=new URL(process.env.APP_URL).origin,server=express(),api=express();
 server.disable('x-powered-by');
 server.set('trust proxy',Number(process.env.TRUST_PROXY||0));
 server.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'",...(!production?["'unsafe-eval'"]:[])],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:","https://drive.google.com"],fontSrc:["'self'","data:"],connectSrc:["'self'","https://*.pusher.com","wss://*.pusher.com",...(!production?["ws://localhost:*"]:[])],frameSrc:["https://drive.google.com","https://docs.google.com"],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"],upgradeInsecureRequests:production?[]:null}},strictTransportSecurity:production?{maxAge:31536000,includeSubDomains:true}:false}));
 api.set('trust proxy',Number(process.env.TRUST_PROXY||0));
 api.use(cookieParser());
 api.use(express.json({limit:'10mb'}));
 api.use(express.urlencoded({extended:false,limit:'10mb'}));
 api.use((_req: any, res: any, next: any)=>{res.setHeader('Cache-Control','no-store');next();});
 api.use(rateLimit({windowMs:60000,limit:Number(process.env.RATE_LIMIT_MAX||360),standardHeaders:'draft-8',legacyHeaders:false}));
 api.use('/auth/login',rateLimit({windowMs:15*60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many sign-in attempts. Try again in 15 minutes.'}}));
 api.use((req: any, res: any, next: any)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.path!=='/jobs/run') {
   if(req.headers['x-agency-request']!=='1'||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){res.status(403).json({message:'Request origin could not be verified.'});return;}
  }
  next();
 });
 const port = Number(process.env.PORT || 3000);
 const host = process.env.BIND_HOST || '0.0.0.0';

 let webHandler: any = null;
 server.use('/api', api);
 server.use((req: any, res: any, next: any) => {
  if (webHandler) return webHandler(req, res);
  if (req.path === '/health') return res.status(200).json({ status: 'initializing' });
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="2"></head><body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#09090b;color:#e4e4e7;margin:0;"><div style="text-align:center;"><div style="display:inline-block;width:32px;height:32px;border:3px solid #3f3f46;border-top-color:#e11d48;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px;"></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style><p style="margin:0;font-size:16px;font-weight:600;">Opening Agency OS...</p></div></body></html>');
 });

 const listener = server.listen(port, host, () => console.log(`Agency OS listening on ${host}:${port}`));

 const nest = await NestFactory.create(AppModule, new ExpressAdapter(api), { bodyParser: false, logger: ['error', 'warn', 'log'] });
 nest.useGlobalFilters(new Errors());
 nest.enableShutdownHooks();
 await nest.init();

 const web = next({ dev: !production, turbopack: false, dir: path.resolve(process.cwd(), 'apps/web'), hostname: '0.0.0.0', port });
 await web.prepare();
 webHandler = web.getRequestHandler();
 console.log('Agency OS fully ready at ' + process.env.APP_URL);

 const shutdown = async () => { listener.close(); await nest.close(); await web.close(); process.exit(0); };
 process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
bootstrap().catch(e=>{console.error(e.message);process.exit(1);});

