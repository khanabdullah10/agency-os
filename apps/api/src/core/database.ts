import { Global, Injectable, Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
 async onModuleInit() { await this.$connect(); }
 async onModuleDestroy() { await this.$disconnect(); }
 async atomic<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T> {
   for(let attempt=0; ; attempt++) {
     try { return await this.$transaction(fn,{ isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:20000 }); }
     catch(e:any) { if(e.code!=='P2034'||attempt>=2) throw e; }
   }
 }
}
@Global() @Module({providers:[Database],exports:[Database]})
export class DatabaseModule {}

