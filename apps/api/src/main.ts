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
 const origin=new URL(process.env.APP_URL).origin;
 const api=express();
 api.set('trust proxy',Number(process.env.TRUST_PROXY||0));
 api.use(cookieParser());
 api.use(express.json({limit:'10mb'}));
 api.use(express.urlencoded({extended:false,limit:'10mb'}));
 api.use((_req: any, res: any, next: any)=>{res.setHeader('Cache-Control','no-store');next();});
 api.use(rateLimit({windowMs:60000,limit:Number(process.env.RATE_LIMIT_MAX||360),standardHeaders:'draft-8',legacyHeaders:false}));
 api.use('/auth/login',rateLimit({windowMs:15*60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many sign-in attempts. Try again in 15 minutes.'}}));
  api.use((req: any, res: any, next: any) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.path !== '/jobs/run') {
      if (req.headers['sec-fetch-site'] === 'cross-site') {
        res.status(403).json({ message: 'Cross-site requests are forbidden.' });
        return;
      }
      const reqOrigin = req.headers.origin;
      if (reqOrigin) {
        try {
          const originUrl = new URL(reqOrigin);
          const hostHeader = (req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();
          const configuredHost = process.env.APP_URL ? new URL(process.env.APP_URL).hostname.toLowerCase() : '';

          const isAllowed =
            !hostHeader ||
            originUrl.hostname.toLowerCase() === hostHeader ||
            (configuredHost && originUrl.hostname.toLowerCase() === configuredHost) ||
            originUrl.hostname.toLowerCase().endsWith('mad0media.com') ||
            originUrl.hostname.toLowerCase().endsWith('hostingersite.com') ||
            originUrl.hostname === 'localhost' ||
            originUrl.hostname === '127.0.0.1';

          if (!isAllowed) {
            console.warn(`[Agency OS] Origin rejected: ${reqOrigin} (host: ${hostHeader}, configured: ${configuredHost})`);
            res.status(403).json({ message: 'Request origin could not be verified.' });
            return;
          }
        } catch (e) {
          res.status(403).json({ message: 'Invalid origin header.' });
          return;
        }
      }
    }
    next();
  });

  const rawPort = process.env.PORT || 3000;
  const portNum = (/^\d+$/.test(String(rawPort))) ? Number(rawPort) : 3000;
  const port = portNum;
  const host = process.env.BIND_HOST || '0.0.0.0';

  const nest = await NestFactory.create(AppModule, new ExpressAdapter(api), { bodyParser: false, logger: ['error', 'warn', 'log'] });
  nest.useGlobalFilters(new Errors());
  nest.enableShutdownHooks();
  await nest.init();

  const webCandidates = [
    path.resolve(process.cwd(), 'apps/web'),
    path.resolve(__dirname, '../../web'),
    path.resolve(__dirname, '../../../apps/web'),
    path.resolve(__dirname, '../web'),
    process.cwd(),
  ];
  const webDir = webCandidates.find((d) => {
    try {
      return require('node:fs').existsSync(path.resolve(d, '.next'));
    } catch {
      return false;
    }
  }) || path.resolve(process.cwd(), 'apps/web');

  const web = next({ dev: !production, turbopack: false, dir: webDir, hostname: '0.0.0.0', port: portNum });
  await web.prepare();

 const appRouter = express.Router();
 appRouter.use('/api', api);
 appRouter.use((req: any, res: any) => web.getRequestHandler()(req, res));

 if ((global as any).__AGENCY_OS_MOUNT__) {
  (global as any).__AGENCY_OS_MOUNT__(appRouter);
 } else {
  const standaloneServer = express();
  standaloneServer.disable('x-powered-by');
  standaloneServer.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
  standaloneServer.use(appRouter);
  const listener = standaloneServer.listen(port, host, () => console.log(`Agency OS listening on ${host}:${port}`));
  const shutdown = async () => { listener.close(); await nest.close(); await web.close(); process.exit(0); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
 }
 console.log('Agency OS fully ready at ' + process.env.APP_URL);
}
bootstrap().catch(e=>{console.error(e.message);process.exit(1);});

