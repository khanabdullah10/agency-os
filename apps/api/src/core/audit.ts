import { Prisma } from '@prisma/client';
import { Actor } from './types';
export async function audit(tx:Prisma.TransactionClient,a:Actor,action:string,entityType:string,entityId:string,data:{clientId?:string;contentId?:number;previous?:any;next?:any;clientVisible?:boolean}={}) {
 return tx.activityLog.create({data:{agencyId:a.agencyId,actorId:a.id,action,entityType,entityId,...data}});
}

