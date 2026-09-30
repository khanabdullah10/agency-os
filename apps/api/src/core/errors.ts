import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ZodError } from 'zod';
@Catch()
export class Errors implements ExceptionFilter {
 private logger=new Logger('API');
 catch(error:any,host:ArgumentsHost) {
  const response=host.switchToHttp().getResponse();
  if(error instanceof ZodError){response.status(400).json({message:error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '),code:'VALIDATION'});return;}
  if(error instanceof HttpException){response.status(error.getStatus()).json({message:error.message});return;}
  const prisma:Record<string,[number,string]>={
    P2002:[409,'A record with this value already exists.'],
    P2025:[404,'The requested record was not found.'],
    P2003:[400,'This record is linked to other records, or a selected reference is invalid.'],
    P2034:[409,'Another change is in progress. Refresh and try again.'],
    P2021:[503,'Database schema is synchronizing. Please refresh in a moment.'],
    P1001:[503,'Database server is temporarily unreachable. Please try again shortly.'],
    P1017:[503,'Database connection was closed. Please refresh in a moment.'],
    P2024:[503,'Database connection pool is busy. Please try again in a few seconds.']
  };
  if(prisma[error.code]){const [status,message]=prisma[error.code];response.status(status).json({message});return;}
  const msg = String(error?.message || '');
  if (msg.includes('Response from the Engine was empty') || msg.includes('Engine is not running')) {
    this.logger.warn(`Database engine connection reset [${error.code || 'NO_CODE'}]: ${msg}`);
    response.status(503).json({ message: 'Database connection was reset. Please refresh in a moment.' });
    return;
  }
  this.logger.error(`${error.name || 'Error'} [${error.code || 'NO_CODE'}]: ${error.message || error}`, error.stack);
  response.status(500).json({message:'Something went wrong. Please try again.'});
 }
}

