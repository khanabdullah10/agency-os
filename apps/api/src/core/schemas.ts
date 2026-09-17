import { z } from 'zod';
import { actions, validateDriveUrl } from './workflow';
export const id = z.string().min(1).max(80);
export const text = z.string().trim().max(10000);
const short = z.string().trim().max(300);
export const date = z.string().datetime({ offset: true });
export const drive = z.string().max(2000).refine(validateDriveUrl, 'Use a valid HTTPS Google Drive or Google Docs URL.');
export function validateWebUrl(value: string) {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && !!u.hostname;
  } catch {
    return false;
  }
}
export const webUrl = z.string().trim().max(2000).transform(v => {
  if (!v) return '';
  if (!/^https?:\/\//i.test(v) && v.includes('.')) return 'https://' + v;
  return v;
}).refine(v => !v || validateWebUrl(v), 'Use a valid HTTP or HTTPS URL.');
export const rules = z.object({ smm:z.literal(true), admin:z.boolean(), superAdmin:z.boolean(), client:z.boolean() }).strict();
export const deadlineOffsets = z.object({script:z.number().int().min(0).max(365),clientScript:z.number().int().min(0).max(365),shoot:z.number().int().min(0).max(365),edit:z.number().int().min(0).max(365),internal:z.number().int().min(0).max(365),clientFinal:z.number().int().min(0).max(365),ready:z.number().int().min(0).max(365)}).strict();
export const assignments = z.object({smm:id,writer:id.optional(),designer:id.optional(),editor:id.optional(),videographer:id.optional()}).strict();
export const loginDto = z.object({email:z.string().email().max(254),password:z.string().min(1).max(128)}).strict();
export const userDto = z.object({ name:short.min(2),email:z.string().email().max(254),roleId:id,phone:short.optional(),whatsapp:short.optional(),whatsappOptIn:z.boolean().default(false),password:z.string().min(12).max(128),clientId:id.optional(),avatarUrl:z.string().max(7000000).optional().nullable() }).strict();
export const updateUserDto = userDto.omit({password:true,clientId:true}).partial().extend({active:z.boolean().optional(), permissions:z.array(z.object({key:id,allowed:z.boolean()}).strict()).max(100).optional()}).strict();
export const brandDto = z.object({colors:short.default(''),fonts:short.default(''),logoUrl:drive.or(z.literal('')).default(''),assetsUrl:drive.or(z.literal('')).default(''),audience:text.default(''),competitors:text.default(''),pillars:text.default(''),tone:text.default(''),dos:text.default(''),donts:text.default('')}).strict();
export const clientDto = z.object({
 name:short.min(2), industry:short.min(1),website:webUrl.or(z.literal('')).optional(),contactName:short.min(2),
 email:z.string().email(),phone:short.optional(),whatsapp:short.optional(),address:short.optional(),
 packageName:short.default('Custom'), deliverables:z.record(z.number().int().min(0).max(10000)),
 platforms:z.array(short).min(1).max(20),brand:brandDto,notes:text.optional(),
 approvalRules:rules,deadlineOffsets:deadlineOffsets,color:z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ea6b36'),
 avatarUrl:z.string().max(7000000).optional().nullable(),
 team:z.array(z.object({userId:id,responsibility:z.enum(['smm','writer','designer','editor','videographer','other'])}).strict()).max(50),
 socialAccounts:z.array(z.object({platform:short,handle:short,url:webUrl.or(z.literal('')).optional()}).strict()).max(30).default([]),
 login:z.object({name:short.min(2),email:z.string().email(),password:z.string().min(12).max(128),avatarUrl:z.string().max(7000000).optional().nullable()}).strict().optional()
}).strict();
export const clientUpdateDto=clientDto.omit({login:true}).partial().extend({active:z.boolean().optional()}).strict();
export const contentDto = z.object({ clientId:id,title:short.min(3),platform:short.min(1),type:short.min(1),pillar:short.optional(),publishAt:date,requiresShoot:z.boolean(),assignees:assignments,notes:text.optional(),deadlines:z.record(date).optional() }).strict();
export const contentUpdateDto = contentDto.omit({clientId:true}).partial().extend({revision:z.number().int().min(0)}).strict();
export const scriptDto = z.object({hook:text,body:z.string().max(100000),cta:text,caption:text,hashtags:text,references:z.array(drive).max(30),notes:text.optional(),revision:z.number().int().min(0)}).strict();
export const shootDto=z.object({scheduledAt:date,location:short.min(1),shotList:text.min(1),props:text.optional(),people:short.optional(),orientation:z.enum(['Portrait','Landscape','Square']),durationMinutes:z.number().int().min(1).max(1440),referenceUrl:drive.optional(),notes:text.optional()}).strict();
export const actionDto=z.object({action:z.enum(actions),revision:z.number().int().min(0),comment:text.optional(),timestampComments:z.array(z.object({timestamp:z.string().regex(/^\d{1,3}:\d{2}$/),comment:text.min(1)}).strict()).max(50).optional(),referenceUrls:z.array(drive).max(20).optional(),rawUrl:drive.optional(),publishedUrl:webUrl.optional(),externalPostId:short.optional(),scheduledAt:date.optional()}).strict();
export const versionDto=z.object({url:drive,notes:text.optional(),revision:z.number().int().min(0)}).strict();
export const taskDto=z.object({title:short.min(3),description:text.optional(),clientId:id,contentId:z.number().int().positive().optional(),assigneeId:id,priority:z.enum(['LOW','MEDIUM','HIGH','URGENT']),startsAt:date.optional(),dueAt:date,driveUrl:drive.optional()}).strict();
export const taskUpdateDto=z.object({status:z.enum(['TO_DO','ACCEPTED','IN_PROGRESS','FOR_REVIEW','CHANGES_REQUIRED','COMPLETED','ON_HOLD','CANCELLED']).optional(),assigneeId:id.optional(),dueAt:date.optional(),priority:z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional()}).strict();
export const commentDto=z.object({body:text.min(1),timestamp:short.optional(),referenceUrl:drive.optional(),clientVisible:z.boolean().default(false)}).strict();
export const driveDto=z.object({clientId:id,contentId:z.number().int().positive().optional(),taskId:id.optional(),revisionId:id.optional(),title:short.min(1),url:drive,category:short.min(1),clientVisible:z.boolean().default(false)}).strict();
export const threadDto=z.object({title:short.min(1),kind:z.enum(['DIRECT','GROUP','CLIENT_INTERNAL','CONTENT','TASK']),clientId:id.optional(),contentId:z.number().int().positive().optional(),taskId:id.optional(),memberIds:z.array(id).min(1).max(100)}).strict();
export const messageDto=z.object({body:z.string().trim().min(1).max(5000),replyToId:id.optional(),mentions:z.array(id).max(30).default([])}).strict();
export const metricsDto=z.object({date,reach:z.number().int().min(0),impressions:z.number().int().min(0),views:z.number().int().min(0),likes:z.number().int().min(0),comments:z.number().int().min(0),shares:z.number().int().min(0),saves:z.number().int().min(0),followerGrowth:z.number().int()}).strict();
export const reportDto=z.object({clientId:id,title:short.min(2),periodStart:date,periodEnd:date,summary:text,driveUrl:drive.optional(),clientVisible:z.boolean()}).strict().refine(v=>v.periodEnd>=v.periodStart,'End date must follow start date.');
export const preferenceDto=z.object({category:z.enum(['task','script','shoot','edit','approval','revision','content','chat']),email:z.boolean(),whatsapp:z.boolean(),inApp:z.boolean()}).strict();

