import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs:ClassValue[]) { return twMerge(clsx(inputs)); }
export const label=(s:string='')=>s.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export const initials=(s:string='')=>s.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
export const dateLabel=(d:string|Date,options?:Intl.DateTimeFormatOptions)=>new Date(d).toLocaleDateString('en-IN',options||{day:'numeric',month:'short'});
export const timeLabel=(d:string|Date)=>new Date(d).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
export const code=(id:number)=>'CNT-'+String(id).padStart(4,'0');
export const inputDate=(d:Date|string)=>{const v=new Date(d);return new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export const number=(n:number)=>Intl.NumberFormat('en-IN',{notation:n>=10000?'compact':'standard',maximumFractionDigits:1}).format(n||0);
export const statusTone=(s:string='')=>s.includes('CHANGES')||s==='OVERDUE'?'red':s.includes('REVIEW')?'amber':['READY_TO_PUBLISH','FINAL_CLIENT_APPROVED','PUBLISHED','COMPLETED','APPROVED'].includes(s)?'green':s.includes('SCRIPT')?'purple':['EDITING','IN_PROGRESS','SCHEDULED'].includes(s)?'blue':'neutral';

